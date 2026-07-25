# Competition Engine V2 — Audit & Implementation Plan

**Date:** 24 July 2026
**Status:** 🚫 **AUDIT ONLY — NO CODE WRITTEN. Awaiting approval.**
**Target first competition:** English Premier League 2026/27
**Supersedes nothing.** Extends `docs/PHASE_1_PLAN.md`, which remains correct and is absorbed here as Phase 1.

---

## 0. Executive summary

**The good news:** the predictor was built generically from day one. `competitions`, `teams`,
`fixtures`, `predictions`, `prediction_leagues` are already the right nouns with the right foreign
keys. `predictor-schema.sql` line 2 literally says *"Generic Prediction Engine Schema."* There are
**zero tables and zero columns** named after the World Cup. This is a rename-and-extend job, not a
rewrite.

**The bad news is narrower but sharper than expected.** Five things block a Premier League launch,
and three of them only become dangerous when a **second competition exists**:

| # | Blocker | Severity | Only bites with 2+ competitions? |
|---|---|---|---|
| 1 | Fixture identity is inferred from kickoff time (±90 min) | 🔴 Corrupts data | No — bites on PL alone (10 simultaneous kickoffs) |
| 2 | `fixtures.stage` CHECK constraint has 7 hardcoded WC values — a league fixture **cannot be inserted** | 🔴 Blocks entirely | No |
| 3 | **Bonus points leak across competitions in both leaderboard RPCs** | 🔴 Wrong winners | **Yes — new finding, see §3.1** |
| 4 | No `rounds`/matchweek entity — required by matchweeks, matchday challenges, and every windowed leaderboard | 🔴 Blocks features | No |
| 5 | No competition in the URL — `/predict` is hardcoded to `getCompetition("wc2026")` in 10 pages | 🟡 Blocks navigation | **Yes** |

**Three requested features have no foundation at all** and are genuinely new work, not refactors:

- **Friends leaderboard** — there is no friend, follow, or connection model anywhere in the codebase.
- **Weekly / monthly leaderboards** — leaderboard RPCs aggregate all-time with no date or round filter.
- **Matchday Challenges** — `bonus_questions` is competition-scoped with one lock time and
  `answer_type CHECK IN ('team','player')`. Round scoping, over/under and boolean answers are all absent.

**Recommended sequence:** finish the World Cup closure (Phase 0, already specified) → land the Phase 1
foundations already planned → **then** the multi-competition work, which is where the new findings
live. The PL launch is realistically Phases 0–6.

---

## 1. What exists today

### 1.1 Stack and scale

Next.js 14 App Router (all `"use client"`), TypeScript, Tailwind, Supabase (Postgres + Auth + RLS),
PostHog, Vercel. Capacitor wrappers for iOS/Android. Result ingestion runs from GitHub Actions every
5 minutes; two email crons run from Vercel and two more from Actions.

Predictor surface: **20 pages** (`app/predict/**`, `app/admin/**`), **8 components**
(`components/predictor/`), **1,350 lines** in `lib/predictor.ts`, **333 lines** in `lib/ingestion.ts`,
**546 lines** in `supabase/predictor-schema.sql`, plus **36 migrations**.

### 1.2 Data model as built

```
competitions (id, name, slug, status, starts_at, ends_at)
  └── teams (id, competition_id, name, code, flag_emoji, group_name, fifa_ranking*)
  └── fixtures (id, competition_id, stage▲, group_name, fixture_number,
                home_team_id, away_team_id, home_score, away_score,
                kicks_off_at, venue, status▲)
        └── predictions (id, user_id, fixture_id, home_score, away_score, points_awarded)
  └── bonus_questions (id, competition_id, question_key, points_value, answer_type▲, locks_at, ...)
        └── bonus_predictions (id, user_id, question_id, answer_team_id, answer_text, points_awarded)
  └── prediction_leagues (id, competition_id, name, invite_code, created_by, is_public, ...)
        └── prediction_league_members (id, league_id, user_id, joined_at)

▲ = closed CHECK constraint    * = exists in production but not in the repo (drift)
```

**Everything hangs off `competition_id`.** That is the single most valuable property of the existing
build and the reason multi-competition is achievable rather than a rewrite.

### 1.3 Behaviour worth preserving verbatim

