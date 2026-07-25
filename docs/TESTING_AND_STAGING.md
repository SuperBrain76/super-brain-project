# Testing & Staging — Recommendations

**Date:** 17 July 2026
**Status:** recommendations only. **Nothing installed. No staging created or connected.**

---

## Part 1 — Testing

### During the freeze: no framework. Agreed.

Installing a test runner means touching `package.json`, `package-lock.json` and CI two days before the
final. That is a build-system change on the deploy branch to gain confidence about code nobody is
allowed to change. **Not worth it.**

### For the final: read-only SQL, already delivered

Where automated tests do not exist, the verification is SQL. These are written and ready:

| Script | Covers | Status |
|---|---|---|
| `scripts/verify-leaderboard-rpc.sql` | Tie-break ordering · which RPC version is live · current vs. intended prize ranking · bonus inclusion | ✅ Ready — **run this before the final** |
| `docs/WORLD_CUP_CLOSURE_CHECKLIST.md` | Fixture identity · kickoff · prediction lock · result · scoring completion · duplicate scoring · duplicate IQ · global/league/public leaderboards · bonus scoring · tie-breaks · pending fixtures | ✅ Ready — 20 items, each with its query |
| `scripts/capture-production-schema.sql` | Scoring/leaderboard function definitions · constraints · triggers · RLS | ✅ Ready |

All read-only. All safe during the freeze. **Together they are the test suite for the final** — they
just run by hand instead of in CI.

### Post-final: the smallest viable setup

**Runner:** `vitest` — one dev dependency, zero config for plain TypeScript, runs `lib/*.ts` directly.
Do not add Jest (heavier, needs config) or Playwright (E2E is not the gap here).

```
npm i -D vitest
# "test": "vitest run"
```

**Six suites, in priority order.** Each maps to a real defect risk already identified:

| # | Suite | Tests | Why | Needs DB? |
|---|---|---|---|---|
| 1 | **Fixture matching** | 🔴 **Ten fixtures at an identical `kicks_off_at` → each result lands on its own fixture.** Unmatched fixture logs and writes nothing. Rescheduled fixture updates `kicks_off_at` without orphaning predictions. | The Premier League blocker. Today's code **fails** this test — write it first so it fails for the right reason. | No — `findDbFixtureByKickoff` is pure |
| 2 | **Scoring** | The 5/3/2/0 matrix: exact → 5, GD → 3, result → 2, wrong → 0. Boundary cases: 0-0 draw, high scores, `points_awarded` null before result. | Guards the Phase 1.5 extraction. This suite **is** the zero-delta proof. | Yes — Postgres |
| 3 | **Tie-break ordering** | Users tied on `total_points` order by exact → gd → result → bonus → predictions. Fully-tied users get stable ranks. | The defect found in Phase 0.1. No test would have caught four conflicting definitions. | Yes |
| 4 | **Prediction locking** | Insert/update rejected at and after `kicks_off_at`. Accepted one second before. Reschedule moves the lock. | The deadline trigger is the fairness guarantee. | Yes |
| 5 | **IQ idempotency** | `rescore_fixture` twice → balance unchanged. Economy failure does not block scoring (the exception guard). No mint while status is abandoned/unresolved. | The ledger is append-only. Wrong mints cannot be deleted. | Yes |
| 6 | **Competition isolation** | A fixture in competition A never appears in B's leaderboard. Leagues scoped correctly. Knockout cron no-ops when `has_knockout: false`. | The whole point of the Competition Engine. | Yes |

**Suite 1 needs no database** — `findDbFixtureByKickoff`, `extractScore`, `mapStatus` and
`getPollReason` are all pure functions. **Start there.** It is the highest-value suite and the cheapest
to stand up: `npm i -D vitest`, one file, done.

Suites 2–6 need Postgres. Use `supabase start` (local, free, Docker) — see Part 2. Do not point tests
at production. Ever.

**Order:** suite 1 immediately post-final (no infrastructure needed) → local Supabase → suites 2–5
before Phase 1.5 touches scoring → suite 6 alongside Phase 1.2.

