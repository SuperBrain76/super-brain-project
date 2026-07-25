/**
 * lib/matchweekPredictions.ts — Premier League experience
 *
 * The Home/Draw/Away prediction model, reconciled with the 5/3/2/0 engine.
 * See docs/PREMIER_LEAGUE_UX.md §9.1.
 *
 * ────────────────────────────────────────────────────────────
 * THE RECONCILIATION
 * ────────────────────────────────────────────────────────────
 * The interface is Home / Draw / Away — one tap, autosaves. But the engine
 * scores exact (5) / GD (3) / result (2) / wrong (0) and stores a SCORE, not
 * an outcome. A pure H/D/A pick could only ever score "result" or "wrong".
 *
 * So an H/D/A tap maps to a DEFAULT REPRESENTATIVE SCORELINE, and the stored
 * prediction is always a score. Users who want the 5s and 3s expand the row
 * and set an exact score. "One tap to play, two to compete."
 *
 * NO React, NO Supabase here — pure functions, fully tested. The autosave
 * wiring that calls upsertPrediction lives in the component.
 */

import type { Fixture } from "./predictor";

export type Outcome = "home" | "draw" | "away";

export interface ScorePick {
  home: number;
  away: number;
}

/**
 * Default scoreline for each outcome.
 *
 * These are the most common Premier League results, so a one-tap pick is a
 * defensible prediction on its own — not a placeholder. Configurable per
 * competition later via competition_settings; these are the football defaults.
 */
export const DEFAULT_SCORELINE: Record<Outcome, ScorePick> = {
  home: { home: 1, away: 0 },   // 1-0 is the modal home win
  draw: { home: 1, away: 1 },   // 1-1 the modal draw
  away: { home: 0, away: 1 },   // 0-1 the modal away win
};

/** Which outcome does a scoreline represent? */
export function outcomeOf(pick: ScorePick): Outcome {
  if (pick.home > pick.away) return "home";
  if (pick.away > pick.home) return "away";
  return "draw";
}

/**
 * The stored score for an H/D/A tap.
 *
 * If the user already has a score whose OUTCOME matches the tapped button,
 * keep it — re-tapping "Home" must not wipe a carefully chosen 3-1 back to
 * 1-0. Only when the outcome actually changes do we drop to the default.
 */
export function scoreForOutcome(outcome: Outcome, existing: ScorePick | null): ScorePick {
  if (existing && outcomeOf(existing) === outcome) return existing;
  return DEFAULT_SCORELINE[outcome];
}

/** The prediction on a fixture as a ScorePick, or null if none. */
export function pickFromFixture(f: Fixture): ScorePick | null {
  const p = f.myPrediction;
  if (!p) return null;
  return { home: p.homeScore, away: p.awayScore };
}

/** The currently-selected outcome for a fixture, or null. */
export function selectedOutcome(f: Fixture): Outcome | null {
  const pick = pickFromFixture(f);
  return pick ? outcomeOf(pick) : null;
}

// ── Score bounds (mirror the DB CHECK: 0–20) ─────────────────

export const MIN_GOALS = 0;
export const MAX_GOALS = 20;

export function clampGoals(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(MIN_GOALS, Math.min(MAX_GOALS, Math.round(n)));
}

export function stepGoals(current: number, delta: number): number {
  return clampGoals(current + delta);
}

// ── Bulk helpers (user-initiated only — never automatic) ─────
// docs/PREMIER_LEAGUE_UX.md §4.2: these are buttons the user presses, never
// something we do on their behalf. Auto-predicting fakes engagement, pollutes
// leaderboards and mints IQ nobody earned.

export interface BulkTarget {
  fixtureId: string;
  pick:      ScorePick;
}

/**
 * "Copy last week's scores" — map a previous round's predictions onto this
 * round's fixtures BY TEAM MATCH-UP, not by position. Only fills fixtures the
 * user has NOT already predicted and can still predict.
 */
