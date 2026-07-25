# Premier League — Experience Design

**Date:** 24 July 2026
**Status:** 🎨 **DESIGN ONLY. No Premier League code written.**
**Scope:** the complete user experience, first visit to season end.
**Engine:** Phases 1–2 (migrations 037–049) — designed against what exists, not what we wish existed.

---

## 0. The insight everything else follows from

> **The World Cup was a four-week sprint. The Premier League is a nine-month marathon.**

That single difference invalidates most of what worked before.

| | World Cup 2026 | Premier League 2026/27 |
|---|---|---|
| Duration | 39 days | 279 days |
| Matches | 104 | 380 |
| Rhythm | Something almost every day | One pulse a week, then silence |
| Simultaneity | 2 at once, at most | **10 at 15:00 on a Saturday** |
| Dead periods | None | **Three international breaks, 2 weeks each** |
| Cost of missing a day | Small — tomorrow there's another | You miss a *week*, and 1/38th of the season |
| Reason to return | The tournament is on | **We have to manufacture one** |

The World Cup never had to answer "why come back?" — the tournament answered it.
The Premier League asks that question 38 times, and three times it asks it after a
fortnight of nothing happening.

**So the design goal is not "let users predict matches." That is solved.**
**It is: give someone a reason to open the app on a Thursday.**

Your "This Matchweek" idea is exactly the right instinct. My one change is that it
should not be a page — it should be **the competition home**, always. See §2.

### Three constraints the engine imposes

1. **Challenges lock at the round's first kickoff** (`rounds.locks_at`, stored). For a
   typical matchweek that is **Friday 20:00**, not Saturday 15:00. This is a real UX
   hazard — see §6.3.
2. **Match predictions lock per fixture**, in Postgres (`enforce_prediction_deadline`).
   Monday-night fixtures stay open after Saturday's are closed. The UI must present
   one deadline while honouring eleven.
3. **There is no player data.** None. `bonus_questions.answer_type` allows `'player'`
   but stores free text. "Star players to watch" needs a new source — see §7.

---

## 1. The matchweek lifecycle — the spine of the product

Every surface in this document is a function of **where we are in the matchweek cycle**.
Design the state machine first; the screens fall out of it.

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
   ┌────────┐   ┌───▼────┐   ┌────────┐   ┌──────┐   ┌──────────┐  │
   │ PREVIEW │──▶│  OPEN  │──▶│ LOCKED │──▶│ LIVE │──▶│ SETTLING │──┘
   └────────┘   └────────┘   └────────┘   └──────┘   └──────────┘
    Tue–Thu      Thu–Fri      1st KO      matches     results
                              reached     playing     landing
                                                          │
                                                          ▼
                                                    ┌──────────┐
                                                    │  BREAK   │  (international
                                                    └──────────┘   break only)
