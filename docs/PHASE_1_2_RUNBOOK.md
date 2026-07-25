# Phases 1–2 Deployment Runbook — Competition Engine V2

**Written:** 24 July 2026
**Status:** ⏸ **Ready to apply. Nothing has been applied.**
**Applies:** migrations 037–046 and the code changes shipped alongside them.

> **Claude does not apply production changes** (`PRODUCTION_FREEZE.md` §0).
> Everything below is prepared, reviewed and reversible. Dylan applies it.

---

## 0. Before anything

These are **blocking**. Each one exists because a later step is unverifiable
without it.

- [ ] **Freeze lifted in writing** per `PRODUCTION_FREEZE.md` §5
- [ ] **Closure checklist signed off**, including the **leaderboard snapshot**
      — every "zero-delta" claim below is measured against it
- [ ] **Production backup taken AND a restore tested** (an untested backup is
      not a backup)
- [ ] **Production schema baseline captured** —
      run `scripts/capture-production-schema.sql`, save to
      `supabase/schema-production-baseline-2026-07.sql`
- [ ] **Staging exists.** Migration 040 must not touch production without a
      rehearsal. If there is genuinely only one Supabase project, say so and
      stop here — that is a decision, not an oversight.
- [ ] **Commit the untracked Phase 0 docs.** `git status` shows nine `??`
      files including `PRODUCTION_FREEZE.md` and `docs/PHASE_1_PLAN.md`. The
      governing documents for this project exist on one laptop.

---

## 1. Order of application

Strictly sequential. **Do not batch them.** Read the `NOTICE` output of each
before starting the next.

| # | Migration | Risk | Writes data? | Stop and check |
|---|---|---|---|---|
| 1 | `037_schema_reconciliation` | 🟢 no-op | Ledger row only | Any NOTICE containing **FINDING** |
| 2 | `038_bonus_competition_scope` | 🔴 correctness | No | Leaderboard checksum unchanged |
| 3 | `039_fixture_provider_identity` **part 1** | 🟡 | No | Columns exist |
| — | **Backfill provider ids** (HTTP, below) | 🟡 | **Yes** | Dry run is clean |
| — | `039` **part 2** (unique index, by hand) | 🟡 | No | Coverage is 104/104 |
| 4 | `040_competition_stages` | 🔴 **HIGH** | Seeds stages | **Staging rehearsal first** |
| 5 | `041_seasons` | 🟡 | Backfills season_id | 104 / 48 / 6 |
| 6 | `042_rounds` | 🟡 | Backfills rounds | 7 rounds, 0 unassigned |
| 7 | `043_competition_settings` | 🟢 | Seeds settings | `ingest_enabled = false` |
| 8 | `044_scoring_rules` | 🟡 | No | Points checksum unchanged |
| 9 | `045_sports` | 🟢 | No | — |
| 10 | `046_engine_indexes` | 🟢 | No | — |
| 11 | `047_hierarchy_integrity` | 🟡 | No | Blocks A–C of the 047/048 verifier |
| 12 | `048_competition_economy` | 🟡 | No | IQ totals unchanged |
| 13 | `049_competition_wizard` | 🟢 | Seeds templates | Templates listed |
| 14 | **Deploy the application** | 🔴 | — | See §4 — **routing changes** |
| 15 | `scripts/verify-phase2-isolation.sql` | 🟢 read-only | Rolls back | **Must pass** |

---

## 2. Step-by-step

### 1 — `037_schema_reconciliation` 🟢

Intended as a **deliberate no-op**. It declares what production already has.

```
Run: supabase/migrations/037_schema_reconciliation.sql
```

**Read every NOTICE.** Any line containing `FINDING` means production
differed from the repository and this migration was *not* a no-op — record it
in `docs/SCHEMA_DRIFT_REPORT.md`. In particular, if
`get_user_public_predictions` was **absent**, then `/predict/user/[userId]`
has been silently rendering empty prediction lists in production, because the
call site discards the error.

Also creates `public.schema_migrations`. **Versions 001–036 are deliberately
not backfilled** — we do not know which of them ran. Backfill by hand against
the baseline.

---

### 2 — `038_bonus_competition_scope` 🔴 the correctness fix

```
Run FIRST:  scripts/verify-038-bonus-scope.sql       → save the output
Run:        supabase/migrations/038_bonus_competition_scope.sql
Run AGAIN:  scripts/verify-038-bonus-scope.sql       → save the output
Diff them.
```

**Blocks A and B must be byte-identical.** Block C should list exactly one
competition (`wc2026`); if it lists two, the defect was already live and the
leaderboard has been wrong since the second competition scored a bonus
question.

**If block A or B differs: STOP.** Roll back by re-applying migration 019
verbatim and investigate before going further.

---

### 3 — `039` part 1, backfill, part 2 🟡

