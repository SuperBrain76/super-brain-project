# Schema Drift Report — Phase 0

**Date:** 17 July 2026
**Method:** static analysis of repository SQL vs. application queries. **No production access.**
**Status:** ⚠️ **INCOMPLETE — the Production column cannot be filled from this environment.**

---

## Read this first

Phase 0 asked for a production schema baseline at
`supabase/schema-production-baseline-2026-07.sql`. **That file has not been created, deliberately.**

This environment has no Supabase CLI, no `psql`, no `.env.local`, and no linked Supabase project.
There is no path from here to the production database.

I could have concatenated the repository's SQL files and named the result
`schema-production-baseline-2026-07.sql`. That would have been worse than producing nothing. The
entire purpose of that file is to be the one artifact everybody trusts when planning migrations
against live data — and its whole reason for existing is that **the repository is already known to
be wrong**. A baseline derived from the repository would encode the exact error it is meant to
detect, under a filename that asserts otherwise. Every later phase would then be verified against a
fiction.

**To produce it, run `scripts/capture-production-schema.sql`** (read-only, safe during the freeze),
or better, if you have the DB password:

```
supabase db dump --db-url "<CONNECTION_STRING>" --schema public \
  -f supabase/schema-production-baseline-2026-07.sql
```

Then complete the Production column below. Until that happens, **Phase 1 cannot start** — that is
the gate, and it is the single most important outcome of Phase 0.

---

## What static analysis *can* prove

Three objects are referenced by application code and defined in **no** repository SQL file. Since the
affected features work in production, these objects exist in the live database and were created
outside source control. `fifa_ranking` was already known. **The other two are new findings.**

### Confirmed drift

| Object | Repository State | Production State | Application Dependency | Risk | Required Action |
|---|---|---|---|---|---|
| `teams.fifa_ranking` | **Absent.** Not in `predictor-schema.sql`, no migration, no seed. | **Exists** (inferred with high confidence — `FIXTURE_SELECT` names it on every fixtures query; if absent, PostgREST would 400 and `/predict` would be broken. It is not.) | `lib/predictor.ts:275` (`FIXTURE_SELECT`), mapped at `:175` into `Team.fifaRanking` | **High** — proves the repo is not authoritative. Type/nullability/default all unknown. | Capture live definition; add a reconciliation migration recording it. |
| `get_user_public_predictions(p_user_id, p_competition_id)` | **Absent.** Migration 018 *mentions* it in a comment and adds the supporting RLS policy, but **never creates the function.** | **Unknown.** Either it exists (drift), or it does not and the call fails. | `lib/predictor.ts:1253` | **High** — see "Silent failure" below. | Confirm existence via capture block 7. If present, commit its source. If absent, `/predict/user/[userId]` is silently broken. |
| `get_leaderboard_stats` | **Absent.** No definition anywhere in `supabase/`. | **Unknown.** | `lib/leaderboard.ts:65` | **Medium** | Same as above. |

#### Silent failure — why the two RPCs are worth attention

Both call sites discard the error:

```ts
// lib/predictor.ts:1253
const { data: predData } = await supabase.rpc("get_user_public_predictions", { ... });
```

`supabase-js` does not throw on a missing function; it returns `{ data: null, error }`. With `error`
ignored, `predData` is `null`, the prediction map stays empty, and
`/predict/user/[userId]` renders fixtures with **no predictions and no error message** — visually
indistinguishable from a user who predicted nothing.

So there are exactly two possibilities, and both are findings:

1. **The function exists in production** → confirmed drift, same class as `fifa_ranking`.
2. **The function does not exist** → a live feature is broken and has been failing invisibly.

Capture block 7 settles it in one query. **Do not "fix" either case during the freeze** — reading
public prediction pages does not affect results or the prize.

---

## Under-specified, not drift

These are consistent between repo and app, but incomplete for Phase 1. Listed because Phase 0 asked
about them specifically.

| Object | Repository State | Application Dependency | Risk | Required Action |
|---|---|---|---|---|
| `fixtures.stage` CHECK | `check (stage in ('group','r32','r16','qf','sf','3rd','final'))` — `predictor-schema.sql:44`. **Never altered by any migration.** | `stageLabel()` `lib/predictor.ts:1330`; `GroupStandings.tsx:31` | **Blocker for Phase 1** (not for the WC) | **Verify the live definition** via capture block 5 before planning the Phase 1 migration. Do not touch during freeze. |
| `fixtures.status` CHECK | `('scheduled','live','completed','postponed')` | `lib/ingestion.ts:124–148` maps `ABD`→`postponed` | Medium — abandonment conflated with postponement | Phase 1. Verify live definition first. |
| **Fixture-provider identifier** | **Does not exist** in repo, app, or (presumably) production. | Matching is by kickoff proximity — `lib/ingestion.ts:211` | **Blocker for Premier League** | See `docs/FIXTURE_IDENTITY_RISK.md`. Absence is a design gap, not drift. |
| `competition_id` | Present and consistent on `teams`, `fixtures`, `prediction_leagues`, `bonus_questions`. FKs to `competitions(id)`, `on delete cascade`. | Leaderboard/stats RPCs take `p_competition_id` | **Low — this is the good news.** No drift found. | None. Confirm FK delete rules via capture block 4. |
| `predictions` constraints | `home_score`/`away_score` `not null`, `0..20`; `unique(user_id, fixture_id)` | `upsertPrediction` uses `onConflict: "user_id,fixture_id"` | Low — consistent | Verify the unique constraint survives in production (the upsert depends on it). |
| Scoring RPCs | `score_fixture_predictions` + `rescore_fixture` both exist; **the 5/3/2/0 matrix is written out twice** (`:266–276` and `:338–348`) | `adminRescoreFixture`, `adminRescoreCompetition` | Medium — duplication invites drift between the two paths | Phase 7. Verify both live definitions match the repo **before** the final, since rescore may be needed on fixture 104. |
| Leaderboard RPCs | Base defined in `predictor-schema.sql:410`, **superseded** by `migrations/019` (adds `match_points`, `bonus_points`, tie-breaks); `user_id` added by `migrations/014` | `lib/predictor.ts:987–1021` reads `match_points`, `bonus_points`, `correct_gd`, `correct_results`, `user_id` | **High if 019/014 were not applied** — the client would silently coalesce every tie-break column to `0` (`?? 0`), producing a wrongly-ordered leaderboard that *looks* fine. **The prize depends on this ordering.** | **Verify before the final.** Capture block 7 — confirm the live `get_predictor_leaderboard` returns all seven columns. This is the highest-priority pre-final check. |
| Bonus tables | `bonus_questions`, `bonus_predictions` — `migrations/006`; `answer_type` CHECK `('team','player')`; WC-specific seed | `lib/predictor.ts:1057–1148` | Low | None now. |
| Economy tables | `migrations/021–036` | `lib/economy.ts`, `missions.ts`, `network.ts` | **Unknown — see below** | Verify which migrations are actually applied. |

