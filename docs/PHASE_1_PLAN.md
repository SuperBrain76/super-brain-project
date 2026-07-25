# Phase 1 Plan — Competition Engine Foundations

**Status:** 🚫 **NOT STARTED. Approval required.** Nothing here begins until `PRODUCTION_FREEZE.md` §5 is satisfied.
**Scope:** foundations only. **No Premier League implementation. No multi-sport abstraction. No UI redesign.**
**Revised:** 17 July 2026, following Phase 0 findings.

---

## What changed since the audit

Three Phase 0 findings revise the audit's sequence:

1. **Schema reconciliation is now a hard gate, not a task.** Drift is confirmed in *three* objects, not
   one (`teams.fifa_ranking`, plus `get_user_public_predictions` and `get_leaderboard_stats`, both
   called by the app and defined nowhere in the repo). Worse: **there is no migration ledger at all.**
   Every estimate below assumes 1.0 completes first, because none of them are trustworthy otherwise.
2. **Fixture identity moves to first implementation slot**, matching your priority ordering. The audit
   sequenced it sixth on dependency grounds; that was wrong. It is the only item on this list that can
   silently corrupt data, it is purely additive, and nothing else depends on it. It goes first.
3. **Competition settings splits in two.** The provider constant (`league=1&season=2026`) does not need
   to move for fixture identity to land. Splitting lets the correctness fix ship without waiting on a
   new config table.

**Sequence rationale:** gate first, then the correctness blocker, then the riskiest migration while the
system is quiet, then additive structure, then config, then the zero-risk edges.

| # | Change | Risk | DB? | Reversible |
|---|---|---|---|---|
| **1.0** | Schema reconciliation | 🔴 Gate | Read-only | n/a |
| **1.1** | Fixture identity — `provider_fixture_id` | 🟡 Medium | Additive | Yes |
| **1.2** | Competition stages — replace the CHECK | 🔴 High | **Constraint** | Yes |
| **1.3** | Seasons | 🟡 Medium | Additive | Yes |
| **1.4** | Competition settings | 🟢 Low | Additive | Yes |
| **1.5** | Competition-level scoring rules | 🟡 Medium | Additive | Yes |
| **1.6** | Competition resolver (edges) | 🟢 Low | **None** | Yes |
| **1.7** | Competition-aware analytics | 🟢 Low | **None** | Yes |

**1.6 and 1.7 have no database dependency** and can run in parallel with 1.1–1.5 by a second person.
Everything else is strictly sequential.

---

## 1.0 — Schema reconciliation 🔴 GATE

**Goal:** make the repository an accurate description of production. Nothing else may start first.

| | |
|---|---|
| **Tables** | None modified. Read-only inventory. |
| **Files** | `scripts/capture-production-schema.sql` (exists) → `supabase/schema-production-baseline-2026-07.sql` (new) → `supabase/migrations/037_schema_reconciliation.sql` (new) |
| **Migration** | One — **and it is a deliberate no-op against production.** `if not exists` / `or replace` only. It declares what production already has so a fresh database reproduces it. |
| **Backfill** | None. |
| **WC compatibility** | Total — nothing changes. |
| **Rollback** | n/a — no production change. |
| **Tests** | Apply the repo in documented order to an empty DB; diff against the captured baseline. **The diff must be empty.** That is the acceptance test. |
| **Deployment order** | First. Blocks everything. |
| **Feature flag** | None. |
| **Risk** | 🔴 **Gate** — not because it is dangerous, but because everything after it is dangerous without it. |

**Definition of done:** baseline committed · repo reproduces production exactly · the three known drift
objects explained · a decision recorded on adopting the Supabase CLI (`docs/MIGRATION_HISTORY_ASSESSMENT.md` §7 step 4).

---

## 1.1 — Fixture identity via provider fixture IDs 🟡

**Goal:** results land on the fixture they belong to. See `docs/FIXTURE_IDENTITY_RISK.md`.

