-- 0001_core_entities.sql
--
-- REFERENCE / DOCUMENTATION ONLY. This schema has already been designed
-- and applied directly to the Supabase project (awmrjwwteupgpdmmayji) by
-- the project owner, outside of this repo. This file is not run by
-- anything and is not guaranteed to be byte-for-byte identical to what's
-- live — it exists so the shape of the data is readable from the repo
-- without needing DB access. See src/lib/types.ts and src/lib/api.ts for
-- what the frontend actually depends on (the RPC functions, not these
-- tables directly — RLS blocks direct table access by design).

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Link to the team's slide deck / demo materials, shown to other
  -- students (while investing) and to judges (while scoring). Null until
  -- one of the team's students submits one via submit_presentation_url().
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

-- See 0002_students.sql for `students`, and 0003_investments_and_scores.sql
-- for `investments` / `judge_scores` and the RPC functions the frontend
-- actually calls.
