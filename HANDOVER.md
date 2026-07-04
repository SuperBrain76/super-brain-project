# SuperBrain Economy — Session Handover

_Last updated: 2026-07-04. Read this + `SUPERBRAIN.md` + `docs/ECONOMY.md` to continue without the prior chat._

## Environment
- **Working directory (canonical codebase):** `/Users/dylanfjellstrom/Downloads/Claude Code Interior Design Skill/pilot-cognitive-test/`
  - This is the ACTIVE build (Capacitor iOS/Android, App Store "Build 3"). Newer/richer than the GitHub snapshot at `~/Documents/GitHub/super-brain-project` (same lineage, older). Work here.
- **Stack:** Next.js 14 (App Router, TS) · Supabase (Postgres + Auth + RLS) · Capacitor · Vercel · PostHog · Resend.
- **Git:** local repo; last app-store commit was on the `pilot-cognitive-test` working tree. No economy work has been committed yet unless the user did so — check `git status`.
- **Preview:** `.claude/launch.json` has a `pilot-cognitive-test` config on **port 3005** (`npm run dev`). Use the `preview_*` tools, not Bash, to run it.
- **Local limitation:** NO local Postgres/Docker and Supabase env is NOT set locally → pages render their graceful "not connected"/signed-out states, and migrations CANNOT be executed here. All SQL below is hand-validated only.

## What has been built (economy platform, migrations 021–031)
All additive, idempotent, data-driven. Currency = **IQ** (soft; `is_redeemable` flag reserved for a future cashable tier). Append-only `economy_ledger` is the single source of truth; balances are a VIEW; all mutations go through `SECURITY DEFINER` RPCs; RLS default-deny (users read only their own ledger).

| Migration | Adds |
|---|---|
| `021_economy_core.sql` | `economy_currencies`, `economy_event_types` (earning rulebook), `economy_ledger`, `economy_balances` view; RPCs `economy_emit`, `economy_reconcile`, `economy_spend`, `get_my_balance`, `get_contribution_leaderboard`; **prediction pillar wired** (`economy_award_fixture` from scoring trigger + `rescore_fixture`, reconciling/idempotent) + backfill |
| `022_economy_login_streaks.sql` | `economy_config` (scalar tunables) + `economy_config_num()`; `user_streaks`; `economy_daily_checkin()`, `get_my_streak()`; `daily_streak` milestones |
| `023_economy_test_personal_bests.sql` | trigger on `test_results` → mints `test_personal_best` on new PB (quality by percentile) |
| `024_economy_profile_completion.sql` | triggers on `user_profiles` → mints `profile_complete` once |
| `025_economy_referrals.sql` | `referral_codes`, `referrals`; `get_my_referral_code()`, `economy_attach_referral()`, `economy_qualify_referrals()`, `get_my_referral_stats()` — referrer paid only when referred user EARNS ≥ `referral_qualify_iq` (config) from real activity |
| `026_economy_achievements.sql` | `achievements` (jsonb `criteria`), `user_achievements`; `economy_meets_criteria()`, `economy_check_achievements()`, `get_my_achievements()`; 10 seeded badges |
| `027_economy_activity_orchestrator.sql` | `economy_on_activity()` + AFTER INSERT trigger on `economy_ledger` → runs referral qualification + achievement checks. Recursion-safe (ignores delta≤0 and events `referral_qualified`/`achievement_unlocked`). Backfills existing earners |
| `028_partner_dashboard.sql` | `partner_levels` (tier table); `get_partner_dashboard(p_currency)` — the whole `/iq` home screen in one JSONB RPC (balance, level+progress, streak, daily-reward preview, referral+network, recent tx, achievements, leaderboard rank, Next Actions) |
| `029_public_profiles.sql` | adds `username`/`bio`/`avatar_url`/`banner_url`/`is_public`/`privacy` to `user_profiles`; `reserved_usernames`; `set_username()`, `update_public_profile()`, `get_my_profile_settings()`, `get_public_profile(username)` (anon-safe, privacy-filtered — the ONLY public surface) |
| `030_network_dashboard.sql` | `get_network_dashboard(p_currency)` + `get_network_leaderboard(p_currency)` — quality-first referral-network analytics; config keys `network_*` |
| `031_daily_missions.sql` | `missions` (config) + `mission_claims`; `_mission_progress()`, `get_missions(p_currency)`, `claim_mission(code)`; `mission_reward` event; 9 seeded daily/weekly/event missions |