---

## Part 2 — Staging

**Agreed and adopted: Phase 1 migrations must not run directly against production.** Item 1.2 (the
`fixtures` stage CHECK swap) is the reason — it alters a constraint on the table holding every
prediction, and there is no tested database restore.

### Options

| # | Option | Cost | Prod impact | Fidelity | Setup |
|---|---|---|---|---|---|
| **1** | **Local Supabase** (`supabase start`, Docker) | **Free** | **None** — never touches prod | Schema-exact, synthetic data | ~30 min |
| **2** | **Second free Supabase project** | **Free** (2 free projects/org; 500 MB; pauses after 7 days idle) | **None** — separate project | Schema-exact, synthetic data, real network conditions | ~1 hr |
| **3** | **Supabase branching** | **Paid** — requires Pro (~$25/mo) plus ~$0.01/hr per active branch | Low, but couples to the prod project | Highest — git-integrated | ~2 hrs + GitHub integration |

### Recommendation: **1 + 2**

**Local (1) for iteration, a free hosted project (2) for the migration rehearsal.**

- **Local** gives fast, free, offline runs for test suites 2–6, and it costs nothing to throw away.
- **A free hosted staging project** is where item 1.2 gets rehearsed. It exercises the real PostgREST
  layer, real RLS, real `SECURITY DEFINER` behaviour and real network — the things local Docker
  approximates but does not reproduce.

**Not branching (3)**, at least not now: it needs a paid plan, it couples staging to the production
project, and its main advantage — per-PR ephemeral databases — solves a problem you do not have with
one developer and eight sequential migrations. Revisit if the team grows.

### On data

**Do not restore a production backup into staging.** It carries real emails, display names, countries
and birth years into a second system with a second attack surface, for no testing benefit.

Generate synthetic data instead — the shapes that matter are small:

- 1 competition, 104 fixtures, 48 teams (the WC seed already exists: `supabase/seeds/wc2026-fixtures.sql`)
- ~50 synthetic users with randomised predictions
- **10 fixtures sharing one `kicks_off_at`** — the Premier League case that today's code fails
- A handful of deliberate ties on `total_points` — the case Phase 0.1 just proved is untested

That last pair is the entire point. Real data would not contain either.

### Setup steps — for approval, not yet executed

**Option 1 (local):**
```bash
npm i -D supabase          # or: brew install supabase/tap/supabase
npx supabase init          # creates supabase/config.toml — new file, no prod impact
npx supabase start         # local Postgres + PostgREST in Docker
# apply repo SQL in documented order, then seed synthetic data
```
⚠️ `supabase init` writes `supabase/config.toml`. Harmless, but it is a repo change — **approval
needed before I run it.** Requires Docker Desktop.

**Option 2 (free hosted):**
1. Create a Supabase project `superbrain-staging` (free tier, same region).
2. Apply the repo SQL in documented order — **this is also Phase 1.0 step 3**, the test that proves the
   repo reproduces production.
3. Diff its schema against `schema-production-baseline-2026-07.sql`. Iterate until empty.
4. Seed synthetic data.
5. Add staging env vars to a Vercel **Preview** environment — which also closes the
   "previews run against production" gap flagged in the migration assessment.

**Step 5 is worth calling out separately.** It fixes a live risk: today every PR preview is an admin
console pointed at production data. Repointing previews at staging is a security improvement
independent of Phase 1 — but it is a Vercel environment change, so it waits for the freeze to lift.

### Cost summary

**£0 / $0.** Options 1 and 2 are both free tier and neither touches production. No paid infrastructure
is required for Phase 1. Revisit only if branching becomes worthwhile.

---

## What I need from you

1. **Approval to run `supabase init` locally** (writes `supabase/config.toml`) — or defer to post-freeze.
2. **Decision: local, free hosted, or both.** Recommendation: both.
3. **Confirmation** that synthetic data is acceptable in staging (it is my strong recommendation over a
   production restore).

None of this is urgent. All of it is post-freeze. It is here so the decision is made before Phase 1.2
arrives and needs somewhere to rehearse.
