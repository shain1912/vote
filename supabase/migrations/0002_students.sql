-- 0002_students.sql
--
-- REFERENCE / DOCUMENTATION ONLY — see the note at the top of
-- 0001_core_entities.sql. Already applied directly to the Supabase project
-- by the project owner; this file is not run by anything.
--
-- Investing is done by individual students, not by teams collectively.
-- ~44 students across 15 teams (14 teams of 3, one team of 2). Each
-- student has a fixed personal investment budget of 10,000 points (see
-- PERSONAL_BUDGET in src/pages/student/StudentInvestPage.tsx) and their
-- own personal unique access code/link (the /t/:code page looks up a
-- student, not a team). A student cannot invest in their own team_id —
-- enforced server-side inside the submit_investment() RPC, not by a
-- table constraint here.

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id uuid not null references teams (id) on delete cascade,
  -- Unique per-student invite code used in the /t/:code link. This is the
  -- only login mechanic for students — teams themselves have no
  -- access_code (see note in 0001_core_entities.sql).
  access_code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists students_team_id_idx on students (team_id);
