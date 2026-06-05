/**
 * Automated match result ingestion — API-Football Pro
 *
 * Fetches live and completed fixtures from API-Football (league=1, season=2026)
 * and updates the SuperBrain fixtures table. The existing auto_score_predictions
 * DB trigger fires automatically when home_score/away_score are written,
 * scoring all predictions without any additional code.
 *
 * Score extraction rules:
 *   - LIVE matches: only update status → 'live' (never write partial scores)
 *   - COMPLETED matches: write score.fulltime (90-minute result only, per rules)
 *   - AET / PEN matches: still use score.fulltime (the 90-min draw that led to ET/pens)
 *
 * This prevents the auto_score_predictions trigger from firing with wrong
 * live partial scores.
 */

// ── API-Football response types ───────────────────────────────

export interface ApiFootballFixture {
  fixture: {
    id:     number;
    date:   string;           // ISO UTC, e.g. "2026-06-11T19:00:00+00:00"
    status: { short: string }; // "NS" | "1H" | "HT" | "2H" | "FT" | "AET" | "PEN" etc.
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

export interface IngestedScore {
  homeScore: number | null;
  awayScore: number | null;
}

// ── Status mapping ────────────────────────────────────────────
//
// API-Football short codes → SuperBrain DB status
// DB CHECK constraint: 'scheduled' | 'live' | 'completed' | 'postponed'

const STATUS_MAP: Record<string, string> = {
  // Not started
  NS:   "scheduled",
  TBD:  "scheduled",
  // Live (all phases)
  "1H": "live",
  HT:   "live",
  "2H": "live",
  ET:   "live",    // Extra time
  BT:   "live",    // Break between ET halves
  P:    "live",    // Penalty in progress
  SUSP: "live",    // Suspended
  INT:  "live",    // Interrupted
  LIVE: "live",    // Generic live fallback
  // Final — triggers auto_score_predictions
  FT:   "completed",
  AET:  "completed", // After extra time
  PEN:  "completed", // After penalties
  AWD:  "completed", // Awarded (e.g. walkover result)
  WO:   "completed", // Walkover
  // Not playing
  PST:  "postponed",
  CANC: "postponed",
  ABD:  "postponed",
};

export function mapStatus(apiShortStatus: string): string {
  return STATUS_MAP[apiShortStatus] ?? "scheduled";
}

// ── Score extraction ──────────────────────────────────────────
//
// CRITICAL: We use score.fulltime (90-min result) for all final states.
//
// For knockout matches that go to extra time (AET):
//   score.fulltime = the draw score after 90 min (e.g. {1,1})
//   goals = FT+ET result (e.g. {2,1})
//   We write score.fulltime so predictions are scored on 90-min result.
//
// For matches decided by penalties (PEN):
//   score.fulltime = draw after 90+ET (e.g. {0,0})
//   score.penalty = shootout result (e.g. {4,3})
//   We write score.fulltime so penalty goals don't affect scoring.
//
// For live matches: return null/null so we NEVER write partial scores to DB.
// This prevents the auto_score_predictions trigger from misfiring.

export function extractScore(fixture: ApiFootballFixture): IngestedScore {
  const short = fixture.fixture.status.short;
  const isFinal = ["FT", "AET", "PEN", "AWD", "WO"].includes(short);

  if (!isFinal) {
    // Not started or live — never write scores to DB during play
    return { homeScore: null, awayScore: null };
  }

  return {
    homeScore: fixture.score.fulltime.home,
    awayScore: fixture.score.fulltime.away,
  };
}

// ── Fixture matching ──────────────────────────────────────────
//
// Match API-Football fixtures to our DB fixtures by kickoff timestamp.
// We use a ±5-minute window to tolerate minor clock differences between
// our NBC Sports-sourced data and API-Football's official FIFA data.
// Within WC2026, no two fixtures kick off within 5 minutes of each other,
// so this is a unique match.

export function findDbFixtureByKickoff(
  apiKickoffIso: string,
  dbFixtures: Array<{ id: string; kicks_off_at: string; home_score: number | null; away_score: number | null; status: string }>,
): typeof dbFixtures[0] | undefined {
  const apiMs = new Date(apiKickoffIso).getTime();
  return dbFixtures.find((f) => {
    const dbMs = new Date(f.kicks_off_at).getTime();
    return Math.abs(dbMs - apiMs) <= 5 * 60 * 1000; // ±5 minutes
  });
}

// ── API client ────────────────────────────────────────────────

const API_BASE = "https://v3.football.api-sports.io";
const WC2026   = "league=1&season=2026";

async function apiFetch(path: string, apiKey: string): Promise<ApiFootballFixture[]> {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: {
      "x-rapidapi-key":  apiKey,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();

  // API-Football returns errors in the response body even on 200
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }

  return (json.response as ApiFootballFixture[]) ?? [];
}

/** Fetch all currently live WC2026 fixtures. Returns [] if none are live. */
export async function fetchLiveFixtures(apiKey: string): Promise<ApiFootballFixture[]> {
  return apiFetch(`fixtures?${WC2026}&live=all`, apiKey);
}

/** Fetch all WC2026 fixtures for a given UTC date (YYYY-MM-DD). */
export async function fetchFixturesByDate(
  apiKey: string,
  date: string,
): Promise<ApiFootballFixture[]> {
  return apiFetch(`fixtures?${WC2026}&date=${date}`, apiKey);
}
