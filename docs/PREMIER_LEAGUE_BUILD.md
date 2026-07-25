# Premier League — Build Status

**Started:** 25 July 2026
**Design:** `docs/PREMIER_LEAGUE_UX.md` (approved, §9 decisions locked)
**Rule:** engine unchanged; the World Cup stays byte-identical.

---

## Phase 3a — shipped

The spine of the experience: the living dashboard, the one-screen prediction
sheet, and the matchweek browser. **Not yet applied to production** (migration
050 + the code) — ships with the Phase 1–2 batch or after it.

### Logic (pure, fully unit-tested — 40 tests)

| File | What |
|---|---|
| `lib/matchweek.ts` | The six-state machine (Preview→Open→Locked→Live→Results→Break), derived from fixtures + round. No clock, no DB baked in. Countdown + headline + primary-action helpers. |
| `lib/matchweekPredictions.ts` | H/D/A ↔ score reconciliation (§9.1), goal bounds, kickoff grouping, sheet progress, the two bulk helpers (copy-last-week, fill-remaining). |
| `tests/matchweek.test.ts` | 40 tests pinning every state transition and the whole prediction model. |

> Two bugs the tests caught during the build: `isLive` using the clock alone
> made the LOCKED and between-batches states unreachable — now it requires
> live evidence (status or a running score). Progress counting had to exclude
> locked fixtures a user can no longer act on, or "4 of 10" would nag about a
> match that already kicked off.

### UI

| File | What |
|---|---|
| `components/premier/CompetitionHome.tsx` | The single living dashboard. One component, six state-specific heroes, persistent context strips (biggest match, challenges, league, season). Mobile-first column. |
| `components/premier/MatchweekSheet.tsx` | The one-screen sheet. Inline H/D/A, one-tap autosave (optimistic, per-row revert on failure), optional exact-score stepper, kickoff grouping, the Friday-lock marker, bulk helpers. **No Save button.** |
| `components/premier/PremierLeagueHome.tsx` | Data loader for the dashboard — round-scoped (one matchweek, never 380 fixtures). |

### Routes

| Route | What |
|---|---|
| `/[competition]` | Branches on `home_style`: `matchweek` → the dashboard; anything else → the classic World Cup hub, untouched. |
| `/[competition]/predict` | The Matchweek prediction sheet. |
| `/[competition]/matchweek/[code]` | Any matchweek — past, current, future — with ← → chevrons. |

### Data + schema

| File | What |
|---|---|
| `lib/predictor.ts` | `getFixturesByRound()` — the round-scoped, uncached load. |
| `lib/competitionEngine.ts` | `getCurrentRoundContext()`, `getRoundFixtures()`, `homeStyle` setting. |
| `supabase/migrations/050_home_style_and_editorial.sql` | `home_style` setting (default `classic`, WC pinned) + `round_editorial` table for admin-curated star players / headline. |

### How the World Cup stays untouched

`home_style` defaults to `classic` and migration 050 pins `wc2026` to it
explicitly. The dashboard code path is never reached for the World Cup; its
800-line hub renders exactly as before. Verified: `/wc2026` still resolves,
build clean, no console errors, and the classic-hub branch is the default.

---

## Playable prototype — the whole loop, in the browser, no database

`/prototype/matchweek` — a self-contained, database-free **Premier League
Matchweek 1** you can play through right now. It renders the REAL components
(`CompetitionHome`, `MatchweekSheet`) and REAL logic (`lib/matchweek`,
`lib/matchweekPredictions`, `lib/scoringModel`), backed by
`lib/prototype/localStore` (localStorage) instead of Supabase. Playing it IS
testing the actual experience.

- **20 real clubs, 10 fixtures** across a realistic spread — Friday opener,
  the Saturday 15:00 five-match wall, a Sunday marquee, a Monday nighter.
- **A control bar** to time-travel (before / open / friday / saturday / after),
  simulate results, and reset. The clock is injected into the components
  (`clock` prop), so moving it walks the dashboard through every state.
