# Premier League — real data & personality

**Date:** 25 July 2026
**Goal:** make it feel alive. Real clubs, real fixtures, real kickoff times, and
the copy that gives people a reason to come back Thursday, Friday, Saturday,
Monday. **No new architecture, no new abstraction, no new test suites** — this
is data, colour and words.

---

## What shipped

### Real Premier League data

| File | What |
|---|---|
| `lib/premierLeague/clubs.ts` | The 20 real clubs, their **real colours** (Anfield red, City sky blue, Wolves gold), nicknames and how fans actually say the name ("Spurs", "Man Utd"). Text-contrast is computed, so a light badge never ships with unreadable text. |
| `lib/premierLeague/fixtures.ts` | The real 2025/26 opening 3 matchweeks — actual match-ups, real kickoff times-of-day (Fri night, Sat 12:30/15:00/17:30, Sun, Mon night), real results for the "simulate" flow. Dates shifted to the 2026/27 calendar so it reads as the upcoming season. |
| `supabase/seeds/premier-league-2026-27.sql` | **Ready-to-apply production seed.** Creates the competition, season, 3 rounds, 20 clubs and 30 fixtures; wired for the matchweek dashboard; **left HIDDEN** so you launch it from `/admin/competitions` when you're ready. Generated from the same data files, so seed and prototype tell one story. |

### Club identity

- `components/premier/ClubCrest.tsx` — a coloured monogram badge in the club's
  real colour. No crest images (licensing), but colour alone carries instant
  recognition. Added to the prediction sheet and the dashboard's biggest-match
  strip. **This one thing is most of what makes it feel like the Premier
  League instead of a form.**

### Personality & copy

- `lib/premierLeague/matchweekCopy.ts` — the voice of the product:
  - **Real editorial per matchweek.** MW1: *"It's back. United host Arsenal,
    City go to Wolves, Sunderland return."* The biggest match carries a real
    reason: *"Old Trafford, Sunday teatime. Arsenal want the title that keeps
    slipping away; United want to prove last season was the floor."*
  - **State-aware dashboard copy** — a different, human line for every day of
    the matchweek, so opening the app feels like checking on something moving.
  - **The four return hooks** (Thursday / Saturday / Monday) — the retention
    thesis in three lines, ready for the notification cap in UX §4.8.

### The prototype is now the real thing

`/prototype/matchweek` plays the **actual opening weekend** — real clubs, real
crests, real fixtures, real results, real editorial. Verified in-browser
(mobile): the sheet shows Liverpool v Bournemouth under the Friday-night
"locks first" badge, club badges in true colours (LIV red, NEW black, BHA blue,
FUL near-black), and the dashboard's biggest-match strip reads
**🔥 [MUN] Man United v Arsenal [ARS]** with the real story. Clean console.

Also fixed a real hydration bug found by playing it: the prototype read
`localStorage` during render, so server and client disagreed. Gated behind a
mount flag — the correct fix, and it makes the page SSR-safe.

---

## The question every future feature answers

> **"Will this make users come back next Thursday, Friday, Saturday and Monday?"**

How the current build answers it, per day:

| Day | State | The hook |
|---|---|---|
| **Thursday** | Preview | New fixtures + editorial drop. *"Matchweek N is nearly here."* The star-players and biggest-match story build anticipation before you've predicted anything. |
| **Friday** | Open | The green "Predict N matches" hero + the Friday **"locks first"** deadline. One-tap picks — no friction. |
| **Saturday** | Live | *"23 points and counting."* Live points as goals go in — the most compelling screen we have. |
| **Monday** | Results | The payoff: your score, your movement, your league position. *"You scored 7 and you're 5th in The Office."* Then next matchweek opens. |

Everything from here is copy, excitement and retention on this spine —
not another abstraction layer.

---

## To go live

1. Apply `supabase/seeds/premier-league-2026-27.sql` (needs engine migrations
   037–050).
2. `/admin/competitions` → the Premier League appears **HIDDEN** → run the
   launch checks → **Go live**.
3. It opens at `/premier-league`, with the matchweek dashboard.

Real fixtures beyond MW3 and live result ingestion (API-Football league 39)
are configuration once you're ready — the engine already does it.
