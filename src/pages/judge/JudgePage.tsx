import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { PresentationLink } from '../../components/PresentationLink'
import { DUMMY_TEAMS } from '../../lib/dummyData'

// TODO(scoring-design): these criteria are placeholders only, to prove out
// the form layout. Replace with the real rubric (names, count, scale, and
// whether they're weighted) once it's finalized.
const PLACEHOLDER_CRITERIA = [
  { key: 'criteria_1', label: '기준 1 (placeholder)' },
  { key: 'criteria_2', label: '기준 2 (placeholder)' },
  { key: 'criteria_3', label: '기준 3 (placeholder)' },
] as const

type ScoreInputs = Record<string, Partial<Record<(typeof PLACEHOLDER_CRITERIA)[number]['key'], string>>>

export function JudgePage() {
  const { code } = useParams<{ code: string }>()

  // TODO(scoring-design): look up the judge by `code` (access_code) via
  // Supabase instead of using dummy data, and fetch the real team list.
  const teams = DUMMY_TEAMS

  const [scores, setScores] = useState<ScoreInputs>({})

  function handleScoreChange(teamId: string, criteriaKey: string, value: string) {
    setScores((previous) => ({
      ...previous,
      [teamId]: { ...previous[teamId], [criteriaKey]: value },
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // TODO(scoring-design): this is a stub. Real submission needs to write
    // to the (not-yet-designed) `judge_scores` / `scores` table via
    // Supabase, keyed by this judge's id and each team's id.
    console.log('[stub] submit judge scores', { judgeCode: code, scores })
  }

  return (
    <div className="page">
      <h1>심사위원 채점</h1>
      <p className="page-subtitle">심사위원 초대 코드: {code}</p>
      <p className="hint-text">
        아래 채점 기준은 임시 값입니다. 실제 채점 기준은 별도로 확정될 예정입니다.
      </p>

      <form onSubmit={handleSubmit}>
        {teams.map((team) => (
          <section className="panel" key={team.id}>
            <h2>{team.name}</h2>
            <p>
              <PresentationLink url={team.presentationUrl} />
            </p>
            <div className="criteria-grid">
              {PLACEHOLDER_CRITERIA.map((criteria) => (
                <label key={criteria.key} className="criteria-field">
                  {criteria.label}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    inputMode="numeric"
                    value={scores[team.id]?.[criteria.key] ?? ''}
                    onChange={(event) => handleScoreChange(team.id, criteria.key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
        <button type="submit">채점 제출</button>
      </form>
    </div>
  )
}
