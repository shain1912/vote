// Thin typed wrapper around every backend call this app makes. All reads
// and writes go through supabase.rpc(...) — RLS blocks direct table access
// by design, so these RPCs (applied directly to the Supabase project by
// the project owner) are the only supported entry points.

import { supabase } from './supabase'
import type {
  InvestmentRow,
  InvestorLeaderboardRow,
  JudgeIdentity,
  JudgeScoreRow,
  StudentIdentity,
  TeamLeaderboardRow,
  TeamSummary,
} from './types'

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

/** Human-readable message for anything thrown by `call`. Postgres RAISE
 * EXCEPTION messages (e.g. budget/self-investment/"forbidden" errors) come
 * through as `.message` on a PostgrestError, which extends Error. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

// ---- Anon-callable: shared ----

export const listTeams = () => call<TeamSummary[]>('list_teams')

// ---- Anon-callable: student flow ----

export const getStudentByCode = (accessCode: string) =>
  call<StudentIdentity[]>('get_student_by_code', { p_access_code: accessCode })

export const getMyInvestments = (accessCode: string) =>
  call<InvestmentRow[]>('get_my_investments', { p_access_code: accessCode })

export const submitInvestment = (accessCode: string, teamId: string, amount: number) =>
  call<void>('submit_investment', {
    p_access_code: accessCode,
    p_team_id: teamId,
    p_amount: amount,
  })

export const submitPresentationUrl = (accessCode: string, url: string) =>
  call<void>('submit_presentation_url', { p_access_code: accessCode, p_url: url })

// ---- Anon-callable: judge flow ----

export const getJudgeByCode = (accessCode: string) =>
  call<JudgeIdentity[]>('get_judge_by_code', { p_access_code: accessCode })

export const getMyScores = (accessCode: string) =>
  call<JudgeScoreRow[]>('get_my_scores', { p_access_code: accessCode })

export interface JudgeScoreInput {
  problemImpact: number
  technicalCompleteness: number
  feasibilityScalability: number
  uxPresentation: number
}

export const submitJudgeScore = (accessCode: string, teamId: string, scores: JudgeScoreInput) =>
  call<void>('submit_judge_score', {
    p_access_code: accessCode,
    p_team_id: teamId,
    p_problem_impact: scores.problemImpact,
    p_technical_completeness: scores.technicalCompleteness,
    p_feasibility_scalability: scores.feasibilityScalability,
    p_ux_presentation: scores.uxPresentation,
  })

// ---- Authenticated-only: admin dashboard ----
// Both raise a Postgres "forbidden" error for a signed-in user who isn't
// in the `admins` table. Callers should catch and display that gracefully.

export const getTeamLeaderboard = () => call<TeamLeaderboardRow[]>('get_team_leaderboard')

export const getInvestorLeaderboard = () => call<InvestorLeaderboardRow[]>('get_investor_leaderboard')
