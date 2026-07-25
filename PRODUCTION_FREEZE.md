# PRODUCTION FREEZE — SuperBrain World Cup 2026

**Status:** ACTIVE
**Declared:** 17 July 2026
**Expected lift:** after all conditions in §4 are met (earliest 20 July 2026)
**Scope:** the World Cup Predictor competition (`wc2026`) and every system that can alter its results.

---

## 0. Ownership

| Role | Owner |
|---|---|
| **Product owner · final approval** | **Dylan** |
| **Technical investigation · proposed fixes** | **Claude** |
| **Production changes** | **Require Dylan's explicit written approval.** No exceptions. |
| **Emergency exception** | Only issues threatening **final scoring, leaderboard accuracy, prize determination, security, or availability**. |
| **Every emergency change requires** | ① a rollback plan captured *before* the change ② post-deployment verification ③ a written record in the closure checklist |

**Claude does not apply production changes.** Claude investigates, prepares statements with their
rollback, and presents evidence. Dylan approves and applies. A prepared script is not an approved
script — see `scripts/PROPOSED-019b-leaderboard-tiebreak.sql`, which is guarded against execution for
exactly this reason.

---

## Why

Fixture 104 (the final) kicks off **19 July 2026, 20:00 UTC** at MetLife Stadium. Live predictions,
automatic scoring and IQ minting are all active. The grand prize — the Custom Champion Watch — has
not been awarded, and its winner is determined by the leaderboard this system produces.

Until the champion is confirmed, **the correctness of the existing competition outranks all
architectural work.** The Competition Engine project (Premier League support) is approved in
principle and begins only after this freeze lifts.

---

## 1. Frozen systems

No change may be made to the following without meeting the emergency bar in §3.

### Database — frozen absolutely

| Object | Reason |
|---|---|
| `fixtures` (schema **and** rows) | Holds the final. Stage/status constraints, kickoff times, results. |
| `predictions` (schema **and** rows) | User entries and `points_awarded`. |
| `competitions`, `teams` | Competition identity and participants. |
| `bonus_questions`, `bonus_predictions` | Unscored at time of writing; decide the overall champion. |
| `economy_ledger` and all `economy_*` tables | IQ is minted from prediction points. |
| **All constraints, indexes, triggers, RLS policies** | Especially `fixtures.stage` and `fixtures.status` CHECKs. |
| **All migrations** | No new migration is applied to production during the freeze. |

### Functions — frozen absolutely

- `score_fixture_predictions` (trigger)
- `rescore_fixture` / `rescore_competition`
- `enforce_prediction_deadline` (trigger)
- `economy_award_fixture`
- `get_predictor_leaderboard` / `get_league_leaderboard` / `get_my_predictor_stats`
- `admin_set_fixture_result`, `admin_set_bonus_answer`, `admin_lock_bonus_question`

### Files — do not modify

| Path | Why |
|---|---|
| `supabase/predictor-schema.sql` | Scoring + locking + leaderboards |
| `supabase/migrations/**` | No new or edited migrations |
| `lib/ingestion.ts` | Result ingestion — **incl. `findDbFixtureByKickoff` (line 211)** |
| `app/api/cron/ingest-results/route.ts` | Writes results |
| `app/api/cron/advance-knockout/route.ts` | Propagates the bracket into the final |
| `lib/predictor.ts` | Prediction, leaderboard and admin data access |
| `lib/economy.ts` | IQ |
| `app/predict/**` | Live prediction UI |
| `app/admin/fixtures/**`, `app/admin/bonus/**` | Result and bonus entry |
| `vercel.json`, `.github/workflows/**` | Live schedulers — see `docs/EMAIL_CRON_INVESTIGATION.md` |

> **Known issue held under freeze:** `findDbFixtureByKickoff` matches provider fixtures to database
> fixtures by a ±90-minute kickoff window. This is **safe for the remainder of the World Cup** (one
> match at a time, hours apart) and **unsafe for the Premier League**. It is documented in
> `docs/FIXTURE_IDENTITY_RISK.md` and fixed in Phase 1. Do not touch it now.

---

## 2. Not frozen

The freeze is narrow on purpose. The following may proceed normally:

- Cognitive tests (`app/tests/**`, `lib/matrix/**`, `supabase/matrix-schema.sql`)
- Battle (`app/battle/**`, `supabase/battle-schema.sql`)
- Public profiles, onboarding, network and missions surfaces **that do not write to `economy_ledger`**
- Marketing, legal and static pages (`app/privacy`, `/terms`, `/contact`, `/disclaimer`)
- Documentation, including everything produced by Phase 0
- Planning and design work for the Competition Engine — **planning only, no code**