| | |
|---|---|
| **Tables** | `fixtures` — **add** `provider` text, `provider_fixture_id` text, `unique(provider, provider_fixture_id)` |
| **Files** | `lib/ingestion.ts` (`findDbFixtureByProviderId`; `DbFixture` type) · `app/api/cron/ingest-results/route.ts` (select + match + log) · `app/api/admin/sync-kickoff-times/route.ts` (reuse for backfill) |
| **Migration** | One, additive. Nullable columns. **Add the unique constraint only after backfill verifies 104/104.** |
| **Backfill** | **Yes — and it is the crux.** `fetchAllFixtures()` returns all 104 provider fixtures in one API call. Match on **kickoff + both team names** (not kickoff alone). The WC's ≥3h spacing makes this unambiguous — the property that makes today's code safe also makes backfill safe. **Verify 104/104. Anything less is investigated by hand, never forced.** |
| **WC compatibility** | Full. Read-only against results — writes a new column, touches no score, no prediction, no point. WC ingestion is disabled by then (checklist item 20), so there is no concurrent writer. |
| **Rollback** | `drop column provider_fixture_id, provider` + revert the code. Kickoff matching still works for the WC. |
| **Tests** | 🔴 **The decisive one: ten synthetic fixtures at an identical `kicks_off_at`, ten provider results in arbitrary order — every result lands on its own fixture.** Today's code fails this; write it first so it fails for the right reason. Plus: unmatched fixture logs and writes nothing · rescheduled fixture updates `kicks_off_at` without orphaning predictions · replaying the full WC ingest produces **zero** point changes vs. the closure snapshot. |
| **Deployment order** | After 1.0. Before any PL fixture exists. |
| **Feature flag** | None needed — no PL data exists yet, and the WC is complete. |
| **Risk** | 🟡 Medium. Touches the ingestion path, but with the WC finished there is no live scoring to disturb. This is the safest window this change will ever have. |

**Definition of done:** simultaneous-kickoff test passes · 104/104 WC fixtures carry provider IDs ·
unmatched fixtures log instead of guessing · **no silent first-match selection anywhere in the code.**

---

## 1.2 — Competition stages: replace the closed CHECK 🔴

**Goal:** unblock league fixtures. Merges items 2 and 4 of your brief — they are the same work.

| | |
|---|---|
| **Tables** | **New** `competition_stages(competition_id, code, label, sort_order, has_table, is_knockout)`, `unique(competition_id, code)` · `fixtures` — **drop** the `stage` CHECK, **add** FK `(competition_id, stage)` → `competition_stages(competition_id, code)` |
| **Files** | `lib/predictor.ts:1330` (`stageLabel()` reads from the table) · `components/predictor/GroupStandings.tsx:31` (filter on `has_table`, not `stage === 'group'`) · `app/admin/fixtures/page.tsx` (stage filter — already generic) |
| **Migration** | One, **ordered strictly**: ① create table ② seed WC's 7 codes verbatim ③ **verify every existing fixture's stage resolves** ④ drop CHECK ⑤ add FK. If ⑤ fails, ④ alone is harmless and the system keeps working. |
| **Backfill** | Seed only. `fixtures.stage` values are unchanged — they simply point at rows now. |
| **WC compatibility** | Full, **provided step ③ passes**. Seven codes seeded exactly as the CHECK declares them: `group, r32, r16, qf, sf, 3rd, final`. Bracket and group tables must render identically. |
| **Rollback** | Re-add the CHECK, drop the FK and table. **Safe only while no league fixture exists** — which is precisely why this lands before any PL data. |
| **Tests** | Every existing WC fixture resolves to a stage row · a synthetic `league` fixture inserts successfully (fails today) · `stageLabel()` output for all 7 WC codes is byte-identical · group standings render identically · bracket page unchanged · **leaderboard matches the closure snapshot exactly.** |
| **Deployment order** | After 1.1. Before 1.3. |
| **Feature flag** | None — behaviour is identical for the WC. The flag would protect nothing. |
| **Risk** | 🔴 **High — the riskiest migration in the plan.** It alters a constraint on the table holding every prediction. Mitigated by ordering, by the WC being complete, and by rehearsing on staging first. **Do not run this without a staging rehearsal.** |

**Definition of done:** a league fixture inserts · WC bracket and tables visually unchanged · leaderboard
zero-delta vs. snapshot · `stageLabel()` and the standings filter both read from the table.

---

## 1.3 — Seasons 🟡

**Goal:** give the Premier League somewhere to put "current season" and "historical seasons".

