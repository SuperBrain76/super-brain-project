# SuperBrain Economy

The Economy is the foundation that connects every feature of the platform. Users
earn a soft currency — **IQ** — by creating value: predicting accurately,
performing on cognitive tests, winning battles, showing up daily, and bringing in
active referrals. It is designed for tens of millions of users and for *unlimited*
future earning sources added by configuration alone.

> Status: **Core + six earning pillars live** (migrations `021`–`027`).
> Currency: `IQ`, soft (non-cashable) today, with a `is_redeemable` flag reserved
> for a future cashable tier.
>
> Pillars: prediction accuracy · daily login · login streaks · cognitive-test
> personal bests · profile completion · referral engine · achievement engine.

---

## Core model

```
economy_currencies    which currencies exist (IQ today). is_spendable / is_redeemable.
economy_event_types   the DATA-DRIVEN earning rulebook — one row per earning source.
economy_ledger        APPEND-ONLY. one row per mint (+) or spend (−). source of truth.
economy_balances      VIEW: balance = SUM(delta) per (user, currency). never written.
```

Two invariants make this safe at scale:

1. **Append-only ledger.** Balances are never stored as a mutable integer — they
   are a sum of immutable deltas. Every mint and spend is a permanent, auditable
   row. No lost-update races, full history for free.
2. **All writes go through SECURITY DEFINER RPCs.** RLS is default-deny; clients
   can only *read their own* ledger. They cannot forge balances.

---

## Earning is configuration, not code

To make **any** action mint IQ, insert a row into `economy_event_types`. That is
the entire integration surface for a "config-only" source — no deploy.

| Column | Purpose |
|---|---|
| `code` | Event identifier, e.g. `prediction_score`, `daily_login`. |
| `base_amount` | Flat award when no quality tier applies. |
| `amount_map` | JSONB tier map keyed by a "quality bucket" string. Overrides base. |
| `cooldown_seconds` | Min seconds between awards of this event per user. |
| `daily_cap` | Max IQ per user per UTC day from this event (`null` = uncapped). |
| `per_source` | If true, each `source_ref` is awarded once (reconciled). |
| `active` | Toggle the source on/off instantly. |

### Reward philosophy (encoded in the seed config)

- **Quality over quantity** — exact predictions and personal bests pay
  disproportionately more (`amount_map` tiers), and caps blunt farming.
- **Retention over signups** — `daily_login` pays little but has a ~20h cooldown;
  the *habit* compounds (streak multipliers are the next layer).
- **Active referrals over registrations** — `referral_qualified` only pays when the
  invitee performs a real qualifying action, keyed `per_source` on the invitee id.

---

## Minting API (server-side)

```sql
-- Universal entry point. Enforces active/cooldown/daily_cap/idempotency.
select economy_emit(
  p_user_id  => '<uuid>',
  p_event_code => 'daily_login'
);

-- For sources that can re-run (e.g. rescored fixtures): set NET award to a
-- target, writing only the correcting delta. Idempotent by construction.
select economy_reconcile('<uuid>', 'prediction_score', '<prediction_id>', 50);
```

`economy_emit` / `economy_reconcile` / `economy_award_fixture` are **not** grantable
to clients — call them from other definer functions (like the scoring trigger) or
from API routes using the service-role key.

## Spending API (client-callable)

```ts
import { spend } from "@/lib/economy";
await spend("IQ", 100, { reason: "featured_league_entry", sourceRef: leagueId });
```

`economy_spend` binds to `auth.uid()`, checks the balance atomically, and raises on
insufficient funds.

## Reading (client)

```ts
import { getMyIqBalance, getContributionLeaderboard, getMyLedger } from "@/lib/economy";
```

The `/iq` page renders the signed-in balance + global contribution leaderboard.

---

## Wired sources

| Event | Source | Status | Integration point |
|---|---|---|---|
| `prediction_score` | Match prediction accuracy (5/3/2/0 pts → 50/15/8/0 IQ) | **LIVE** | `score_fixture_predictions` trigger + `rescore_fixture` → `economy_award_fixture` |
| `daily_login` | Daily active login (once per UTC day) | **LIVE** | `economy_daily_checkin()` RPC (client, on app load) |
| `daily_streak` | Consecutive-day streak milestones | **LIVE** | `economy_daily_checkin()` — milestones in `amount_map` |
| `test_personal_best` | New personal-best cognitive score (quality by percentile) | **LIVE** | trigger `economy_award_test_pb` on `test_results` insert |
| `profile_complete` | Account profile completed | **LIVE** | triggers on `user_profiles` (`profile_complete` false→true) |
| `referral_welcome` | Welcome gift to a newly-referred user | **LIVE** | `economy_attach_referral(code)` RPC |
| `referral_qualified` | Referred user became **active** (earned ≥ threshold) | **LIVE** | `economy_qualify_referrals` via activity orchestrator |
| `achievement_unlocked` | Data-driven achievement criteria met | **LIVE** | `economy_check_achievements` via activity orchestrator |
| `bonus_score` | Bonus questions | seeded, not wired | emit from bonus scoring RPC |
| `career_profile_complete` | Career cognitive profile finished | seeded, not wired | emit on completion |
| `battle_win` | Head-to-head win | seeded, not wired | emit from battle result write |