```

| State | When | The one job of the home screen |
|---|---|---|
| **PREVIEW** | Previous matchweek settled → fixtures published | *Build anticipation.* No predicting yet. |
| **OPEN** | Predictions available → first kickoff | *Get predictions in.* Everything else is secondary. |
| **LOCKED** | First kickoff → first final whistle | *Reassure.* "You're in. 10/10 predicted." |
| **LIVE** | Matches playing | *Live points.* The most exciting screen we have. |
| **SETTLING** | Final whistle → all results in | *Deliver the payoff.* Your score, your movement. |
| **BREAK** | International break | *Retain without football.* Season stats, standings, long-view. |

**Derivable from the engine today, with no new columns:**

```
PREVIEW   round.status = 'upcoming' AND now < (locks_at − predictions_open_lead)
OPEN      now < round.locks_at
LOCKED    now >= round.locks_at AND no fixture has a score yet
LIVE      any fixture in the round has status 'live'
SETTLING  all fixtures kicked off, some without a final result
BREAK     next round's starts_at is more than 8 days away
```

> **Design rule.** The user should never have to work out which state they are in.
> The home screen tells them in the first 200 pixels.

---

## 2. "This Matchweek" — make it the home, not a page

You proposed a Thursday/Friday page showing biggest match, leaderboard, league
standings, star players, challenges, countdown. **The content is right. The
placement, I'd change.**

**Why not a separate page:** it creates a "which page do I want?" decision every
visit, splits the entry point between `/premier-league` and `/premier-league/this-week`,
and is wrong six days out of seven — on Sunday evening nobody wants a preview, they
want their score. A page that's right one day a week is a page people stop opening.

**Instead: `/premier-league` IS "This Matchweek", and it changes with the state.**
One URL, always right, always worth opening. Every notification, every share, every
bookmark points at the same place.

### The home screen, per state

```
┌─ PREVIEW ─────────────────────────────┐  ┌─ OPEN ────────────────────────────────┐
│ MATCHWEEK 13                          │  │ MATCHWEEK 13    ● OPEN                │
│ Opens Thursday 18:00      [Remind me] │  │ Locks Fri 20:00 · ⏱ 2d 04h 11m        │
│                                       │  │                                       │
│ 🔥 BIGGEST MATCH                      │  │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│    Arsenal v Man City · Sun 16:30     │  │ ┃  PREDICT 10 MATCHES     4 of 10  ┃ │
│    1st v 3rd · 4 pts apart            │  │ ┃  ▓▓▓▓░░░░░░              [GO →]  ┃ │
│                                       │  │ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│ 🧠 3 CHALLENGES                       │  │                                       │
│    Preview — lock at first kickoff    │  │ 🧠 CHALLENGES          1 of 3 answered │
│                                       │  │ 🔥 Arsenal v Man City · Sun 16:30     │
│ 📈 YOUR SEASON      #142 ▲6           │  │ ⚔️ The Office          You 2nd of 8   │
│ ⚔️ The Office       2nd of 8          │  │ 📈 Season #142 ▲6 · This month #38    │
│                                       │  │                                       │
│ [ See all 10 fixtures ]               │  │ [ See all 10 fixtures ]               │
└───────────────────────────────────────┘  └───────────────────────────────────────┘

