# World Cup Predictor — Architecture & Continuation Guide

**Purpose:** Self-contained reference for any Claude session continuing predictor development. Includes current state, complete schema, implementation plans, and testing checklist. No prior chat context required.

**Project root:** `/Users/dylanfjellstrom/Downloads/Claude Code Interior Design Skill/pilot-cognitive-test`  
**Live site:** [superbrain.social](https://superbrain.social)  
**GitHub repo:** `SuperBrain76/super-brain-project` (connected to Vercel, auto-deploys on push to `main`)  
**Supabase project:** `agtyfbqxmrobliqybrvz` (region: ap-northeast-1)

---

## 1. Current Architecture

### Stack
- **Next.js 14** (App Router, `"use client"` pages) + TypeScript + Tailwind CSS
- **Supabase** — Postgres DB + Auth + RLS + Realtime (used by battle system)
- **PostHog** — analytics
- **Vercel** — hosting, CI/CD from GitHub `main`

### Design system
Dark "cockpit" theme. Key CSS classes via `tailwind.config.ts`:

| Token | Value | Use |
|---|---|---|
| `cockpit-bg` | `#080b0f` | Page background |
| `cockpit-surface` | `#0d1117` | Elevated surfaces, stat strips |
| `cockpit-card` | `#111820` | Cards, fixture rows |
| `cockpit-border` | `#1e2a38` | Borders only — never use as text colour |
| `cockpit-accent` | `#00d4ff` | Primary accent (cyan) |
| `cockpit-green` | `#00e676` | Success, live status |
| `cockpit-amber` | `#ffab00` | Warning, rank |
| `cockpit-red` | `#ff3d00` | Error, danger |
| `cockpit-dim` | `#a8b8cc` | Secondary text — ~7.5:1 contrast on card ✅ |
| `cockpit-muted` | `#8899aa` | Tertiary text — ~5.2:1 contrast on card ✅ |
| `cockpit-text` | `#e2e8f0` | Input text, primary body |

> ⚠️ **Never use `text-cockpit-border` for text.** `#1e2a38` on `#111820` is near-invisible. Only use `border-cockpit-border`.  
> ⚠️ **Never use hardcoded `#4a5568`** — ~2.2:1, fails WCAG AA.

### Predictor module — file map

```
lib/
  predictor.ts              ← All DB queries, row mappers, helper functions

app/
  predict/
    page.tsx                ← Hub: fixture list, tabs, stat chips
    [fixtureId]/page.tsx    ← Single fixture: predict / view result
    leagues/                ← ⚠️ DOES NOT EXIST YET (Day 3)
    leaderboard/            ← ⚠️ DOES NOT EXIST YET (Day 3)
  admin/
    fixtures/page.tsx       ← Admin: enter results, search, rescore

components/
  predictor/
    FixtureCard.tsx         ← Reusable fixture card (list view)
    ScoreInput.tsx          ← Score spinner (+/- buttons, 0–20)

supabase/
  predictor-schema.sql      ← Full schema: tables, RLS, triggers, RPCs
  seeds/
    wc2026-fixtures.sql     ← Original seed (approximate kickoff times)
    wc2026_correct.sql      ← Corrected seed (verified UTC times, June 2026)
```

---

## 2. Database Schema

### Tables

#### `competitions`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | "FIFA World Cup 2026" |
| `slug` | `text` UNIQUE | "wc2026" |
| `status` | `text` | `upcoming` \| `active` \| `completed` |
| `starts_at` | `timestamptz` | nullable |
| `ends_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | |

**Live data:** 1 row — `id: e0a9ff8e-1e46-4577-9517-c3cd83ea0e33`, slug `wc2026`, status `upcoming`.

#### `teams`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `competition_id` | `uuid` FK → competitions | CASCADE delete |
| `name` | `text` | "Brazil" |
| `code` | `text` | "BRA" |
| `flag_emoji` | `text` | nullable |
| `group_name` | `text` | nullable (null for unresolved knockout slots) |

**Unique index:** `(competition_id, code)` — one code per competition.  
**Live data:** 48 teams (corrected WC2026 draw).

#### `fixtures`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `competition_id` | `uuid` FK | |
| `stage` | `text` CHECK | `group` \| `r32` \| `r16` \| `qf` \| `sf` \| `3rd` \| `final` |
| `group_name` | `text` | nullable |
| `fixture_number` | `integer` | 1–104, sequential display order |
| `home_team_id` | `uuid` FK → teams | nullable (TBD knockout slots) |
| `away_team_id` | `uuid` FK → teams | nullable |
| `home_score` | `integer` | nullable until played, CHECK ≥ 0 |
| `away_score` | `integer` | nullable until played, CHECK ≥ 0 |
| `kicks_off_at` | `timestamptz` | **UTC always** |
| `venue` | `text` | nullable |
| `status` | `text` CHECK | `scheduled` \| `live` \| `completed` \| `postponed` |
| `updated_at` | `timestamptz` | updated on each save |

**Live data:** 104 fixtures (72 group stage with teams, 32 knockout TBD).

#### `predictions`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → auth.users | CASCADE delete |
| `fixture_id` | `uuid` FK → fixtures | CASCADE delete |
| `home_score` | `integer` | CHECK 0–20 |
| `away_score` | `integer` | CHECK 0–20 |
| `points_awarded` | `integer` | null until fixture completed + scored |
| `submitted_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Unique constraint:** `(user_id, fixture_id)` — one prediction per fixture per user.  
**Live data:** 0 rows (tournament hasn't started).

#### `prediction_leagues`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `competition_id` | `uuid` FK | |
| `name` | `text` | user-chosen, 2–40 chars |
| `invite_code` | `text` UNIQUE | auto-generated 8-char uppercase (from UUID) |
| `created_by` | `uuid` FK → auth.users | |
| `created_at` | `timestamptz` | |

**Live data:** 0 rows.

#### `prediction_league_members`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `league_id` | `uuid` FK → prediction_leagues | CASCADE delete |
| `user_id` | `uuid` FK → auth.users | CASCADE delete |
| `joined_at` | `timestamptz` | |

**Unique constraint:** `(league_id, user_id)` — join is idempotent (error code `23505` treated as success).  
**Live data:** 0 rows.

---

## 3. Data Layer — `lib/predictor.ts`

### TypeScript types (camelCase, mapped from snake_case DB)

```typescript
Competition  { id, name, slug, status, startsAt, endsAt }
Team         { id, name, code, flagEmoji, groupName }
Fixture      { id, competitionId, stage, groupName, fixtureNumber,
               homeTeam, awayTeam, homeScore, awayScore, kicksOffAt,
               venue, status, myPrediction }
Prediction   { id, fixtureId, homeScore, awayScore, pointsAwarded, submittedAt }
PredictionLeague { id, competitionId, name, inviteCode, createdBy, createdAt, memberCount? }
LeaderboardRow   { rank, displayName, country, totalPoints, predictions,
                   exactScores, userId?, isMe? }
MyStats      { totalPoints, predictions, exactScores, globalRank }
```

### Key implementation detail — `myPrediction` embedded in Fixture

`FIXTURE_SELECT` joins `predictions` table in the same query:

```typescript
const FIXTURE_SELECT = `
  id, competition_id, stage, group_name, fixture_number,
  home_score, away_score, kicks_off_at, venue, status,
  home_team:teams!home_team_id ( id, name, code, flag_emoji, group_name ),
  away_team:teams!away_team_id ( id, name, code, flag_emoji, group_name ),
  predictions ( home_score, away_score, points_awarded )
`;
```

The `predictions` join is filtered by RLS — anonymous users get `[]`, authenticated users get their own row only. `rowToFixture` maps it to `myPrediction: { homeScore, awayScore, pointsAwarded } | null`.

### PostgREST join syntax — critical note

When a table has **two FK columns pointing at the same target table**, PostgREST requires a disambiguation hint:

```
-- ✅ CORRECT — specifies which FK to traverse
home_team:teams!home_team_id ( id, name, code, flag_emoji, group_name )
away_team:teams!away_team_id ( id, name, code, flag_emoji, group_name )

-- ❌ WRONG — PostgREST treats "home_team_id" as a table name → silent empty result
home_team:home_team_id ( ... )
```

### Available functions

| Function | Returns | Notes |
|---|---|---|
| `getCompetition(slug)` | `{ competition, error }` | Verbose error messages for debugging |
| `listCompetitions()` | `Competition[]` | For admin selectors |
| `getFixtures(compId, stage?)` | `{ fixtures, error }` | Optional stage filter |
| `getFixture(id)` | `Fixture \| null` | Single fixture with myPrediction |
| `getUpcomingFixtures(compId, limit)` | `Fixture[]` | Scheduled, future only |
| `upsertPrediction(fixtureId, home, away)` | `{ error }` | Gets user from session |
| `getMyPredictions(compId)` | `Prediction[]` | All user predictions for competition |
| `getMyLeagues(compId)` | `PredictionLeague[]` | Filtered client-side by compId |
| `createLeague(compId, name)` | `{ league, error }` | Auto-joins creator |
| `joinLeague(leagueId)` | `{ error }` | `23505` = already member (success) |
| `getLeagueByInviteCode(code)` | `PredictionLeague \| null` | Uppercases code |
| `getLeagueMemberCount(leagueId)` | `number` | |
| `getPredictorLeaderboard(compId)` | `LeaderboardRow[]` | Global, top 200 |
| `getLeagueLeaderboard(leagueId)` | `LeaderboardRow[]` | League-scoped, includes userId |
| `getMyStats(compId)` | `MyStats \| null` | Total pts, rank, predictions, exact |
| `adminSetResult(id, h, a)` | `{ error }` | Sets status=completed, triggers scoring |
| `adminRescoreFixture(id)` | `{ updated, error }` | Manual re-run scoring RPC |
| `adminRescoreCompetition(id)` | `{ updated, error }` | Nuclear option |
| `adminUpdateFixtureTeams(id, homeId, awayId)` | `{ error }` | For knockout bracket fill |
| `isPredictionOpen(fixture)` | `boolean` | status=scheduled AND kickoff in future |
| `formatKickoff(iso, opts)` | `string` | Local timezone, date/time options |
| `kickoffCountdown(iso)` | `string` | "2h 14m" or "Kicked off" |
| `stageLabel(stage)` | `string` | "Group Stage", "Quarter-final", etc. |
| `pointsColor(pts)` | `string` | Hex colour for 0/2/3/5 pts |

---

## 4. Predictor Routes

### `/predict` — Hub page

**File:** `app/predict/page.tsx`

- Loads competition by slug `"wc2026"` on mount
- Loads all fixtures (no stage filter) — 104 rows
- Loads user's stats separately (`getMyStats`) after competition loads
- Shows verbose error card with exact Supabase error string + checklist
- **Tabs:** All fixtures / Today / Results — filters client-side
- **Groups fixtures by local date** using `toLocaleDateString` (user's timezone)
- **Stat chips** (visible when user has ≥1 prediction): Points, Rank, Predicted, Exact
- **Quick-action cards:** "My Leagues" → `/predict/leagues`, "Leaderboard" → `/predict/leaderboard`
- Renders `<FixtureCard>` for each fixture with `showPrediction={!!user}`

### `/predict/[fixtureId]` — Fixture detail + prediction form

**File:** `app/predict/[fixtureId]/page.tsx`

- Loads single fixture by `fixtureId` URL param
- Pre-fills score inputs from `fixture.myPrediction` if exists
- Countdown refreshes every 30s via `forceRefresh` state trick
- **States:** open prediction form / locked (past kickoff) / completed with points result
- Uses `<ScoreInput>` spinner component for home/away scores
- On submit: `upsertPrediction()` → reload fixture → show saved confirmation
- Shows `<PointsResult>` banner after fixture completes and user had a prediction

### `/admin/fixtures` — Admin result entry

**File:** `app/admin/fixtures/page.tsx`

- Guarded by `NEXT_PUBLIC_ADMIN_EMAIL === user.email`
- Lists all fixtures with search (team/group), stage filter, status filter
- Each row expands inline to show score inputs + "Set result" button
- `adminSetResult()` sets both scores + `status = "completed"` — this triggers `auto_score_predictions` at DB level
- Manual "↻ Rescore" button per fixture + "Rescore entire competition" in danger zone
- Stats strip shows Total / Done / Pending counts

---

## 5. Scoring Logic

Scoring is implemented identically in two places (kept in sync):

1. **`auto_score_predictions()` trigger** — fires automatically on `fixtures UPDATE` when both scores are set and changed
2. **`rescore_fixture(p_fixture_id)` RPC** — manual recalculation, callable from admin panel

### Points table

| Points | Condition | Example |
|---|---|---|
| **5** | Exact score | Predicted 2-1, actual 2-1 |
| **3** | Correct goal difference | Predicted 2-0 (+2 GD), actual 3-1 (+2 GD) |
| **2** | Correct result (win/draw) only | Predicted 1-0 (home win), actual 2-1 (home win) |
| **0** | Wrong | Any other case |

### Colour coding in UI

```typescript
pointsColor(5)    → "#00e676"  // green
pointsColor(3)    → "#00d4ff"  // cyan
pointsColor(2)    → "#ffab00"  // amber
pointsColor(0)    → "#ff4040"  // red
pointsColor(null) → "#4a5568"  // grey (not yet scored)
```

Note: `#4a5568` in `pointsColor()` is acceptable for a _loading placeholder_, but never use it for rendered text labels.

---

## 6. League Design

### Data model

- A **league** belongs to one competition and has one **invite code** (8-char uppercase, auto-generated from UUID strip)
- **Any authenticated user** can create a league — creator is auto-joined as a member
- **Any authenticated user** can join any league if they know the invite code
- League membership is public to all authenticated users (RLS policy)
- Predictions themselves remain private — only the scoring results appear in leaderboards
- A user can belong to **multiple leagues** in the same competition

### Invite code flow

1. Creator calls `createLeague(competitionId, name)` → receives `{ league: { inviteCode, ... } }`
2. Creator shares the 8-char code (e.g. `A3BF72CX`) via copy button
3. Invitee navigates to `/predict/leagues`, enters the code
4. Frontend calls `getLeagueByInviteCode(code)` → shows league name + member count for confirmation
5. User clicks "Join" → `joinLeague(leagueId)` → error `23505` means already a member (treated as success)
6. League appears in user's "My Leagues" list

### League leaderboard

Powered by `get_league_leaderboard(p_league_id)` RPC:
- Returns ALL league members regardless of prediction count (shows 0 pts for those who haven't predicted yet)
- Includes `user_id` (UUID) so frontend can set `isMe: true` on the current user's row
- Do **not** render `user_id` in the UI
- Uses `SECURITY DEFINER` — bypasses RLS, scoped by `league_id` only

---

## 7. Invite Code Design

### Generation

Postgres generates the code at INSERT time:

```sql
invite_code text not null unique
  default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
```

This produces codes like `A3BF72CX`, `F9D24E81`.

### Collision probability

With 8 hex characters (upper case) from a UUID strip:  
- Character set: `[0-9A-F]` = 16 chars
- Codes: 16^8 = ~4 billion possibilities
- At 10,000 leagues, collision probability < 0.0001% — negligible

### Validation

- Frontend: trim whitespace, uppercase before `getLeagueByInviteCode(code.toUpperCase())`
- DB: `UNIQUE` constraint on `invite_code` ensures no duplicates

---

## 8. RLS / Security Rules

### Summary table

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `competitions` | ✅ Anyone | ❌ Admin only (via SQL) | ❌ | ❌ |
| `teams` | ✅ Anyone | ❌ Admin only (via SQL) | ❌ | ❌ |
| `fixtures` | ✅ Anyone | ❌ Admin only (via SQL) | ❌ Admin only via `adminSetResult` (no RLS UPDATE policy — relies on Supabase service role) | ❌ |
| `predictions` | 🔒 Own rows only | 🔒 Own `user_id` | 🔒 Own `user_id` | ❌ |
| `prediction_leagues` | ✅ Anyone | 🔒 `created_by = auth.uid()` | ❌ | ❌ |
| `prediction_league_members` | 🔒 Authenticated only | 🔒 `user_id = auth.uid()` | ❌ | 🔒 Own `user_id` |

### Important security notes

1. **Predictions are private before kickoff.** The `predictions` SELECT policy is `auth.uid() = user_id`. Other users cannot read your prediction before the match starts (no peeking). Scores are only surfaced via `SECURITY DEFINER` leaderboard RPCs after the match.

2. **`adminSetResult` has no RLS guard.** It calls `supabase.from("fixtures").update(...)` which succeeds because the Supabase `anon` key uses row-level policies and there is no UPDATE policy on fixtures — meaning **any authenticated user can currently call this function from the client**. The only protection is the UI check `user.email === ADMIN_EMAIL`. This should be hardened with a DB-level UPDATE policy restricted to a `service_role` or RPC with `SECURITY DEFINER`.

3. **Prediction deadline is enforced at DB level.** The `prediction_deadline_check` trigger fires `BEFORE INSERT OR UPDATE` on `predictions`. Client-side checks are UI-only and insufficient.

4. **`get_league_leaderboard` exposes `user_id`.** This is intentional (for `isMe` highlighting) and is scoped to league members, but never render UUIDs directly in the UI.

---

## 9. Known Issues

### 🔴 CRITICAL — Dead nav links in production

`/predict` hub page has two quick-action cards that link to:
- `/predict/leagues` → **404** (page does not exist)
- `/predict/leaderboard` → **404** (page does not exist)

Every user who visits the predictor hub sees broken navigation. **This is the first priority for Day 3.**

### 🔴 HIGH — `adminSetResult` has no server-side auth guard

Any authenticated user can call `supabase.from("fixtures").update(...)` directly. The protection is client-side only (`user.email === ADMIN_EMAIL`). Before launch, add an UPDATE RLS policy on `fixtures` restricted to a specific role or admin flag, or route result entry through a server action / API route.

### 🟡 MEDIUM — Original seed file has approximate kickoff times

`supabase/seeds/wc2026-fixtures.sql` contains the original approximate seed. The corrected seed `supabase/seeds/wc2026_correct.sql` has been applied to the production DB (verified 2026-06-04, sources: NBC Sports + Sky Sports). The original file is kept for history but should not be re-run.

### 🟡 MEDIUM — Competition status stuck on "upcoming"

The `competitions` table `status` field is still `upcoming`. It should be changed to `active` on tournament start (June 11, 2026). This can be done via Supabase SQL Editor or via a cron job. Nothing in the current UI blocks on this, but the competition badge on `/predict` shows "upcoming" rather than "active".

### 🟡 MEDIUM — Knockout fixtures have null home/away teams

Fixtures #73–104 have `home_team_id = NULL` and `away_team_id = NULL`. `FixtureCard` renders "TBD 🏳" for these. Admin will need to use `adminUpdateFixtureTeams()` as group stage results come in. No UI exists for this yet — must be done directly via Supabase SQL or by adding a team-assignment panel to `/admin/fixtures`.

### 🟢 LOW — `getMyLeagues` does a client-side filter

`getMyLeagues(competitionId)` fetches ALL leagues the user belongs to, then filters `.filter((l) => l.competitionId === competitionId)` in JavaScript. Fine while there is only one competition; will become inefficient at scale.

---

## 10. Day 3 Implementation Plan

> **Goal:** Fix the two dead nav links. Build `/predict/leagues` (create + join + list) and `/predict/leaderboard` (global standings).

### Step 1: `/predict/leagues/page.tsx`

```
State: myLeagues[], creating (bool), joining (bool), createName, joinCode, 
       confirmLeague (PredictionLeague | null), error

Load:  getCompetition("wc2026") → getMyLeagues(comp.id)

Sections:
A. My leagues — list of PredictionLeague cards:
   - League name + invite code (copy button)
   - Member count via getLeagueMemberCount
   - Link to /predict/leagues/[leagueId]
   - Empty state: "No leagues yet — create one or join with a code"

B. Create league form:
   - Text input (2–40 chars)
   - Submit → createLeague() → add to list + show invite code
   - Success: show new league card with code prominently

C. Join by invite code:
   - 8-char input (auto-uppercase as user types)
   - "Look up" → getLeagueByInviteCode() → show league name + member count
   - "Join" → joinLeague() → redirect to /predict/leagues/[leagueId]
   - Already-member case: redirect directly
```

### Step 2: `/predict/leagues/[leagueId]/page.tsx`

```
Load:  getLeagueByInviteCode isn't right here — fetch by ID.
       Add getLeague(leagueId) to lib/predictor.ts: 
         supabase.from("prediction_leagues").select("*").eq("id", leagueId).single()
       Then: getLeagueLeaderboard(leagueId)
       Mark rows: isMe = (row.userId === user?.id)

Sections:
A. Header: league name, invite code with copy button, member count
B. Leaderboard table:
   - Rank | Player (flag + name) | Pts | Predicted | Exact
   - Highlight current user's row with accent border
   - "You" chip on their row
C. Fixture strip (optional Day 3 stretch):
   - Upcoming fixtures for the competition using FixtureCard compact=true
```

### Step 3: `/predict/leaderboard/page.tsx`

```
Load:  getCompetition("wc2026") → getPredictorLeaderboard(comp.id)
       If user: getMyStats(comp.id)

Sections:
A. My stats strip (when signed in + has predictions):
   Points / Rank / Predicted / Exact — same StatChip pattern as hub page
B. Leaderboard table (identical structure to league leaderboard):
   - Rank | Player (flag + name) | Pts | Predicted | Exact
   - Mark current user's row (match by displayName is not reliable — 
     better to also call getMyStats and compare totalPoints + globalRank)
   - Empty state: "No results yet — predictions are scored after each match"
C. Link back to /predict
```

### New `lib/predictor.ts` function needed

```typescript
export async function getLeague(leagueId: string): Promise<PredictionLeague | null> {
  const { data, error } = await supabase
    .from("prediction_leagues")
    .select("id, competition_id, name, invite_code, created_by, created_at")
    .eq("id", leagueId)
    .single();
  if (error || !data) return null;
  const l = data as Record<string, unknown>;
  return {
    id:            l.id as string,
    competitionId: l.competition_id as string,
    name:          l.name as string,
    inviteCode:    l.invite_code as string,
    createdBy:     l.created_by as string,
    createdAt:     l.created_at as string,
  };
}
```

### Build and deploy checklist for Day 3

1. `npm run build` — must pass with zero errors
2. Verify `/predict/leagues` loads without error (signed in + signed out)
3. Verify `/predict/leaderboard` loads without error
4. Test create league flow end-to-end
5. Test join-by-code flow end-to-end
6. `git add ... && git commit -m "Day 3: leagues and leaderboard pages"`
7. `git push origin main` → Vercel auto-deploys

---

## 11. Day 4 Implementation Plan

> **Goal:** Bracket management (admin fills in knockout teams), prediction deadline display, social sharing of league invites.

### Knockout bracket admin panel

Add to `/admin/fixtures` — filter to show only knockout fixtures (status ≠ completed, stage ≠ group). Each row should have team dropdowns populated from `teams WHERE competition_id = comp.id`. On save, calls `adminUpdateFixtureTeams(id, homeTeamId, awayTeamId)`.

### Prediction deadline countdown on FixtureCard

Replace the static kickoff date on `FixtureCard` with a live countdown for fixtures kicking off within 24 hours. Use `kickoffCountdown(fixture.kicksOffAt)` already in `lib/predictor.ts`. Show amber/red colouring as deadline approaches.

### League invite sharing

On the league detail page (`/predict/leagues/[leagueId]`), add:
- Native `navigator.share()` with the invite code and a link like `superbrain.social/predict/leagues?join=A3BF72CX`
- Add handling in `/predict/leagues/page.tsx` for `?join=XXXXXX` URL param — auto-populate the join code input and trigger the lookup

### Competition status automation

Add a `CompetitionStatusBanner` component to `/predict/page.tsx` that shows a countdown to kickoff when status is `upcoming`. This automatically disappears once `competition.status === "active"`. Change DB status via Supabase SQL on tournament day.

### Security hardening (Day 4 priority)

Move `adminSetResult` to a Next.js **server action** or API route that verifies the admin email from a server-side session, not client-side. This removes the current client-side-only auth guard on fixture updates.

---

## 12. Deployment Process

### Standard code change

```bash
# 1. Make changes locally
# 2. Build must pass
npm run build

# 3. Stage only source files (never .next/)
git add <files>

# 4. Commit with descriptive message
git commit -m "feat: description"

# 5. Push — Vercel auto-deploys on push to main
git push origin main
```

**Vercel project:** `prj_uSFc3cNFyRy7OaRHCggpRkGxGbau`  
**Team:** `team_R3ucBV5zK0tYabrTO7n3l69S`  
**Auto-deploy:** All pushes to `main` trigger a production deployment.

### Database changes

Run SQL in: **Supabase Dashboard → SQL Editor** for the `agtyfbqxmrobliqybrvz` project.

Order of SQL files:
1. `supabase/schema.sql` — core platform (user_profiles, test_results, etc.)
2. `supabase/migrations/001_security_fixes.sql`
3. `supabase/migrations/002_fix_public_results_rls.sql`
4. `supabase/predictor-schema.sql` — predictor tables + RLS + triggers + RPCs
5. `supabase/battle-schema.sql` — battle system
6. `supabase/matrix-schema.sql` — matrix test
7. `supabase/seeds/wc2026_correct.sql` — **use this, not `wc2026-fixtures.sql`**

### Environment variables

Set in both `.env.local` (local dev) and **Vercel → Project → Settings → Environment Variables** (production):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Email that unlocks `/admin/*` pages |

---

## 13. Production Testing Checklist

### Before any predictor deployment

**Anonymous user tests (signed out):**
- [ ] `/predict` loads without error — 104 fixtures visible
- [ ] Fixtures group by date, tabs (All/Today/Results) work
- [ ] Sign-in nudge banner visible
- [ ] Tapping a FixtureCard navigates to `/predict/[fixtureId]`
- [ ] Fixture detail shows teams, kickoff time, countdown
- [ ] Prediction form not visible — "Sign in to predict" prompt shown
- [ ] "My Leagues" and "Leaderboard" quick-action cards navigate without 404

**Signed-in user tests:**
- [ ] Stat chips hidden when user has 0 predictions
- [ ] Tap FixtureCard for a scheduled fixture → prediction form appears
- [ ] Score spinners increment/decrement correctly (0–20 range)
- [ ] Submit prediction → green confirmation, fixture reloads, prediction row shows in card
- [ ] Return to `/predict` → FixtureCard shows "Your pick: X–Y"
- [ ] Edit prediction before kickoff → score updates correctly
- [ ] Attempting to predict a completed/past fixture → locked state shown

**Admin tests (signed in as `NEXT_PUBLIC_ADMIN_EMAIL`):**
- [ ] `/admin/fixtures` loads all 104 fixtures
- [ ] Search for team name filters correctly
- [ ] Expand a fixture row → score inputs appear
- [ ] Set result (e.g. 2–1) → "Saved 2–1. Predictions scored automatically." message
- [ ] Fixture row shows green result after save
- [ ] "↻ Rescore" button appears on completed fixture → rescores without error
- [ ] "Rescore entire competition" asks for confirmation → runs without error

**Leagues tests (Day 3+):**
- [ ] Create league with valid name → invite code shown, creator auto-joined
- [ ] Copy invite code to clipboard works
- [ ] Enter invalid/unknown invite code → helpful error shown
- [ ] Enter valid invite code → league name shown for confirmation
- [ ] Join league → member count increments → league appears in "My Leagues"
- [ ] Joining twice (same code) → no error (idempotent)
- [ ] League leaderboard shows member rows even with 0 predictions
- [ ] Current user's row highlighted

**Error state tests:**
- [ ] Disconnect Supabase (wrong anon key) → `/predict` shows error card with exact message
- [ ] Navigate to `/predict/INVALID-UUID` → "Fixture not found" with back link
