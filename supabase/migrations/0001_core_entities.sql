-- 0001_core_entities.sql
--
-- DRAFT ONLY. Not applied anywhere. Written for review by the project owner
-- who has direct Supabase admin access and will finalize + apply the real
-- migrations once the scoring/investment design is settled.
--
-- Scope: only the entities that stay the same no matter how the final
-- scoring formula and investment-round mechanic turn out — i.e. "who exists
-- and how they log in", not "how points/money flow between them".
--
-- NOTE: `teams` has no `access_code` / login of its own. Individual
-- students log in (see 0002_students.sql) and act on behalf of their team
-- (e.g. submitting `presentation_url`) via their personal access code.

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Link to the team's slide deck / demo materials, shown to other
  -- students (while investing) and to judges (while scoring). Null until
  -- one of the team's students submits one.
  presentation_url text,
  created_at timestamptz not null default now()
);

create table if not exists judges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Unique per-judge invite code used in the /j/:code link.
  access_code text not null unique,
  created_at timestamptz not null default now()
);

-- TODO(scoring-design): the following tables are intentionally NOT defined
-- yet, pending the live design interview on scoring/investment rules:
--
--   * investments        -- who (student) invested how much in which team,
--                            and whether this is single-round or
--                            multi-round, how a student's personal budget
--                            is tracked/enforced. Self-investment is
--                            already ruled out (a student cannot invest in
--                            their own team_id) but everything else about
--                            round structure is still open.
--
--   * judge_scores (or scores) -- the real rubric criteria (names, count,
--                            scale, weighting) and how a judge's per-team
--                            scores are stored.
--
-- Once those are designed, this file should also gain:
--   * Row Level Security policies for `teams`, `students`, and `judges`
--     (e.g. a student can only update their own team's
--     `presentation_url`, nobody can read another student's or judge's
--     access_code, only the admin role can read everything needed for the
--     leaderboard).
--   * Indexes as needed once query patterns are known.
