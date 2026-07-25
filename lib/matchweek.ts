/**
 * lib/matchweek.ts — Premier League experience
 *
 * The matchweek state machine. The Competition Home is one living dashboard
 * that changes state through the week; this module is the pure function that
 * decides which state it is in, and derives everything the dashboard needs
 * from data the engine already has.
 *
 * NO React, NO Supabase, NO Date.now() baked in (every function takes an
 * explicit `nowMs`). That is what makes the whole state machine unit-testable
 * without a database or a clock — which matters, because getting the state
 * wrong is the most visible bug this product can have.
 *
 * See docs/PREMIER_LEAGUE_UX.md §1 and §9.
 */

import type { Fixture } from "./predictor";
import type { Round } from "./competitionEngine";

// ── The six states ────────────────────────────────────────────

export type MatchweekState =
  | "preview"   // fixtures published, predictions not open yet
  | "open"      // predicting allowed, before first kickoff
  | "locked"    // first kickoff reached, no results yet
  | "live"      // matches in progress
  | "results"   // matches done, showing the payoff (a.k.a. SETTLING)
  | "break";    // international break — next round is far away

export interface MatchweekView {
  state:        MatchweekState;
  round:        Round | null;

  // Deadlines, resolved once so the UI never recomputes them.
  firstKickoff: number | null;   // ms — when predictions start locking
  lastKickoff:  number | null;   // ms — when the final fixture begins
  challengeLock: number | null;  // ms — rounds.locks_at (Friday, typically)

  // Fixture roll-up.
  total:        number;
  predicted:    number;
  completed:    number;          // fixtures with a final result
  liveNow:      number;          // fixtures currently playing

  // Prediction progress. Only counts fixtures that are still predictable
  // PLUS ones already predicted, so "4 of 10" never counts a locked match a
  // user could no longer act on.
  predictable:  number;          // fixtures a user could still predict now
  outstanding:  number;          // predictable AND not yet predicted

  nextKickoffMs: number | null;  // for the countdown
}

// ── Tunables ──────────────────────────────────────────────────
// How far before challenge-lock predictions open. The engine has no
// "predictions_open_at" column; PREVIEW is derived from this lead time so
// fixtures are visible-but-not-yet-predictable for a couple of days.
export const PREVIEW_LEAD_MS = 3 * 24 * 60 * 60 * 1000;   // 3 days

// Gap to the next round beyond which we call it an international break.
export const BREAK_GAP_MS = 8 * 24 * 60 * 60 * 1000;      // 8 days

// ── Fixture predicates ────────────────────────────────────────

function kickoffMs(f: Fixture): number {
  return new Date(f.kicksOffAt).getTime();
}

function hasResult(f: Fixture): boolean {
  return f.homeScore !== null && f.awayScore !== null && f.status === "completed";
}

/**
 * Is this fixture actually in play?
 *
 * Requires EVIDENCE — a live status, or a running score on a not-yet-final
 * match. A clock merely past kickoff is not enough: "kicked off, no data yet"
 * is the LOCKED state (waiting for the ball), not LIVE. Using the clock alone
 * made both LOCKED and the between-batches Saturday-morning state unreachable.
 */
function isLive(f: Fixture, _nowMs: number): boolean {
  if (f.status === "live") return true;
  if (hasResult(f)) return false;
  return f.homeScore !== null || f.awayScore !== null;   // a running score
}

/**
 * Can this fixture still be predicted right now?
 *
 * Mirrors the DB deadline trigger (enforce_prediction_deadline): open only
 * while scheduled AND before kickoff. This is a display convenience — the
 * database is the real gate.
 */
export function isFixturePredictable(f: Fixture, nowMs: number): boolean {
  return f.status === "scheduled" && kickoffMs(f) > nowMs;
}

// ── The state decision ────────────────────────────────────────

/**
 * Derive the whole dashboard view for one round from its fixtures.
 *
 * `fixtures` must be the fixtures of `round` only. `nextRoundStartsAt` (ms)
 * is used solely to tell BREAK apart from a normal gap.
 */
