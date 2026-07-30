-- 0003_investments_and_scores.sql
--
-- REFERENCE / DOCUMENTATION ONLY — see the note at the top of
-- 0001_core_entities.sql. Already applied directly to the Supabase project
-- by the project owner; this file is not run by anything, and the exact
-- constraints/RLS policies below are illustrative (best-effort from the
-- known column list + RPC contracts), not necessarily byte-for-byte what's
-- live.

create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  -- Current allocation from this student to this team. One row per
  -- (student, team) pair — submit_investment() upserts, it doesn't append.
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, team_id)
  -- A student investing in their own team is rejected inside
  -- submit_investment() (raises a Postgres exception surfaced to the UI),
  -- not via a table CHECK constraint.
);

create table if not exists judge_scores (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references judges (id) on delete cascade,
  team_id uuid not null references teams (id) on delete cascade,
  -- Rubric, finalized: 4 criteria totaling 100 points.
  problem_impact integer not null check (problem_impact between 0 and 30), -- 문제정의/임팩트
  technical_completeness integer not null check (technical_completeness between 0 and 30), -- 기술완성도
  feasibility_scalability integer not null check (feasibility_scalability between 0 and 25), -- 실현가능성/확장성
  ux_presentation integer not null check (ux_presentation between 0 and 15), -- UX/발표
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (judge_id, team_id)
);

-- ---------------------------------------------------------------------
-- RPC functions (already implemented server-side). The frontend calls
-- these exclusively via supabase.rpc(...) — see src/lib/api.ts — and never
-- queries the tables above directly; RLS blocks direct table access by
-- design. Signatures documented here for reference only.
-- ---------------------------------------------------------------------

-- Anon-callable, shared:
--   list_teams() -> table (id uuid, name text, presentation_url text)
--     15 rows, pre-seeded as "팀 1".."팀 15" placeholder names — the admin
--     renames them later; no frontend change needed for that.
--
-- Anon-callable, student flow (no per-person link/code — a student picks
-- their team + types their name):
--   start_as_student(p_team_id uuid, p_name text)
--     -> student_id uuid, student_name text, team_id uuid, team_name text
--        Finds an existing row by (team_id, exact trimmed name), or
--        creates one on first visit. Always succeeds (no "invalid code"
--        case) — repeat visits with the same team + name resume the same
--        budget/investments.
--   get_my_investments(p_student_id uuid) -> table (team_id uuid, amount integer)
--   submit_investment(p_student_id uuid, p_team_id uuid, p_amount integer) -> void
--     enforces: amount >= 0, per-student total <= 10000, cannot invest in
--     own team_id. Raises a human-readable Postgres exception on violation.
--   submit_presentation_url(p_student_id uuid, p_url text) -> void
--     updates the caller's own team's presentation_url (team looked up
--     server-side from the student_id).
--
-- Anon-callable, judge flow (no per-judge code — name + a single shared
-- passphrase, since judge scores are high-stakes and open self-registration
-- would let anyone submit fake scores):
--   start_as_judge(p_name text, p_passphrase text) -> judge_id uuid, judge_name text
--     wrong passphrase raises a Postgres exception ("invalid passphrase"),
--     surfaced as a normal form error in the UI, not a crash.
--   get_my_scores(p_judge_id uuid)
--     -> table (team_id uuid, problem_impact int, technical_completeness int,
--               feasibility_scalability int, ux_presentation int)
--   submit_judge_score(p_judge_id uuid, p_team_id uuid, p_problem_impact int,
--                       p_technical_completeness int, p_feasibility_scalability int,
--                       p_ux_presentation int) -> void
--
-- Authenticated-only (admin dashboard; caller must exist in an `admins`
-- table or the function raises a "forbidden" exception):
--   get_team_leaderboard()
--     -> table (team_id uuid, team_name text, judge_score numeric,
--               judges_scored_count int, investment_received numeric,
--               investor_count int, judge_percentile numeric,
--               investment_percentile numeric, final_score numeric)
--        pre-sorted by final_score desc, tie-break judge_score desc.
--        final_score = 0.5*judge_percentile + 0.5*investment_percentile
--        (both are rank-based percent_rank, computed server-side).
--   get_investor_leaderboard()
--     -> table (student_id uuid, student_name text, team_id uuid,
--               team_name text, total_invested numeric, final_value numeric,
--               profit numeric)
--        pre-sorted by profit desc. Top 8 rows are the "베스트 인베스터"
--        prize winners (50,000원 each) — sliced client-side in
--        AdminDashboardPage, not encoded here.