| Asset | Why it is worth keeping |
|---|---|
| Three-gate ingestion pre-flight (window → DB fixtures → active match) | Genuinely well built. Keeps API quota near zero on off days. Generalize the gates, do not replace them. |
| `extractScore()` FT-only invariant for AET/PEN | Correct football rules (90-min result), hard-won. |
| `economy_award_fixture` **reconciling** ledger writes | Writes the *delta*, so rescores top up or claw back instead of double-minting. Rare and correct. |
| Economy call wrapped in an exception guard inside the scoring trigger | An IQ failure can never block match scoring. Keep this shape. |
| DB-level deadline trigger `enforce_prediction_deadline` | Locking is enforced in Postgres, not the client. Already correct for the PL. |
| `admin_set_fixture_result` RPC with `app_admins` check (migration 005) | Server-side admin auth already exists. |
| Six-column leaderboard tie-break (migration 019) | Thought through, prize-grade. Reuse as-is. |
| League invite-code flow, moderation, owner controls, public/featured leagues | Complete and battle-tested. Zero changes needed beyond scoping. |

---

## 2. What must be renamed

**Almost nothing.** This is the headline finding.

There are **no** tables, columns, RPCs, types or components named after the World Cup. The literal
string `wc2026` appears in exactly three categories:

| Category | Count | Action |
|---|---|---|
| `getCompetition("wc2026")` in page components | 10 call sites | Replace with a resolver (Phase 1.6, already planned) |
| `.eq("slug", "wc2026")` in API routes | 12 call sites | Take competition from the request/config (Phase 2) |
| Seeds, one-off WC repair routes, audit scripts | ~10 files | **Leave alone.** Historical. Archive the repair routes. |

Genuine renames — all cosmetic, all optional:

- `lib/predictor.ts` → could become `lib/competition.ts`. **Recommend not doing this.** It touches
  every import in the app for zero functional gain. Rename later, or never.
- `get_predictor_leaderboard` → the name is already generic ("predictor", not "world cup").
- `bonus_questions` / `bonus_predictions` → **do not rename.** They hold frozen WC history. New
  work goes in new `challenges` tables (§4.4).

---

## 3. What must be generalized — and the risks

### 3.1 🔴 NEW CRITICAL FINDING — bonus points leak across competitions

`supabase/migrations/019_leaderboard_tiebreak.sql`, both leaderboard RPCs:

```sql
bonus_pts AS (
  SELECT ap.user_id, coalesce(sum(bp.points_awarded), 0) AS pts
  FROM all_predictors ap
  LEFT JOIN public.bonus_predictions bp
         ON bp.user_id = ap.user_id
        AND bp.points_awarded IS NOT NULL     -- ⚠️ no competition filter
  GROUP BY ap.user_id
)
```

`bonus_predictions` joins to `bonus_questions`, which is where `competition_id` lives — **and that
join is missing.** The CTE sums *every bonus point the user has ever scored, in any competition*,
and adds it to their total for **this** competition.

- **Today:** harmless. One competition exists, so the unfiltered sum equals the filtered sum.
- **The moment a second competition has scored bonus questions:** every global and league leaderboard
  is wrong. A user who did well in the World Cup starts the Premier League with a points head start
  they did not earn. This determines prizes.

`get_my_predictor_stats` (migration 006) **does** filter correctly by `competition_id`. So the two
will disagree — the user's own stat card will show a different total than their leaderboard row.
That divergence is the symptom to watch for.

> **This is the single most important finding in this audit.** It is invisible today, it is cheap to
> fix (add one join and one predicate), and it silently produces wrong prize winners if missed. It
> must be fixed **before** any second competition scores a bonus question, and the fix must be proved
> zero-delta against the World Cup closure snapshot.

### 3.2 🔴 `fixtures.stage` CHECK blocks league fixtures

```sql
stage text not null check (stage in ('group','r32','r16','qf','sf','3rd','final'))
```

A Premier League fixture has no valid value. **Insert fails.** Already scoped as Phase 1.2 and
correctly flagged there as the riskiest migration in the plan — it alters a constraint on the table
that every prediction points at.

### 3.3 🔴 Fixture identity — `findDbFixtureByKickoff`

