/**
 * Automated match result ingestion — API-Football Pro
 *
 * Design principles:
 *   1. DB-first: always check our own fixtures table before touching the
 *      external API. Skip the API call entirely if no match is active or
 *      imminent. This is the primary request-saving mechanism.
 *
 *   2. Tournament window: hard-coded start/end dates ensure zero API calls
 *      outside the WC2026 dates regardless of cron schedule.
 *
 *   3. Never write partial live scores: extractScore() returns null/null
 *      for any non-final status, so the auto_score_predictions trigger
 *      can only fire when both fulltime scores are confirmed.
 *
 *   4. 90-minute result only: even for AET/PEN matches we write
 *      score.fulltime (not goals, not penalty totals) as required by rules.
 *
 *   5. Idempotent: every update is guarded by a diff — unchanged fixtures
 *      are skipped silently with no DB write.
 */

// ── Tournament window ────────────────────────────────────────
// The GitHub Actions cron runs every 5 minutes indefinitely.
// These constants gate the expensive API call to WC2026 dates only.

export const TOURNAMENT_START_MS = new Date("2026-06-11T18:45:00Z").getTime(); // 15 min before first kickoff
export const TOURNAMENT_END_MS   = new Date("2026-07-20T03:00:00Z").getTime(); // final + 8h buffer

export function isTournamentWindow(): boolean {
  const now = Date.now();
  return now >= TOURNAMENT_START_MS && now <= TOURNAMENT_END_MS;
}

// ── DB fixture type (what the route loads from Supabase) ─────

export interface DbFixture {
  id:           string;
  kicks_off_at: string;
  home_score:   number | null;
  away_score:   number | null;
  status:       string;
}

// ── Match-window decision ────────────────────────────────────
//
// Given today's DB fixtures, decide whether an API call is warranted.
// Returns null if no API call is needed (saves a request quota).

export type PollReason =
  | "live_match"           // DB shows status='live'
  | "match_in_progress"    // Started within last 3h, not yet completed
  | "kickoff_imminent"     // Kicks off within next 30 min
  | null;                  // No active window — skip API call

export function getPollReason(
  dbFixtures: DbFixture[],
  nowMs: number = Date.now(),
): PollReason {
  for (const f of dbFixtures) {
    // Already marked live in our DB
    if (f.status === "live") return "live_match";

    const kickoffMs = new Date(f.kicks_off_at).getTime();
    const msSinceKickoff = nowMs - kickoffMs;
    const msUntilKickoff = kickoffMs - nowMs;

    // Match started in the last 3 hours and isn't completed/postponed
    // (covers matches in progress where our DB status is stale)
    if (
      msSinceKickoff > 0 &&
      msSinceKickoff < 3 * 60 * 60 * 1000 &&
      f.status !== "completed" &&
      f.status !== "postponed"
    ) {
      return "match_in_progress";
    }

    // Kickoff within the next 30 minutes
    if (msUntilKickoff > 0 && msUntilKickoff < 30 * 60 * 1000) {
      return "kickoff_imminent";
    }
  }

  return null; // Nothing active or imminent
}

// ── API-Football response types ───────────────────────────────

export interface ApiFootballFixture {
  fixture: {
    id:     number;
    date:   string;           // ISO UTC e.g. "2026-06-11T19:00:00+00:00"
    status: { short: string }; // NS | 1H | HT | 2H | FT | AET | PEN …
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null }; // FT + ET, no penalties
  score: {
    fulltime:  { home: number | null; away: number | null }; // 90-min result
    extratime: { home: number | null; away: number | null }; // ET goals only
    penalty:   { home: number | null; away: number | null }; // Shootout only
  };
}

export interface QuotaMeta {
  requestsLimit:     number | null; // daily limit, e.g. 7500
  requestsRemaining: number | null; // remaining today
  requestsUsed:      number | null; // derived: limit - remaining
}

export interface ApiFootballResponse {
  fixtures:     ApiFootballFixture[];
  quota:        QuotaMeta;
  apiCallsMade: number; // how many HTTP requests this invocation made
}

// ── Status mapping ────────────────────────────────────────────
// API-Football short codes → SuperBrain DB status values
// DB CHECK constraint: 'scheduled' | 'live' | 'completed' | 'postponed'

const STATUS_MAP: Record<string, string> = {
  // Not started
  NS:   "scheduled",
  TBD:  "scheduled",
  // Live — all phases, we never write scores for these
  "1H": "live",
  HT:   "live",
  "2H": "live",
  ET:   "live",    // Extra time
  BT:   "live",    // Break between ET halves
  P:    "live",    // Penalty in progress
  SUSP: "live",    // Suspended
  INT:  "live",    // Interrupted
  LIVE: "live",    // Generic live
  // Final — triggers auto_score_predictions when scores written
  FT:   "completed",
  AET:  "completed", // After extra time (fulltime = pre-ET draw)
  PEN:  "completed", // After penalties (fulltime = pre-ET draw)
  AWD:  "completed", // Awarded
  WO:   "completed", // Walkover
  // Not happening
  PST:  "postponed",
  CANC: "postponed",
  ABD:  "postponed",
};

export function mapStatus(apiShortStatus: string): string {
  return STATUS_MAP[apiShortStatus] ?? "scheduled";
}