### Front-end (all premium, mobile-first, green+gold palette, graceful empty/signed-out states)
- **libs:** `lib/economy.ts` (balance, dashboard, streaks, referrals, achievements, spend), `lib/publicProfile.ts`, `lib/network.ts`, `lib/missions.ts`; `lib/og.ts` gained `fetchProfileOG`.
- **pages:** `app/iq/page.tsx` = **Partner Dashboard** home (hero balance+level, quick stats, daily reward claim, **Missions section** with progress bars + instant claim, Next Actions, referral+share, achievements, recent activity; links to `/network` and `/settings/public-profile`). `app/u/[username]/page.tsx` (+`layout.tsx` metadata +`opengraph-image.tsx`) = public profile. `app/settings/public-profile/page.tsx` = editor with per-section privacy toggles. `app/network/page.tsx` = Network Dashboard (SVG growth chart, quality score, top contributors, rankings, top-networks board).
- **docs:** `SUPERBRAIN.md` (platform map) and `docs/ECONOMY.md` (full economy spec) kept current. This `HANDOVER.md`.

## What has NOT been deployed
- **None of migrations 021–031 have been run against the live Supabase DB.** They are written + hand-validated only (no local Postgres to execute/verify). Everything front-end is `tsc`-clean and visually verified via temporary demo data (since removed).

## Required Supabase migration order
Run **in numeric order 021 → 031** in the Supabase SQL editor (Dashboard → SQL). All are idempotent/safe to re-run. Dependencies: 022 creates `economy_config` (used by 025/030/031); 025+026 must precede 027; 028 precedes nothing but is used by `/iq`; 029/030/031 depend on 021–028. After running, the prediction backfill (021) and orchestrator backfill (027) populate historical IQ automatically.

## Known caveats
1. **Not executed / not verified against a real DB** — highest risk is in the largest plpgsql RPCs (`get_partner_dashboard` 028, `get_public_profile` 029, `get_network_dashboard` 030, `get_missions`/`claim_mission` 031). Validate by running 021–031, then smoke-test each RPC in the SQL editor.
2. **Scale:** the `economy_ledger` AFTER INSERT orchestration trigger (027) is synchronous, and the network global-ranking aggregates (030) scan all referrals per call. Fine pre-launch; at tens of millions move orchestration to an async queue/worker and back rankings with a materialized view. (Interfaces stay identical.)
3. **Existing `user_profiles` RLS:** migrations 010/011 allow any *authenticated* user to read any profile row (incl. private demographic columns). Anon has no direct read. Public profiles are served only via the definer RPC — do not add an anon table policy.
4. **Multi-currency:** only `IQ` exists; mission/economy reward events mint IQ. `reward_currency` columns exist for future currencies but reward mints currently resolve to the event's currency (IQ).
5. **Seeded-but-not-wired earning events:** `bonus_score`, `career_profile_complete`, `battle_win` (config rows exist; each just needs a one-line `economy_emit` at its value-creation point).
6. **Referral attach on signup is not wired:** `economy_attach_referral(code)` exists and `/u/[username]` shares a `?ref=CODE` link, but the signup flow (`app/login/page.tsx`) does not yet read `?ref=` and call it.

## Exact next recommended task
**Run migrations 021–031 in the Supabase SQL editor (in order), then smoke-test the RPCs** (`get_partner_dashboard`, `get_public_profile`, `get_network_dashboard`, `get_missions`, `claim_mission`) with a real signed-in user, and set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally to verify `/iq`, `/network`, `/u/<username>`, and `/settings/public-profile` end-to-end.

If the user instead wants to keep building without deploying, the next feature increment is **wiring referral attribution on signup**: read `?ref=` in `app/login/page.tsx` (persist through email verification via `options.data` or localStorage) and call `economy_attach_referral()` post-confirmation — this closes the referral loop the network/profile features already assume.