Fully documented in `docs/FIXTURE_IDENTITY_RISK.md`. Summary: results are matched to fixtures by a
±90-minute kickoff window, safe only because World Cup matches are ≥3 hours apart. Ten Premier League
matches kick off at 15:00 on a Saturday.

**The audit doc understates one thing.** `app/api/cron/ingest-results/route.ts` has since grown a
team-name matcher (lines 304–333) that partly mitigates this, but it:

- matches on **either** team (`home === apiHome || away === apiAway || home === apiAway || away === apiHome`),
- falls back to `findDbFixtureByKickoff` — **first match wins, silently** — when the name match fails,
- and is bypassed entirely by `useSingleMatchFallback` (line 294), which assigns the API result to
  *whatever single fixture is in progress* without checking teams at all.

The claim-set (`claimedDbIds`) prevents two API results landing on one DB row, but does not prevent a
result landing on the **wrong** row. Only a provider fixture ID fixes this. Phase 1.1.

### 3.4 🟡 Stale invariant in `lib/ingestion.ts`

The header comment (lines 8–20) and the block comment above `extractScore` (lines 154–171) both state:

> *"CRITICAL INVARIANT: This function NEVER returns non-null scores for a match that has not fully
> concluded at 90 minutes."*

**The code no longer does that.** `extractScore` returns live running goals for live statuses
(lines 192–198), and the ingest route deliberately writes them (line 360: `newStatus === "live" || newStatus === "completed"`)
so points fluctuate during a match. That was a deliberate live change; the comments were not updated.

Consequences: the scoring trigger fires on every score change during a match, not once. This is
**safe today** because `economy_award_fixture` reconciles deltas and `rescore` is idempotent — but it
means with 10 simultaneous PL matches, a Saturday afternoon produces roughly 10× the trigger volume
and ledger churn the World Cup ever generated. Worth load-testing (Phase 7), not worth changing.

### 3.5 🔴 No `rounds` / matchweek entity

`fixtures` has `stage`, `group_name`, `fixture_number`. There is nothing that says "Matchweek 12".

This blocks **four** requested features simultaneously: matchweek navigation, matchday challenges,
weekly leaderboards, and round-scoped fixture loading. It is the keystone of Phase 2.

### 3.6 🟡 Everything loads every fixture

`app/predict/page.tsx` loads all 104 fixtures on mount, `getFixtures` has a 15-second cache and no
pagination, `get_predictor_leaderboard` is `LIMIT 200` with no offset parameter.

- 1 competition × 104 fixtures — fine.
- 1 competition × 380 fixtures — slow.
- 3 competitions × 380 fixtures with a competition switcher — unusable.

Round-scoped loading (§3.5) is the fix, not caching.

### 3.7 🟡 Competition is not in the URL

Routes are `/predict`, `/predict/[fixtureId]`, `/predict/leaderboard`, `/predict/bonus`… all
hardcoded to `wc2026`. With three simultaneous competitions there is nowhere to put "which one".
This is a routing change across ~20 pages.

### 3.8 🟢 Component-level WC assumptions

| File | Assumption | Fix |
|---|---|---|
| `components/predictor/GroupStandings.tsx:31` | `f.stage !== "group" \|\| !f.groupName` → skip | Filter on `has_table`; allow a single ungrouped table (a league table **is** this component with one group) |
| `lib/predictor.ts:1330` `stageLabel()` | Hardcoded 7-entry map | Read `competition_stages.label` |
| `lib/knockoutSeeds.ts` | Entirely WC-specific (fixtures 73–104) | Leave. Gate on `has_knockout`. |
| `app/predict/bracket/page.tsx` | Bracket UI | Leave. Gate on `has_knockout`. |
| `app/api/cron/advance-knockout` | Propagates bracket winners | Gate on `has_knockout` — **must not run for the PL** |

`GroupStandings` is the best reuse story in the codebase: a Premier League table is mathematically
the same object as a World Cup group table with one group.

### 3.9 🟡 Economy inflation across simultaneous competitions

`economy_event_types.prediction_score` mints IQ per scored prediction, competition-agnostic. Three
active competitions ≈ 3× the IQ minting rate, against an economy tuned for one 104-match tournament.
Not a correctness bug — an economy-balance decision. Needs a per-competition multiplier or cap in
`competition_settings`, and a call from you on the target rate.

### 3.10 🟢 Non-football sports

