import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { PresentationLink } from '../../components/PresentationLink'
import { DUMMY_STUDENTS, DUMMY_TEAMS } from '../../lib/dummyData'

// TODO(scoring-design): replace with the real remaining-budget figure once
// each student's personal investment budget/round rules are finalized.
const PLACEHOLDER_BUDGET = 0

export function StudentInvestPage() {
  const { code } = useParams<{ code: string }>()

  // TODO(scoring-design): look up the student by `code` (access_code) via
  // Supabase instead of using dummy data. If no student matches, show an
  // "invalid link" state instead of the form below.
  const currentStudent = DUMMY_STUDENTS[0]
  const myTeam = DUMMY_TEAMS.find((team) => team.id === currentStudent.teamId)

  // Investing is per-student, not per-team: a student cannot invest in
  // their own team, but their teammates each get their own independent
  // allocation (three teammates might invest very differently).
  const investableTeams = DUMMY_TEAMS.filter((team) => team.id !== currentStudent.teamId)

  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [presentationUrlInput, setPresentationUrlInput] = useState(myTeam?.presentationUrl ?? '')

  function handleAmountChange(teamId: string, value: string) {
    setAmounts((previous) => ({ ...previous, [teamId]: value }))
  }

  function handleSubmitInvestments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // TODO(scoring-design): this is a stub. Real submission needs to:
    // - decide whether this is a single round or multiple rounds
    // - validate total invested amount against this student's personal
    //   remaining budget
    // - write to the (not-yet-designed) `investments` table via Supabase,
    //   keyed by this student's id and each team's id
    // (Self-investment is already excluded above: `investableTeams` never
    // contains this student's own team_id.)
    console.log('[stub] submit investments', { studentCode: code, amounts })
  }

  function handleSubmitPresentation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // TODO(scoring-design): stub. Real submission should update the
    // `presentation_url` column on this student's OWN team's row (see
    // supabase/migrations/0001_core_entities.sql), most likely via an RLS
    // policy that lets any student update only their own team_id's row.
    // Any of the ~3 teammates can submit/edit this — it's shared per team,
    // not per student.
    console.log('[stub] submit presentation url', { studentCode: code, presentationUrlInput })
  }

  return (
    <div className="page">
      <h1>{currentStudent.name}</h1>
      <p className="page-subtitle">
        소속 팀: {myTeam?.name ?? '알 수 없음'} · 개인 초대 코드: {code}
      </p>

      <section className="panel">
        <h2>나의 투자 예산</h2>
        {/* TODO(scoring-design): render this student's real remaining
            budget once the investment/budget rules are defined. This is a
            personal budget, not a team budget — teammates have their own,
            separate amounts. */}
        <p className="budget-amount">{PLACEHOLDER_BUDGET.toLocaleString()} (placeholder)</p>
      </section>

      <section className="panel">
        <h2>우리 팀 발표자료 제출</h2>
        <p className="hint-text">
          다른 팀 학생과 심사위원이 확인할 수 있는 우리 팀의 발표자료 링크를 등록하세요. 팀원 누구나
          제출/수정할 수 있습니다.
        </p>
        <form onSubmit={handleSubmitPresentation} className="stacked-form">
          <label htmlFor="presentation-url">발표자료 링크</label>
          <input
            id="presentation-url"
            type="url"
            placeholder="https://..."
            value={presentationUrlInput}
            onChange={(event) => setPresentationUrlInput(event.target.value)}
          />
          <button type="submit">발표자료 링크 저장</button>
        </form>
      </section>

      <section className="panel">
        <h2>다른 팀에 투자하기</h2>
        <p className="hint-text">본인 팀({myTeam?.name ?? '—'})은 투자 대상 목록에서 제외됩니다.</p>
        <form onSubmit={handleSubmitInvestments}>
          <table className="data-table">
            <thead>
              <tr>
                <th>팀</th>
                <th>발표자료</th>
                <th>투자 금액</th>
              </tr>
            </thead>
            <tbody>
              {investableTeams.map((team) => (
                <tr key={team.id}>
                  <td>{team.name}</td>
                  <td>
                    <PresentationLink url={team.presentationUrl} />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={amounts[team.id] ?? ''}
                      onChange={(event) => handleAmountChange(team.id, event.target.value)}
                      aria-label={`${team.name}에 투자할 금액`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit">투자 제출</button>
        </form>
      </section>
    </div>
  )
}