If a change is not on the §1 list and cannot alter a World Cup result, a leaderboard position or an
IQ balance, it is not frozen.

---

## 3. Allowed emergency changes

Only a defect that **corrupts the competition or blocks the prize** qualifies. Examples that qualify:

- The final's result is wrong, missing, or scored against the wrong fixture
- Predictions fail to lock at kickoff
- Scoring does not fire, or double-fires, for fixture 104
- A leaderboard misranks users, or tie-breaks incorrectly
- Bonus scoring awards the wrong answer
- Ingestion writes a result to the wrong fixture

Examples that **do not** qualify: duplicate match-day emails (annoying, not corrupting), cosmetic
bugs, performance, and everything in the Phase 1 plan.

**Procedure for an emergency change:**

1. Post the evidence before the fix — the symptom, the query that proves it, the blast radius.
2. Prefer the narrowest instrument available, in this order:
   `admin_set_fixture_result` → `rescore_fixture(<id>)` → a targeted admin route → code change.
   `rescore_competition` recalculates every prediction and is a last resort.
3. Two people confirm before execution. Never during a live match unless the match itself is the fault.
4. Record what ran, when, by whom, and the row counts affected, in the closure checklist.
5. Re-verify against the leaderboard snapshot afterwards.

**Never, under any circumstances, during the freeze:** apply a migration, alter a constraint, edit a
trigger or scoring function, or change fixture matching.

---

## 4. Required validation after the final

The freeze does not lift when the final ends. It lifts when every item in
**`docs/WORLD_CUP_CLOSURE_CHECKLIST.md`** is verified and signed off. In summary:

1. Fixture 104 identity, kickoff and lock confirmed
2. Official result entered and matches the real-world score
3. Scoring completed exactly once — no duplicate `points_awarded`, no duplicate IQ
4. Global leaderboard verified, including tie-breaks
5. Private and public league leaderboards verified
6. Bonus questions locked, answered and scored
7. Grand-prize winner confirmed and recorded
8. Final leaderboard exported and stored as the **immutable Phase 0 reference snapshot**
9. Full production database backup taken and restore-tested
10. No fixtures left in `scheduled` or `live`
11. Competition marked `completed` — **last, and only after 1–10**

Item 8 is the one that matters most to the Competition Engine: every later phase is proved correct by
diffing against that snapshot. Without it, "we did not change scoring" is an assertion rather than a
fact.

---

## 5. Conditions for lifting the freeze

All of:

- [ ] Closure checklist complete and signed off
- [ ] Grand-prize winner confirmed and communicated
- [ ] Final leaderboard snapshot exported, stored and independently readable
- [ ] Production backup taken **and a restore verified** (an untested backup is not a backup)
- [ ] Production schema baseline captured — see `docs/SCHEMA_DRIFT_REPORT.md` §Capture
- [ ] Schema drift reconciled or consciously accepted, in writing
- [ ] Named owner for Phase 1

The freeze lifts by an explicit written decision, not by the calendar.

---

## 6. Rollback

| Layer | Method | Notes |
|---|---|---|
| Application | Vercel one-click rollback to the previous deployment | Fast, proven. Project `prj_GIjsXzlloGDlZpy3KEs8RQnvRcnK`. |
| Database schema | **No automated path.** Migrations are applied by hand in the Supabase SQL editor. | See `docs/MIGRATION_HISTORY_ASSESSMENT.md`. This is precisely why no migration runs during the freeze. |
| Database data | Supabase PITR / daily backup, subject to plan tier | **Unverified — confirm the tier and test a restore before lifting the freeze.** |
| Scoring | `rescore_fixture(<uuid>)` is idempotent and recomputes from `fixtures.home_score`/`away_score` | Safe to re-run; economy reconciles rather than double-mints. |
| Ingestion | Disable the GitHub Actions workflow `ingest-results.yml` | Stops all automated result writes immediately. |

**Escalation contact:** Dylan — see §0.
**Backup/restore owner:** Dylan (Supabase dashboard access required; Claude has none).

---

## 7. Open blockers

Tracked in full in the Phase 0 report. The two that gate everything:

1. **No production schema baseline exists yet.** The repository is known to differ from production
   (see `docs/SCHEMA_DRIFT_REPORT.md`). No migration can be safely planned until this is captured.
2. **Staging environment unconfirmed.** There is one `NEXT_PUBLIC_SUPABASE_URL`, which implies Vercel
   preview deployments run against production. If true, Phase 1 has no safe rehearsal target and
   preview builds expose admin write routes to live data.