`fixtures` is `home_team_id` vs `away_team_id`; `predictions` is `home_score` / `away_score`. Formula 1
(finishing order), cricket (innings, wickets, DLS) and rugby (try counts, bonus points) do not fit.

**Recommendation: do not solve this now, and do not design it out.** Reserve the shape —
`fixtures.prediction_type` and a nullable `predictions.payload jsonb` — so a non-score sport slots in
without touching the proven integer path. Football competitions (PL, CL, La Liga, Serie A,
Bundesliga, Ligue 1, MLS) are all served by the existing model and are the realistic next five.

---

## 4. Target architecture

### 4.1 Entity model

```
sports                (code, name, has_draw, default_prediction_type)
  └── competitions    (id, sport_code, slug, name, status, ...)          ← already exists
        └── seasons   (id, competition_id, slug, label, status, is_current, starts_at, ends_at)
              └── rounds        (id, season_id, code, label, sort_order, kind,
                                 opens_at, locks_at, starts_at, ends_at)
              └── season_teams  (season_id, team_id)        ← promotion/relegation
              └── fixtures      (+ season_id, round_id, provider, provider_fixture_id)
                    └── predictions                          ← unchanged
              └── challenges    (id, season_id, round_id, question_text, answer_type,
                                 options jsonb, points_value, locks_at, correct_answer jsonb)
                    └── challenge_answers (user_id, challenge_id, answer jsonb, points_awarded)
        └── competition_stages   (competition_id, code, label, sort_order, has_table, is_knockout)
        └── competition_settings (competition_id, key, value jsonb)
        └── scoring_rules        (competition_id, rule_code, points, sort_order)
        └── prediction_leagues   (competition_id)            ← already exists, stays competition-keyed
              └── prediction_league_members (+ season_id, nullable)
user_connections      (user_id, friend_id, status)           ← new, for friends leaderboard
```

### 4.2 The two rules that make simultaneous competitions safe

> **Rule A — every aggregate is scoped.** No sum, count, rank or window may cross a `season_id`
> boundary without saying so explicitly. §3.1 is what happens when this rule is broken once.
>
> **Rule B — every route carries the competition.** If a page cannot name its competition from its
> own URL, it cannot be correct in a multi-competition world.

Enforcement: a single test that seeds two competitions with overlapping users and asserts that every
leaderboard, stat card and challenge total is identical to the same competition run alone. That test
would have caught §3.1 the day it was written, and it is the acceptance gate for Phase 2.

### 4.3 Why `season` and not just `competition`

"Premier League" is permanent. "Premier League 2026/27" is one instance. A private league called
*The Office* should survive into 2027/28 with its members and its history — which is only possible if
league identity attaches to the **competition** and participation attaches to the **season**. This
was already decided (`PHASE_1_PLAN.md` §1.3, 17 Jul) and this plan does not reopen it.

Consequence for teams: `teams` stays keyed on `competition_id` so a club row persists across
promotion and relegation; `season_teams` records who actually played in a given season. Standings and
squad lists read `season_teams`; historical predictions keep resolving.

### 4.4 Matchday Challenges — design

New tables, deliberately **not** a migration of `bonus_questions`. The WC bonus data is frozen
history and there is no reason to touch it.

```sql
challenges (
  id, season_id, round_id,               -- round_id NOT NULL → always matchweek-scoped
  question_key, question_text,
  answer_type,                           -- team | player | boolean | over_under | number | choice
  options        jsonb,                  -- e.g. {"line": 2.5} or {"choices": ["Arsenal","Chelsea"]}
  points_value   integer,
  sort_order     integer,
  locks_at       timestamptz NOT NULL,   -- = first kickoff of the round
  status         text,                   -- open | locked | answered | void
  correct_answer jsonb
)
challenge_answers (
  id, user_id, challenge_id, answer jsonb, points_awarded, submitted_at, updated_at,
  UNIQUE (user_id, challenge_id)
)
```

- **2–5 per matchweek**, optional, enforced by a check on insert count.
- **Lock at the first kickoff of that round only** — this is the whole point. A user joining in
  matchweek 20 is not permanently behind, which is exactly the flaw of season-long bonus questions.
- `locks_at` is **stored, not derived at read time**, and recomputed by a trigger when a fixture in
  the round is rescheduled. Deriving it live means a postponed opening match silently reopens a
  locked challenge.