export function deriveMatchweekView(
  round:             Round | null,
  fixtures:          Fixture[],
  nowMs:             number,
  nextRoundStartsMs: number | null = null,
): MatchweekView {
  const total     = fixtures.length;
  const predicted = fixtures.filter((f) => f.myPrediction != null).length;
  const completed = fixtures.filter(hasResult).length;
  const liveNow   = fixtures.filter((f) => isLive(f, nowMs)).length;

  const kickoffs   = fixtures.map(kickoffMs).sort((a, b) => a - b);
  const firstKick  = kickoffs.length ? kickoffs[0] : null;
  const lastKick   = kickoffs.length ? kickoffs[kickoffs.length - 1] : null;
  const challengeLock = round?.locksAt ? new Date(round.locksAt).getTime() : firstKick;

  const predictableFixtures = fixtures.filter((f) => isFixturePredictable(f, nowMs));
  const predictable = predictableFixtures.length;
  const outstanding = predictableFixtures.filter((f) => f.myPrediction == null).length;

  const nextKickoffMs = fixtures
    .map(kickoffMs)
    .filter((ms) => ms > nowMs)
    .sort((a, b) => a - b)[0] ?? null;

  const state = decideState({
    round, total, completed, liveNow, firstKick, lastKick, challengeLock,
    nowMs, nextRoundStartsMs,
  });

  return {
    state, round,
    firstKickoff: firstKick,
    lastKickoff:  lastKick,
    challengeLock,
    total, predicted, completed, liveNow,
    predictable, outstanding,
    nextKickoffMs,
  };
}

function decideState(a: {
  round: Round | null;
  total: number; completed: number; liveNow: number;
  firstKick: number | null; lastKick: number | null; challengeLock: number | null;
  nowMs: number; nextRoundStartsMs: number | null;
}): MatchweekState {
  const { total, completed, liveNow, firstKick, lastKick, nowMs, nextRoundStartsMs } = a;

  // No fixtures yet, or the round hasn't materialised: it's a gap. Call it a
  // break if the next round is far off, otherwise a preview of what's coming.
  if (total === 0 || firstKick === null) {
    if (nextRoundStartsMs !== null && nextRoundStartsMs - nowMs > BREAK_GAP_MS) return "break";
    return "preview";
  }

  // Everything played and resulted → RESULTS, until the next round is far
  // enough away to be a break.
  if (completed === total) {
    if (nextRoundStartsMs !== null && nextRoundStartsMs - nowMs > BREAK_GAP_MS) return "break";
    return "results";
  }

  // Something actually in play → LIVE. The "Saturday afternoon" state.
  if (liveNow > 0) return "live";

  // Before the first kickoff: OPEN inside the lead window, else PREVIEW.
  if (nowMs < firstKick) {
    return firstKick - nowMs <= PREVIEW_LEAD_MS ? "open" : "preview";
  }

  // Locked territory — first kickoff passed, nothing live, not all done:
  //   - matches still to come (now on/before the last kickoff) → LOCKED.
  //     "You're in. Next up Saturday 15:00." A settled Friday result is shown
  //     in the fixture list, but the dominant need here is what's next.
  //   - every fixture has kicked off, waiting on final results → RESULTS
  //     (settling).
  if (lastKick !== null && nowMs <= lastKick) return "locked";
  return "results";
}

// ── Countdown formatting ──────────────────────────────────────

/** Compact "2d 04h 11m" / "04h 11m" / "11m 30s". Never negative. */
export function formatCountdown(targetMs: number, nowMs: number): string {
  const ms = Math.max(0, targetMs - nowMs);
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  if (h > 0) return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

// ── Human summary of the state ────────────────────────────────
// One line the dashboard shows under the matchweek title. Kept here, not in
// the component, so it is tested rather than eyeballed.

export function stateHeadline(v: MatchweekView, nowMs: number): string {
  switch (v.state) {
    case "preview":
      return v.firstKickoff
        ? `Predictions open soon`
        : `Fixtures to be confirmed`;
    case "open":
      return v.challengeLock
        ? `Locks in ${formatCountdown(v.challengeLock, nowMs)}`
        : `Open now`;
    case "locked":
      return `Locked · first match soon`;
    case "live":
      return v.liveNow > 0 ? `${v.liveNow} live now` : `Matches under way`;
    case "results":
      return v.completed === v.total ? `Matchweek complete` : `Results coming in`;
    case "break":
      return `International break`;
  }
}

/** The dashboard's primary call to action per state. */
export function statePrimaryAction(
  v: MatchweekView,
): { label: string; kind: "predict" | "view" | "results" | "none" } {
  switch (v.state) {
    case "open":
      return v.outstanding > 0
        ? { label: `Predict ${v.outstanding} match${v.outstanding === 1 ? "" : "es"}`, kind: "predict" }
        : { label: "Edit your predictions", kind: "predict" };
    case "preview":
      return { label: "See the fixtures", kind: "view" };
    case "locked":
    case "live":
      return { label: "Watch it live", kind: "view" };
    case "results":
      return { label: "See your results", kind: "results" };
    case "break":
      return { label: "View the table", kind: "view" };
  }
}