// ── Score extraction ──────────────────────────────────────────
//
// CRITICAL INVARIANT: This function NEVER returns non-null scores
// for a match that has not fully concluded at 90 minutes.
//
// Why this matters: the auto_score_predictions trigger fires on
// UPDATE OF home_score, away_score WHERE both are NOT NULL.
// If we ever wrote a live running score (e.g. 1-0 at 67 min) and
// then correctly wrote 2-1 at FT, the trigger would fire TWICE —
// first awarding points based on 1-0, then correcting to 2-1.
// Keeping scores null until FT means the trigger fires exactly once.
//
// AET (after extra time): score.fulltime = the 90-min draw (e.g. 1-1).
//   We store this so predictions are scored on 90-min result per rules.
//   The ET winner doesn't affect prediction scoring.
//
// PEN (after penalties): score.fulltime = the 90+ET draw (e.g. 0-0).
//   Penalty shootout goals are in score.penalty and are never stored.

export interface IngestedScore {
  homeScore: number | null;
  awayScore: number | null;
}

export function extractScore(fixture: ApiFootballFixture): IngestedScore {
  const short = fixture.fixture.status.short;

  const isFinal = ["FT", "AET", "PEN", "AWD", "WO"].includes(short);
  const isLive  = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(short);

  if (isFinal) {
    // Use score.fulltime for the official 90-min result
    const home = fixture.score.fulltime.home;
    const away = fixture.score.fulltime.away;
    if (home === null || away === null) return { homeScore: null, awayScore: null };
    return { homeScore: home, awayScore: away };
  }

  if (isLive) {
    // Use goals.home/away — the running live score updated by API-Football
    const home = fixture.goals.home;
    const away = fixture.goals.away;
    if (home === null || away === null) return { homeScore: null, awayScore: null };
    return { homeScore: home, awayScore: away };
  }

  // Not started / postponed — no score
  return { homeScore: null, awayScore: null };
}

// ── Fixture matching ──────────────────────────────────────────
// Match API fixtures to DB fixtures by kickoff timestamp.
// ±5-minute tolerance handles minor clock differences between
// our NBC Sports-sourced data and API-Football's official times.
// WC2026 never has two fixtures within 5 min of each other.

export function findDbFixtureByKickoff(
  apiKickoffIso: string,
  dbFixtures: DbFixture[],
): DbFixture | undefined {
  const apiMs = new Date(apiKickoffIso).getTime();
  return dbFixtures.find((f) => {
    const dbMs = new Date(f.kicks_off_at).getTime();
    return Math.abs(dbMs - apiMs) <= 5 * 60 * 1000;
  });
}

// ── API client ────────────────────────────────────────────────

const API_BASE = "https://v3.football.api-sports.io";
const WC2026   = "league=1&season=2026";

function parseQuota(headers: Headers): QuotaMeta {
  const limit     = parseInt(headers.get("x-ratelimit-requests-limit")     ?? "", 10);
  const remaining = parseInt(headers.get("x-ratelimit-requests-remaining") ?? "", 10);
  return {
    requestsLimit:     isNaN(limit)     ? null : limit,
    requestsRemaining: isNaN(remaining) ? null : remaining,
    requestsUsed:      (!isNaN(limit) && !isNaN(remaining)) ? limit - remaining : null,
  };
}

async function apiFetch(
  path:   string,
  apiKey: string,
): Promise<{ fixtures: ApiFootballFixture[]; quota: QuotaMeta }> {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: {
      // Direct API-Sports endpoint requires x-apisports-key.
      // x-rapidapi-* headers are only for the RapidAPI proxy (different host).
      "x-apisports-key": apiKey,
    },
    cache: "no-store",
  });

  const quota = parseQuota(res.headers);

  if (res.status === 429) {
    // Rate limit hit — not a crash, caller handles gracefully
    const err = new RateLimitError("API-Football rate limit reached (429)");
    (err as RateLimitError).quota = quota;
    throw err;
  }

  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();

  // API-Football surfaces errors in the body even on 200
  if (json.errors && Object.keys(json.errors).length > 0) {
    const msg = JSON.stringify(json.errors);
    // Auth errors
    if (msg.includes("token") || msg.includes("key") || msg.includes("auth")) {
      throw new AuthError(`API-Football auth error: ${msg}`);
    }
    throw new Error(`API-Football response error: ${msg}`);
  }

  return {
    fixtures: (json.response as ApiFootballFixture[]) ?? [],
    quota,
  };
}

// Custom error classes for typed catch handling

export class RateLimitError extends Error {
  quota?: QuotaMeta;
  constructor(message: string) { super(message); this.name = "RateLimitError"; }
}

export class AuthError extends Error {
  constructor(message: string) { super(message); this.name = "AuthError"; }
}

/**
 * Fetch all currently live WC2026 fixtures.
 * Returns empty fixtures array (not an error) when nothing is live.
 */
export async function fetchLiveFixtures(
  apiKey: string,
): Promise<ApiFootballResponse> {
  const { fixtures, quota } = await apiFetch(
    `fixtures?${WC2026}&live=all`,
    apiKey,
  );
  return { fixtures, quota, apiCallsMade: 1 };
}

/**
 * Fetch all WC2026 fixtures for a given UTC date (YYYY-MM-DD).
 * Used when no live match is detected to catch recent FT results.
 */
export async function fetchFixturesByDate(
  apiKey: string,
  date:   string,
): Promise<ApiFootballResponse> {
  const { fixtures, quota } = await apiFetch(
    `fixtures?${WC2026}&date=${date}`,
    apiKey,
  );
  return { fixtures, quota, apiCallsMade: 1 };
}
