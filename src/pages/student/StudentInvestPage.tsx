import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { PresentationLink } from '../../components/PresentationLink'
import {
  getErrorMessage,
  getMyInvestments,
  getStudentByCode,
  listTeams,
  submitInvestment,
  submitPresentationUrl,
} from '../../lib/api'
import type { StudentIdentity, TeamSummary } from '../../lib/types'

// Fixed per-student budget for this event (confirmed, not a placeholder).
const PERSONAL_BUDGET = 10000

interface FieldStatus {
  state: 'idle' | 'saving' | 'saved' | 'error'
  message?: string
}

const IDLE_STATUS: FieldStatus = { state: 'idle' }

export function StudentInvestPage() {
  const { code } = useParams<{ code: string }>()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [student, setStudent] = useState<StudentIdentity | null>(null)
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [committedAmounts, setCommittedAmounts] = useState<Record<string, number>>({})
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({})
  const [rowStatus, setRowStatus] = useState<Record<string, FieldStatus>>({})

  const [presentationUrlInput, setPresentationUrlInput] = useState('')
  const [presentationStatus, setPresentationStatus] = useState<FieldStatus>(IDLE_STATUS)

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
        const studentRows = await getStudentByCode(accessCode)
        if (cancelled) return

        if (studentRows.length === 0) {
          setStudent(null)
          return
        }
        const me = studentRows[0]

        const [teamList, investments] = await Promise.all([
          listTeams(),
          getMyInvestments(accessCode),
        ])
        if (cancelled) return

        const committed = Object.fromEntries(investments.map((row) => [row.team_id, row.amount]))
        const otherTeamIds = teamList.filter((team) => team.id !== me.team_id).map((team) => team.id)

        setStudent(me)
        setTeams(teamList)
        setCommittedAmounts(committed)
        setDraftAmounts(
          Object.fromEntries(otherTeamIds.map((teamId) => [teamId, String(committed[teamId] ?? 0)])),
        )

        const myTeam = teamList.find((team) => team.id === me.team_id)
        setPresentationUrlInput(myTeam?.presentation_url ?? '')
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

  const remainingBudget =
    PERSONAL_BUDGET - Object.values(committedAmounts).reduce((sum, amount) => sum + amount, 0)

  function handleAmountChange(teamId: string, value: string) {
    setDraftAmounts((previous) => ({ ...previous, [teamId]: value }))
    setRowStatus((previous) => ({ ...previous, [teamId]: IDLE_STATUS }))
  }

  async function handleSaveInvestment(teamId: string) {
    if (!code) return

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
      await submitInvestment(code, teamId, amount)
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
    if (!code || !student) return

    setPresentationStatus({ state: 'saving' })
    try {
      await submitPresentationUrl(code, presentationUrlInput)
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

  if (!student) {
    return (
      <div className="page">
        <h1>유효하지 않은 링크</h1>
        <p>이 링크는 더 이상 유효하지 않습니다. 담당자에게 새 링크를 요청하세요.</p>
      </div>
    )
  }

  const myTeam = teams.find((team) => team.id === student.team_id)
  const investableTeams = teams.filter((team) => team.id !== student.team_id)

  return (
    <div className="page">
      <h1>{student.student_name}</h1>
      <p className="page-subtitle">소속 팀: {student.team_name}</p>

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
        <table className="data-table">
          <thead>
            <tr>
              <th>팀</th>
              <th>발표자료</th>
              <th>투자 금액</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {investableTeams.map((team) => {
              const status = rowStatus[team.id] ?? IDLE_STATUS
              return (
                <tr key={team.id}>
                  <td>{team.name}</td>
                  <td>
                    <PresentationLink url={team.presentation_url} />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={draftAmounts[team.id] ?? ''}
                      onChange={(event) => handleAmountChange(team.id, event.target.value)}
                      aria-label={`${team.name}에 투자할 금액`}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleSaveInvestment(team.id)}
                      disabled={status.state === 'saving'}
                    >
                      {status.state === 'saving' ? '저장 중...' : '저장'}
                    </button>
                    {status.state === 'saved' && <div className="hint-text">저장됨</div>}
                    {status.state === 'error' && <div className="error-text">{status.message}</div>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