- Scored by an admin-set `correct_answer`, or auto-settled from fixture data for the mechanical types
  (total goals, clean sheets, highest-scoring team). **Auto-settlement is Phase 5b, not MVP** —
  manual settlement with a documented rule set ships first, exactly as `docs/BONUS_SETTLEMENT_RULES.md`
  already does for the World Cup.

Leaderboards read bonus points through a single view over both sources:

```sql
create view v_bonus_points as
  select bp.user_id, bq.competition_id, null::uuid as season_id, bp.points_awarded  -- legacy WC
    from bonus_predictions bp join bonus_questions bq on bq.id = bp.question_id
  union all
  select ca.user_id, s.competition_id, c.season_id, ca.points_awarded               -- challenges
    from challenge_answers ca join challenges c on c.id = ca.challenge_id
                              join seasons s on s.id = c.season_id;
```

One code path, both eras, and the competition filter that §3.1 is missing becomes structural rather
than remembered.

### 4.5 Leaderboards V2

One RPC replaces the current pair:

```sql
get_competition_leaderboard(
  p_season_id uuid,
  p_scope     text,     -- 'global' | 'league' | 'friends'
  p_scope_id  uuid,     -- league_id when scope='league', else null
  p_window    text,     -- 'round' | 'month' | 'season'
  p_window_id uuid,     -- round_id when window='round'
  p_from      timestamptz,  -- when window='month'
  p_to        timestamptz,
  p_limit     integer,      -- pagination, finally
  p_offset    integer
)
```

Windowing filters on `fixtures.round_id` or `fixtures.kicks_off_at`. Tie-break ordering from
migration 019 is reused **unchanged** — it is good and it is proven.

> **⚠️ Decision needed — what does "weekly" mean?**
> Premier League matchweeks do not align with calendar weeks: MW12 might run Friday to Monday, and
> international breaks leave empty weeks. **Recommendation: "weekly" = matchweek (round).** It is what
> users actually mean, it is what challenges lock to, and it never produces an empty leaderboard.
> Calendar-week is available but would show blank weeks during breaks. Your call.

Monthly is calendar month over `kicks_off_at` in the competition's timezone. Season is all-time
within the season — the existing behaviour.

**Performance:** these are on-the-fly aggregates. At PL scale (380 fixtures × N users × 3 windows ×
several competitions) this needs a covering index on `predictions(fixture_id, user_id, points_awarded)`
and one on `fixtures(season_id, round_id, kicks_off_at)`. If it is still slow under load, materialize
round totals into `leaderboard_round_totals` — **but measure first.** Do not build a cache for a
problem that has not appeared.

### 4.6 Friends leaderboard

Nothing exists. Three options:

| Option | Cost | Honest assessment |
|---|---|---|
| **(a)** Reuse `referrals` — "your network" | Near zero | Directed, not mutual. Someone who invited you is not necessarily a friend. Cheap but semantically wrong. |
| **(b)** New `user_connections` with mutual accept | ~1 table + 3 RPCs + UI | **Recommended.** Small, correct, and reusable by Battle and the cognitive tests later. |
| **(c)** Treat private leagues as friends | Zero | Already shipped — this is what private leagues *are*. Arguably the friends leaderboard already exists under a different name. |

**Recommendation: (b), but scheduled after the PL launch** unless you want it at launch. If launch
timing is tight, (c) is a defensible answer to a user asking "where's my friends leaderboard?" —
point them at private leagues.

---

## 5. Database changes required

Grouped by phase. Every migration is additive unless marked.

