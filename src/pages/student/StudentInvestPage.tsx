import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BrandHeader } from '../../components/BrandHeader'
import { PresentationLink } from '../../components/PresentationLink'
import {
  getErrorMessage,
  getMyInvestments,
  listTeams,
  startAsStudent,
  submitInvestment,
  submitPresentationUrl,
} from '../../lib/api'
import type { StudentIdentity, TeamSummary } from '../../lib/types'

// Fixed per-student budget for this event (confirmed, not a placeholder).
const PERSONAL_BUDGET = 10000

// Kept only for this browser tab's session, so a page refresh resumes
// without retyping — not a login credential (there is no per-person
// link/code anymore). start_as_student would happily resume the same
// person again anyway if this were lost, as long as they pick the same
// team + type the same name.
const SESSION_KEY = 'makerthon:student-identity'

interface FieldStatus {
  state: 'idle' | 'saving' | 'saved' | 'error'
  message?: string
}

const IDLE_STATUS: FieldStatus = { state: 'idle' }

function loadStoredIdentity(): StudentIdentity | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StudentIdentity) : null
  } catch {
    return null
  }
}

function storeIdentity(identity: StudentIdentity | null) {
  try {
    if (identity) sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // sessionStorage can be unavailable in some environments — not fatal.
  }
}

