# The completion "wow" moment + the 2-minute bar

**Date:** 25 July 2026
**Lens:** Head of Product. Every change here serves signups, completed
predictions, return visits or sharing. Nothing else.

---

## The north-star test

> **Can a brand-new user understand and make all 10 predictions in under 2
> minutes with no explanation?**

Where the build stands against it:

- **Understand, no explanation** — the sheet now shows a one-line hint before
  the first pick: *"👇 Tap who you think wins each match. That's it."* It
  disappears after the first tap. The control is three buttons; the default
  scoreline appears on tap; there is nothing to read.
- **Under 2 minutes** — one tap per match, ten matches, autosave. A confident
  user is done in ~20 taps and well under a minute. "Fill remaining as 1–1"
  and "Copy last week" collapse the tail for anyone who stalls.
- **The payoff** — finishing now triggers a celebration instead of a silent
  save. See below.

---

## The wow moment

`components/premier/CompletionCelebration.tsx` — fires **once**, the first time
all ten matches are predicted. Built to your spec, verified in the browser:

```
              🏆  (bounces in)
        Matchweek 1 complete!
     You've predicted all 10 matches.

          ┌────────────────────┐
          │   up to 500 IQ     │
          │ up for grabs this  │
          │      weekend       │
          └────────────────────┘

   You've joined 4,287 SuperBrain players.

     [   View leaderboards →   ]   ← primary
     [   Challenge a friend    ]   ← share
        Back to my predictions
```

Full-screen, blurred backdrop, hand-rolled CSS confetti (no library, no
dependency), trophy bounce, card pop. Respects `prefers-reduced-motion`.

### Why each element earns its place

| Element | Metric it moves |
|---|---|
| The celebration itself | **Completed predictions** — a payoff for finishing makes people finish |
| "up to 500 IQ this weekend" | **Return visits** — a concrete reason to come back Saturday |
| "You've joined 4,287 players" | **Signups** — social proof that this is alive and worth joining |
| **View leaderboards →** (primary) | **Return visits** — sends them to a screen that rewards checking back |
| **Challenge a friend** | **Sharing** — the viral loop, front and centre at the peak emotional moment |

The IQ figure and player count are **props**, not hardcoded — production wires
the real max-IQ (from the competition's economy) and the real player count.
The `500` shown is the true maximum for the default economy (10 exact scores ×
50 IQ). If that feels high, it's tuned in `competition_economy_rules` — a
settings decision, no code.

### It fires exactly once

Guarded by a ref, on the transition from "not all predicted" → "all
predicted". Editing a score afterwards does not re-trigger it. Closing returns
you to your predictions; the primary button goes to the leaderboard.

---

## How it's wired

- `MatchweekSheet` gained four optional props: `maxIq`, `playerCount`,
  `onViewLeaderboard`, `onShare`. Absent → the celebration still fires, just
  without the social-proof line or the buttons it can't route. The World Cup
  and any other sheet are unaffected.
- The prototype passes real values and routes "View leaderboards" to the
  league tab and "Challenge a friend" to `navigator.share`.

No migration, no new abstraction, no new test suite — the existing 164 pass.

---

## Product backlog, ranked by the four metrics

Not built yet. Ordered by impact on the metrics, so the next session picks the
top of the list, not the most interesting engineering.

| Idea | Primary metric | Why it's high/low |
|---|---|---|
| **Predict before sign-up** (save picks locally, register to keep them) | Signups + completed predictions | 🔝 Biggest lever. The sign-in wall is the single largest drop-off before the 2-minute goal. Let them play, then convert at the celebration. |
| **Share card with your actual picks** (image) | Sharing | People share specifics, not generic links. Turns the "Challenge a friend" tap into real reach. |
| **Saturday "your points are live" push** | Return visits | The Saturday return hook already written in copy; needs the notification wiring (respecting the 3/week cap). |
| **First-run empty state on the dashboard** | Completed predictions | A new user landing on `/premier-league` should be one tap from the sheet, with the biggest match as the hook. |
| **"You beat Sarah this week" league moments** | Return visits + sharing | The social obligation is the strongest retention force; surface head-to-heads. |

Everything above is UX/copy/growth. The engine is not on this list — it's done.