| Phase | Migration | Type | WC risk |
|---|---|---|---|
| 1.0 | Schema reconciliation baseline | Read-only no-op | None |
| 1.1 | `fixtures.provider`, `fixtures.provider_fixture_id` + unique | Additive | None (WC ingestion disabled) |
| 1.2 | `competition_stages` + **drop `fixtures.stage` CHECK** + FK | ⚠️ **Constraint change** | Highest in the plan |
| 1.3 | `seasons` + nullable `season_id` on fixtures/teams/bonus_questions | Additive, inert | None |
| 1.4 | `competition_settings` | Additive | None |
| 1.5 | `scoring_rules` + both scoring functions read from it | `create or replace` | Medium — must prove zero-delta |
| **2.1** | **Fix bonus leak in both leaderboard RPCs** | `create or replace` | **Must prove zero-delta** |
| 2.2 | `rounds` + `fixtures.round_id` (nullable) | Additive | None |
| 2.3 | `season_teams` | Additive | None |
| 2.4 | `sports` + `competitions.sport_code` (default `'football'`) | Additive | None |
| 2.5 | Multi-active competitions: drop the "one active" assumption | Code only | None |
| 3.1 | PL season + 20 teams + 38 rounds + 380 fixtures | Data | None |
| 4.1 | `get_competition_leaderboard` (new; old RPCs kept as thin wrappers) | Additive | None if wrappers are exact |
| 4.2 | Leaderboard indexes | Additive | None |
| 4.3 | `user_connections` | Additive | None |
| 5.1 | `challenges`, `challenge_answers`, `v_bonus_points` | Additive | None |
| 5.2 | Challenge lock trigger on fixture reschedule | Additive | None |
| 6.1 | `prediction_league_members.season_id` (nullable) | Additive | None |
| 7.1 | `prizes`, `rewards` (if in scope — see §8) | Additive | None |

**Two migrations change existing behaviour: 1.2 and 1.5. Everything else is additive.** Both are
already scoped in `PHASE_1_PLAN.md` with rollback and zero-delta tests. 2.1 joins them and needs the
same treatment.

---

## 6. APIs and routes to refactor

### 6.1 Cron routes

| Route | Change | Risk |
|---|---|---|
| `cron/ingest-results` | Loop over **all active competitions**; provider config from `competition_settings`; match by `provider_fixture_id`; remove `useSingleMatchFallback`; **no silent first-match fallback** | 🔴 High — the data-integrity path |
| `cron/advance-knockout` | **Gate on `has_knockout`** — must no-op for the PL | 🟡 Medium |
| `cron/email-matchday` | Round-aware; must not send one email per competition per day | 🟡 Medium |
| `cron/email-standings` | Same; per-competition digests or one combined | 🟡 Medium |

`isTournamentWindow()` (hardcoded 11 Jun – 20 Jul 2026) currently makes ingestion a **no-op** — it has
been returning `skipped: outside_tournament_window` since 20 July. Replace with a window derived from
fixtures (gate 2 already does this correctly). Until then there is no live writer, which makes this
the safest possible moment for Phase 1.1.

### 6.2 Admin routes

Eight `app/api/admin/fix-*` routes are one-off World Cup repairs (`fix-fixture-96`, `fix-sf-direct`,
`fix-bracket-direct`, `fix-r16-team`, `fix-penalty-winners`, `fix-stuck-fixture`, `audit-duplicates`,
`bracket-status`). **Archive them** — move to `scripts/wc2026-repairs/` or delete after the closure
snapshot. They are live HTTP endpoints against production data with narrow auth, and they have no
purpose after closure. This is a security tidy-up, not a refactor.

Keep and generalize: `set-fixture-result`, `sync-kickoff-times`, `set-knockout-teams`, `results`.

### 6.3 Pages

`/predict/**` becomes `/predict/[competition]/**` (or `/c/[competition]/**`). Twenty pages. The
resolver from Phase 1.6 supplies the competition; the route param overrides the default. Old
`/predict/*` URLs redirect to the current default competition so nothing already shared breaks.

New: a competition switcher, and a home surface that lists the user's active competitions.

---

## 7. Risks to the World Cup implementation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Phase 1.2 constraint change corrupts `fixtures` | Low | Strict step order; verify every stage resolves *before* dropping the CHECK; staging rehearsal is **mandatory** |
| Scoring-rule extraction (1.5) changes a historical point | Low | Rescore the entire completed WC; assert **zero** rows differ from the closure snapshot |
| Bonus-leak fix (2.1) changes historical WC ranks | **Very low but must be proved** | With one competition the filtered and unfiltered sums are identical by definition — assert it, don't assume it |
| Leaderboard V2 (4.1) changes WC ranks | Low | Keep old RPCs as wrappers; diff both against the snapshot |
| Historical WC pages break under the new routing | Medium | Redirect `/predict/*` → `/predict/wc2026/*`; keep the bracket and group pages gated on `has_knockout` |
| A PL fixture appears in a WC leaderboard | Low | Rule A + the two-competition isolation test (§4.2) |
| IQ inflation from 3 simultaneous competitions | **High if unaddressed** | Per-competition economy multiplier (§3.9) — needs a product decision |