export function StudentInvestPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [teamsError, setTeamsError] = useState<string | null>(null)

  const [student, setStudent] = useState<StudentIdentity | null>(() => loadStoredIdentity())

  // Entry form (team + name)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [entryStatus, setEntryStatus] = useState<FieldStatus>(IDLE_STATUS)

  // Investment state (once identified)
  const [committedAmounts, setCommittedAmounts] = useState<Record<string, number>>({})
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({})
  const [rowStatus, setRowStatus] = useState<Record<string, FieldStatus>>({})
  const [investmentsLoading, setInvestmentsLoading] = useState(false)
  const [investmentsError, setInvestmentsError] = useState<string | null>(null)

  const [presentationUrlInput, setPresentationUrlInput] = useState('')
  const [presentationStatus, setPresentationStatus] = useState<FieldStatus>(IDLE_STATUS)
  const presentationInitialized = useRef(false)

  // Load all 15 teams once — needed for both the entry <select> and the invest list.
  useEffect(() => {
    let cancelled = false
    listTeams()
      .then((rows) => {
        if (cancelled) return
        setTeams(rows)
        setSelectedTeamId((previous) => previous || rows[0]?.id || '')
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

  // Once identified, load this student's existing investments.
  useEffect(() => {
    if (!student) return
    let cancelled = false
    setInvestmentsLoading(true)
    setInvestmentsError(null)
    getMyInvestments(student.student_id)
      .then((rows) => {
        if (cancelled) return
        setCommittedAmounts(Object.fromEntries(rows.map((row) => [row.team_id, row.amount])))
      })
      .catch((err) => {
        if (!cancelled) setInvestmentsError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setInvestmentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [student])

  // Prefill the presentation-url input once, from the student's own team.
  useEffect(() => {
    if (!student || presentationInitialized.current) return
    const myTeam = teams.find((team) => team.id === student.team_id)
    if (!myTeam) return
    setPresentationUrlInput(myTeam.presentation_url ?? '')
    presentationInitialized.current = true
  }, [teams, student])

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = nameInput.trim()
    if (!trimmedName) {
      setEntryStatus({ state: 'error', message: '이름을 입력해주세요.' })
      return
    }
    if (!selectedTeamId) {
      setEntryStatus({ state: 'error', message: '팀을 선택해주세요.' })
      return
    }

    setEntryStatus({ state: 'saving' })
    try {
      const identity = await startAsStudent(selectedTeamId, trimmedName)
      storeIdentity(identity)
      setStudent(identity)
      setEntryStatus(IDLE_STATUS)
    } catch (err) {
      setEntryStatus({ state: 'error', message: getErrorMessage(err) })
    }
  }

  function handleSwitchUser() {
    storeIdentity(null)
    setStudent(null)
    setCommittedAmounts({})
    setDraftAmounts({})
    setRowStatus({})
    setPresentationUrlInput('')
    setNameInput('')
    presentationInitialized.current = false
  }

  const remainingBudget =
    PERSONAL_BUDGET - Object.values(committedAmounts).reduce((sum, amount) => sum + amount, 0)

  function handleAmountChange(teamId: string, value: string) {
    setDraftAmounts((previous) => ({ ...previous, [teamId]: value }))
    setRowStatus((previous) => ({ ...previous, [teamId]: IDLE_STATUS }))
  }

  async function handleSaveInvestment(teamId: string) {
    if (!student) return

    const raw = draftAmounts[teamId] ?? '0'
    const amount = Number(raw)
    if (!Number.isInteger(amount) || amount < 0) {
      setRowStatus((previous) => ({
        ...previous,
        [teamId]: { state: 'error', message: '0 이상의 정수를 입력하세요.' },
      }))
      return
    }

    setRowStatus((previous) => ({ ...previous, [teamId]: { state: 'saving' } }))
    try {
      await submitInvestment(student.student_id, teamId, amount)
      setCommittedAmounts((previous) => ({ ...previous, [teamId]: amount }))
      setRowStatus((previous) => ({ ...previous, [teamId]: { state: 'saved' } }))
    } catch (err) {
      setRowStatus((previous) => ({
        ...previous,
        [teamId]: { state: 'error', message: getErrorMessage(err) },
      }))
    }
  }

  async function handleSubmitPresentation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!student) return

    setPresentationStatus({ state: 'saving' })
    try {
      await submitPresentationUrl(student.student_id, presentationUrlInput)
      setTeams((previous) =>
        previous.map((team) =>
          team.id === student.team_id ? { ...team, presentation_url: presentationUrlInput } : team,
        ),
      )
      setPresentationStatus({ state: 'saved' })
    } catch (err) {
      setPresentationStatus({ state: 'error', message: getErrorMessage(err) })
    }
  }

  if (teamsLoading) {
    return (
      <>
        <BrandHeader />
        <p className="page-status">불러오는 중...</p>
      </>
    )
  }

  if (teamsError) {
    return (
      <>
        <BrandHeader />
        <div className="page">
          <h1>오류</h1>
          <p className="error-text">{teamsError}</p>
        </div>
      </>
    )
  }

  if (!student) {
    return (
      <>
        <BrandHeader />
        <div className="centered-stage">
          <div className="entry-card">
            <h1>학생으로 시작하기</h1>
            <p className="hint-text">
              소속 팀과 이름을 입력하고 시작하세요. 이후 같은 팀 + 같은 이름으로 다시 들어오면 기존
              투자 내역이 그대로 이어집니다.
            </p>
            <form onSubmit={handleStart} className="stacked-form">
              <label htmlFor="student-team">소속 팀</label>
              <select
                id="student-team"
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>

              <label htmlFor="student-name">이름</label>
              <input
                id="student-name"
                type="text"
                value={nameInput}
                onChange={(event) => {
                  setNameInput(event.target.value)
                  setEntryStatus(IDLE_STATUS)
                }}
              />

              <button type="submit" disabled={entryStatus.state === 'saving'}>
                {entryStatus.state === 'saving' ? '확인 중...' : '시작'}
              </button>
              {entryStatus.state === 'error' && <p className="error-text">{entryStatus.message}</p>}
            </form>
          </div>
        </div>
      </>
    )
  }

  const myTeam = teams.find((team) => team.id === student.team_id)
  const investableTeams = teams.filter((team) => team.id !== student.team_id)

  return (
    <>
      <BrandHeader />
      <div className="page">
        <div className="page-header-row">
          <h1>{student.student_name}</h1>
          <button type="button" onClick={handleSwitchUser}>
            다른 사람으로 전환
          </button>
        </div>
        <p className="page-subtitle">소속 팀: {student.team_name}</p>

        {investmentsError && (
          <p className="error-text">투자 내역을 불러오지 못했습니다: {investmentsError}</p>
        )}
        {investmentsLoading && <p className="page-status">투자 내역 불러오는 중...</p>}

        <section className="panel">
          <h2>나의 투자 예산</h2>
          <p className="budget-amount">
            {remainingBudget.toLocaleString()} / {PERSONAL_BUDGET.toLocaleString()}
          </p>
          <p className="hint-text">남은 예산 / 전체 예산 (포인트)</p>
        </section>

        <section className="panel">
          <h2>우리 팀 발표자료 제출</h2>
          <p className="hint-text">
            다른 팀 학생과 심사위원이 확인할 수 있는 우리 팀({myTeam?.name ?? student.team_name})의
            발표자료 링크를 등록하세요. 팀원 누구나 제출/수정할 수 있습니다.
          </p>
          <form onSubmit={handleSubmitPresentation} className="stacked-form">
            <label htmlFor="presentation-url">발표자료 링크</label>
            <input
              id="presentation-url"
              type="url"
              placeholder="https://..."
              value={presentationUrlInput}
              onChange={(event) => {
                setPresentationUrlInput(event.target.value)
                setPresentationStatus(IDLE_STATUS)
              }}
            />
            <button type="submit" disabled={presentationStatus.state === 'saving'}>
              {presentationStatus.state === 'saving' ? '저장 중...' : '발표자료 링크 저장'}
            </button>
            {presentationStatus.state === 'saved' && <p className="hint-text">저장되었습니다.</p>}
            {presentationStatus.state === 'error' && (
              <p className="error-text">{presentationStatus.message}</p>
            )}
          </form>
        </section>

        <section className="panel">
          <h2>다른 팀에 투자하기</h2>
          <p className="hint-text">
            본인 팀({myTeam?.name ?? student.team_name})은 투자 대상 목록에서 제외됩니다. 팀별로 저장
            버튼을 눌러야 반영됩니다.
          </p>
          <div className="row-list">
            {investableTeams.map((team) => {
              const status = rowStatus[team.id] ?? IDLE_STATUS
              return (
                <div className="row-item" key={team.id}>
                  <div className="row-item__main">
                    <div className="row-item__info">
                      <span className="row-item__title">{team.name}</span>
                      <PresentationLink url={team.presentation_url} />
                    </div>
                    <div className="row-item__action">
                      <div className="amount-field">
                        <label htmlFor={`amount-${team.id}`} className="amount-field__label">
                          투자 금액
                        </label>
                        <input
                          id={`amount-${team.id}`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={draftAmounts[team.id] ?? String(committedAmounts[team.id] ?? 0)}
                          onChange={(event) => handleAmountChange(team.id, event.target.value)}
                          aria-label={`${team.name}에 투자할 금액`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveInvestment(team.id)}
                        disabled={status.state === 'saving'}
                      >
                        {status.state === 'saving' ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                  {status.state === 'saved' && (
                    <div className="row-item__feedback hint-text">저장됨</div>
                  )}
                  {status.state === 'error' && (
                    <div className="row-item__feedback error-text">{status.message}</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </>
  )
}
