// Thin typed wrapper around every backend call this app makes. All reads
// and writes go through supabase.rpc(...) — RLS blocks direct table access
// by design, so these RPCs (applied directly to the Supabase project by
// the project owner) are the only supported entry points.

import { supabase } from './supabase'
import type {
  InvestmentRecordRow,
  InvestmentRow,
  InvestorLeaderboardRow,
  JudgeIdentity,
  JudgeScoreRecordRow,
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
 * passphrase/"forbidden" errors) come through as `.message` on the object
 * supabase-js's `.rpc()` resolves as `error` — despite being
 * PostgrestError-shaped (code/details/hint/message), it is NOT actually an
 * `instanceof Error` in the installed @supabase/supabase-js version (verified
 * by hand: `error.constructor.name` is plain `Object`), so `err instanceof
 * Error` alone silently fell through to `String(err)` → "[object Object]"
 * for every single RPC failure in the app. Check for a `.message` string
 * first, regardless of prototype. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message
  }
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

// ---- Anon-callable: admin ----
// Gated by a single shared passphrase (same mechanic as judges), not
// Supabase Auth. This RPC is for the login step only — the real
// enforcement lives server-side in each admin RPC below, which re-verifies
// the passphrase itself and raises a "forbidden" error if it's wrong.

export const verifyAdminPassphrase = (passphrase: string) =>
  call<boolean>('verify_admin_passphrase', { p_passphrase: passphrase })

// ---- Passphrase-gated: admin dashboard ----
// Each of these re-verifies p_admin_passphrase server-side and raises a
// "forbidden" error if it doesn't match. Callers should catch that, clear
// the cached passphrase, and redirect to /admin/login rather than showing
// a dead error state.

export const getTeamLeaderboard = (adminPassphrase: string) =>
  call<TeamLeaderboardRow[]>('get_team_leaderboard', { p_admin_passphrase: adminPassphrase })

export const getInvestorLeaderboard = (adminPassphrase: string) =>
  call<InvestorLeaderboardRow[]>('get_investor_leaderboard', {
    p_admin_passphrase: adminPassphrase,
  })

// Instant fallback: shuffles ALL teams server-side and assigns a fresh
// 1..15 presentation_order in one call. Used for the skip/timeout path
// when the marble race is abandoned — NOT part of the normal flow, where
// the race itself is authoritative (see submitPresentationOrder below).
export const drawPresentationOrder = (adminPassphrase: string) =>
  call<PresentationOrderDraw[]>('draw_presentation_order', { p_admin_passphrase: adminPassphrase })

// The normal flow: the marble race runs with real physics and decides the
// order itself, then this persists that exact finish order (all 15 team
// ids, no duplicates/missing — validated server-side).
export const submitPresentationOrder = (teamIds: string[], adminPassphrase: string) =>
  call<void>('submit_presentation_order', {
    p_team_ids: teamIds,
    p_admin_passphrase: adminPassphrase,
  })

// Raw per-record data behind the two leaderboards above, for CSV export —
// one row per (student, team) investment / (judge, team) score rather
// than the aggregated per-student or per-team totals.
export const getInvestmentRecords = (adminPassphrase: string) =>
  call<InvestmentRecordRow[]>('get_investment_records', { p_admin_passphrase: adminPassphrase })

export const getJudgeScoreRecords = (adminPassphrase: string) =>
  call<JudgeScoreRecordRow[]>('get_judge_score_records', { p_admin_passphrase: adminPassphrase })

// Wipes ALL investments/judge_scores/students/judges and resets every
// team's presentation_order/presentation_url to null — for clearing out
// 모의테스트 (mock test) data before the real event. Does NOT touch the 15
// real team rows/names or event_settings (passphrases survive). This is
// genuinely destructive and irreversible — see AdminDashboardPage's
// type-to-confirm gate before this ever gets called.
export const resetEventData = (adminPassphrase: string) =>
  call<void>('reset_event_data', { p_admin_passphrase: adminPassphrase })