| | |
|---|---|
| **Tables** | **New** `seasons(id, competition_id, slug unique, label, status, starts_at, ends_at, is_current)` · **add** nullable `season_id` to `fixtures`, `teams`, `bonus_questions` |
| **Files** | None in this phase. **This phase populates the column; nothing reads it yet.** That separation is the entire safety argument. |
| **Migration** | One, additive. All `season_id` columns **nullable**. |
| **Backfill** | One `seasons` row for the WC (`wc2026`, label `2026`, status `completed`, the existing `starts_at`/`ends_at`). Backfill `season_id` onto its 104 fixtures, 48 teams, 6 bonus questions. |
| **WC compatibility** | Full. `competition_id` remains the working key on every table and every query — permanently. `season_id` is purely additional. Both FKs coexist by design (audit rule 7: nothing removed or renamed). |
| **Rollback** | `drop column season_id` ×3 · `drop table seasons`. Nothing reads it, so nothing breaks. |
| **Tests** | Every WC fixture/team/bonus question has a `season_id` · **all existing RPCs return byte-identical results** · leaderboard zero-delta vs. snapshot. |
| **Deployment order** | After 1.2. |
| **Feature flag** | None — inert by construction. |
| **Risk** | 🟡 Medium — additive columns on the live table, but nothing consumes them yet. |

**Definition of done:** seasons exist and are backfilled · **not one existing query behaves differently.**

> ### ✅ DECIDED — private leagues across seasons (Dylan, 17 Jul 2026)
>
> **Decision:** league identity and membership persist across seasons, but a member must **explicitly
> activate or join** for each new season. Inactive members must **not** appear in a new season's
> leaderboard. For the first Premier League release, **preserve current behaviour** unless persistence
> can be added without delaying launch. Design the schema so season participation drops in cleanly.
>
> **Schema consequence — deliberately deferred, not designed out:**
>
> - `prediction_leagues` stays keyed on `competition_id`. **No `season_id` column.** A league belongs to
>   a competition; that is what makes it able to outlive a season.
> - Season participation is a **membership** concern, not a league concern. Add
>   `prediction_league_members.season_id` (nullable) later — a member row with `season_id = null` is a
>   legacy/all-seasons member; a row with a season is an activated participant.
> - `get_league_leaderboard` gains an optional `p_season_id`. When passed, it filters members to those
>   activated for that season. **This satisfies "do not automatically include inactive members" without
>   a single schema change in Phase 1.**
>
> **Phase 1 action: none.** The decision is satisfied by *not* adding `prediction_leagues.season_id` —
> which would have been the wrong grain and would have forced a new league row per season, destroying
> the persistent identity you asked for. The PL launches on current behaviour (one league per
> competition); activation lands when persistence is scheduled.

---

## 1.4 — Competition settings 🟢

**Goal:** move per-competition configuration out of code. Mirrors the existing `economy_config` pattern.

| | |
|---|---|
| **Tables** | **New** `competition_settings(competition_id, key, value jsonb)`, `unique(competition_id, key)` |
| **Files** | `lib/ingestion.ts:225` (**retire** `const WC2026 = "league=1&season=2026"`) · `lib/ingestion.ts:27–33` (**retire** `TOURNAMENT_START_MS`/`END_MS`/`isTournamentWindow()` — gate 2 already derives the window from fixtures correctly) · `app/api/cron/ingest-results/route.ts` · `app/api/cron/advance-knockout/route.ts` (**gate on `has_knockout`**) |
| **Migration** | One, additive. Seed WC keys: `provider: 'api-football'`, `provider_league_id: 1`, `provider_season: 2026`, `has_knockout: true`, `has_bonus: true`. |
| **Backfill** | Seed only. |
| **WC compatibility** | Full — seeded values reproduce today's hardcoded behaviour exactly. |
| **Rollback** | Revert code to the constants; drop the table. |
| **Tests** | WC settings reproduce the current provider query string byte-for-byte · `advance-knockout` **no-ops** for a competition with `has_knockout: false` · polling window derived from fixtures matches the old date-constant behaviour across the full WC calendar. |
| **Deployment order** | After 1.3. |
| **Feature flag** | None. |
| **Risk** | 🟢 Low — but note it touches ingestion, so it inherits 1.1's test suite. |

**Definition of done:** no competition-specific constants remain in `lib/ingestion.ts` · knockout cron
gated · WC behaviour unchanged.

---

## 1.5 — Competition-level scoring rules 🟡

**Goal:** one implementation of 5/3/2/0. **Extract, do not modify** (audit rule 6).

