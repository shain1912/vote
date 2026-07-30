// Types mirror the RPC return shapes exactly (snake_case, matching
// Postgres/PostgREST), since every read/write in this app goes through
// supabase.rpc(...) — see src/lib/api.ts — rather than direct table
// queries (RLS blocks those by design; only the RPCs below are callable).

/** Row from `list_teams()`. Sorted server-side by presentation_order asc
 * (nulls last), then name — so the array is already in draw order once a
 * draw has happened. */
export interface TeamSummary {
  id: string
  name: string
  presentation_url: string | null
  presentation_order: number | null
}

/** Result of `start_as_student(p_team_id, p_name)` — creates the student on first visit, resumes on repeat visits with the same team + exact trimmed name. */
export interface StudentIdentity {
  student_id: string
  student_name: string
  team_id: string
  team_name: string
}

/** Result of `start_as_judge(p_name, p_passphrase)` — gated by a single shared passphrase, not a per-person code. */
export interface JudgeIdentity {
  judge_id: string
  judge_name: string
}

/** Row from `get_my_investments(p_student_id)`. */
export interface InvestmentRow {
  team_id: string
  amount: number
}

/** Row from `get_my_scores(p_judge_id)`. */
export interface JudgeScoreRow {
  team_id: string
  problem_impact: number
  technical_completeness: number
  feasibility_scalability: number
  ux_presentation: number
}

/** Row from `get_team_leaderboard()` (authenticated/admin only). Pre-sorted by final_score desc. */
export interface TeamLeaderboardRow {
  team_id: string
  team_name: string
  judge_score: number
  judges_scored_count: number
  investment_received: number
  investor_count: number
  judge_percentile: number
  investment_percentile: number
  final_score: number
}

/** Row from `get_investor_leaderboard()` (authenticated/admin only). Pre-sorted by profit desc. */
export interface InvestorLeaderboardRow {
  student_id: string
  student_name: string
  team_id: string
  team_name: string
  total_invested: number
  final_value: number
  profit: number
}

/** Row from `draw_presentation_order()` (authenticated/admin only). Pre-sorted by the new presentation_order asc — this IS the randomly decided order, not to be re-sorted client-side. */
export interface PresentationOrderDraw {
  team_id: string
  team_name: string
  presentation_order: number
}

/** Row from `get_investment_records()` (admin-passphrase-gated) — the raw
 * per-(student, team) investment data behind the aggregated leaderboards,
 * for CSV export. One row per investment, not per student. */
export interface InvestmentRecordRow {
  student_name: string
  student_team: string
  invested_in_team: string
  amount: number
  updated_at: string
}

/** Row from `get_judge_score_records()` (admin-passphrase-gated) — the raw
 * per-(judge, team) score breakdown behind the aggregated leaderboards,
 * for CSV export. One row per score, not per judge. */
export interface JudgeScoreRecordRow {
  judge_name: string
  team_name: string
  problem_impact: number
  technical_completeness: number
  feasibility_scalability: number
  ux_presentation: number
  total: number
  updated_at: string
}