┌─ LIVE ────────────────────────────────┐  ┌─ SETTLING ────────────────────────────┐
│ MATCHWEEK 13   ● 5 LIVE               │  │ MATCHWEEK 13 · COMPLETE               │
│                                       │  │                                       │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │  │      ┏━━━━━━━━━━━━━━━━━━━━━┓          │
│ ┃  23 PTS SO FAR        ▲ 11 places ┃ │  │      ┃      31 POINTS      ┃          │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │  │      ┃  your 2nd best week ┃          │
│                                       │  │      ┗━━━━━━━━━━━━━━━━━━━━━┛          │
│ ARS 2-1 MCI  ⚽ 78'    you 2-1  ✓ 5   │  │  3 exact · 2 GD · 4 result · 1 miss   │
│ CHE 0-0 EVE  ⚽ HT     you 1-0    2   │  │                                       │
│ LIV 3-1 FUL  ⚽ 62'    you 2-1    3   │  │ 📈 Season  #131 ▲11                   │
│ …                                     │  │ ⚔️ The Office  1st ▲1  — you're top!  │
│                                       │  │ 🧠 Challenges  2 of 3  +12            │
│ ⚔️ The Office — you're 1st this week  │  │                                       │
│                                       │  │ [ Share your week ]  [ MW14 → ]       │
└───────────────────────────────────────┘  └───────────────────────────────────────┘
```

**BREAK state** replaces the matchweek block entirely: "No Premier League for 12 days."
Then season-scale content — your form over the last 5 matchweeks, the real league table,
your accuracy stats, your private league's season race. The one screen that has to work
without any football to talk about.

---

## 3. Navigation

```
Mobile bottom bar (5)          Desktop
┌──────┬──────┬──────┬──────┬──────┐   Premier League ▾   This Week · Predict ⁴⁄₁₀
│ This │Predict│Ranks│Leagues│ You │                      Ranks · Leagues · Stats
│ Week │ ⁴⁄₁₀  │      │       │     │
└──────┴──────┴──────┴──────┴──────┘
```

**Predict carries a badge** — `4/10` while open, hidden when complete or locked. An
unfinished count is the single most effective nudge available, and it costs no
notification budget.

### Routes

| Route | Purpose | New? |
|---|---|---|
| `/premier-league` | This Matchweek — state-aware home | reshaped |
| `/premier-league/predict` | **The matchweek prediction sheet** | 🆕 |
| `/premier-league/matchweek/[code]` | Any matchweek, past or future | 🆕 |
| `/premier-league/fixture/[id]` | One fixture, deep detail | exists |
| `/premier-league/leaderboard` | Matchweek · Month · Season tabs | reshaped |
| `/premier-league/leagues` | Private leagues | exists |
| `/premier-league/standings` | The actual league table | reshaped |
| `/premier-league/challenges` | Current + past challenges | 🆕 |
| `/premier-league/stats` | Your prediction statistics | 🆕 |
| `/premier-league/season` | Season wrap-up (appears in May) | 🆕 |

---

## 4. Surface designs

### 4.1 Landing / first visit

**The critical path is not the homepage. It is a WhatsApp invite opened on a phone in
matchweek 19.** Design for that first; the marketing page second.

Three arrivals, three different jobs:

| Arrival | They need to know | The hazard |
|---|---|---|
| Invite link (`/premier-league/leagues/join?code=…`) | Which league, who's in it, how to join | Sign-up wall before value is shown |
| Cold / organic | What this is, that it's free, that it's live now | Generic "predict football" pitch |
| **Returning World Cup player** | Their history carries over, PL is new | Feeling like a stranger in a product they used |

> 🔴 **The single most important message on this page, from October onward:**
> **"You have not missed it."**
>
> A user arriving in matchweek 19 will assume a 38-week competition is over for them.
> It is not — and the engine is *designed* so it isn't. Monthly leaderboards reset,
> matchweek leaderboards reset weekly, and challenges lock per round rather than for
> the season. Say so, explicitly, above the fold:
>
> *"Matchweek 19 of 38. Join now and you're level with everyone on this month's
> leaderboard."*
>
> Without this, late arrivals bounce, and after October that's most arrivals.

**Layout (invite arrival):**

```
┌──────────────────────────────────────┐
│  ⚔️  THE OFFICE                      │
│  Dylan invited you · 7 members       │
│  ┌─────┬─────┬─────┬─────┐           │
│  │ 1st │ 2nd │ 3rd │ +4  │  avatars  │
│  └─────┴─────┴─────┴─────┘           │
│                                      │
│  Premier League Predictor            │
│  Matchweek 19 of 38                  │
│                                      │
│  ✓ Free · ✓ Monthly leaderboard      │
│    resets — you start level          │
│                                      │
│  [   Join The Office   ]             │
│  Already playing? Sign in            │
└──────────────────────────────────────┘
```

Show the league and its members **before** asking for an account. The value is visible;
the account comes at the join.

### 4.2 The prediction flow — the highest-leverage change

**The World Cup flow does not survive contact with 10 simultaneous fixtures.**

```
World Cup (per fixture)                 Premier League (one sheet)
tap card → page loads → predict         all 10 on one screen
→ back → tap next → …                   → stepper each → autosave
≈ 40 interactions, 10 page loads        ≈ 20 taps, 0 page loads
```

`/premier-league/predict` — one scrolling sheet, all fixtures, inline steppers,
**autosave on change** (no Save button), a sticky progress header.

```
┌──────────────────────────────────────────┐
│ MATCHWEEK 13        4/10    ⏱ 2d 04h    │ ← sticky
├──────────────────────────────────────────┤
│ FRIDAY 20:00                    ⚠ locks first │
│  Brentford   [−] 1 [+] – [−] 2 [+]  Arsenal  ✓│
├──────────────────────────────────────────┤
│ SATURDAY 15:00 · 5 matches               │
│  Chelsea     [−] 0 [+] – [−] 0 [+]  Everton   │
│  Liverpool   [−] 2 [+] – [−] 1 [+]  Fulham   ✓│
│  …                                       │
├──────────────────────────────────────────┤
│           [ Copy last week's scores ]    │
│           [ Predict remaining as 1-1 ]   │
└──────────────────────────────────────────┘
```

Design decisions, with reasoning:

- **Autosave, no Save button.** `upsertPrediction` is already a single upsert. A Save
  button on a 10-fixture form creates one moment where everything can be lost. Show a
  ✓ per row instead.
- **Group by kickoff, not by fixture number.** Users think "Saturday 3 o'clock."
- **Mark the Friday match.** It locks ~19 hours before the rest and it is the round's
  challenge deadline. This marker is the mitigation for §6.3.
- **Bulk helpers, not auto-fill.** "Copy last week" and "fill remaining 1-1" are
  *user-initiated*. Never auto-predict on someone's behalf: it fakes engagement,
  pollutes leaderboards, and mints IQ nobody earned.
- **A locked fixture stays visible, greyed, showing your prediction.** Never remove a
  row — a disappearing fixture reads as a bug.
- **Keep `/fixture/[id]`** for depth (head-to-head, form, others' predictions after
  kickoff). It stops being the prediction mechanism and becomes the detail view.

### 4.3 Matchday page — `/matchweek/[code]`

One template for **any** matchweek, past or future. Past matchweeks are the browsable
history that makes a 38-week season feel like a season rather than a treadmill.

- **Future:** fixtures, kickoff times, "opens Thursday"
- **Current:** live scores, live points, your predictions inline
- **Past:** results, your points per fixture, your matchweek rank, challenge outcomes

Left/right chevrons for MW12 ← MW13 → MW14. Deep-linkable, shareable, indexable.

### 4.4 Leaderboards

Three windows, one screen, tabs. Decided: **weekly = matchweek.**

```
┌────────────────────────────────────────────┐
│ [ MATCHWEEK 13 ] [ NOVEMBER ] [ SEASON ]   │
│ ─────────────                              │
│  #1  Sarah K      41  🇬🇧   5 exact        │
│  #2  Tom R        38  🇮🇪   4 exact        │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃#7  You          31  🇦🇪   3 exact  ▲11 ┃ │ ← sticky
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
└────────────────────────────────────────────┘
```

- **Your row is always visible**, pinned, even at rank 4,000. A leaderboard that
  doesn't show you is a leaderboard you stop opening.
- **Matchweek tab is the default during OPEN/LIVE/SETTLING.** Season is the default
  during BREAK. The tab that matters right now is the one that opens.
- **Movement arrows (▲11)** are the retention mechanic. Rank alone is static; *change*
  is a story. Requires the previous window's rank — see §7.
- **Pagination.** 380 fixtures × thousands of users. The current
  `get_predictor_leaderboard` is `LIMIT 200` with no offset — Phase 4 replaces it.

### 4.5 Matchday Challenges

2–5 per matchweek. Optional. **Lock at the round's first kickoff and no other time** —
which is what stops a matchweek-19 joiner being permanently behind, and is the entire
reason these replaced season-long bonus questions.

```
┌──────────────────────────────────────┐
│ 🧠 MATCHWEEK 13 CHALLENGES           │
│ Lock Friday 20:00 · ⏱ 2d 04h        │
│                                      │
│ 1. Highest scoring team?      15 pts │
│    [ Arsenal ▾ ]                   ✓ │
│                                      │
│ 2. Total goals over/under 26?  10 pts│
│    [ OVER ] [ UNDER ]                │
│                                      │
│ 3. Will anyone score a hat-trick? 20 │
│    [ YES ] [ NO ]                    │
└──────────────────────────────────────┘
```

- **Higher stakes than a single match** (10–20 pts vs 5). They are the comeback
  mechanism: a good challenge week can recover a bad prediction week, which is what
  keeps a mid-table user engaged in February.
- **Answer types beyond the World Cup's team/player**: boolean, over/under, numeric,
  multiple choice — designed into the `challenges` table in Phase 5.
- **Show last week's outcomes** underneath. Settled challenges are content: "62% of
  players said OVER. They were wrong."
- **Never punish skipping.** They are optional and framed as upside, never as an
  incomplete task.

### 4.6 Private leagues

The mechanics are built and proven — invite codes, join, leave, rename, public/featured,
owner controls. What the Premier League needs is **not more features, it's a weekly
narrative.**

A private league is the strongest retention tool in the product, because the
obligation is social rather than to an app. Lean on it:

- **Matchweek result inside the league**, not just season totals: "You won The Office
  this week with 31."
- **Head-to-head line**: "You've beaten Tom in 7 of 13 matchweeks."
- **A running league story**: "Sarah has led for 4 weeks."
- **League matchweek leaderboard** — the small-number competition (8 people) is far
  more motivating than rank 4,000 of 20,000.

### 4.7 Invites

Existing flow works. What's missing is a **reason to send one**, and that reason is
generated weekly by results:

- After SETTLING, a **shareable matchweek card**: "MW13 · 31 pts · 3 exact · 1st in The
  Office" → WhatsApp. That is the loop: play → do well → share → invite.
- Invite links must land on the league preview (§4.1), not a sign-up wall.
- **Invite peaks are seasonal.** August (season start), January (new year, transfer
  window), and after any personal best. Prompt then; stay quiet otherwise.

### 4.8 Notifications — a scarce budget

> **38 weeks × over-notifying = unsubscribed.** The World Cup could send daily for four
> weeks and get away with it. Do that for nine months and the list is gone by Christmas.

**Budget: 3 per matchweek maximum, and two are conditional.**

| # | When | Trigger | Condition |
|---|---|---|---|
| 1 | Thu 18:00 | Matchweek opens | Always. *"MW13 is open — 10 fixtures, 3 challenges."* |
| 2 | Fri 17:00 | 3h before lock | **Only if incomplete.** *"You've predicted 4 of 10."* |
| 3 | Sun 20:00 | Results settled | **Only if they predicted.** *"31 points. You're 1st in The Office."* |

Never sent: per-match alerts, per-goal alerts, "someone joined your league," anything
during an international break, anything to a user who predicted nothing for 3 weeks
(they get one re-engagement message at the start of the next month, then silence).

**Opt-in extras:** "someone overtook you in your private league" — high-signal,
genuinely wanted, but must be off by default.

**Existing infrastructure:** `email-matchday` and `email-standings` crons plus Resend
with one-click unsubscribe. Both are competition-unaware today and would send duplicates
once a second competition is live — flagged in the Phase 1–2 runbook as Phase 4 work.
Capacitor is already wrapped for iOS/Android, so push is available; **the same 3-per-week
budget must be shared across email and push, not applied to each.**

### 4.9 Results

Two moments, and the second is the one that matters.

**During (LIVE):** points tick up as goals go in. The engine already writes live scores,
which fires the scoring trigger repeatedly — so live points come free. This is the most
compelling screen in the product and it exists as a side effect of an ingestion decision.

**After (SETTLING):** the payoff moment. It must land in one screen, without scrolling:

```
        31 POINTS
     your 2nd best week
   3 exact · 2 GD · 4 result · 1 miss
   Season #131 ▲11 · The Office 1st ▲1
   [ Share ]            [ MW14 → ]
```

Lead with the number, then context, then two actions. Never open with what they got
wrong.

### 4.10 Statistics

The reward for a long season: 380 fixtures produce patterns four weeks never could.

- **Accuracy by team** — "You're 71% accurate on Arsenal, 22% on Brentford."
- **Home/away bias** — "You over-predict home wins by 18%."
- **Scoreline habits** — "You predict 2-1 more than anyone. It lands 14%."
- **Form** — points per matchweek, sparkline, best and worst weeks.
- **vs the crowd** — where you disagreed with the majority and were right. The most
  shareable stat in the product.

**Available from `predictions` + `fixtures` alone. No new data.** This is the highest
value-to-effort surface in the entire design, and it doubles as BREAK-week content.

### 4.11 Season wrap-up

May. A personal, shareable season story — and the single best acquisition asset for
2027/28, because it ships exactly when people are deciding whether to play again.

```
YOUR 2026/27 SEASON
340 of 380 predicted · 1,847 points · finished #131 of 4,210
Best week      MW22 · 41 pts
Best call      Forest 2-1 Man City — 4% of players got it
Your team      Arsenal · 71% accurate
The Office     🥇 Champion
[ Share your season ]
```

Ship it as a **route, not an email** — shareable, linkable, permanent. It should be
built for `/premier-league/season` and reusable by every future competition.

---

## 5. Build order

Sequenced so the product is usable at every stop, not only at the end.

| Phase | Ships | Why here |
|---|---|---|
| **3a** | PL data, competition home (OPEN + LOCKED), **prediction sheet**, matchweek page | The minimum that lets someone play a matchweek |
| **3b** | Leaderboards (matchweek/month/season), league table | Play without ranking is pointless |
| **3c** | LIVE + SETTLING states, results moment, share card | The payoff and the viral loop |
| **4** | Matchday Challenges | Needs rounds (built) + settlement rules |
| **5** | PREVIEW + BREAK states, notifications | Retention — only meaningful once there's something to return to |
| **6** | Statistics, private-league narrative | Depth, and it makes breaks survivable |
| **7** | Season wrap-up | May |

> **Do not ship 3a without 3c.** Predicting with no payoff is the version people play
> once. If time is short, cut challenges (Phase 4), not the results moment.

---

## 6. Design risks

### 6.1 The dead-February problem 🔴

A mid-table user in February has no title race, no relegation battle, and 12 matchweeks
left. **Monthly leaderboards are the answer** — February is a fresh competition starting
at zero for everyone. This is the strongest argument for making the monthly window
prominent rather than a tab nobody finds. Consider a monthly recap moment on the 1st.

### 6.2 Ten simultaneous kickoffs

Saturday 15:00: ten matches, ten live score streams, ten sets of points moving. The
engine handles it (provider-ID routing, Phase 1.1). The *interface* must not become a
wall of numbers. Recommendation: your predictions first, ordered by points earned, with
a single aggregate "23 pts so far" hero. Detail on demand.

### 6.3 The Friday-night lock ⚠️

**Challenges lock at the round's first kickoff.** For a typical matchweek that's Friday
20:00 — but most users think the deadline is Saturday 15:00, and most matches are then.
A user opening the app Saturday morning finds challenges already closed and will read it
as a bug.

Mitigations, in order of importance:
1. The **Thursday notification is mandatory**, not optional. It is the only warning.
2. The countdown on the home screen is to the **challenge lock**, labelled explicitly:
   *"Challenges lock Friday 20:00."*
3. The Friday fixture is **visually marked** in the prediction sheet.

**Worth measuring in the first month:** what fraction of users answer challenges after
the Friday match has kicked off (i.e. would have been shut out). If it's material,
consider moving the challenge lock to the first *Saturday* kickoff — a rule change, so
your call, and one better made with data than in advance.

### 6.4 Late joiners

Handled by design — monthly and matchweek windows reset, challenges are per-round. But
**it has to be said out loud on the landing page** (§4.1), because the assumption "I've
missed it" forms before anyone reads a leaderboard.

### 6.5 IQ inflation

380 fixtures mints roughly 3.7× a 104-fixture tournament at the same rate. The mechanism
to fix this is built (`competition_economy_rules`, per competition and per event). **The
number is still your call** — it's the one open decision carried over from the last phase.

---

## 7. What needs data we do not have

Honest inventory. Everything else in this document is buildable on the current schema.

| Feature | Needs | Recommendation |
|---|---|---|
| ⭐ **Star players to watch** | **Player data. We have none.** | **Admin-curated for MVP.** A `round_editorial` table (`round_id`, `headline`, `body`, `players jsonb`) — three names and a line each, written Thursday. A player feed is a project; this is a text box, and it's better copy. |
| 🔥 **Biggest match** | League positions | **Derivable** from fixtures — compute the table, rank by combined position. Auto-suggest, admin override. No new source. |
| 📈 **Movement arrows (▲11)** | Previous window's rank | Snapshot ranks at each round settlement (`leaderboard_round_snapshots`). Small table, and it makes every leaderboard a story rather than a list. |
| 🏆 **League table** | Nothing new | `GroupStandings` already computes this from fixtures. Generalise `has_table` — Phase 3.4. |
| 📊 **Statistics** | Nothing new | `predictions` + `fixtures`. Highest value-to-effort in the document. |
| 🖼️ **Club crests** | Asset pipeline | 20 SVGs. Not a data problem, a licensing and storage one. Flag early — the design leans on them.

---

## 8. Decisions I need from you

| # | Question | My recommendation |
|---|---|---|
| 1 | "This Matchweek" as a **separate page**, or as the **state-aware home**? | **The home.** One URL, always right, always worth opening. |
| 2 | **Star players** — admin-curated, or wait for a player feed? | **Admin-curated.** Ships in Phase 3, writes better, costs a text box. |
| 3 | Are the **3-per-matchweek** notification limits acceptable? | Yes — and treat email + push as one shared budget. |
| 4 | **Bulk-fill helpers** in the prediction sheet — acceptable, or too close to auto-predicting? | Acceptable **only** user-initiated. Never automatic. |
| 5 | **Challenge lock** stays at first kickoff (Friday), or moves to first Saturday kickoff? | **Keep it**, ship the mitigations, decide with data after a month. |
| 6 | **IQ rate** per competition? | Still open from Phase 2. Needed before launch. |
| 7 | **Prizes** in the PL season? | Out of the MVP. But if there is one, it changes the leaderboard design — tell me early. |

---

---

## 9. Locked decisions (25 Jul 2026)

Confirmed by Dylan; these are now build constraints, not open questions.

1. **Competition Home is one living dashboard.** State changes automatically
   Preview → Open → Locked → Live → Results → Break. No separate preview page.
2. **One Matchweek prediction sheet.** All fixtures on one screen, inline
   Home/Draw/Away, autosave after every pick. Never one fixture at a time.
3. **3 notifications per matchweek, hard cap:** Thu (opens) · Sat last-chance
   (incomplete only) · Mon (results). Shared budget across email and push.
   *(Note: this shifts the last-chance send from Friday to Saturday — see the
   Friday-lock note in §6.3. With challenges locking Friday, the Saturday
   last-chance covers MATCH predictions, whose per-fixture deadlines run
   through Monday. Challenge deadline is carried by the Thursday send.)*
4. **Mobile-first.** Phone, 10 minutes before kickoff, is the design target.
   Desktop adapts up from mobile, never the reverse.
5. **Statistics deferred** until after PL launch. Build order: prediction flow
   → leaderboards → private leagues → challenges → results. (§4.10 and the old
   Phase 6 stats move to post-launch.)

### 9.1 H/D/A vs the 5/3/2/0 engine — how it's reconciled

The engine scores exact (5) / GD (3) / result (2) / wrong (0), stored as
`home_score`/`away_score` integers. A pure Home/Draw/Away pick can only ever
land "result" or "wrong" — users could never earn a 5 or a 3, which removes
the mechanic that made the World Cup compelling.

**Reconciliation — "one tap to play, two to compete":**

- The inline control is **Home / Draw / Away**, exactly as specified. One tap
  autosaves a prediction, using a **default representative scoreline** per pick
  (Home → 1-0, Draw → 1-1, Away → 0-1).
- A row expands to an **optional exact-score stepper** for users who want the
  5s and 3s. Collapsed by default, so the fast path stays one tap.
- The stored prediction is always a score, so scoring, leaderboards, IQ and the
  entire engine are unchanged.

This delivers the requested interaction (inline H/D/A, autosave, one screen,
one tap) without discarding the richer game. Default scorelines are configurable
per competition. **Reversible to pure 1X2** by setting result-only scoring in
`scoring_rules` (result = N, wrong = 0) — no code change, a competition-settings
decision — if the exact-score layer proves unwanted.

---

## 10. Build status

- **25 Jul 2026 — Phase 3a underway.** Matchweek state machine, H/D/A + score
  prediction model, Competition Home dashboard and the Matchweek prediction
  sheet. See `docs/PREMIER_LEAGUE_BUILD.md` for what has actually shipped.
