# Competition Engine v1 — Deployment Report

**Prepared:** 25 July 2026
**Scope:** Deploy the Competition Engine · archive the World Cup · launch the
Premier League · add competition lifecycle control.

> **Important:** this environment has **no Supabase access**, so migrations and
> seeds are **prepared and locally verified, not applied**. Everything that can
> be checked without the database is green (build, typecheck, 164 tests, route
> resolution, console-clean render). The steps that touch production are in
> **§Manual steps** and must be run by you.

---

## 1. Completed items (built & locally verified)

### Lifecycle control (the operational backbone you asked for)
- **`draft → internal → public → archived`** as a single competition setting.
- Admin dropdown at **`/admin/competitions`** — change state with one click, no
  deployment. Going **public** runs the launch gate first (won't publish a
  broken competition). Every other transition is immediate.
- `setLifecycle()` writes lifecycle + the derived `visible` flag + the
  competition-row status together, so every existing consumer stays consistent.
- Migration **`051_competition_lifecycle.sql`**.

### World Cup archive (read-only, permanent, accessible)
- Set to **`archived`** by migration 051.
- **Read-only enforced in the database** by three additive, INSERT-only
  triggers: no new predictions, no new leagues, no new joins on an archived
  competition. They deliberately do **not** touch `enforce_prediction_deadline`
  or any scoring path (the repo's deadline trigger is known to differ from
  production — see `docs/SCHEMA_DRIFT_REPORT.md`), so scoring/rescoring is
  unaffected. For the WC it's belt-and-suspenders anyway: every fixture has
  kicked off, so predictions are already closed.
- **Still fully accessible**: final leaderboards, private-league standings, user
  predictions, results and stats all render exactly as before — the classic hub
  is unchanged. An **"🗄 ARCHIVED — read-only"** banner marks it.

### Premier League launch path
- Seed **`supabase/seeds/premier-league-2026-27.sql`** — real clubs, real
  fixtures, ships as **`draft`** (invisible). You flip it to public when ready.
- Once public, it becomes the default competition: `/` heroes it and `/predict`
  redirects to it. The archived WC never competes for attention.

### Homepage
- New active-competition band (`components/home/HomeCompetitions.tsx`): heroes
  the live competition; lists archived ones under **"Past Competitions"**.
- The legacy World-Cup billboard is wrapped in `HideWhenActiveCompetition` — it
  vanishes the moment a competition goes public. Pre-launch it still shows, so
  nothing breaks before you flip the PL.

### Profile — Competition History
- New section on **`/iq`** (`components/profile/CompetitionHistory.tsx`): per
  competition — **final rank, total points, IQ earned, best private-league
  finish**. Foundation for a Hall of Fame. Migration **`052`**.

### Not built (correctly — out of scope)
No new gameplay features. Everything above is deployment machinery for the
objectives you set.

---

## 2. Pre-deployment checklist

| Item | Status | Note |
|---|---|---|
| Competition routing | ✅ verified | `/premier-league`, `/wc2026`, legacy `/predict/*` redirects (earlier phases) |
| Premier League seed | ✅ prepared | `seeds/premier-league-2026-27.sql`; **not yet applied** |
| Competition Wizard | ✅ built | `/admin/competitions/new` (migration 049) |
| Leaderboards | ✅ built | competition-scoped; bonus-leak fixed (038) |
| Private leagues | ✅ built | archived comps blocked from new create/join |
| Prediction sheet | ✅ built + played | one-tap H/D/A, autosave |
| Autosave | ✅ verified | optimistic, per-row revert |
| Match locking | ✅ built | DB `enforce_prediction_deadline` (untouched) |
| Results | ✅ built + played | live + settling states |
| Scoring | ✅ verified | 5/3/2/0; TS mirror pinned to SQL (9 tests) |
| Archive mode | ✅ built | lifecycle=archived + read-only triggers + banner |
| Redirects | ✅ verified | `/predict/*` → active competition |
| Mobile | ✅ verified | prototype played at 375px |
| Desktop | ✅ verified | routes render |
| Production build | ✅ green | `next build` compiles, 54 routes |
| Database migrations | ✅ prepared | 051, 052 ready; **not applied** |
| Rollback plan | ✅ see §4 | per-migration + Vercel one-click |
| Typecheck | ✅ clean | `tsc --noEmit` |
| Tests | ✅ 164 pass | |

**Cannot be verified here (needs production DB):** the actual apply of 051/052,
the seed insert, the archive triggers firing against live data, and the
Competition History RPC against real rows. These are the §5 manual steps.

---

## 3. Manual steps you must perform (in order)