Wiring a new pillar = call `economy_emit(user, '<event>', <source_ref>)` at the
point value is created (triggers for server-side data; a definer RPC for
client-driven actions). Prediction accuracy is the reference implementation.

---

## The pillars

### Daily login & streaks (`022`)
`economy_daily_checkin()` is the single client entry point — idempotent per UTC
day. It updates `user_streaks` (consecutive-day logic, gap resets), mints
`daily_login`, and mints a `daily_streak` bonus. Streak milestones live in
`economy_event_types('daily_streak').amount_map` (`{"3":20,"7":50,"14":120,...}`) —
retention is tuned by data, not code.

### Cognitive-test personal bests (`023`)
A trigger on `test_results` insert rewards only a **new** personal best per
(user, test), scaled by percentile bucket (elite/high/mid/low). No client change;
covers every current and future save path. `daily_cap` blunts farming.

### Profile completion (`024`)
Triggers on `user_profiles` pay a one-time reward the moment `profile_complete`
flips to true. `per_source` + idempotency key guarantee exactly-once.

### Referral engine (`025`)
`referral_codes` (stable per-user code) + `referrals` (one attribution per user).
`economy_attach_referral(code)` creates a `pending` referral + welcome gift.
The referrer is paid **only** when the referred user has *earned* ≥
`referral_qualify_iq` (config, default 50) from genuine activity — the welcome
gift and referral payouts are excluded from that total. This enforces "active,
qualified referrals over registrations."

### Achievement engine (`026`)
Achievements are **rows**. Each has a JSONB `criteria` evaluated by
`economy_meets_criteria` against ledger / streaks / tests / referrals. Supported
types: `iq_earned`, `iq_total`, `event_count`, `streak`, `tests_completed`,
`test_best`, `referrals_qualified`. Add a badge by INSERTing a row.

### Activity orchestrator (`027`)
The reusable hook that binds referrals + achievements to **every** earning event.
A trigger on `economy_ledger` insert calls `economy_on_activity(user)` →
`economy_qualify_referrals` + `economy_check_achievements`. Recursion-safe: the
trigger ignores non-positive deltas and the orchestrator's own reward events
(`referral_qualified`, `achievement_unlocked`), so one earning event = one pass.

> **Scale note:** the ledger trigger runs synchronously per earning row. At tens
> of millions of users, move `economy_on_activity` to an async queue (e.g. a
> `pg_notify`/worker or Supabase Edge Function) and debounce per user. The
> interface stays identical — only the invocation becomes asynchronous.

---

## Roadmap (build on this foundation)

1. ~~Streaks~~ ✅ shipped (`022`).
2. **Rewards store / redemption** — spend IQ on cosmetics, league entries, boosts
   (`economy_spend` is ready).
3. **Featured Leagues** (P1) — priced in IQ via `economy_spend`.
4. **Wire remaining seeded sources** — `bonus_score`, `career_profile_complete`,
   `battle_win` (each is a one-line `economy_emit` at the value-creation point).
5. **Async orchestration** — move `economy_on_activity` off the synchronous
   ledger trigger to a queue/worker for tens-of-millions scale.
6. **Cashable tier** — flip `is_redeemable` / add a second currency; requires
   KYC/AML + tax review before enabling. Ledger already supports it.
7. **Anti-abuse** — velocity checks and per-event caps live in config already;
   add device/IP heuristics as emit-time guards.

## Partner Dashboard (`028`, the `/iq` home screen)

The Economy's home screen is the **Partner Dashboard** — a premium, mobile-first
view assembled by **one** SECURITY DEFINER RPC, `get_partner_dashboard(p_currency)`,
returning the entire screen as a single JSONB payload (one round trip):

- **configurable currency** balance + symbol (never hardcoded — read from
  `economy_currencies`; pass `p_currency` or default to the platform currency),
- **Partner Level** + progress to next tier (data-driven `partner_levels` table,
  computed from lifetime earned),
- **current streak** and a **daily-reward preview** (today's login + streak IQ,
  computed without minting; the UI claims via `economy_daily_checkin`),
- **referral code** + **network stats** (total / active / pending / earned),
- **recent transactions** (human-labelled from `economy_event_types.description`),
- **achievements** (unlocked/total + recent badges),
- **contribution leaderboard position** (rank + field size),
- **Next Actions** — the highest-value actions available today, each with its IQ
  value read from config (`prediction_score`, `test_personal_best`,
  `profile_complete`, `referral_qualified`, daily reward), ranked and filtered by
  availability. Nothing about the ranking or amounts is hardcoded.

`partner_levels` is data — add/retune tiers by INSERT/UPDATE, no deploy.

## Public Profile System (`029`)

Every user gets a shareable profile at a configurable URL, `/u/<username>`,
assembled from the same infrastructure and gated by user-owned privacy controls.

