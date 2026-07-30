// Types mirror the RPC return shapes exactly (snake_case, matching
// Postgres/PostgREST), since every read/write in this app goes through
// supabase.rpc(...) — see src/lib/api.ts — rather than direct table
// queries (RLS blocks those by design; only the RPCs below are callable).

/** Row from `list_teams()`. */
export interface TeamSummary {
  id: string
  name: string
  presentation_url: string | null
}

/** Row from `get_student_by_code(p_access_code)`. Empty result = invalid/expired link. */
export interface StudentIdentity {
  student_id: string
  student_name: string
  team_id: string
  team_name: string
}

/** Row from `get_judge_by_code(p_access_code)`. Empty result = invalid/expired link. */
export interface JudgeIdentity {
  judge_id: string
  judge_name: string
}

/** Row from `get_my_investments(p_access_code)`. */
export interface InvestmentRow {
  team_id: string
  amount: number
}

/** Row from `get_my_scores(p_access_code)`. */
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
