import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { BrandHeader } from '../../components/BrandHeader'
import { drawPresentationOrder, getErrorMessage, listTeams } from '../../lib/api'
import type { PresentationOrderDraw, TeamSummary } from '../../lib/types'

interface DrawSlot {
  rank: number
  teamId: string | null
  teamName: string
  status: 'pending' | 'cycling' | 'locked'
}

// list_teams() doesn't expose presentation_order as a field (it's only
// used server-side for ORDER BY), and there's no dedicated "has a draw
// happened yet" RPC — only the shuffling draw_presentation_order() itself,
// which we must NOT call just to check state. So: before any draw, the
// list comes back in plain alphabetical order (nulls last, name); after a
// real random shuffle among 15 teams, the odds of it coincidentally
// matching alphabetical order are effectively zero. If this heuristic is
// ever wrong, it can only be wrong in the safe direction — treating an
// undrawn list as "already drawn" (blocking on an extra confirm before the
// real first draw) — never the reverse, so it can't silently clobber a
// real result.
function looksAlreadyDrawn(teams: TeamSummary[]): boolean {
  const alphabetical = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return teams.some((team, index) => team.id !== alphabetical[index]?.id)
}

const TICKS_PER_SLOT = 11

function revealSlot(
  index: number,
  namePool: string[],
  finalRow: PresentationOrderDraw,
  setSlots: Dispatch<SetStateAction<DrawSlot[]>>,
): Promise<void> {
  return new Promise((resolve) => {
    let tick = 0

    function step() {
      const randomName = namePool[Math.floor(Math.random() * namePool.length)]
      setSlots((previous) => {
        const next = [...previous]
        next[index] = { ...next[index], teamName: randomName, status: 'cycling' }
        return next
      })
      tick += 1
      if (tick < TICKS_PER_SLOT) {
        // Gradually slow down each tick for a simple decelerating flicker.
        setTimeout(step, 60 + tick * 12)
      } else {
        setSlots((previous) => {
          const next = [...previous]
          next[index] = {
            rank: index + 1,
            teamId: finalRow.team_id,
            teamName: finalRow.team_name,
            status: 'locked',
          }
          return next
        })
        resolve()
      }
    }

    step()
  })
}

export function AdminDrawPage() {
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [teamsError, setTeamsError] = useState<string | null>(null)

  const [slots, setSlots] = useState<DrawSlot[]>([])
  const [hasDrawn, setHasDrawn] = useState(false)
  const [namePool, setNamePool] = useState<string[]>([])
  const [drawing, setDrawing] = useState(false)
  const [drawError, setDrawError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listTeams()
      .then((rows) => {
        if (cancelled) return
        setNamePool(rows.map((team) => team.name))
        const alreadyDrawn = looksAlreadyDrawn(rows)
        setHasDrawn(alreadyDrawn)
        setSlots(
          rows.map((team, index) => ({
            rank: index + 1,
            teamId: alreadyDrawn ? team.id : null,
            teamName: alreadyDrawn ? team.name : '',
            status: alreadyDrawn ? 'locked' : 'pending',
          })),
        )
      })
      .catch((err) => {
        if (!cancelled) setTeamsError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runDraw() {
    setDrawing(true)
    setDrawError(null)
    setSlots((previous) =>
      previous.map((slot) => ({ ...slot, status: 'pending', teamId: null, teamName: '' })),
    )
    try {
      const result = await drawPresentationOrder()
      const pool = result.map((row) => row.team_name)
      setNamePool(pool)
      for (let i = 0; i < result.length; i++) {
        await revealSlot(i, pool, result[i], setSlots)
      }
      setHasDrawn(true)
    } catch (err) {
      setDrawError(getErrorMessage(err))
    } finally {
      setDrawing(false)
    }
  }

  function handleStartDraw() {
    if (drawing) return
    runDraw()
  }

  function handleRedraw() {
    if (drawing) return
    const confirmed = window.confirm(
      '정말 다시 추첨하시겠습니까? 기존 발표 순서가 사라지고 새로운 순서로 바뀝니다.',
    )
    if (!confirmed) return
    runDraw()
  }

  return (
    <>
      <BrandHeader />
      <div className="page">
        <div className="page-header-row">
          <h1>발표 순서 추첨</h1>
        </div>
        <p className="page-subtitle">
          이 페이지는 관리자에게만 표시됩니다. 발표/투자 화면과는 별도이며, 행사장에 공개적으로
          띄워도 되는 화면입니다.
        </p>

        {teamsLoading && <p className="page-status">불러오는 중...</p>}
        {teamsError && (
          <p className="error-text">
            팀 목록을 불러오지 못했습니다: {teamsError}
            {teamsError.includes('forbidden') && (
              <> — 이 계정이 아직 관리자로 등록되지 않았을 수 있습니다.</>
            )}
          </p>
        )}

        {!teamsLoading && !teamsError && (
          <section className="panel">
            <div className="page-header-row">
              <h2>{hasDrawn ? '발표 순서' : '추첨 대기 중'}</h2>
              {!hasDrawn && (
                <button type="button" onClick={handleStartDraw} disabled={drawing}>
                  {drawing ? '추첨 중...' : '발표 순서 추첨 시작'}
                </button>
              )}
              {hasDrawn && (
                <button type="button" onClick={handleRedraw} disabled={drawing}>
                  {drawing ? '추첨 중...' : '다시 추첨'}
                </button>
              )}
            </div>
            {drawError && <p className="error-text">{drawError}</p>}
            {namePool.length === 0 && <p className="hint-text">등록된 팀이 없습니다.</p>}

            <div className="row-list">
              {slots.map((slot) => (
                <div key={slot.rank} className={`draw-slot draw-slot--${slot.status}`}>
                  <span className="draw-slot__rank">{slot.rank}</span>
                  <span className="draw-slot__name">
                    {slot.status === 'pending' ? '—' : slot.teamName}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
