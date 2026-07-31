import { useEffect, useState } from 'react'
import { BrandHeader } from '../../components/BrandHeader'
import { PresentationLink } from '../../components/PresentationLink'
import { StudentEntryScreen } from '../../components/StudentEntryScreen'
import { getErrorMessage, getMyInvestments, submitInvestment } from '../../lib/api'
import { IDLE_STATUS, useStudentSession } from '../../lib/useStudentSession'
import type { TeamSummary } from '../../lib/types'

// Fixed per-student budget for this event (confirmed, not a placeholder).
const PERSONAL_BUDGET = 10000

interface SubmitFailure {
  teamName: string
  message: string
}

interface SubmitSummary {
  state: 'idle' | 'submitting' | 'done'
  succeeded: number
  failed: SubmitFailure[]
}

const IDLE_SUMMARY: SubmitSummary = { state: 'idle', succeeded: 0, failed: [] }

export function StudentInvestPage() {
  const {
    teams,
    teamsLoading,
    teamsError,
    student,
    selectedTeamId,
    setSelectedTeamId,
    nameInput,
    setNameInput,
    entryStatus,
    setEntryStatus,
    handleStart,
    handleSwitchUser: switchUser,
  } = useStudentSession()

  // Investment state (once identified)
  const [committedAmounts, setCommittedAmounts] = useState<Record<string, number>>({})
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({})
  const [submitSummary, setSubmitSummary] = useState<SubmitSummary>(IDLE_SUMMARY)
  const [investmentsLoading, setInvestmentsLoading] = useState(false)
  const [investmentsError, setInvestmentsError] = useState<string | null>(null)

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

  function handleSwitchUser() {
    switchUser()
    setCommittedAmounts({})
    setDraftAmounts({})
    setSubmitSummary(IDLE_SUMMARY)
  }

  const remainingBudget =
    PERSONAL_BUDGET - Object.values(committedAmounts).reduce((sum, amount) => sum + amount, 0)

  function handleAmountChange(teamId: string, value: string) {
    setDraftAmounts((previous) => ({ ...previous, [teamId]: value }))
    setSubmitSummary(IDLE_SUMMARY)
  }

  // One button submits every row at once instead of a per-row save: loop
  // over each investable team with a non-zero amount (or an amount that
  // changed from what's already saved) and call submit_investment for it.
  // Still N sequential RPC calls under the hood — this is purely about it
  // being one user action, not a concurrency fix (each student's own rows
  // never conflict with anyone else's).
  async function handleSubmitAll() {
    if (!student) return

    const toSubmit = investableTeams
      .map((team) => {
        const committed = committedAmounts[team.id] ?? 0
        const raw = draftAmounts[team.id]
        if (raw === undefined) {
          return committed !== 0 ? { team, amount: committed } : null
        }
        const amount = Number(raw)
        if (!Number.isInteger(amount) || amount < 0) {
          return { team, amount: Number.NaN }
        }
        if (amount === 0 && committed === 0) return null
        return { team, amount }
      })
      .filter((entry): entry is { team: TeamSummary; amount: number } => entry !== null)

    if (toSubmit.length === 0) {
      setSubmitSummary({ state: 'done', succeeded: 0, failed: [] })
      return
    }

    setSubmitSummary({ state: 'submitting', succeeded: 0, failed: [] })

    let succeeded = 0
    const failed: SubmitFailure[] = []

    for (const { team, amount } of toSubmit) {
      if (Number.isNaN(amount)) {
        failed.push({ teamName: team.name, message: '0 이상의 정수를 입력하세요.' })
        continue
      }
      try {
        await submitInvestment(student.student_id, team.id, amount)
        setCommittedAmounts((previous) => ({ ...previous, [team.id]: amount }))
        succeeded += 1
      } catch (err) {
        failed.push({ teamName: team.name, message: getErrorMessage(err) })
      }
    }

    setSubmitSummary({ state: 'done', succeeded, failed })
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
      <StudentEntryScreen
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setSelectedTeamId}
        nameInput={nameInput}
        onNameChange={(name) => {
          setNameInput(name)
          setEntryStatus(IDLE_STATUS)
        }}
        entryStatus={entryStatus}
        onSubmit={handleStart}
      />
    )
  }

  const myTeam = teams.find((team) => team.id === student.team_id)
  const investableTeams = teams.filter((team) => team.id !== student.team_id)

  // Live running total across whatever's currently typed in every row
  // (saved or not) — recalculated on every keystroke, unlike
  // remainingBudget above which only reflects the last successful submit.
  // This is what the student should be watching while filling the form in.
  const draftTotal = investableTeams.reduce((sum, team) => {
    const raw = draftAmounts[team.id]
    const amount = raw === undefined ? (committedAmounts[team.id] ?? 0) : Number(raw)
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)
  const draftRemaining = PERSONAL_BUDGET - draftTotal
  const isOverBudget = draftRemaining < 0

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

        <section className="panel panel--sticky-budget">
          <h2>입력 중인 투자 합계 (실시간)</h2>
          <p className={`budget-amount${isOverBudget ? ' budget-amount--over' : ''}`}>
            {draftTotal.toLocaleString()} / {PERSONAL_BUDGET.toLocaleString()}
          </p>
          <p className={isOverBudget ? 'error-text' : 'hint-text'}>
            남은 예산: {draftRemaining.toLocaleString()} — 아직 저장하지 않은 입력값까지 포함한
            실시간 합계입니다.
          </p>
        </section>

        <section className="panel">
          <h2>나의 투자 예산</h2>
          <p className="budget-amount">
            {remainingBudget.toLocaleString()} / {PERSONAL_BUDGET.toLocaleString()}
          </p>
          <p className="hint-text">남은 예산 / 전체 예산 (포인트) · 마지막으로 저장된 금액 기준</p>
        </section>

        <section className="panel">
          <h2>다른 팀에 투자하기</h2>
          <p className="hint-text">
            본인 팀({myTeam?.name ?? student.team_name})은 투자 대상 목록에서 제외됩니다. 원하는 만큼
            금액을 입력한 뒤, 맨 아래 제출 버튼을 한 번 눌러야 모두 반영됩니다.
          </p>
          <div className="row-list">
            {investableTeams.map((team) => (
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
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSubmitAll}
            disabled={submitSummary.state === 'submitting'}
          >
            {submitSummary.state === 'submitting' ? '제출 중...' : '제출'}
          </button>

          {submitSummary.state === 'done' && submitSummary.failed.length === 0 && (
            <p className="hint-text">{submitSummary.succeeded}개 팀 투자 저장 완료</p>
          )}
          {submitSummary.state === 'done' && submitSummary.failed.length > 0 && (
            <>
              <p className="error-text">
                {submitSummary.succeeded}개 팀 저장 완료, {submitSummary.failed.length}개 팀 저장
                실패:
              </p>
              {submitSummary.failed.map((entry) => (
                <p className="error-text" key={entry.teamName}>
                  {entry.teamName}: {entry.message}
                </p>
              ))}
            </>
          )}
        </section>
      </div>
    </>
  )
}