All SQL runs in the Supabase SQL editor for project `agtyfbqxmrobliqybrvz`.
**Take a database backup first.**

1. **Apply the engine migrations** if not already applied: `037` → `050`
   (see `docs/PHASE_1_2_RUNBOOK.md`). If your production is already on the
   engine, skip to step 2.
2. **Apply `051_competition_lifecycle.sql`.** Read the NOTICEs — it archives the
   World Cup and initialises the PL (if seeded) to draft.
3. **Apply `052_competition_history.sql`.**
4. **Seed the Premier League:** run `seeds/premier-league-2026-27.sql`.
5. **Deploy the application** (push to `main` → Vercel).
6. **Verify the World Cup archive:** open `/wc2026` — confirm the ARCHIVED
   banner, leaderboards and predictions all still show, and that creating a
   league there is rejected.
7. **Test the Premier League privately:** `/admin/competitions` → Premier
   League → set **Internal testing**. Now only admins see `/premier-league`.
   Play a full matchweek: predict, autosave, complete → celebration, leaderboard.
8. **Go live when ready:** `/admin/competitions` → Premier League → **Public
   (live)**. This runs the launch gate, then flips it public. The homepage now
   heroes the PL; the WC drops to Past Competitions automatically — **no second
   deployment**.
9. **(Optional) live results:** set `ingest_enabled = true` and confirm
   `provider_league_id = 39` once you want automated scoring; back-fill provider
   fixture IDs first (`/api/admin/backfill-provider-ids?competition=premier-league`).

> The whole point of the lifecycle control: steps 7→8 need **no deployment**.
> Test for days on Internal, then one click to Public.

---

## 4. Rollback procedure

| Layer | How | Notes |
|---|---|---|
| **Application** | Vercel one-click rollback to previous deployment | Fast, proven |
| **Lifecycle mistake** | `/admin/competitions` → set the competition back | e.g. Public → Internal; instant, no deploy |
| **Migration 052** | `drop function if exists public.get_my_competition_history();` | Profile section then renders nothing — harmless |
| **Migration 051** | Rollback block at foot of the file: drop the 3 triggers + 2 functions + the lifecycle setting rows | **The World Cup remains fully accessible** — it just loses the archive write-guard. Predictions stay closed by kickoff dates regardless. |
| **PL seed** | `delete from competitions where slug='premier-league'` cascades to season/rounds/teams/fixtures | Only safe before users predict on it |
| **Full stop** | Set PL back to `draft` (hidden) via admin | Instant "unlaunch" with no data loss — the safest abort |

The safest abort if anything looks wrong post-launch: **flip the PL to Draft.**
It disappears from users immediately, the World Cup is untouched, and you
investigate with zero data loss.

---

## 5. Known issues / caveats

1. **Not applied to production.** No Supabase access here. 051/052 and the seed
   are written and locally reasoned but have not run against live data. Apply on
   a backup-first basis and read the NOTICEs.
2. **Engine migrations 037–050 assumed applied.** If production hasn't had the
   earlier phases, do `docs/PHASE_1_2_RUNBOOK.md` first — 051 depends on the
   settings + wizard infrastructure. Migration 040 (the stage-constraint change)
   still needs the staging rehearsal noted there.
3. **Competition History RPC is unmeasured at scale.** `get_my_competition_history`
   does per-competition rank subqueries; fine for a handful of competitions and
   normal user counts, but run `EXPLAIN ANALYZE` if a user is in many leagues.
4. **Homepage marketing copy below the hero** still references the World Cup in
   places (feature cards, prize section). The *hero* and *Past Competitions* are
   correct and competition-driven; a full marketing-copy refresh of the lower
   sections was out of scope for this deploy and is cosmetic.
5. **`provider_league_id = 39`** (Premier League on API-Football) should be
   confirmed against your plan before enabling ingestion.

---

## 6. Estimated deployment time

| Step | Time |
|---|---|
| Backup + restore-test | 15–20 min |
| Apply 051 + 052 | 5 min |
| Seed the Premier League | 2 min |
| App deploy (Vercel) | 3–5 min |
| Verify WC archive + PL internal | 15 min |
| Play a full test matchweek | 5 min |
| Flip to Public | 1 min |
| **Total (excluding any 037–050 catch-up)** | **~45–55 min** |

If engine migrations 037–050 are **not** yet on production, add the Phase 1–2
runbook time (including the mandatory 040 staging rehearsal) — budget a half-day
for that separately.

---

## 7. One-line summary

Everything is built, typechecked, tested and build-clean. The deploy is now a
**backup → apply 2 migrations → seed → deploy → test on Internal → one click to
Public** sequence, all reversible, with the World Cup preserved as a read-only
archive throughout.