---

## Migrations that may never have been applied

Repository handover notes flag several migrations as "must be run on live DB", and the presence of
hand-assembled combined files (`deploy_economy_021-031.sql`, `deploy_033-034.sql`,
`deploy_035-036.sql`, each headed *"Paste once, Run"*) confirms migrations are applied manually
through the SQL editor.

**This is drift in the opposite direction: production may be *missing* objects the application calls.**

| Migration | Adds | If not applied |
|---|---|---|
| `032_battle_leaderboard` | `get_battle_leaderboard()` | Battles segment of `/leaderboard` fails to load |
| `033_profile_images_storage` | `profile-images` bucket + storage RLS | Avatar/banner upload fails |
| `034_network_referral_list` | `get_my_referrals()` | Invitee list renders empty |
| `035_onboarding` | `get_onboarding_status`, `set_onboarding_done` | `/welcome` errors |
| `036_multilevel_referral_foundation` | `economy_referral_upline/downline` | Foundation only — no user-visible effect |

None of these touch the World Cup, scoring, or the prize — so **none justify breaking the freeze.**
Capture blocks 7 and 12 resolve all five at once.

---

## Side finding — account deletion queries two non-existent tables

Not drift in the strict sense, and **not** a data-retention breach. Recording it because it is
direct evidence that application code and schema have diverged unnoticed, and because it will be
inherited by the Premier League.

`app/api/account/delete/route.ts:22–25`:

```ts
await sb.from("predictions").delete().eq("user_id", user.id);     // ✅ exists
await sb.from("league_members").delete().eq("user_id", user.id);  // ❌ real name: prediction_league_members
await sb.from("test_results").delete().eq("user_id", user.id);    // ✅ exists
await sb.from("profiles").delete().eq("id", user.id);             // ❌ real name: user_profiles
```

Two of the four table names are wrong, and **all four discard the returned error**, so the failures
are invisible.

**User data is still deleted**, because every affected table declares
`references auth.users(id) on delete cascade` (`schema.sql:13,68`; `predictor-schema.sql:71,95,109`),
and `sb.auth.admin.deleteUser()` on line 27 triggers the cascade. The two broken statements are
redundant no-ops that the foreign keys happen to cover.

So: correct outcome, by accident rather than design. Two caveats worth noting:

- If legacy `profiles` / `league_members` tables *do* exist in production (capture block 1 will say),
  the code is deleting from the wrong tables while the real ones cascade — same outcome, worse story.
- Any future table referencing `user_profiles` rather than `auth.users` would not be covered.

**Recommended action:** none during the freeze. Deletion works. Fix the names and check the errors in
Phase 1 alongside the other de-drifting work.

---

## False positives (checked and dismissed)

For completeness — these appeared in the automated diff and are **not** drift:

- `battle_profiles`, `battle_queue`, `battle_matches`, `battle_round_results`, and the battle RPCs
  (`find_or_create_battle`, `start_battle_round`, `submit_battle_answer`, `ensure_battle_profile`) —
  all defined in `supabase/battle-schema.sql`, which creates them **without** the `public.` prefix.
  A schema-qualification inconsistency, not a missing object.
- `matrix_attempts`, `matrix_responses` — same pattern in `supabase/matrix-schema.sql`.

---

## Verification checklist

Run `scripts/capture-production-schema.sql`, then confirm, in priority order:

- [ ] **`get_predictor_leaderboard` returns all seven columns** (migrations 014 + 019 applied) — *the prize depends on this. Check before the final.*
- [ ] `score_fixture_predictions` and `rescore_fixture` live definitions match the repo — *rescore may be needed on fixture 104*
- [ ] `teams.fifa_ranking` — exact type, nullability, default
- [ ] `get_user_public_predictions` — exists or not
- [ ] `get_leaderboard_stats` — exists or not
- [ ] `fixtures.stage` and `fixtures.status` live CHECK definitions
- [ ] Which of migrations 032–036 are applied
- [ ] Whether legacy `profiles` / `league_members` tables exist
- [ ] Any function, trigger, policy or index in production with no repository counterpart
- [ ] `supabase_migrations.schema_migrations` exists at all (block 12)

The first two are pre-final safety checks. The rest gate Phase 1.
