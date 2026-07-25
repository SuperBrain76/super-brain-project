/**
 * lib/prototype/localStore.ts — playable-prototype backing store
 *
 * A Supabase-free store so a full Premier League Matchweek 1 can be played
 * end-to-end in the browser with no database: predict → autosave → simulate
 * results → score (the real 5/3/2/0 model) → leaderboard.
 *
 * State lives in localStorage so a refresh keeps your predictions — the
 * prototype should feel real, not reset on every reload.
 *
 * Prototype only. None of this touches the engine or production data.
 */

import type { Fixture } from "@/lib/predictor";
import { mw1Fixtures, MW1_RESULTS } from "./mw1Fixtures";
import { scorePrediction, DEFAULT_SCORING } from "@/lib/scoringModel";

const KEY = "sb-proto-mw1-v1";

interface StoredPick { home: number; away: number; }

interface ProtoState {
  picks:      Record<string, StoredPick>;   // fixtureId → prediction
  resulted:   boolean;                       // have results been simulated?
  clockOffsetMs: number;                     // time-travel for state testing
}

const EMPTY: ProtoState = { picks: {}, resulted: false, clockOffsetMs: 0 };

function read(): ProtoState {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

function write(s: ProtoState): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ── Time travel ───────────────────────────────────────────────
// The whole point of the prototype is to walk a matchweek through its
// states. `nowMs()` is the store's clock; the harness shifts it forward to
// jump from Open → Locked → Live → Results without waiting for August.

export function nowMs(): number {
  return Date.now() + read().clockOffsetMs;
}

export function setClockOffset(ms: number): void {
  const s = read();
  s.clockOffsetMs = ms;
  write(s);
}

export function getClockOffset(): number {
  return read().clockOffsetMs;
}

/** Jump the clock to a moment relative to Matchweek 1's fixtures. */
export function jumpTo(moment: "before" | "open" | "friday" | "saturday" | "after"): void {
  const fx = mw1Fixtures();
  const firstKo = new Date(fx[0].kicksOffAt).getTime();      // Friday 19:00
  const satKo   = new Date(fx[2].kicksOffAt).getTime();      // Saturday 15:00
  const lastKo  = new Date(fx[fx.length - 1].kicksOffAt).getTime(); // Monday
  const realNow = Date.now();

  const target = {
    before:   firstKo - 5 * 24 * 3600_000,   // 5 days out — PREVIEW
    open:     firstKo - 2 * 3600_000,         // 2h before Friday — OPEN
    friday:   firstKo + 30 * 60_000,          // Friday match on — LOCKED/LIVE
    saturday: satKo + 20 * 60_000,            // Saturday 15:20 — LIVE
    after:    lastKo + 3 * 3600_000,          // after Monday — RESULTS
  }[moment];

  setClockOffset(target - realNow);
}

// ── Predictions ───────────────────────────────────────────────

/** Save one prediction. Same shape as the real upsertPrediction. */
export async function protoSave(
  fixtureId: string, home: number, away: number,
): Promise<{ error: string | null }> {
  // A tiny delay so the sheet's optimistic "saving… → saved" is visible,
  // exactly as it would be against the network.
  await new Promise((r) => setTimeout(r, 120));
  const s = read();
  s.picks[fixtureId] = { home, away };
  write(s);
  return { error: null };
}

export function clearAll(): void {
  write({ ...EMPTY });
}

// ── Results ───────────────────────────────────────────────────

export function simulateResults(): void {
  const s = read();
  s.resulted = true;
  write(s);
}

export function hasResults(): boolean {
  return read().resulted;
}

// ── Fixtures, with predictions + results + scores applied ─────

/**
 * The prototype's fixtures as the real components expect them: predictions
 * joined into `myPrediction`, results applied once simulated, and each
 * prediction scored with the real 5/3/2/0 model.
 */
export function protoFixtures(): Fixture[] {
  const s = read();
  const now = nowMs();

  const FULL_TIME_MS = 2 * 60 * 60 * 1000;   // a match runs ~2h

  return mw1Fixtures().map((f, i) => {
    const pick = s.picks[f.id];
    const result = MW1_RESULTS[i];
    const ko = new Date(f.kicksOffAt).getTime();

    // Once results are simulated a fixture progresses with the clock:
    //   scheduled → live (first 2h after kickoff) → completed.
    // So at the "saturday" jump the 15:00 games are LIVE while later games
    // are still scheduled and earlier ones are done — a real matchweek.
    const played = s.resulted && now >= ko + FULL_TIME_MS;
    const live   = s.resulted && !played && ko <= now;
    const showScore = played || live;

    const homeScore = showScore ? result[0] : null;
    const awayScore = showScore ? result[1] : null;

    // Points are scored during LIVE too — the running score IS the final
    // here — so the dashboard's "23 pts so far" ticks up, which is the whole
    // appeal of the live state.
    let pointsAwarded: number | null = null;
    if (showScore && pick) {
      pointsAwarded = scorePrediction(pick.home, pick.away, result[0], result[1], DEFAULT_SCORING);
    }

    return {
      ...f,
      status:     played ? "completed" : live ? "live" : "scheduled",
      homeScore,
      awayScore,
      myPrediction: pick
        ? { homeScore: pick.home, awayScore: pick.away, pointsAwarded }
        : null,
    };
  });
}

// ── A mock private league, so the league surfaces have data ──
// Rivals with fixed prediction "skill" so the leaderboard is believable and
// your live position shifts as results land.

interface Rival { name: string; skill: number; }  // 0..1 accuracy-ish
const RIVALS: Rival[] = [
  { name: "Sarah K",  skill: 0.85 },
  { name: "Tom R",    skill: 0.70 },
  { name: "Dev P",    skill: 0.55 },
  { name: "Marcus",   skill: 0.40 },
];

export interface LeagueRow {
  name:    string;
  points:  number;
  exact:   number;
  isMe:    boolean;
}

/**
 * The prototype private league leaderboard. Your row is scored from your
 * real picks; rivals are scored from deterministic pseudo-predictions so the
 * board is stable across reloads and moves sensibly as results come in.
 */
export function protoLeague(): { name: string; rows: LeagueRow[] } {
  const fx = protoFixtures();

  const myPoints = fx.reduce((n, f) => n + (f.myPrediction?.pointsAwarded ?? 0), 0);
  const myExact  = fx.filter((f) => f.myPrediction?.pointsAwarded === 5).length;

  const rows: LeagueRow[] = RIVALS.map((r) => {
    let pts = 0, exact = 0;
    fx.forEach((f, i) => {
      if (f.homeScore === null || f.awayScore === null) return;
      const guess = rivalGuess(i, r.skill, f.homeScore, f.awayScore);
      const p = scorePrediction(guess.home, guess.away, f.homeScore, f.awayScore);
      pts += p;
      if (p === 5) exact++;
    });
    return { name: r.name, points: pts, exact, isMe: false };
  });

  rows.push({ name: "You", points: myPoints, exact: myExact, isMe: true });
  rows.sort((a, b) => b.points - a.points || b.exact - a.exact);

  return { name: "The Office", rows };
}

// Deterministic rival prediction: with probability ~skill they get the exact
// result, otherwise a plausible near-miss. Seeded by fixture index so it is
// stable across reloads.
function rivalGuess(i: number, skill: number, ah: number, aa: number): StoredPick {
  const seed = (i * 2654435761) % 1000 / 1000;
  if (seed < skill) return { home: ah, away: aa };              // exact
  if (seed < skill + 0.2) return { home: ah + 1, away: aa };    // right-ish
  return { home: 1, away: 1 };                                  // lazy draw
}
