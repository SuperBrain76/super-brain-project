# SuperBrain — Platform Architecture

SuperBrain is a global **contribution platform**. Users participate in prediction
competitions, cognitive testing, communities, and AI experiences, and are rewarded
for the value they create through a platform-wide **contribution economy**. It is
architected for tens of millions of users: scalable, extensible, maintainable,
secure, performant, and reusable — data-driven wherever possible.

> This document is the permanent, top-level map of the platform. Deep-dives live
> in `docs/` (e.g. [`docs/ECONOMY.md`](docs/ECONOMY.md)).

---

## Stack

Next.js 14 (App Router, TypeScript) · Supabase (Postgres + Auth + RLS) · Capacitor
(iOS/Android) · Vercel · PostHog · Resend · API-Football (fixtures/scores).

Conventions the codebase holds to:
- **Idempotent, numbered SQL migrations** (`supabase/migrations/NNN_*.sql`).
- **RLS default-deny**; privileged reads/writes go through `SECURITY DEFINER` RPCs
  that never leak `user_id` or private profile fields.
- **Per-feature `lib/*.ts` modules**; a single anon Supabase client gated by
  `isSupabaseConfigured`.
- **Data-driven over hardcoded** — behaviour lives in config rows, not branches.

---

## Feature pillars

| Pillar | Routes | Core tables |
|---|---|---|
| **Predict** (multi-competition; WC2026 live) | `/predict/*` | `competitions, teams, fixtures, predictions, prediction_leagues, prediction_league_members` |
| **Tests** (9 cognitive tests + career profile) | `/tests/*` | `test_results`, `matrix_attempts/responses` |
| **Battle** (head-to-head) | `/battle/*` | `battle_profiles, battle_queue, battle_matches, battle_round_results` |
| **Share / Challenge** (viral) | `/share/*`, `/challenge/*` | share ids + OG images + `get_challenge_result` |
| **Economy** (contribution / IQ) — **Partner Dashboard** home at `/iq` | `/iq` | `economy_*`, `partner_levels`, `user_streaks`, `referrals`, `achievements` |

The competition engine is **parameterized by `competition_id`** — it supports
multiple sports/competitions by design; new competitions are data, not code.

---

## The Economy (highest-priority system)

The Economy is the connective tissue: every pillar *emits events* that mint a soft
currency, **IQ**. It is built on an **append-only ledger** with a **data-driven
earning rulebook**, so any future action becomes an IQ-earning event by inserting a
config row — no deploy. Full spec: [`docs/ECONOMY.md`](docs/ECONOMY.md).

**Core (`021`):** `economy_currencies`, `economy_event_types` (rulebook),
`economy_ledger` (append-only source of truth), `economy_balances` (view). All
mints go through `economy_emit` / `economy_reconcile`; spends through
`economy_spend`. Clients can only read their own ledger.

**Earning pillars (live):**

| Migration | Pillar | Mechanism |
|---|---|---|
| `021` | Prediction accuracy | reconciled from `points_awarded` in the scoring trigger |
| `022` | Daily login + streaks | `economy_daily_checkin()` RPC; milestones in config |
| `023` | Test personal bests | trigger on `test_results`, quality by percentile |
| `024` | Profile completion | trigger on `user_profiles` (once) |
| `025` | Referral engine | pay referrer only on referred user's *active* qualification |
| `026` | Achievement engine | data-driven JSONB criteria evaluator |
| `027` | Activity orchestrator | one ledger trigger drives referrals + achievements |
| `028` | Partner Dashboard | `partner_levels` + `get_partner_dashboard()` — the `/iq` home screen in one RPC |
| `029` | Public Profile System | `/u/<username>` shareable profiles + privacy controls via `get_public_profile()` (anon-safe, privacy-filtered) |
| `030` | Network Dashboard | `/network` growth analytics via `get_network_dashboard()` + `get_network_leaderboard()` — quality-first referral network metrics |
| `031` | Daily Missions Engine | config-driven `missions` + `mission_claims`; `get_missions()` / `claim_mission()`; daily/weekly/event cadences shown on `/iq` with progress bars + instant claim |

**Design principles the Economy enforces:** append-only & auditable; all writes via
definer RPCs; idempotent (dedupe keys + reconcile); config-driven earning; reward
**quality over quantity, retention over signups, active referrals over
registrations**; future-proofed for a cashable tier via `is_redeemable`.

---

## Extending the platform

- **New earning source, config only:** `INSERT` into `economy_event_types`, then
  call `economy_emit(user, '<code>', <source_ref>)` where the value is created.
- **New achievement:** `INSERT` into `achievements` with a JSONB `criteria`.
- **New competition/sport:** seed `competitions` + `teams` + `fixtures`; the
  predictor, scoring, and IQ minting work unchanged.
- **New pillar:** add a `lib/<pillar>.ts` module + migration; emit economy events
  at value-creation points so contribution accrues automatically.

## Operational notes

- Migrations `021`–`027` are written and idempotent but must be **run against the
  live Supabase DB** (SQL editor) to take effect.
- Economy calls in scoring/test/profile paths are **guarded** — an economy fault
  can never block core actions (match scoring, saving a test, completing a profile).
- At extreme scale, move the synchronous ledger-trigger orchestration to an async
  worker/queue (interface unchanged). See `docs/ECONOMY.md` → Scale note.
