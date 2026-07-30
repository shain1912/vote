-- 0002_students.sql
--
-- REFERENCE / DOCUMENTATION ONLY — see the note at the top of
-- 0001_core_entities.sql. Already applied directly to the Supabase project
-- by the project owner; this file is not run by anything.
--
-- Investing is done by individual students, not by teams collectively.
-- ~44 students across 15 teams (14 teams of 3, one team of 2). Each
-- student has a fixed personal investment budget of 10,000 points (see
-- PERSONAL_BUDGET in src/pages/student/StudentInvestPage.tsx).
--
-- No sign-up and no per-person link/code: a student picks their team from
-- a dropdown and types their name. start_as_student(team_id, name) finds
-- an existing row by (team_id, exact trimmed name) or creates one on first
-- visit, so repeat visits with the same team + name resume the same
-- budget/investments. A student cannot invest in their own team_id —
-- enforced server-side inside the submit_investment() RPC, not by a table
-- constraint here.

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id uuid not null references teams (id) on delete cascade,
  created_at timestamptz not null default now()
  -- Presumably a uniqueness constraint on (team_id, name) so
  -- start_as_student can find-or-create deterministically — exact
  -- constraint as applied is not visible from the frontend.
);

create index if not exists students_team_id_idx on students (team_id);
