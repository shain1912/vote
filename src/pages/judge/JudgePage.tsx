import { useEffect, useState, type FormEvent } from 'react'
import { PresentationLink } from '../../components/PresentationLink'
import {
  getErrorMessage,
  getMyScores,
  listTeams,
  startAsJudge,
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

// Kept only for this browser tab's session, so a page refresh resumes
// without retyping the passphrase again.
const SESSION_KEY = 'makerthon:judge-identity'

interface FieldStatus {
  state: 'idle' | 'saving' | 'saved' | 'error'
  message?: string
}

const IDLE_STATUS: FieldStatus = { state: 'idle' }

function loadStoredIdentity(): JudgeIdentity | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as JudgeIdentity) : null
  } catch {
    return null
  }
}

function storeIdentity(identity: JudgeIdentity | null) {
  try {
    if (identity) sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // sessionStorage can be unavailable in some environments — not fatal.
  }
}

export function JudgePage() {
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [teamsError, setTeamsError] = useState<string | null>(null)

  const [judge, setJudge] = useState<JudgeIdentity | null>(() => loadStoredIdentity())

  // Entry form (name + shared passphrase)
  const [nameInput, setNameInput] = useState('')
  const [passphraseInput, setPassphraseInput] = useState('')
  const [entryStatus, setEntryStatus] = useState<FieldStatus>(IDLE_STATUS)

  // Scoring state (once identified)
  const [scores, setScores] = useState<ScoreInputs>({})
  const [rowStatus, setRowStatus] = useState<Record<string, FieldStatus>>({})
  const [scoresLoading, setScoresLoading] = useState(false)
  const [scoresError, setScoresError] = useState<string | null>(null)

  // Load all 15 teams once.
  useEffect(() => {
    let cancelled = false
    listTeams()
      .then((rows) => {
        if (!cancelled) setTeams(rows)
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

  // Once identified, load this judge's existing scores.
  useEffect(() => {
    if (!judge) return
    let cancelled = false
    setScoresLoading(true)
    setScoresError(null)
    getMyScores(judge.judge_id)
      .then((rows) => {
        if (cancelled) return
        setScores(
          Object.fromEntries(
            rows.map((row) => [
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
      })
      .catch((err) => {
        if (!cancelled) setScoresError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setScoresLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [judge])

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = nameInput.trim()
    if (!trimmedName) {
      setEntryStatus({ state: 'error', message: '이름을 입력해주세요.' })
      return
    }
    if (!passphraseInput) {
      setEntryStatus({ state: 'error', message: '암호를 입력해주세요.' })
      return
    }

    setEntryStatus({ state: 'saving' })
    try {
      const identity = await startAsJudge(trimmedName, passphraseInput)
      storeIdentity(identity)
      setJudge(identity)
      setEntryStatus(IDLE_STATUS)
    } catch (err) {
      setEntryStatus({ state: 'error', message: getErrorMessage(err) })
    }
  }

  function handleSwitchUser() {
    storeIdentity(null)
    setJudge(null)
    setScores({})
    setRowStatus({})
    setNameInput('')
    setPassphraseInput('')
  }

  function handleScoreChange(teamId: string, criteriaKey: CriteriaKey, value: string) {
    setScores((previous) => ({
      ...previous,
      [teamId]: { ...previous[teamId], [criteriaKey]: value },
    }))
    setRowStatus((previous) => ({ ...previous, [teamId]: IDLE_STATUS }))
  }

  async function handleSaveScore(teamId: string) {
    if (!judge) return

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
      await submitJudgeScore(judge.judge_id, teamId, {
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

  if (teamsLoading) {
    return <p className="page-status">불러오는 중...</p>
  }

  if (teamsError) {
    return (
      <div className="page">
        <h1>오류</h1>
        <p className="error-text">{teamsError}</p>
      </div>
    )
  }

  if (!judge) {
    return (
      <div className="page page--narrow">
        <h1>심사위원으로 시작하기</h1>
        <p className="hint-text">이름과 공유받은 암호를 입력하세요.</p>
        <form onSubmit={handleStart} className="stacked-form">
          <label htmlFor="judge-name">이름</label>
          <input
            id="judge-name"
            type="text"
            value={nameInput}
            onChange={(event) => {
              setNameInput(event.target.value)
              setEntryStatus(IDLE_STATUS)
            }}
          />

          <label htmlFor="judge-passphrase">암호</label>
          <input
            id="judge-passphrase"
            type="password"
            value={passphraseInput}
            onChange={(event) => {
              setPassphraseInput(event.target.value)
              setEntryStatus(IDLE_STATUS)
            }}
          />

          <button type="submit" disabled={entryStatus.state === 'saving'}>
            {entryStatus.state === 'saving' ? '확인 중...' : '시작'}
          </button>
          {entryStatus.state === 'error' && <p className="error-text">{entryStatus.message}</p>}
        </form>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <h1>심사위원 채점 — {judge.judge_name}</h1>
        <button type="button" onClick={handleSwitchUser}>
          다른 사람으로 전환
        </button>
      </div>
      <p className="hint-text">각 팀별로 4개 항목을 입력한 뒤 저장 버튼을 눌러주세요. (총 100점)</p>

      {scoresError && <p className="error-text">채점 내역을 불러오지 못했습니다: {scoresError}</p>}
      {scoresLoading && <p className="page-status">채점 내역 불러오는 중...</p>}

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
