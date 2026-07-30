// Shared shapes for the entities that are stable regardless of how the
// scoring/investment rules end up working. These mirror the columns in
// supabase/migrations/0001_core_entities.sql and 0002_students.sql.
//
// TODO(scoring-design): once the `investments` and `judge_scores` tables
// exist, add their types here too (or switch this file to generated
// Supabase types via `supabase gen types typescript`).

export interface Team {
  id: string
  name: string
  /** Link to the team's slide deck / demo materials. Null until a student on the team submits one. */
  presentationUrl: string | null
  createdAt: string
}

// Investing is done by individual students, not by teams collectively.
// Each student has their own access code (the /t/:code login) and belongs
// to exactly one team. A student cannot invest in their own team.
export interface Student {
  id: string
  name: string
  teamId: string
  accessCode: string
  createdAt: string
}

export interface Judge {
  id: string
  name: string
  accessCode: string
  createdAt: string
}
