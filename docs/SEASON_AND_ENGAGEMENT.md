# SuperBrain — Full Season, The Table & Engagement (design)

Status: **proposal, awaiting approval** · 15 Aug 2026

Goal: make SuperBrain sticky enough that a football fan comes back every week for
nine months — then reuse the same engine for other leagues and sports. We study
Fantasy Premier League (11M+ users, 20 years) for *why people return*, and adapt
the mechanics to our game (predict results), which is a different game from FPL
(build a squad, score off player actions). We take the engagement, not the format.

---

## 1. What FPL does right (and how we adapt it)

| FPL mechanic | Why it works | Our adaptation (predictions game) |
|---|---|---|
| **Captain = 2× points** | One high-stakes decision every week; endless debate | **Banker pick** — tap one match each matchweek to double its points |
| **Chips** (Wildcard, Triple Captain, Bench Boost, Free Hit — 2 sets/season) | Scarce power-ups create "when do I play it?" tension all season | **Season chips** (limited): *Double Down* (triple your Banker once), *All In* (double a whole matchweek once), *Safety Net* (a miss can't break your streak once) |
| **Mini-leagues** (classic + head-to-head) | Play against people you know; the real reason people stay | We have private leagues → add **Head-to-Head** league type (weekly opponent) + a **season cup** (knockout) |
| **Elite global leagues** (top 1% / 10%) | Aspirational tiers beyond "you're 2,000,000th" | **Divisions / percentile badges**, tied to our IQ levels (Bronze→Legend) |
| **Gameweek + overall rank, MoM** | Two horizons: this week AND the season | Show **matchweek rank** and **season rank**; **Manager of the Month** |
| **Live points on the pitch** | Appointment viewing on match day | Live scoring via the feed (points move as goals go in) |
| **Ownership %** | "Am I with the crowd or brave?" | We already have **crowd %** (trending picks) ✓ |
| **Deadlines** | A weekly heartbeat + urgency | Matchweek lock ✓ + 3 well-timed reminders/matchweek |
| **Price changes / transfers** | Daily reason to log in | **We deliberately skip this** — it belongs to squad-building, not predicting |

**Not copying:** squad selection, player prices, transfers, bench — that's FPL's
game. Ours stays "predict the score, one tap." Simplicity is our edge.

---

## 2. The three things you asked for

### A. The Table, with form guide
The real Premier League standings — **P · W · D · L · GF · GA · GD · Pts** — with a
**form guide** (last five results as W/D/L dots per club) and movement arrows.
Purpose: context that makes predicting smarter and browsing enjoyable. Tapping a
club shows its fixtures + your predictions for them.
- *Needs results data.* Pre-season it shows the opening table (all zero, no form);
  it comes alive as results arrive from the feed. TheSportsDB serves both the
  **table** (`lookuptable`) and **past results** (for form) on the free tier.

### B. Predict every game, all season
Today only 3 matchweeks exist. To predict ahead we import **all 380 fixtures** and
let you predict any future matchweek at any time (edit until each locks).
- A **season fixtures browser**: jump to any matchweek, see what you've predicted,
  "predict all remaining" helpers, progress ("You've predicted 84/380").
- *Needs the full fixture list.* TheSportsDB free tier pages the whole season by
  round (`eventsround`, 38 calls).

### C. FPL-inspired engagement (§1) — proposed build order
1. **Banker pick** (double one match/matchweek) — biggest bang, tiny cost.
2. **Streaks & milestones** (predicted N weeks running; longest correct streak) — retention.
3. **Season chips** (3 scarce power-ups).
4. **Head-to-Head leagues + season cup**.
5. **Divisions / Manager of the Month**.

---

## 3. The unlock: wire TheSportsDB (free tier) first

A, B and correct scoring all depend on real data: full fixtures, results, the
table, and form. All of that is on TheSportsDB's **free** tier (live in-play
scoring is the only premium-only piece). So the first build is a **TheSportsDB
provider adapter + importer** feeding our existing competition-agnostic pipeline
(`lib/ingestion.ts`, the results cron, per-competition settings). This is the
foundation for everything else — and for adding other leagues/sports later by
config, not code.

**Sequencing**
- **Phase 1 — Data:** TheSportsDB adapter + full-season import (fixtures, table, form, final results). Free tier.
- **Phase 2 — Surfaces:** the Table + form screen; the season fixtures browser + predict-ahead.
- **Phase 3 — Engagement:** Banker → streaks → chips → H2H/cup → divisions.
- **Phase 4 — Expand:** more leagues, then other sports (same engine, new config).

---

## 4. Open decisions (need your call)
1. **"The Table" = the real Premier League standings** (context), not our predictor
   leaderboard — correct? (We keep the predictor leaderboard too.)
2. **Wire TheSportsDB free adapter now** as the foundation (unblocks table, form,
   full-season, real scoring) — go?
3. **Engagement first cut:** start with **Banker + streaks** (highest ROI), or a
   bigger first drop including chips + H2H?