```
Run: supabase/migrations/039_fixture_provider_identity.sql   (part 1 only)
```

Then backfill — **dry run first, always**:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://superbrain.social/api/admin/backfill-provider-ids?competition=wc2026"
```

Read `ambiguous` and `unmappedInDatabase`. Both must be empty. The endpoint
**refuses to commit** a partial or ambiguous mapping (HTTP 409) — that is
deliberate, do not work around it.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://superbrain.social/api/admin/backfill-provider-ids?competition=wc2026&commit=1"
```

```
Run: scripts/verify-039-provider-ids.sql
```

Block A must show `mapped = total = 104`, block B zero rows, block D every
shared-kickoff group `OK`. **Only then** uncomment and run PART 2 of
migration 039 (the unique index) as a standalone statement.

---

### 4 — `040_competition_stages` 🔴 HIGHEST RISK

> This alters a constraint on `fixtures`, the table every prediction points
> at. **Rehearse on staging. Do not skip this.**

```
Staging:    supabase/migrations/040_competition_stages.sql
Verify on staging:
  • bracket page renders identically
  • group standings render identically
  • all 7 stage labels unchanged
  • leaderboard checksum unchanged
Then production.
```

The migration verifies every fixture's stage resolves **before** dropping the
CHECK, and aborts with nothing changed if not. If the FK step fails after the
CHECK is dropped, the system stays functional and strictly more permissive —
investigate and add the FK separately. **Do not re-add the CHECK.**

---

### 5–7 — `041`, `042`, `043` 🟡🟡🟢

```
Run: 041_seasons.sql   → expect 104 fixtures, 48 teams, 6 bonus questions
Run: 042_rounds.sql    → expect 7 World Cup rounds, 0 unassigned fixtures
Run: 043_competition_settings.sql
```

041 and 042 are additive and **inert** — nothing reads `season_id` or
`round_id` yet.

After 043, confirm the World Cup is configured as it actually behaves:

```sql
select key, value from public.competition_settings cs
join public.competitions c on c.id = cs.competition_id
where c.slug = 'wc2026' order by key;
```

`ingest_enabled` must be **false** (the tournament is over) and `is_default`
**true** (it is still the only competition).

---

### 8 — `044_scoring_rules` 🟡

```
Run FIRST:  scripts/verify-044-scoring.sql  blocks A–C   → save the output
Run:        supabase/migrations/044_scoring_rules.sql
Run AGAIN:  scripts/verify-044-scoring.sql  blocks A–C
```

`predictions_checksum` must be unchanged, and block B must report **0
mismatched predictions**. Block B is the one that matters: it recomputes
every prediction in pure SQL without calling any function under test.

Block D (full rescore) is optional, **writes**, and has its own preconditions.

---

### 9–10 — `045`, `046` 🟢

```
Run: 045_sports.sql
Run: 046_engine_indexes.sql
```

---

### 11 — `047_hierarchy_integrity` 🟡

Enforces **Sport → Competition → Season → Round → Fixture** with cross-row
triggers. Foreign keys prove a season *exists*; only a trigger can prove it is
the *right* season — that a fixture's season belongs to the fixture's own
competition.

```
Run FIRST: scripts/verify-047-048-hierarchy-economy.sql  blocks A–C
Run:       supabase/migrations/047_hierarchy_integrity.sql
```

Block A must show, for `wc2026`, `fixtures = with_season = with_round = 104`
and **zero half-assigned** rows. Block B must return **zero rows** in all four
sub-queries. If it does not, fix the data first — the trigger will reject
those rows on their next update and the error will surface at the worst
moment.

Fixtures with *neither* a season nor a round are exempt as legacy. Once
block A shows zero of those, the `NOT NULL` block at the foot of migration
047 becomes safe.

---

### 12 — `048_competition_economy` 🟡

Replaces the unread `economy_multiplier` setting with real per-competition,
per-event rules, and rewires `economy_award_fixture` to resolve through them.

```
Run FIRST: scripts/verify-047-048-hierarchy-economy.sql  blocks D–F  → save
Run:       supabase/migrations/048_competition_economy.sql
Run AGAIN: scripts/verify-047-048-hierarchy-economy.sql  blocks D–F
```

Block D (IQ minted per competition) must be **identical**. Block E must show
every row `OK`. Block F must return **zero rows** — the migration seeds no
rules deliberately, which is what makes it zero-delta by construction rather
than by careful seeding.

`economy_award_fixture` still reconciles deltas, so a later tuning change
corrects balances rather than double-minting.

---

### 13 — `049_competition_wizard` 🟢

Templates plus `admin_create_competition`, `admin_import_fixtures`,
`admin_launch_competition` and `admin_competition_readiness`.

```
Run: supabase/migrations/049_competition_wizard.sql
```

Confirm the templates landed:

