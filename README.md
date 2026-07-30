# 2026 AI 에너지 스마트홈 메이커톤 — 투자 심사 사이트

Peer-evaluation / "investment day" site for the 2026 AI Energy Smart-Home
Makerthon (15 teams, ~44 students, 3 judges, 1 admin). Each **student**
(not each team collectively) gets a fixed personal virtual investment
budget of 10,000 points and invests it individually in other teams — a
student cannot invest in their own team, but otherwise invests
independently of their teammates. Judges score teams against a 4-criteria,
100-point rubric. The admin is the only person who can see final rankings
(team leaderboard + a "베스트 인베스터" list), which combine investment
totals and judge scores.

The scoring/investment design is finalized and the real schema, RLS
policies, and RPC functions are already applied to the Supabase project by
the project owner. This app talks to the backend exclusively through
`supabase.rpc(...)` calls (see `src/lib/api.ts`) — RLS blocks direct table
access by design, so those RPCs are the only supported entry points.

## Folder layout

```
src/
  lib/
    supabase.ts        Supabase client (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
    api.ts              Typed wrapper around every supabase.rpc(...) call the app makes
    useAdminSession.ts  Hook exposing the current Supabase Auth session (admin only)
    types.ts            Types matching each RPC's return shape
  components/
    AdminRouteGuard.tsx  Redirects to /admin/login if there's no admin session
    PresentationLink.tsx "발표자료 보기" link, or fallback text if not submitted
  pages/
    HomePage.tsx                  "/" — links to /invest and /judge
    NotFoundPage.tsx              catch-all 404
    student/StudentInvestPage.tsx "/invest" — team+name entry screen, then invest + team presentation-link page
    judge/JudgePage.tsx           "/judge" — name+passphrase entry screen, then scoring page (4-criteria rubric)
    admin/AdminLoginPage.tsx      "/admin/login" — Supabase Auth email/password sign-in
    admin/AdminDashboardPage.tsx  "/admin/dashboard" — team + investor leaderboards (admin only)
  App.tsx    Route table (HashRouter — see "Deploying" for why)
  main.tsx   Entry point

supabase/
  migrations/   REFERENCE ONLY — see the note at the top of each file. The
                real schema was applied directly to the Supabase project by
                the project owner, outside of this repo. These .sql files
                document that schema (tables + RPC signatures) for readers
                without DB access; they are not run by anything.
    0001_core_entities.sql             teams, judges
    0002_students.sql                  students
    0003_investments_and_scores.sql    investments, judge_scores, and a
                                        comment block documenting every RPC
                                        function's signature

.github/workflows/deploy.yml   Build + deploy to GitHub Pages on push to main
```

## Routes

| Route | Who | Auth |
|---|---|---|
| `/` | anyone | none — links to `/invest` and `/judge` |
| `/invest` | a **student** — picks their team from a dropdown and types their name | none; see below |
| `/judge` | a judge — types their name and a shared passphrase | shared passphrase only, no per-person account |
| `/admin` | admin | redirects to `/admin/dashboard` |
| `/admin/login` | admin | Supabase Auth email/password form |
| `/admin/dashboard` | admin | requires an authenticated Supabase session (see `AdminRouteGuard`); redirects to `/admin/login` otherwise |

There is no per-person link/code anymore (an earlier version of this app
used `/t/:code` and `/j/:code` invite links — that model was dropped as
operationally too complicated for a live event). A student instead picks
their team and types their name on `/invest`; `start_as_student` finds an
existing row for that exact (team, trimmed name) pair or creates one, so
leaving and coming back with the same team + name resumes the same
budget/investments. A judge types their name plus a single passphrase
shared with all 3 judges (not a per-judge secret) on `/judge`; wrong
passphrase is a normal form error, not a crash. The identity returned by
either flow is cached in `sessionStorage` for that browser tab only, so a
page refresh doesn't force retyping — it's a convenience, not a security
boundary; anyone can always re-enter their own team+name or the shared
passphrase again. Teams themselves have no login of their own: any student
on a team can view/update that team's `presentation_url` once they've
entered as a student on that team.

## How data flows

- **Student flow** (`/invest`): `list_teams` populates the team `<select>`
  on first load. Submitting the entry form calls `start_as_student`; the
  returned `student_id` (kept in state + `sessionStorage`) is then used for
  `get_my_investments` (prefill) and every subsequent write. Remaining
  budget is computed client-side as `10000 - sum(amounts)`. Each team row
  has its own **저장 (save)** button that calls `submit_investment` for
  just that team — not one bulk submit — matching the RPC's per-row upsert
  semantics. The presentation-link form calls `submit_presentation_url`.
- **Judge flow** (`/judge`): `list_teams` loads up front; submitting the
  entry form (name + passphrase) calls `start_as_judge` — a wrong
  passphrase shows inline as "암호가 올바르지 않습니다"-style RPC error
  text, not a crash. The returned `judge_id` is then used for
  `get_my_scores` (prefill) and `submit_judge_score`. The 4 rubric fields
  are 문제정의/임팩트 (0–30), 기술완성도 (0–30), 실현가능성/확장성
  (0–25), UX/발표 (0–15, 100 total). Each team has its own **채점 저장**
  button.
- **Admin dashboard** (`/admin/dashboard`, requires a Supabase Auth
  session): `get_team_leaderboard` (pre-sorted by `final_score` desc) and
  `get_investor_leaderboard` (pre-sorted by `profit` desc; top 8 rows are
  highlighted as the 50,000원 "베스트 인베스터" prize winners). Both RPCs
  reject non-admin callers with a Postgres "forbidden" error — until the
  project owner adds a row for this admin's auth user to the `admins`
  table, the dashboard will show a friendly "결과를 불러오지 못했습니다"
  message instead of a leaderboard. That's expected in the meantime.
- Every RPC call and its human-readable Postgres error message (e.g.
  budget exceeded, self-investment blocked, invalid score range) is
  surfaced inline next to the relevant form field — see
  `getErrorMessage` in `src/lib/api.ts`.

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
`actions/deploy-pages` (no `gh-pages` branch). Routing uses React Router's
`HashRouter` (URLs like `/#/invest`) rather than `BrowserRouter`, because
GitHub Pages is static hosting with no server-side rewrite — a
`BrowserRouter` URL like `/invest` opened cold (not already loaded as the
SPA) would 404 instead of reaching the app; hash routes always resolve to
`index.html` first. To enable the deploy:

1. In the GitHub repo settings, set **Pages > Source** to "GitHub Actions".
2. Add the two repo secrets mentioned above.
3. Check `vite.config.ts` — `base` is currently set to the placeholder
   `/vote/`. Update it to match the real repository name
   (`/<repo-name>/`) once the repo exists, or the deployed site's asset
   paths will be wrong.

No git remote is configured yet and this scaffold does not create one —
that's a separate decision for whoever owns the GitHub repo.

## Remaining work / known gaps

- No admin account exists in the `admins` table yet, so
  `/admin/dashboard` currently shows a "forbidden" error after logging in
  (see "How data flows" above) — expected until the project owner finishes
  admin account setup. There's also no Supabase Auth *user* created yet
  either; `/admin/login` needs one to exist before it can succeed.
- No automated tests.
- No loading skeletons/polish beyond simple "불러오는 중..." text.
- `vite.config.ts`'s `base` still needs to be set to the real repo name
  once a GitHub repo exists (see "Deploying").
