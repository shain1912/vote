import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PresentationLink } from '../../components/PresentationLink'
import {
  getErrorMessage,
  getJudgeByCode,
  getMyScores,
  listTeams,
  submitJudgeScore,
} from '../../lib/api'
import type { JudgeIdentity, TeamSummary } from '../../lib/types'

// The real, finalized rubric: 4 criteria totaling 100 points.
const CRITERIA = [
  { key: 'problem_impact', label: '문제정의/임팩트', max: 30 },
  { key: 'technical_completeness', label: '기술완성도', max: 30 },
  { key: 'feasibility_scalability', label: '실현가능성/확장성', max: 25 },
  { key: 'ux_presentation', label: 'UX/발표', max: 15 },
] as const

type CriteriaKey = (typeof CRITERIA)[number]['key']
type ScoreInputs = Record<string, Partial<Record<CriteriaKey, string>>>

interface FieldStatus {
  state: 'idle' | 'saving' | 'saved' | 'error'
  message?: string
}

const IDLE_STATUS: FieldStatus = { state: 'idle' }

export function JudgePage() {
  const { code } = useParams<{ code: string }>()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [judge, setJudge] = useState<JudgeIdentity | null>(null)
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [scores, setScores] = useState<ScoreInputs>({})
  const [rowStatus, setRowStatus] = useState<Record<string, FieldStatus>>({})

  useEffect(() => {
    if (!code) {
      setLoadError('잘못된 링크입니다.')
      setLoading(false)
      return
    }

    let cancelled = false

    async function load(accessCode: string) {
      setLoading(true)
      setLoadError(null)
      try {
        const judgeRows = await getJudgeByCode(accessCode)
        if (cancelled) return

        if (judgeRows.length === 0) {
          setJudge(null)
          return
        }

        const [teamList, existingScores] = await Promise.all([
          listTeams(),
          getMyScores(accessCode),
        ])
        if (cancelled) return

        setJudge(judgeRows[0])
        setTeams(teamList)
        setScores(
          Object.fromEntries(
            existingScores.map((row) => [
              row.team_id,
              {
                problem_impact: String(row.problem_impact),
                technical_completeness: String(row.technical_completeness),
                feasibility_scalability: String(row.feasibility_scalability),
                ux_presentation: String(row.ux_presentation),
              },
            ]),
          ),
        )
      } catch (err) {
        if (!cancelled) setLoadError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load(code)
    return () => {
      cancelled = true
    }
  }, [code])

  function handleScoreChange(teamId: string, criteriaKey: CriteriaKey, value: string) {
    setScores((previous) => ({
      ...previous,
      [teamId]: { ...previous[teamId], [criteriaKey]: value },
    }))
    setRowStatus((previous) => ({ ...previous, [teamId]: IDLE_STATUS }))
  }

  async function handleSaveScore(teamId: string) {
    if (!code) return

    const values: Record<CriteriaKey, number> = {} as Record<CriteriaKey, number>
    for (const criteria of CRITERIA) {
      const raw = scores[teamId]?.[criteria.key] ?? ''
      const n = Number(raw)
      if (raw === '' || !Number.isInteger(n) || n < 0 || n > criteria.max) {
        setRowStatus((previous) => ({
          ...previous,
          [teamId]: {
            state: 'error',
            message: `${criteria.label}은(는) 0~${criteria.max} 사이의 정수로 입력하세요.`,
          },
        }))
        return
      }
      values[criteria.key] = n
    }

    setRowStatus((previous) => ({ ...previous, [teamId]: { state: 'saving' } }))
    try {
      await submitJudgeScore(code, teamId, {
        problemImpact: values.problem_impact,
        technicalCompleteness: values.technical_completeness,
        feasibilityScalability: values.feasibility_scalability,
        uxPresentation: values.ux_presentation,
      })
      setRowStatus((previous) => ({ ...previous, [teamId]: { state: 'saved' } }))
    } catch (err) {
      setRowStatus((previous) => ({
        ...previous,
        [teamId]: { state: 'error', message: getErrorMessage(err) },
      }))
    }
  }

  if (loading) {
    return <p className="page-status">불러오는 중...</p>
  }

  if (loadError) {
    return (
      <div className="page">
        <h1>오류</h1>
        <p className="error-text">{loadError}</p>
      </div>
    )
  }

  if (!judge) {
    return (
      <div className="page">
        <h1>유효하지 않은 링크</h1>
        <p>이 링크는 더 이상 유효하지 않습니다. 담당자에게 새 링크를 요청하세요.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>심사위원 채점 — {judge.judge_name}</h1>
      <p className="hint-text">각 팀별로 4개 항목을 입력한 뒤 저장 버튼을 눌러주세요. (총 100점)</p>

      {teams.map((team) => {
        const status = rowStatus[team.id] ?? IDLE_STATUS
        const teamScores = scores[team.id] ?? {}
        const total = CRITERIA.reduce((sum, criteria) => {
          const n = Number(teamScores[criteria.key])
          return sum + (Number.isFinite(n) ? n : 0)
        }, 0)

        return (
          <section className="panel" key={team.id}>
            <h2>{team.name}</h2>
            <p>
              <PresentationLink url={team.presentation_url} />
            </p>
            <div className="criteria-grid">
              {CRITERIA.map((criteria) => (
                <label key={criteria.key} className="criteria-field">
                  {criteria.label} (0~{criteria.max})
                  <input
                    type="number"
                    min={0}
                    max={criteria.max}
                    inputMode="numeric"
                    value={teamScores[criteria.key] ?? ''}
                    onChange={(event) => handleScoreChange(team.id, criteria.key, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <p className="hint-text">현재 합계: {total} / 100</p>
            <button
              type="button"
              onClick={() => handleSaveScore(team.id)}
              disabled={status.state === 'saving'}
            >
              {status.state === 'saving' ? '저장 중...' : '채점 저장'}
            </button>
            {status.state === 'saved' && <p className="hint-text">저장되었습니다.</p>}
            {status.state === 'error' && <p className="error-text">{status.message}</p>}
          </section>
        )
      })}
    </div>
  )
}
