-- 0002_students.sql
--
-- DRAFT ONLY. Not applied anywhere. Same review process as
-- 0001_core_entities.sql.
--
-- Model (from the live design interview): investing is done by individual
-- students, not by teams collectively. ~44 students across 15 teams (14
-- teams of 3, one team of 2). Each student has their own personal
-- investment budget and their own personal unique access code/link
-- (the /t/:code page looks up a student, not a team). A student cannot
-- invest in their own team_id, but otherwise invests independently of
-- their teammates.

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

-- TODO(scoring-design): still pending, same as noted in
-- 0001_core_entities.sql:
--   * investments table — each row will presumably reference a student
--     (investor) and a team (recipient), plus an amount. Needs a
--     CHECK/constraint or application-level rule preventing a student from
--     investing in students.team_id = their own team_id, once the exact
--     enforcement point (DB constraint vs. RLS vs. app logic) is decided.
--   * how a student's personal budget is represented/tracked (a fixed
--     starting amount? stored per-student? computed?).
--   * Row Level Security policies for `students` (e.g. a student's own row
--     should be readable to look up their name/team, but access_codes in
--     general should not be listable/enumerable by anyone except admin).