```sql
select code, name, jsonb_array_length(stages) as stages,
       round_config ->> 'count' as rounds
from public.competition_templates order by sort_order;
```

Then blocks G and H of the verifier: no competition slug may collide with an
application route, and exactly one competition must be `is_default`.

---

## 3. Rollback

Each migration carries its own rollback block at the foot of the file. In
reverse order:

| Migration | Rollback | Caveat |
|---|---|---|
| 046 | drop the indexes | none |
| 045 | drop columns + `sports` | none |
| 044 | re-apply `predictor-schema.sql`, **then migration 021** | 021 restores the economy call |
| 043 | drop both settings tables | restore constants in `lib/ingestion.ts` |
| 042 | drop trigger, functions, `round_id`, tables | none |
| 041 | drop three columns + `seasons` | none |
| 040 | drop FK, re-add CHECK, drop table | **fails if a league fixture exists** — correct and protective |
| 039 | drop both columns | kickoff matching returns |
| 038 | re-apply migration 019 verbatim | none |
| 037 | none needed | no destructive statement |

**Application:** Vercel one-click rollback to the previous deployment.

---

## 4. Application deployment

Deploy **after** migrations 037–046, not before. The code reads
`get_competition_settings`, `competition_stages` and `rounds`.

It is written to degrade rather than crash if a migration is missing —
`parseSettings(null)` returns defaults, `getStageLabeller` falls back to the
legacy label map — but that is a safety net, not a supported order.

### 🔴 The routing change — read this first

**Every competition-scoped URL moves.** `/predict/*` is no longer the
predictor; the competition slug is now the first path segment.

| Before | After |
|---|---|
| `/predict` | `/wc2026` |
| `/predict/leaderboard` | `/wc2026/leaderboard` |
| `/predict/leagues/<id>` | `/wc2026/leagues/<id>` |
| `/predict/<fixture-uuid>` | `/wc2026/fixture/<fixture-uuid>` |

**Nothing breaks.** `app/predict/[[...rest]]/page.tsx` is an optional
catch-all that redirects every legacy path — including a bare fixture UUID,
which it re-nests under `/fixture/` — to the default competition, preserving
the query string so league invites (`?join=CODE`) still work. Verified for
`/predict`, `/predict/leaderboard`, a fixture UUID, and
`/predict/leagues/join?code=…`.

> **Do not delete that redirect route.** `/predict` URLs are in sent emails,
> shared WhatsApp invites, cached OG cards and the App Store listing. There is
> no expiry date on a link someone else already shared.

Unknown or malformed slugs now **404 server-side** from the segment layout, so
crawlers do not index typo'd URLs. A Supabase outage returns "unknown" rather
than "absent" and falls through to the client, so an outage cannot 404 every
competition at once.

### What changed

| Area | Change |
|---|---|
| `app/[competition]/**` | **14 pages moved here** from `app/predict/**` |
| `app/predict/[[...rest]]` | **New.** Legacy redirect catch-all |
| `components/CompetitionShell.tsx` | **New.** Resolves the competition once, 404s unknown, admin-preview banner |
| `components/CompetitionProvider.tsx` | **New.** Context + `useCompetition` / `useCompetitionSlug` / `useIsCompetitionRoute` |
| `components/CompetitionSwitcher.tsx` | **New.** Hidden while only one competition is visible |
| `lib/competitionRoutes.ts` | **New.** Path builders, reserved slugs, legacy translation |
| `lib/competitionAdmin.ts` | **New.** Wizard RPC wrappers + fixture CSV parser |
| `app/admin/competitions/**` | **New.** Competition list + Launch Competition wizard |
| `lib/ingestion.ts` | Competition config injected; **provider-id matching**; `isTournamentWindow()` replaced by a derived window; two dead team aliases fixed |
| `lib/competitionEngine.ts` | **New.** Settings, stages, seasons, rounds, round locking, competition list |
| `lib/predictor.ts` | `resolveCompetition()`, `getStageLabeller()`; sets the analytics competition context |
| `lib/analytics.ts` | Competition dimension on every predictor event |
| `app/api/cron/ingest-results` | Loops all enabled competitions; no kickoff fallback |
| `app/api/cron/advance-knockout` | **Gated on `has_knockout`**, fails closed |
| `app/api/admin/backfill-provider-ids` | **New.** Dry-run-by-default backfill |
| `app/api/admin/sync-kickoff-times` | Competition-aware; provider-id matched; now authenticated |
| `components/Nav`, `MobileBottomNav`, `ConditionalFooter` | Section detection via `useIsCompetitionRoute()` instead of a `/predict` prefix |
| 8 admin routes | **Archived** to `scripts/wc2026-repairs/` |

### Post-deploy smoke test

