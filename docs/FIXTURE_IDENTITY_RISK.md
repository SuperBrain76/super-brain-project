# Fixture Identity Risk — Phase 0

**Date:** 17 July 2026
**Subject:** `findDbFixtureByKickoff` — `lib/ingestion.ts:211–220`
**Status under freeze:** 🔒 **DO NOT MODIFY.** Safe for the World Cup. Unsafe for the Premier League.
**Severity:** Blocker for Premier League launch. **Zero risk to the World Cup.**

---

## 1. How fixture matching works today

Ingestion has no stable link between a provider fixture and a database fixture. It infers the link
from **kickoff time proximity**:

```ts
// lib/ingestion.ts:211
export function findDbFixtureByKickoff(
  apiKickoffIso: string,
  dbFixtures: DbFixture[],
): DbFixture | undefined {
  const apiMs = new Date(apiKickoffIso).getTime();
  return dbFixtures.find((f) => {
    const dbMs = new Date(f.kicks_off_at).getTime();
    return Math.abs(dbMs - apiMs) <= 90 * 60 * 1000;
  });
}
```

The full path:

1. GitHub Actions calls `/api/cron/ingest-results` every 5 minutes.
2. Three pre-flight gates decide whether to call the provider at all (tournament window → DB fixtures
   within ±3h → any match live/recent/imminent). These gates are well built and should survive Phase 1
   unchanged.
3. On pass, API-Football is queried with `league=1&season=2026` (`lib/ingestion.ts:225`).
4. For each returned fixture, `findDbFixtureByKickoff` locates the DB row.
5. `extractScore()` returns scores **only** for final statuses; `mapStatus()` maps the status code.
6. If changed, the fixture's `home_score`/`away_score`/`status` are written.
7. The `auto_score_predictions` trigger fires → `score_fixture_predictions` awards 5/3/2/0 →
   `economy_award_fixture` mints IQ.

**Two properties matter.** `Array.prototype.find` returns the **first** match and stops — it does not
detect that a second candidate exists. And the function returns `undefined` on no match, which the
caller treats as "nothing to do" — silently.

---

## 2. Why ±90 minutes was acceptable for the World Cup

The tolerance is deliberate and documented (`lib/ingestion.ts:204–209`): seeded kickoff times came
from a published schedule and can differ from the provider's official times by up to ~60 minutes.
The window absorbs that.

It is safe **because of a property of the World Cup, not a property of the code** — as the comment
states plainly:

> *"WC2026 group-stage matches are always 3+ hours apart so a 90-min window never accidentally matches
> the wrong game."*

With ≥3h between kickoffs and a ±90min window, the candidate sets cannot overlap. **Exactly one DB
fixture can ever fall inside the window.** Correctness is guaranteed by the fixture calendar.

This holds for the remainder of the tournament: the semi-finals are played, and the third-place
play-off (18 July) and final (19 July, 20:00 UTC) are a day apart. **The risk to the World Cup is
zero.** That is why this document exists instead of a fix.

---

## 3. Why it is unsafe for the Premier League

The Premier League violates the assumption as a matter of routine:

| Property | World Cup 2026 | Premier League |
|---|---|---|
| Concurrent kickoffs | Never in the group stage; 2 max on final group matchday, in *different* groups | **Routine — up to 10 at 15:00 on a Saturday** |
| Gap between kickoffs | ≥3 hours | **0 minutes** |
| Fixtures per matchday | ≤4 | Up to 10 simultaneously |
| Rescheduling | Rare | Common — TV picks, cups, weather |

On a standard Saturday, ten fixtures share the identical `kicks_off_at`. Every one of them sits inside
every other one's ±90-minute window. `find` returns **whichever happens to be first in the array** —
ordered by whatever PostgREST returned, which is not a guarantee of anything.

The failure is not probabilistic. **With ten fixtures at one kickoff time, at most one can be matched
correctly, and which one is arbitrary.** Nine results land on the wrong fixtures.