| | |
|---|---|
| **Tables** | **New** `scoring_rules(competition_id, rule_code, points, sort_order)` |
| **Files** | `supabase/predictor-schema.sql` — `score_fixture_predictions:266–276` and `rescore_fixture:338–348` both call one shared function |
| **Migration** | One: create + seed + replace both functions. `create or replace` — read-path change only, no stored data touched. |
| **Backfill** | Seed **exactly** today's values: `exact:5, gd:3, result:2, wrong:0`. |
| **WC compatibility** | **Proved, not assumed** — see Tests. |
| **Rollback** | `create or replace` back to the duplicated implementations. The functions are self-contained; reverting restores prior behaviour exactly. |
| **Tests** | 🔴 **Rescore the entire completed World Cup and assert zero rows change vs. the closure snapshot. That single test is the whole justification for this phase.** Plus the Phase 0 characterization matrix against the new function · the economy call stays inside its exception guard (`predictor-schema.sql:283–287`) so an economy failure still cannot block scoring. |
| **Deployment order** | After 1.4. |
| **Feature flag** | None. |
| **Risk** | 🟡 Medium — touches the function that awards points and mints IQ. Mitigated because the WC is complete: no live scoring, and rescore is idempotent. |

**Definition of done:** rules exist once · both paths call it · **WC rescore = zero delta.**

---

## 1.6 — Competition resolver at the edges 🟢

**Goal:** delete the literal `"wc2026"` from ~10 page components.

| | |
|---|---|
| **Tables** | None. |
| **Files** | **New** `resolveCompetition()` in `lib/predictor.ts` (`getCompetition(slug)` itself untouched). Call sites: `app/predict/page.tsx:81` · `bonus:298` · `standings:19` · `leaderboard:62` · `leagues:180` · `leagues/[id]:510` · `leagues/discover:204` · `user/[id]:49` · `app/leaderboard:382` · `app/admin/bonus:235` |
| **Migration** | **None.** |
| **Backfill** | None. |
| **WC compatibility** | Full — the default resolves to `wc2026`, so day-one behaviour is bit-identical. |
| **Rollback** | One commit. Vercel one-click. |
| **Tests** | Resolver unit tests (route param → settings → default) · manual pass over all ten routes confirming identical rendering. |
| **Deployment order** | **No DB dependency — may run in parallel with 1.1–1.5.** |
| **Feature flag** | None. |
| **Risk** | 🟢 Low — frontend only, single-commit revert. |

**Definition of done:** zero occurrences of `"wc2026"` outside seeds, the resolver default, and the
finished WC repair scripts · every page renders exactly as before.

---

## 1.7 — Competition-aware analytics 🟢

**Goal:** make events attributable. **Urgent despite being low-risk.**

| | |
|---|---|
| **Tables** | None. |
| **Files** | `lib/analytics.ts` + call sites. Add `competition_id`, `season_id`, `sport`, `prediction_type`, `league_id`, `matchweek`/`round`, `platform`, `notification_source` to predictor events. |
| **Migration** | **None.** |
| **Backfill** | 🔴 **Impossible — and that is the point.** PostHog properties cannot be added retroactively. Any PL event shipped without them is permanently unattributable. Closure checklist item 17 (export/annotate the WC period) is the only mitigation for historical data, and it must happen before PL traffic exists. |
| **WC compatibility** | Additive. Existing dashboards keep resolving. |
| **Rollback** | One commit. |
| **Tests** | Every predictor event carries a competition dimension · verify in PostHog live events **before** any PL traffic. |
| **Deployment order** | After 1.6 (the resolver supplies the ids). **Otherwise parallel.** |
| **Feature flag** | None. |
| **Risk** | 🟢 Low technically. **The risk is scheduling it late** — it is the only item here whose cost is irreversible if deferred. |

**Definition of done:** every predictor event carries a competition dimension · existing dashboards
unbroken · a competition breakdown is available before the PL emits its first event.

---

## Feature flags — the honest answer

**No feature-flag system exists in this codebase.** No `featureFlag`, no `feature_flag`, no
`isFeatureEnabled` anywhere in `lib/` or `app/`.

**Do not build one for Phase 1.** Every change above is either additive-and-inert (1.3), behaviourally
identical (1.2, 1.5), or a single-commit revert (1.6, 1.7). A flag would guard behaviour that does not
change.

For the **Premier League launch** — Phase 2, not this phase — the cheapest sufficient flag already
exists: `competitions.status = 'upcoming'` plus a `competition_settings` visibility key. The PL renders
end-to-end for admins while remaining invisible to users. That is a flag. It needs no infrastructure.