- **Schema:** `user_profiles` gains `username` (case-insensitive unique),
  `bio`, `avatar_url`, `banner_url`, `is_public`, and a `privacy` JSONB. A
  data-driven `reserved_usernames` table blocks system handles.
- **Public surface:** `get_public_profile(username)` — a single SECURITY DEFINER
  RPC (anon-granted) that is the *only* public read path (anon has no direct
  table access). It returns solely safe, privacy-filtered fields — never
  `birth_year` / `gender` / `industry` / email / raw `user_id`. It reuses every
  economy system: partner level, currency balance, achievements, prediction
  stats, cognitive-test bests, contribution + predictor leaderboard ranks,
  network stats, referral link, and recent public (earning) activity.
- **Privacy:** the `privacy` JSONB toggles each section
  (`level, balance, achievements, predictions, tests, network, referral,
  activity, country`); missing key defaults to visible. `is_public=false` hides
  everything except name/avatar. Edited via `update_public_profile` (validates
  bio length + `https://` URLs) and `set_username` (format + reserved +
  uniqueness). Prefill via `get_my_profile_settings`.
- **Shareability:** `/u/[username]` has `generateMetadata` (OpenGraph/Twitter)
  and a dynamic `opengraph-image` (edge) built from `fetchProfileOG`. The profile
  page has a native Share button and a referral "join via me" CTA.
- **UI:** `/u/[username]` (premium, mobile-first, respects privacy + private
  state) and `/settings/public-profile` (username, bio, images, master toggle,
  per-section privacy switches). Client module: `lib/publicProfile.ts`.

## Network Dashboard (`030`, `/network`)

Turns the referral graph into growth analytics that reward an **active,
high-quality** network — not raw referral counts. Sourced entirely from
`referrals` + `economy_ledger` + `user_profiles` + `partner_levels`; windows and
limits are data-driven via `economy_config` (`network_active_window_days`,
`network_growth_weeks`, `network_top_contributors`, `network_leaderboard_limit`).

- **`get_network_dashboard(p_currency)`** — one RPC returning: total size, active
  members (qualified), recently-engaged count, pending, **conversion / quality
  score** (active ÷ total), currency earned by the network, countries
  represented, weekly growth (new + cumulative), top contributors (by IQ earned,
  with active flag + partner level), and the user's **global rankings** (by active
  members and by network IQ, out of the referrer pool).
- **`get_network_leaderboard(p_currency)`** — global top networks, ranked
  **quality-first** (active members, then network IQ).
- Single-level by design (referrals are 1:1 referrer→member), so "network" = a
  user's direct referrals — consistent with the referral engine that pays only
  for *qualified, active* referrals.
- **UI:** `/network` (premium, mobile-first) — hero foregrounds active members,
  a Network Quality north-star card, stat tiles, an inline SVG growth chart
  (bars = new/week, line = cumulative), global rankings, country chips, top
  contributors (active/inactive), and a quality-ranked Top Networks board. Linked
  from the Partner Dashboard. Client module: `lib/network.ts`.

> **Scale note:** the global-ranking aggregates scan all referrals per call; at
> tens of millions, back them with a periodically-refreshed materialized view.

## Daily Missions Engine (`031`)

Fully **configuration-driven** missions — each is a row in `missions`; add /
remove / retune by INSERT / UPDATE / DELETE, no deploy. Cadences: `daily`,
`weekly`, `event` (windowed or one-time).

- **`missions`** — `title, description, icon, cadence, requirement (jsonb),
  target, reward_currency, reward_amount, starts_at/ends_at, sort, active`.
- **Progress is derived on read** by `_mission_progress` over the current period
  window. Requirement `type`s: `event_count` / `event_sum` (over any ledger
  `event_code` — so *any current or future economy event is mission-able via
  config alone*), `iq_earned`, `predictions_made`, `tests_completed`,
  `profile_complete`, `referrals_qualified`.
- **`get_missions(p_currency)`** — returns each active mission with progress /
  target / completed / claimed + reward, grouped by cadence.
- **`claim_mission(code)`** — verifies completion, mints the reward via
  `economy_emit` (`mission_reward` event, amount overridden per mission) with an
  idempotent key, and records `mission_claims` (one per user × mission × period:
  `YYYY-MM-DD` / `IYYY"W"IW` / `event`). Reclaims are no-ops.
- **UI:** a Missions section on the Partner Dashboard (`/iq`) with per-mission
  progress bars, cadence groups, and instant reward claiming that refreshes the
  balance. Client module: `lib/missions.ts`.
- **Motivates:** retention (login/streak), predictions, cognitive tests, profile
  completion, and *quality* referrals (`referral_qualified`) — plus anything
  future by seeding a row.

## Client API surface (`lib/economy.ts`)

`getPartnerDashboard` (the dashboard aggregate) · `getMyIqBalance` · `getMyBalance` ·
`getContributionLeaderboard` · `getMyLedger` · `dailyCheckin` · `getMyStreak` ·
`getMyReferralCode` · `attachReferral` · `getMyReferralStats` · `getMyAchievements` ·
`spend`. The `/iq` page is the Partner Dashboard; it degrades gracefully to
signed-out and not-configured states.
