# 2026 AI 에너지 스마트홈 메이커톤 — 투자 심사 사이트

Peer-evaluation / "investment day" site for the 2026 AI Energy Smart-Home
Makerthon (15 teams, ~44 students, 3 judges, 1 admin). Each **student**
(not each team collectively) gets a personal virtual investment budget and
invests it individually in other teams — a student cannot invest in their
own team, but otherwise invests independently of their teammates. Judges
score teams against a rubric. The admin is the only person who can see
final rankings, which combine investment totals and judge scores.

**This is a scaffold.** The scoring formula and investment-round mechanic
are still being designed in a separate process by the project owner. Every
place that logic plugs in is marked with a `// TODO(scoring-design): ...`
comment — search for that string to find every stub. Do not add a scoring
formula, budget amount, or portfolio/return calculation here without
checking with the project owner first — none of that is decided yet, and
none of it should ever be visible to students or judges (results are
admin-only).

## Folder layout

```
src/
  lib/
    supabase.ts        Supabase client (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
    useAdminSession.ts  Hook exposing the current Supabase Auth session (admin only)
    types.ts            Shared types for the stable entities (Team, Student, Judge)
    dummyData.ts         Placeholder data used by pages until real queries exist
  components/
    AdminRouteGuard.tsx  Redirects to /admin/login if there's no admin session
    PresentationLink.tsx "발표자료 보기" link, or fallback text if not submitted
  pages/
    HomePage.tsx                 "/" — explains this site is invite-link only
    NotFoundPage.tsx             catch-all 404
    student/StudentInvestPage.tsx "/t/:code" — a student's personal invest + team presentation-link page
    judge/JudgePage.tsx          "/j/:code" — a judge's scoring page
    admin/AdminLoginPage.tsx     "/admin/login" — Supabase Auth email/password sign-in
    admin/AdminDashboardPage.tsx "/admin/dashboard" — results table (admin only)
  App.tsx    Route table
  main.tsx   Entry point

supabase/
  migrations/
    0001_core_entities.sql   DRAFT ONLY, not applied. teams + judges tables.
    0002_students.sql        DRAFT ONLY, not applied. students table (each
                              student belongs to one team and has their own
                              access_code — this is what /t/:code looks up).
                              investments / judge_scores are deliberately left
                              out of both files — see the comment blocks at
                              the bottom of each.

.github/workflows/deploy.yml   Build + deploy to GitHub Pages on push to main
```

## Routes

| Route | Who | Auth |
|---|---|---|
| `/` | anyone | none |
| `/t/:code` | a **student**, via their personal unique invite link | none — the code itself is the "login" |
| `/j/:code` | a judge, via their unique invite link | none — the code itself is the "login" |
| `/admin` | admin | redirects to `/admin/dashboard` |
| `/admin/login` | admin | Supabase Auth email/password form |
| `/admin/dashboard` | admin | requires an authenticated Supabase session (see `AdminRouteGuard`); redirects to `/admin/login` otherwise |

Students and judges never sign up — an admin (via direct Supabase access,
outside this app) creates their rows and hands out the `access_code`
links. There is intentionally no self-registration flow. Teams themselves
have no login of their own: any student on a team can view/update that
team's `presentation_url` from their personal `/t/:code` page, since it's
shared per team rather than per student.

## Running locally

```bash
npm install
cp .env.example .env   # fill in real Supabase URL/key if you have them
npm run dev
```

`npm run build` produces a static `dist/` (this is a client-only SPA — no
server component). `npm run preview` serves that build locally.

## Environment variables

Copy `.env.example` to `.env` (gitignored) and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` — the publishable/anon key. This is safe to ship
  to the browser; access control is enforced by Postgres Row Level Security
  policies on the Supabase project, not by keeping this key secret. **Never**
  put a `service_role` key in this project.

For CI builds (GitHub Actions), set the same two values as repository
secrets (`Settings > Secrets and variables > Actions`) named
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — see
`.github/workflows/deploy.yml`.

## Deploying

Deploys happen automatically on push to `main` via
`.github/workflows/deploy.yml`, using `actions/upload-pages-artifact` +
`actions/deploy-pages` (no `gh-pages` branch). To enable it:

1. In the GitHub repo settings, set **Pages > Source** to "GitHub Actions".
2. Add the two repo secrets mentioned above.
3. Check `vite.config.ts` — `base` is currently set to the placeholder
   `/vote/`. Update it to match the real repository name
   (`/<repo-name>/`) once the repo exists, or the deployed site's asset
   paths will be wrong.

No git remote is configured yet and this scaffold does not create one —
that's a separate decision for whoever owns the GitHub repo.

## What's intentionally NOT here yet

Everything about **how scoring actually works** is pending a live design
session with the project owner:

- The `investments` table (single vs. multi-round investing, how each
  student's personal budget is represented/tracked/enforced — self-investment
  is already ruled out at the UI level: a student's own team is excluded
  from their investable list).
- The `judge_scores` / `scores` table and the real rubric (criteria names,
  count, scale, weighting).
- The final-rank formula that combines investment totals and judge scores,
  and any portfolio/return-on-investment calculation — this is an
  admin-only computation, still undesigned, and must never be shown to
  students or judges.
- Row Level Security policies (who can read/write what) — these depend on
  the tables above.

The project owner has direct Supabase admin access and will design and
apply the real migrations themselves. This repo only contains draft,
unapplied SQL in `supabase/migrations/0001_core_entities.sql` and
`0002_students.sql` for the parts that don't depend on that design
(`teams`, `judges`, `students`).

## TODO markers

Search the codebase for `TODO(scoring-design)` to find every place that
needs real logic once the scoring/investment design is finalized.
