import { useEffect, useState } from 'react'
import { BrandHeader } from '../../components/BrandHeader'
import { PresentationLink } from '../../components/PresentationLink'
import { StudentEntryScreen } from '../../components/StudentEntryScreen'
import { getErrorMessage, getMyInvestments, submitInvestment } from '../../lib/api'
import { IDLE_STATUS, useStudentSession, type FieldStatus } from '../../lib/useStudentSession'

// Fixed per-student budget for this event (confirmed, not a placeholder).
const PERSONAL_BUDGET = 10000

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
  const [rowStatus, setRowStatus] = useState<Record<string, FieldStatus>>({})
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
    setRowStatus({})
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