- **A mock private league** ("The Office") with four rivals, so the league
  surface has believable data that moves as results land.

To make this work, two small design improvements landed in the real
components — both make them more testable, not just prototype-friendly:
`MatchweekSheet` takes an injectable `onSave`, and both hero components take
an injectable `clock`.

### Verified by playing it (mobile viewport, screenshots captured)

- ✅ **PREVIEW** dashboard — editorial headline, ⭐ star players, biggest match,
  league + season strips.
- ✅ **OPEN** — the green "Predict 10 matches" hero + progress bar; flips from
  PREVIEW when the clock crosses the preview-lead window.
- ✅ **Prediction sheet** — grouped by kickoff, the Friday **"⚠ locks first"**
  badge, one-tap **H/D/A → autosave → "1 – 0" scoreline → "Change score"**,
  progress ticking 1/10 → 3/10, defaults correct (Home 1-0, Away 0-1),
  persistence across re-renders.
- ✅ **RESULTS** — the payoff hero: "4 points · 0 exact · 0 GD · 2 result ·
  1 miss", season strip updated to "#131 · 3 predictions".
- ✅ **Scoring** — the real 5/3/2/0 model, verified by hand: 1-0 vs 3-1 = 2,
  0-1 vs 0-2 = 2, one miss = 0 → **4 points**, exactly as shown.
- ✅ **Private league** — "The Office" leaderboard, rivals scored, **your row
  highlighted** at 5th.

## Verification

- ✅ `tsc --noEmit` clean
- ✅ 164 tests pass (40 matchweek logic + 9 scoring-model, mirroring the SQL)
- ✅ `next build` compiles; new routes present in the manifest
- ✅ **The complete matchweek loop played end-to-end in the browser** (above)
- ⚠️ **Not yet run against the real Supabase engine.** The prototype proves the
  UX and the pure logic; the live wiring (round-scoped queries hitting real
  RLS, real `upsertPrediction`, the SQL scorer) is exercised only by the
  migrations' own verification scripts. Connecting the dashboard to a seeded
  PL competition on staging is the first task when credentials are available —
  and now it is swapping `onSave`/data source, not building UI.

---

## The H/D/A decision, as built

You asked for inline Home/Draw/Away. The engine scores 5/3/2/0 on a stored
score, and pure H/D/A can only ever land "result" (2) or "wrong" (0) — no 5s,
no 3s. Built as **"one tap to play, two to compete"** (UX §9.1):

- H/D/A is the one-tap control; a tap autosaves a **default representative
  scoreline** (Home 1-0, Draw 1-1, Away 0-1).
- Each row expands to an optional exact-score stepper for the 5s and 3s.
- The stored value is always a score, so scoring/leaderboards/IQ are unchanged.
- **Reversible to pure 1X2** with result-only `scoring_rules` — a settings
  decision, no code — if the exact-score layer proves unwanted.

Re-tapping the same outcome keeps a considered exact score (3-1 stays 3-1);
only changing the outcome drops to the default. Covered by tests.

---

## Not yet built (later 3 phases, per §5 build order)

- **3b** — leaderboards (matchweek/month/season), league table, league preview
  and biggest-match-by-standings on the dashboard.
- **3c** — the polished Results moment + shareable matchweek card, LIVE ticker.
- **4** — Matchday Challenges (`challenges` tables, settlement).
- **5** — notifications (the 3-per-week Thu/Sat/Mon cap), Break-state content.
- **6** — Statistics (deferred, per decision).
- **7** — Season wrap-up.

---

## Open decisions still outstanding

1. **IQ rate per competition** — mechanism built (`competition_economy_rules`),
   number still unset. Needed before launch.
2. **Biggest match** — currently a kickoff-slot heuristic (standalone latest
   fixture) with an admin override via `round_editorial.biggest_fixture_id`. A
   standings-based ranking lands in 3b once the league table is computed.
3. **Prizes in the PL season?** — out of MVP; if in, it changes leaderboard
   design.