Rescheduling compounds it: a match moved by days no longer falls in any window, so
`findDbFixtureByKickoff` returns `undefined` and the result is **never ingested** — no error, no log,
no alert. The fixture simply stays `scheduled` forever.

---

## 4. How the wrong fixture receives a result

Concretely — Saturday, six fixtures at 15:00:

1. Provider returns Arsenal 2–1 Chelsea, `fixture.id = 1035041`, kickoff `15:00:00Z`.
2. `findDbFixtureByKickoff("15:00:00Z", dbFixtures)` walks the array. First element within 90 minutes
   is **Brighton vs Everton** — also 15:00.
3. It returns Brighton vs Everton. Match found. No warning.
4. The route writes `home_score = 2, away_score = 1, status = 'completed'` to **Brighton vs Everton**.
5. Arsenal vs Chelsea stays `scheduled`, unscored — until a later provider fixture in the same batch
   maps onto it, writing *some other match's* score.

Every downstream guard passes, because each was designed for a different failure. `extractScore`
correctly refuses partial scores — the score is final, just from the wrong match. The idempotency diff
correctly skips unchanged fixtures — the value did change. The trigger's `when (new.home_score is not
null …)` correctly fires — the scores are non-null.

**No layer in this system validates that the result belongs to the fixture.** Nothing can: the
information needed to check was discarded at step 2.

---

## 5. How this corrupts scoring, IQ and leaderboards

The blast radius is wide because scoring is synchronous and cascading:

1. **Predictions mis-scored.** `score_fixture_predictions` (`predictor-schema.sql:240`) awards 5/3/2/0
   against the wrong result. Every user who predicted Brighton vs Everton is scored on Arsenal vs
   Chelsea's scoreline.
2. **IQ minted.** `economy_award_fixture` mints 50/15/8/0 IQ from those points, appending to the
   **append-only** `economy_ledger`.
3. **Leaderboards shift immediately** — `get_predictor_leaderboard` aggregates `points_awarded` live.
   Global, private-league and public-league boards all move.
4. **Downstream economy fires.** The `economy_on_activity` trigger on ledger insert drives referral
   qualification and achievement unlocks. **Wrongly-earned IQ can qualify a referral and unlock an
   achievement.**

**Reversibility, honestly assessed:**

- Prediction points: ✅ fully reversible — `rescore_fixture(<uuid>)` recomputes from the corrected
  result and is idempotent.
- IQ ledger: 🟡 reconcilable, not erasable. `economy_award_fixture` is idempotent under rescore and
  reconciles the delta, so balances converge. The ledger is append-only by design, so the corrective
  entries remain visible.
- Referral qualification / achievements: 🔴 **not automatically reversible.** Nothing un-qualifies a
  referral or re-locks a badge. A user who crossed `referral_qualify_iq` on bad IQ stays qualified.
- User trust: 🔴 not reversible. Leaderboard positions visibly change after the fact.

The reason this ranks above every other Phase 1 item: **it fails silently, it fails on the busiest
day of the week, and its worst consequences are the ones that cannot be undone by rescoring.**

---

## 6. Does the current World Cup data carry a provider fixture ID?

**No — but the provider supplies one, and it is being discarded.**

The type is already modelled (`lib/ingestion.ts:90–96`):

```ts
export interface ApiFootballFixture {
  fixture: {
    id:     number;          // ← the stable provider identifier, already parsed
    date:   string;
    status: { short: string };
  };
  ...
}
```

`fixture.id` is read into the type on every poll and then **never persisted**. There is no
`provider_fixture_id` column on `fixtures`, no `provider` column, and no mapping table. The identity
arrives with every response and is thrown away.

That is fortunate: the fix is to store a value the system already receives, not to source new data.

---

## 7. Can historical provider IDs be recovered?

**Yes — reliably, and cheaply. For the World Cup, one API call.**

`fetchAllFixtures()` (`lib/ingestion.ts:325`) already retrieves the complete `league=1&season=2026`
schedule in a single request, and `app/api/admin/sync-kickoff-times` already demonstrates the pattern
end to end.

Recovery procedure (Phase 1, post-freeze):

1. `fetchAllFixtures()` → all 104 provider fixtures including `fixture.id`.
2. Match each to a DB fixture on **kickoff + both team names**, not kickoff alone. The WC's ≥3h
   spacing makes this unambiguous — the very property that makes the current code safe also makes
   backfill safe.
3. Write `provider_fixture_id`, `provider = 'api-football'`.
4. **Verify 104/104 matched.** Anything less is investigated by hand, not forced.
5. Only then switch matching to identity-first.

Backfill is read-only against production results — it writes a new column and touches no score, no
prediction and no point.

For the Premier League there is no backfill problem: IDs are captured at seed time, before any fixture
is played.

---

## 8. Tables and functions requiring modification (Phase 1 — not now)

| Object | Change | Notes |
|---|---|---|
| `fixtures` | **add** `provider` text · `provider_fixture_id` text · `unique(provider, provider_fixture_id)` | Additive, nullable. Backfill WC before enforcing. |
| `fixtures` | **add** index on `(provider, provider_fixture_id)` | Implied by the unique constraint. |
| `lib/ingestion.ts:211` | `findDbFixtureByKickoff` → `findDbFixtureByProviderId` | Keep the old function, unexported, for manual recovery only. |
| `lib/ingestion.ts:37` | `DbFixture` gains `provider_fixture_id` | Type change. |
| `app/api/cron/ingest-results/route.ts` | Select the new column; match on identity; log unmatched | The three pre-flight gates stay **verbatim**. |
| `app/api/admin/sync-kickoff-times/route.ts` | Reuse for backfill | Already fetches the full schedule. |
| `competition_settings` (new) | `provider`, `provider_league_id`, `provider_season` | Replaces the `WC2026` constant at `:225`. |
| **Not modified** | `score_fixture_predictions`, `rescore_fixture`, `economy_award_fixture`, `extractScore`, `mapStatus`, `getPollReason` | Correct as written. Out of scope. |

---

## 9. Post-freeze solution design

**Do not implement. Recorded for Phase 1 approval.**

**Identity model** — `(provider, provider_fixture_id)` unique on `fixtures`. Provider is explicit so a
second source is possible without ambiguity.

**Matching, in strict order:**

1. **Exact provider-ID match.** The only path that may write a result automatically.
2. **No match → do not guess.** Log `provider_fixture_id`, kickoff, team names, competition. Increment
   an unmatched counter. Write nothing.
3. **Ambiguity is impossible by construction** — the unique constraint guarantees at most one row.

**Controlled fallback.** Kickoff-proximity matching survives **only** as an admin-invoked reconciliation
tool that *proposes* a mapping for a human to confirm. It never runs automatically and never writes a
score. This preserves the recovery capability without the failure mode.

**Logging.** Every unmatched or ambiguous fixture is logged with enough context to reconcile by hand.
Today an unmatched fixture produces no signal at all — that is arguably worse than the mis-match,
because nobody learns.

**Manual reconciliation.** An admin screen listing unmatched provider fixtures beside candidate DB
fixtures, with an explicit "link these" action that writes `provider_fixture_id`. Rescheduled and
newly-added fixtures land here rather than silently disappearing.

**Idempotency.** Preserved exactly as today — the existing diff-before-write guard is correct. With
stable identity it becomes genuinely idempotent rather than accidentally so.

**No silent first-match selection. Ever.** This is the invariant the design exists to establish.

**Acceptance test (the one that matters):**

> Ten synthetic fixtures at an identical `kicks_off_at`, ten provider results in arbitrary order.
> Every result lands on its own fixture.

The current implementation fails this test. That single test is the definition of done for this
work — and it is worth writing *before* the fix, so it fails first for the right reason.
