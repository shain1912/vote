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
  PresentationOrderDraw,
  StudentIdentity,
  TeamLeaderboardRow,
  TeamSummary,
} from './types'

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

/** For RPCs that always return exactly one row. PostgREST returns a bare
 * object for functions declared to return a single row, or a one-element
 * array for functions declared RETURNS TABLE/SETOF — handle both so this
 * doesn't silently break if the underlying function's declaration style
 * changes. */
async function callSingle<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const data = await call<T | T[]>(fn, args)
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error(`${fn} returned no rows`)
    return data[0]
  }
  return data
}

/** Human-readable message for anything thrown by `call`/`callSingle`.
 * Postgres RAISE EXCEPTION messages (e.g. budget/self-investment/invalid
 * passphrase/"forbidden" errors) come through as `.message` on a
 * PostgrestError, which extends Error. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

// ---- Anon-callable: shared ----

export const listTeams = () => call<TeamSummary[]>('list_teams')

// ---- Anon-callable: student flow ----
// No per-person link/code anymore: a student picks their team and types
// their name. start_as_student finds-or-creates their row so repeat visits
// with the same team + name resume the same budget/investments.

export const startAsStudent = (teamId: string, name: string) =>
  callSingle<StudentIdentity>('start_as_student', { p_team_id: teamId, p_name: name })

export const getMyInvestments = (studentId: string) =>
  call<InvestmentRow[]>('get_my_investments', { p_student_id: studentId })

export const submitInvestment = (studentId: string, teamId: string, amount: number) =>
  call<void>('submit_investment', {
    p_student_id: studentId,
    p_team_id: teamId,
    p_amount: amount,
  })

export const submitPresentationUrl = (studentId: string, url: string) =>
  call<void>('submit_presentation_url', { p_student_id: studentId, p_url: url })

// ---- Anon-callable: judge flow ----
// Gated by a single shared passphrase (not a per-judge code), since judge
// scores are high-stakes and open self-registration would let anyone
// submit fake scores.

export const startAsJudge = (name: string, passphrase: string) =>
  callSingle<JudgeIdentity>('start_as_judge', { p_name: name, p_passphrase: passphrase })

export const getMyScores = (judgeId: string) =>
  call<JudgeScoreRow[]>('get_my_scores', { p_judge_id: judgeId })

export interface JudgeScoreInput {
  problemImpact: number
  technicalCompleteness: number
  feasibilityScalability: number
  uxPresentation: number
}

export const submitJudgeScore = (judgeId: string, teamId: string, scores: JudgeScoreInput) =>
  call<void>('submit_judge_score', {
    p_judge_id: judgeId,
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

// Shuffles ALL teams server-side and assigns a fresh 1..15 presentation_order
// every time it's called — this is the only source of randomness for the
// draw. The frontend never shuffles anything itself, only animates
// revealing what this RPC already decided.
export const drawPresentationOrder = () =>
  call<PresentationOrderDraw[]>('draw_presentation_order')
