import { useEffect, useRef, useState } from 'react'
import { BrandHeader } from '../../components/BrandHeader'
import { MarbleRace, type FinishedTeam } from '../../components/MarbleRace'
import {
  drawPresentationOrder,
  getErrorMessage,
  listTeams,
  submitPresentationOrder,
} from '../../lib/api'
import type { TeamSummary } from '../../lib/types'

interface DrawSlot {
  rank: number
  teamName: string
  status: 'pending' | 'locked'
}

// If the marble race hasn't finished naturally by this point (track jam,
// browser hiccup, etc.), fall back to the instant shuffle so the page can
// never get stuck on stage.
const RACE_HARD_TIMEOUT_MS = 40000

function buildPendingSlots(count: number): DrawSlot[] {
  return Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    teamName: '',
    status: 'pending',
  }))
}

export function AdminDrawPage() {
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [teamsError, setTeamsError] = useState<string | null>(null)
  const [teams, setTeams] = useState<TeamSummary[]>([])

  const [hasDrawn, setHasDrawn] = useState(false)
  const [slots, setSlots] = useState<DrawSlot[]>([])
  const [racing, setRacing] = useState(false)
  const [raceGeneration, setRaceGeneration] = useState(0)
  const [saving, setSaving] = useState(false)
  const [drawError, setDrawError] = useState<string | null>(null)
  // Set once the physics race finishes but before submit_presentation_order
  // has successfully persisted it — lets a failed save be retried without
  // throwing away a real race result and re-running everything.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)

  const timeoutRef = useRef<number | undefined>(undefined)

  // list_teams() returns presentation_order directly (integer, nullable) —
  // a real field. All null = no draw has happened yet; all non-null =
  // drawn, and the array is already sorted in that order server-side.
  useEffect(() => {
    let cancelled = false
    listTeams()
      .then((rows) => {
        if (cancelled) return
        setTeams(rows)
        const drawn = rows.length > 0 && rows.every((team) => team.presentation_order !== null)
        setHasDrawn(drawn)
        setSlots(
          drawn
            ? rows.map((team, index) => ({ rank: index + 1, teamName: team.name, status: 'locked' }))
            : buildPendingSlots(rows.length),
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

  useEffect(() => {
    return () => {
      window.clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleStartDraw() {
    if (racing) return
    setDrawError(null)
    setPendingOrder(null)
    setSlots(buildPendingSlots(teams.length))
    setRaceGeneration((generation) => generation + 1)
    setRacing(true)

    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      fallbackToInstantDraw()
    }, RACE_HARD_TIMEOUT_MS)
  }

  function handleRedraw() {
    if (racing) return
    const confirmed = window.confirm(
      '정말 다시 추첨하시겠습니까? 기존 발표 순서가 사라지고 마블 레이스를 처음부터 다시 진행합니다.',
    )
    if (!confirmed) return
    handleStartDraw()
  }

  // Abandons the current race (if any) and falls back to the simple
  // instant-shuffle RPC, which decides AND persists the order in one call.
  // Used for both the skip button and the hard timeout.
  async function fallbackToInstantDraw() {
    window.clearTimeout(timeoutRef.current)
    setRacing(false)
    setDrawError(null)
    try {
      const result = await drawPresentationOrder()
      setSlots(
        result.map((row, index) => ({ rank: index + 1, teamName: row.team_name, status: 'locked' })),
      )
      setHasDrawn(true)
      setPendingOrder(null)
    } catch (err) {
      setDrawError(getErrorMessage(err))
    }
  }

  function handleSkip() {
    fallbackToInstantDraw()
  }

  function handleMarbleFinish(team: FinishedTeam, rank: number) {
    setSlots((previous) => {
      const next = [...previous]
      next[rank - 1] = { rank, teamName: team.name, status: 'locked' }
      return next
    })
  }

  async function handleRaceComplete(finalOrderTeamIds: string[]) {
    window.clearTimeout(timeoutRef.current)
    setRacing(false)
    setPendingOrder(finalOrderTeamIds)
    await persistOrder(finalOrderTeamIds)
  }

  async function persistOrder(teamIds: string[]) {
    setSaving(true)
    setDrawError(null)
    try {
      await submitPresentationOrder(teamIds)
      setHasDrawn(true)
      setPendingOrder(null)
    } catch (err) {
      setDrawError(
        `결과 저장에 실패했습니다: ${getErrorMessage(err)} — 방금 진행된 레이스 결과는 유지되어 있으니 다시 저장을 시도할 수 있습니다.`,
      )
    } finally {
      setSaving(false)
    }
  }

  function handleRetrySave() {
    if (pendingOrder) {
      persistOrder(pendingOrder)
    }
  }

  const raceTeams: FinishedTeam[] = teams.map((team) => ({ id: team.id, name: team.name }))

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
          <>
            <section className="panel">
              <div className="page-header-row">
                <h2>
                  {racing
                    ? '레이스 진행 중...'
                    : saving
                      ? '결과 저장 중...'
                      : hasDrawn
                        ? '추첨 완료'
                        : '추첨 대기 중'}
                </h2>
                <div className="page-header-row__actions">
                  {racing && (
                    <button type="button" onClick={handleSkip}>
                      건너뛰기
                    </button>
                  )}
                  {!racing && pendingOrder && (
                    <button type="button" onClick={handleRetrySave} disabled={saving}>
                      {saving ? '저장 중...' : '결과 저장 다시 시도'}
                    </button>
                  )}
                  {!racing && !pendingOrder && !hasDrawn && (
                    <button type="button" onClick={handleStartDraw} disabled={saving}>
                      발표 순서 추첨 시작
                    </button>
                  )}
                  {!racing && !pendingOrder && hasDrawn && (
                    <button type="button" onClick={handleRedraw} disabled={saving}>
                      다시 추첨
                    </button>
                  )}
                </div>
              </div>
              {drawError && <p className="error-text">{drawError}</p>}
              <p className="hint-text">
                구슬들이 실제 물리 시뮬레이션으로 경주하며, 도착한 순서가 그대로 발표 순서가 되어
                자동으로 저장됩니다. 너무 오래 걸리면 건너뛰기를 눌러 즉시 결과를 받을 수 있습니다.
              </p>

              {racing && raceTeams.length > 0 && (
                <MarbleRace
                  key={raceGeneration}
                  teams={raceTeams}
                  onMarbleFinish={handleMarbleFinish}
                  onComplete={handleRaceComplete}
                />
              )}
            </section>

            <section className="panel">
              <h2>발표 순서</h2>
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
          </>
        )}
      </div>
    </>
  )
}