export function copyFromPreviousRound(
  current:  Fixture[],
  previous: Fixture[],
  nowMs:    number,
): BulkTarget[] {
  // Index previous predictions by an order-independent team-pair key, so
  // "Arsenal v Chelsea" and "Chelsea v Arsenal" resolve, and the home/away
  // orientation of THIS fixture decides how the score is applied.
  const prevByPair = new Map<string, { home: string; pick: ScorePick }>();
  for (const f of previous) {
    const pick = pickFromFixture(f);
    if (!pick || !f.homeTeam || !f.awayTeam) continue;
    const key = pairKey(f.homeTeam.code, f.awayTeam.code);
    prevByPair.set(key, { home: f.homeTeam.code, pick });
  }

  const out: BulkTarget[] = [];
  for (const f of current) {
    if (f.myPrediction != null) continue;                 // don't overwrite
    if (!isStillOpen(f, nowMs)) continue;                 // don't touch locked
    if (!f.homeTeam || !f.awayTeam) continue;

    const key = pairKey(f.homeTeam.code, f.awayTeam.code);
    const prev = prevByPair.get(key);
    if (!prev) continue;

    // Re-orient the previous score to THIS fixture's home/away.
    const sameOrientation = prev.home === f.homeTeam.code;
    const pick = sameOrientation
      ? prev.pick
      : { home: prev.pick.away, away: prev.pick.home };

    out.push({ fixtureId: f.id, pick });
  }
  return out;
}

/**
 * "Fill remaining as 1-1" (or any scoreline) — every still-open, not-yet
 * predicted fixture. The default is a draw because it is the least
 * presumptuous fill.
 */
export function fillRemaining(
  fixtures: Fixture[],
  nowMs:    number,
  pick:     ScorePick = { home: 1, away: 1 },
): BulkTarget[] {
  return fixtures
    .filter((f) => f.myPrediction == null && isStillOpen(f, nowMs))
    .map((f) => ({ fixtureId: f.id, pick }));
}

function isStillOpen(f: Fixture, nowMs: number): boolean {
  return f.status === "scheduled" && new Date(f.kicksOffAt).getTime() > nowMs;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

// ── Grouping for the sheet ────────────────────────────────────
// The sheet groups fixtures by kickoff slot ("Saturday 15:00"), because that
// is how users think about a matchweek — not by fixture number.

export interface KickoffGroup {
  key:         string;    // ISO minute — stable sort key
  label:       string;    // "Saturday 15:00"
  kickoffMs:   number;
  fixtures:    Fixture[];
  locksFirst:  boolean;   // earliest group — carries the challenge deadline
}

export function groupByKickoff(
  fixtures: Fixture[],
  timeZone = "Europe/London",
): KickoffGroup[] {
  const bySlot = new Map<string, Fixture[]>();

  for (const f of fixtures) {
    // Round to the minute so a 15:00 and a 15:00:30 share a slot.
    const ms = Math.floor(new Date(f.kicksOffAt).getTime() / 60000) * 60000;
    const key = String(ms);
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key)!.push(f);
  }

  const groups: KickoffGroup[] = [...bySlot.entries()]
    .map(([key, fs]) => {
      const kickoffMs = Number(key);
      return {
        key,
        label: formatSlot(kickoffMs, timeZone),
        kickoffMs,
        fixtures: fs.sort((a, b) =>
          (a.homeTeam?.name ?? "").localeCompare(b.homeTeam?.name ?? "")),
        locksFirst: false,
      };
    })
    .sort((a, b) => a.kickoffMs - b.kickoffMs);

  if (groups.length) groups[0].locksFirst = true;
  return groups;
}

function formatSlot(ms: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long", hour: "2-digit", minute: "2-digit",
      hour12: false, timeZone,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toUTCString();
  }
}

// ── Progress ──────────────────────────────────────────────────

export interface SheetProgress {
  total:       number;
  predicted:   number;
  predictable: number;   // still open
  locked:      number;   // past kickoff
  complete:    boolean;  // every predictable fixture has a pick
}

export function sheetProgress(fixtures: Fixture[], nowMs: number): SheetProgress {
  const total       = fixtures.length;
  const predicted   = fixtures.filter((f) => f.myPrediction != null).length;
  const predictable = fixtures.filter((f) => isStillOpen(f, nowMs)).length;
  const locked      = total - predictable;
  const openUnpicked = fixtures.filter(
    (f) => isStillOpen(f, nowMs) && f.myPrediction == null,
  ).length;

  return { total, predicted, predictable, locked, complete: openUnpicked === 0 };
}