- [ ] `/wc2026` renders the World Cup exactly as before
- [ ] `/predict` redirects to `/wc2026`
- [ ] `/predict/leaderboard` redirects to `/wc2026/leaderboard`
- [ ] An old `/predict/<fixture-uuid>` link lands on `/wc2026/fixture/<uuid>`
- [ ] An old league invite `/predict/leagues/join?code=XXXX` keeps its code
- [ ] Bracket and group standings unchanged
- [ ] Global and league leaderboards match the closure snapshot
- [ ] Desktop nav and mobile bottom bar highlight correctly on `/wc2026/*`
- [ ] The competition switcher is **absent** (only one competition is visible)
- [ ] `/some-nonsense` returns a real 404
- [ ] `/tests`, `/battle`, `/admin`, `/iq`, `/u/<name>` all still resolve
- [ ] `/wc2026/user/[userId]` shows predictions *(see the 037 note — this may have been broken already)*
- [ ] PostHog: a predictor event carries `competition_id` and `competition_slug`
- [ ] Archived repair endpoints return 404

### Launching a second competition — the whole flow

1. `/admin/competitions` → **Launch competition**
2. Format (e.g. *Football league — 38 matchweeks*) → name → slug → season →
   scoring → IQ multiplier → settings → **Create**
3. Paste the fixture CSV → **Check CSV** → **Dry run** → **Import**
4. **Run checks** → fix anything blocking → **Go live**

No deployment, no migration, no code change.

### Cron check

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://superbrain.social/api/cron/ingest-results"
```

Expect `{"skipped": true, "reason": "no_competitions_with_ingestion_enabled"}`
— correct, because the World Cup has `ingest_enabled = false` and no other
competition exists yet.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://superbrain.social/api/cron/advance-knockout"
```

Expect it to run (the World Cup has `has_knockout = true`) and change nothing.

---

## 5. Phase 2 acceptance gate

```
Run: scripts/verify-phase2-isolation.sql
```

Creates a synthetic second competition sharing a user with the World Cup,
gives that user 999 bonus points and 5 match points in it, and asserts the
World Cup leaderboard is unchanged. **Rolls back — nothing survives.**

It must print `✅ ISOLATION PASSED`. If it raises `ISOLATION FAILURE`, an
aggregate somewhere still crosses a competition boundary and **Phase 3 must
not start**.

---

## 6. What is NOT in this deployment

Deliberate scope boundaries, so nothing here is mistaken for done:

- **No Premier League data.** No competition, season, teams or fixtures. This
  is the engine only — Phase 3, and you asked to review before it starts.
- **No Matchday Challenges.** Rounds — their foundation — are in, including
  the stored lock time and its reschedule trigger. The `challenges` tables
  are Phase 5.
- **No leaderboard windows.** `rounds` and the indexes are in;
  `get_competition_leaderboard` is Phase 4.
- **No `GroupStandings` generalisation.** It still filters
  `stage !== "group"`. Correct for the World Cup, wrong for a league table —
  Phase 3.4, alongside the Premier League UI.
- **No friends leaderboard.** Decided: private leagues already serve this.
- **No per-competition OG images.** Every competition currently shares the
  World Cup card. Accurate about the product, not about the competition —
  it needs crests and a template, so it lands with the Premier League UI.
- **No non-football sports.** `sports` and `prediction_type` are reserved and
  the wizard warns when a non-football sport is chosen, but predictions are
  still home/away integers. F1 and cricket need a real prediction payload,
  which is its own phase.

---

## 7. Known issues carried forward

| Issue | Where | Severity |
|---|---|---|
| Live scores fire the scoring trigger repeatedly during a match | `lib/ingestion.ts` `extractScore` | 🟡 Safe (economy reconciles) but ~10× trigger volume on a PL Saturday. **Load-test before launch.** |
| `getMyLeagues` filters by competition client-side | `lib/predictor.ts` | 🟢 Now indexed; still fetches all leagues |
| Monthly window helper is UTC, ignoring the `timezone` setting | `lib/competitionEngine.ts` `monthWindow` | 🟢 Documented; affects only fixtures near midnight on the 1st |
| Economy has no GLOBAL cap across simultaneous competitions | `competition_economy_rules` | 🟡 Per-competition, per-event tuning now exists and is wired. A platform-wide daily IQ ceiling does not. **Needs your call on the target rate per competition.** |
| `competition_economy_rules.user_cap` is declared but not enforced | migration 048 | 🟢 Documented as reserved. Enforcing it needs a per-user running total inside the set-based award statement — its own change. |
| Monthly leaderboard boundary is UTC, ignoring `timezone` | `lib/competitionEngine.ts` | 🟢 Affects only fixtures kicking off near midnight on the 1st |
| Two email crons are competition-unaware | `app/api/cron/email-*` | 🟡 Fine with one competition; will send duplicates with several. Phase 4. |