---

## Prerequisites — all blocking

- [ ] Freeze lifted per `PRODUCTION_FREEZE.md` §5
- [ ] Closure checklist signed off, **including the leaderboard snapshot** (item 14) — the reference for every zero-delta test above
- [ ] Production backup taken **and restore tested**
- [ ] Schema baseline captured; 1.0 complete
- [ ] **Staging environment confirmed or created** — 1.2 must not run against production without a rehearsal
- [ ] Test runner installed (there is none) — 1.1 and 1.5 are unverifiable without it
- [ ] Named owner
- [x] ~~Answer: do private leagues carry across seasons?~~ — **decided 17 Jul, see 1.3**
- [x] ~~Answer: what happens to predictions on an abandoned match?~~ — **decided 17 Jul, see below**

---

## ✅ DECIDED — abandoned match policy (Dylan, 17 Jul 2026)

**Policy:** predictions on an abandoned match with no official result are **void** — zero points, and
the fixture is **excluded from accuracy statistics** (not counted as a completed prediction).
Predictions are **preserved for audit, never deleted**. If the match resumes as the same official
fixture, keep the fixture and score it only on the final official result. If the provider creates a
**replacement** fixture, link it to the abandoned one but treat it as a **new prediction event**.
Admin can override status manually. **No IQ may be minted while a fixture is abandoned, suspended or
unresolved.**

### Schema consequence — this is now bigger than one CHECK value

The audit scoped this as "add `'abandoned'` to the status CHECK". The policy needs three more things:

| Need | Change | Why |
|---|---|---|
| Void ≠ zero | `predictions.points_awarded = 0` **and** exclusion from stats | `points_awarded = 0` today means *"wrong, and it counts"*. Void means *"does not count at all"*. **These are different states and the column cannot express both.** Add `predictions.voided boolean default false`, or use `points_awarded = null` + a fixture-status filter in the leaderboard. |
| Accuracy stats exclude it | `get_predictor_leaderboard` / `get_my_predictor_stats` filter out fixtures with status `abandoned`/`suspended`/`unresolved` | Otherwise `predictions` count inflates and the tie-break "most predictions submitted" rewards voided entries. |
| Replacement fixture linkage | `fixtures.replaces_fixture_id` (nullable self-FK) | "Link it but treat it as a new prediction event" — a self-FK gives the link; the existing `unique(user_id, fixture_id)` already makes it a separate prediction. |
| No IQ while unresolved | Guard `economy_award_fixture` on fixture status | Today the scoring trigger fires on `home_score`/`away_score` becoming non-null **regardless of status**. An abandoned match with a partial score written would mint IQ. |

### Status vocabulary

The policy names four states — `abandoned`, `suspended`, `unresolved`, plus resumption. The current
CHECK has `scheduled, live, completed, postponed`, and ingestion maps `SUSP`/`INT` → `live` and `ABD`
→ `postponed` (`lib/ingestion.ts:124–148`). Recommend adding **`abandoned`** and **`void`** only, and
treating "suspended"/"unresolved" as `live` (which already blocks scoring, because `extractScore`
returns null for non-final statuses). Fewer states, same guarantees.

### Revised risk

This moves item 1.2 from "add one CHECK value" to **"add a status value + a void concept + a stats
filter + an economy guard."** It touches `predictions`, which Phase 1 had explicitly promised not to
touch, and it changes leaderboard SQL.

**Recommendation: split it out.** The Premier League can launch without void handling — abandoned PL
matches are rare, and an admin can null the score and set status by hand in the interim. Adding
`'abandoned'` to the CHECK in 1.2 is cheap and unblocks the vocabulary; the void semantics, the stats
filter and the economy guard should be **Phase 1.8**, scoped and tested on their own. Bundling them
into the stage migration would make the riskiest migration in the plan riskier still.

**Awaiting your call on that split.**

---

## Explicitly out of scope

Premier League fixtures, teams, crests or branding · multi-sport abstraction · changes to
`predictions` · any UI redesign · rewards or prize entities · the `sport` / `prediction_type` columns
(they belong with 1.4 only when a second sport is actually scheduled) · admin competition CRUD ·
leaderboard pagination · fixing the account-deletion table names (`docs/SCHEMA_DRIFT_REPORT.md`
§Side finding — deletion works via FK cascade; tidy it opportunistically, not here).