**The governing mitigation is the closure snapshot** (`WORLD_CUP_CLOSURE_CHECKLIST.md` item 8). Every
"we did not change the World Cup" claim in this plan is provable only by diffing against it. Without
that file, all of the above becomes assertion.

---

## 8. Phased implementation plan

### Phase 0 — Close the World Cup and unblock (🚫 gate)

Already specified in `PRODUCTION_FREEZE.md` §5 and `WORLD_CUP_CLOSURE_CHECKLIST.md`. Not restated.
Four additions this audit surfaced:

1. **Commit the Phase 0 docs.** `PRODUCTION_FREEZE.md`, `PHASE_1_PLAN.md`, `SCHEMA_DRIFT_REPORT.md`,
   `FIXTURE_IDENTITY_RISK.md` and five others are **untracked** (`git status` shows `??`). The
   governing documents for this project exist only on one laptop.
2. **Install a test runner.** There is none — no Jest, no Vitest, no test script in `package.json`.
   Phases 1.1, 1.5 and 2.1 are unverifiable without one. Vitest, one afternoon.
3. **Confirm or create staging.** Still unconfirmed (`PRODUCTION_FREEZE.md` §7). Phase 1.2 must not
   run against production without a rehearsal.
4. **Archive the eight WC repair endpoints** (§6.2).

**Exit:** freeze lifted in writing · snapshot exported · backup restore-tested · schema baseline
captured · tests runnable · staging exists.

---

### Phase 1 — Foundations

**Exactly `docs/PHASE_1_PLAN.md` 1.0 → 1.7.** That plan is well-specified and this audit does not
revise it. Summary: schema reconciliation (gate) → provider fixture IDs → competition stages →
seasons → competition settings → scoring rules → competition resolver → competition-aware analytics.

One addition: **Phase 1.7 (analytics) should move earlier, or run in parallel from day one.** PostHog
properties cannot be backfilled. Every event shipped without a competition dimension is permanently
unattributable, and Phase 3 starts emitting PL events.

**Exit:** a league fixture inserts · WC leaderboard zero-delta · no competition constants in
`lib/ingestion.ts` · every predictor event carries a competition id.

---

### Phase 2 — Multi-competition core 🔴

The heart of this project, and where the new findings live.

| Step | Work |
|---|---|
| 2.1 | **Fix the bonus-points leak** (§3.1). Add the `bonus_questions` join and the competition predicate to both RPCs. Prove zero-delta. **Do this first — it is the only correctness bug in this phase.** |
| 2.2 | `rounds` table + `fixtures.round_id`. Backfill WC fixtures to synthetic rounds (one per matchday) so the WC renders identically under round-aware code. |
| 2.3 | `season_teams` for promotion/relegation. |
| 2.4 | `sports` + `competitions.sport_code` default `'football'`. Reserve `prediction_type` — do not implement. |
| 2.5 | **Allow multiple `status = 'active'` competitions.** Audit every query that assumes one. |
| 2.6 | Routing: `/predict/[competition]/**` across ~20 pages + redirects from the old paths. |
| 2.7 | Competition switcher + "my competitions" surface. |
| 2.8 | 🔴 **Two-competition isolation test** (§4.2). This is the phase's acceptance gate. |

**Exit:** two competitions run side by side with byte-identical leaderboards to running each alone ·
WC renders unchanged at its new URL · every route names its competition.

---

### Phase 3 — Premier League data

| Step | Work |
|---|---|
| 3.1 | PL competition + 2026/27 season + 38 rounds + 20 teams + `season_teams` |
| 3.2 | Import 380 fixtures **with `provider_fixture_id` from the start** — never by kickoff matching |
| 3.3 | Crests and colours (no flag emoji for clubs — needs an asset pipeline the WC did not) |
| 3.4 | Generalize `GroupStandings` into a league table (`has_table`, single ungrouped table) |
| 3.5 | Reusable fixture importer: provider → validated staging → commit. **This is the "configuration not development" deliverable.** |
| 3.6 | Ingestion loops all active competitions; provider config from settings; `advance-knockout` gated off |

**Exit:** 380 PL fixtures with provider IDs · league table renders · a second competition could be
imported by configuration alone · PL invisible to users (`status = 'upcoming'`).

---

### Phase 4 — Leaderboards V2

| Step | Work |
|---|---|
| 4.1 | `get_competition_leaderboard` with scope + window + pagination (§4.5) |
| 4.2 | Old RPCs become exact wrappers; diff against the snapshot |
| 4.3 | Indexes; load-test at 380 fixtures × realistic user count |
| 4.4 | Round / monthly / season leaderboard UI |
| 4.5 | `user_connections` + friends leaderboard *(or defer — see §4.6)* |

**Exit:** all four windows correct and paginated · WC leaderboard zero-delta through the wrappers.

---

### Phase 5 — Matchday Challenges

| Step | Work |
|---|---|
| 5.1 | `challenges` + `challenge_answers` + `v_bonus_points` (§4.4) |
| 5.2 | Lock-at-first-kickoff, stored, with a reschedule trigger |
| 5.3 | Answer types: team, player, boolean, over/under, number, choice |
| 5.4 | Admin authoring UI (2–5 per round) + manual settlement |
| 5.5 | User UI on the round page |
| 5.6 | Challenge points flow into every leaderboard window through the view |
| 5.7 | *(5b, post-launch)* auto-settlement for mechanical questions |

**Exit:** a matchweek's challenges lock at its first kickoff and at no other time · a user joining at
MW20 is not disadvantaged · WC bonus history still scores identically.

---

### Phase 6 — Admin panel V2

Competition CRUD · season and round management · fixture import UI · settings editor · challenge
authoring · result entry across competitions · rescore tooling · **a competition-creation runbook**
proving the "configuration, not development" claim.

---

### Phase 7 — Launch hardening

Ten-simultaneous-kickoff lock test · ingestion load test on a full Saturday · email crons across
multiple competitions · economy rebalance decision (§3.9) · PL soft launch to admins via
`status = 'upcoming'` · analytics verified before first public traffic.

**Prizes and rewards** are named in your architecture list but not in the MVP list. Treated as Phase 7
or later — flag if you want them at launch.

---

## 9. Decisions needed from you

| # | Question | Recommendation |
|---|---|---|
| 1 | **"Weekly" = matchweek or calendar week?** | **Matchweek.** Never empty, aligns with challenges. |
| 2 | **Friends leaderboard at launch, or after?** | **After.** Private leagues already serve the need; `user_connections` is a real feature deserving its own slot. |
| 3 | **IQ minting rate with 3 simultaneous competitions?** | Per-competition multiplier in `competition_settings`; you set the target rate. |
| 4 | **Prizes/rewards in the PL MVP?** | **No.** Not in your MVP list. Phase 7+. |
| 5 | **Split abandoned-match void semantics into 1.8?** | **Yes** (question still open from `PHASE_1_PLAN.md`). Bundling it into 1.2 makes the riskiest migration riskier. |
| 6 | **Rename `lib/predictor.ts` → `lib/competition.ts`?** | **No.** Touches every import for zero functional gain. |
| 7 | **Fixture provider for the PL** — same API-Football plan? | Confirm league id and season, and quota headroom for Saturday 15:00 (10 matches × 5-min polling). |

---

## 10. What this audit did not cover

Stated plainly so the gaps are not mistaken for clean bills of health:

- **No production database access.** Everything here is static analysis of the repository. The
  schema drift in `docs/SCHEMA_DRIFT_REPORT.md` is unresolved and three objects
  (`teams.fifa_ranking`, `get_user_public_predictions`, `get_leaderboard_stats`) are still
  unconfirmed. **Phase 1.0 remains a hard gate.**
- **No runtime verification.** The bonus-leak finding (§3.1) is read from SQL, not observed. It should
  be confirmed with a query against production before and after the fix.
- **The economy, battle and cognitive-test systems** were surveyed only where they touch the
  predictor (IQ minting, `user_profiles`).
- **No load testing.** Every performance claim in §3.6 and §4.5 is reasoning about row counts, not
  measurement.

---

**Nothing in this document has been implemented. No file outside `docs/` has been touched.
Awaiting approval before any code changes.**
