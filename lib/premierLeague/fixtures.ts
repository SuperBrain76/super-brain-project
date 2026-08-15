/**
 * lib/premierLeague/fixtures.ts — real Premier League 2026/27 fixtures.
 *
 * The ACTUAL opening three matchweeks of the 2026/27 season: real match-ups,
 * real dates, real kickoff times, real venues. Verified against
 * premierleague.com and TheSportsDB (league 4328, season 2026-2027). Kickoff
 * times are UK local (BST, UTC+1 in Aug/Sep) expressed in UTC.
 *
 * These are UPCOMING fixtures, so there are no real results — `result` is only
 * set for Matchweek 1 as ILLUSTRATIVE sample scores for the playable
 * prototype's "simulate results" sandbox. They are NOT real and never seed
 * production; the live feed (TheSportsDB) supplies real results as matches are
 * played.
 *
 * Data, not architecture. The same match-ups seed production
 * (supabase/seeds/premier-league-2026-27.sql) and power the prototype.
 */

export interface PLFixture {
  round: number;         // matchweek
  home:  string;         // club code
  away:  string;         // club code
  koUtc: string;         // ISO UTC kickoff
  venue: string;
  // Illustrative sample score for the prototype's "simulate results" sandbox
  // ONLY (Matchweek 1). Not a real result. Never written to production.
  result?: [number, number];
}

// ── Matchweek 1 — Fri 21 → Mon 24 Aug 2026 (the real opening weekend) ──
const MW1: PLFixture[] = [
  { round: 1, home: "ARS", away: "COV", koUtc: "2026-08-21T19:00:00Z", venue: "Emirates Stadium",              result: [2, 0] },
  { round: 1, home: "HUL", away: "MUN", koUtc: "2026-08-22T11:30:00Z", venue: "MKM Stadium",                    result: [1, 2] },
  { round: 1, home: "EVE", away: "CRY", koUtc: "2026-08-22T14:00:00Z", venue: "Hill Dickinson Stadium",         result: [1, 1] },
  { round: 1, home: "IPS", away: "SUN", koUtc: "2026-08-22T14:00:00Z", venue: "Portman Road",                   result: [2, 1] },
  { round: 1, home: "NFO", away: "LEE", koUtc: "2026-08-22T14:00:00Z", venue: "The City Ground",                result: [3, 0] },
  { round: 1, home: "BRE", away: "TOT", koUtc: "2026-08-22T16:30:00Z", venue: "Gtech Community Stadium",         result: [1, 2] },
  { round: 1, home: "BHA", away: "AVL", koUtc: "2026-08-23T13:00:00Z", venue: "Amex Stadium",                   result: [2, 2] },
  { round: 1, home: "MCI", away: "BOU", koUtc: "2026-08-23T13:00:00Z", venue: "Etihad Stadium",                 result: [3, 1] },
  { round: 1, home: "NEW", away: "LIV", koUtc: "2026-08-23T15:30:00Z", venue: "St James' Park",                 result: [1, 2] },
  { round: 1, home: "FUL", away: "CHE", koUtc: "2026-08-24T19:00:00Z", venue: "Craven Cottage",                 result: [0, 2] },
];

// ── Matchweek 2 — Fri 28 → Mon 31 Aug 2026 ───────────────────
const MW2: PLFixture[] = [
  { round: 2, home: "CRY", away: "MCI", koUtc: "2026-08-28T19:00:00Z", venue: "Selhurst Park" },
  { round: 2, home: "LIV", away: "NFO", koUtc: "2026-08-29T11:30:00Z", venue: "Anfield" },
  { round: 2, home: "BOU", away: "EVE", koUtc: "2026-08-29T14:00:00Z", venue: "Vitality Stadium" },
  { round: 2, home: "COV", away: "HUL", koUtc: "2026-08-29T14:00:00Z", venue: "Coventry Building Society Arena" },
  { round: 2, home: "TOT", away: "NEW", koUtc: "2026-08-29T16:30:00Z", venue: "Tottenham Hotspur Stadium" },
  { round: 2, home: "CHE", away: "BHA", koUtc: "2026-08-30T13:00:00Z", venue: "Stamford Bridge" },
  { round: 2, home: "LEE", away: "BRE", koUtc: "2026-08-30T13:00:00Z", venue: "Elland Road" },
  { round: 2, home: "SUN", away: "FUL", koUtc: "2026-08-30T13:00:00Z", venue: "Stadium of Light" },
  { round: 2, home: "MUN", away: "IPS", koUtc: "2026-08-30T15:30:00Z", venue: "Old Trafford" },
  { round: 2, home: "AVL", away: "ARS", koUtc: "2026-08-31T19:00:00Z", venue: "Villa Park" },
];

// ── Matchweek 3 — Fri 4 → Sun 6 Sep 2026 ─────────────────────
const MW3: PLFixture[] = [
  { round: 3, home: "IPS", away: "LIV", koUtc: "2026-09-04T19:00:00Z", venue: "Portman Road" },
  { round: 3, home: "NEW", away: "BOU", koUtc: "2026-09-05T11:30:00Z", venue: "St James' Park" },
  { round: 3, home: "BRE", away: "SUN", koUtc: "2026-09-05T14:00:00Z", venue: "Gtech Community Stadium" },
  { round: 3, home: "BHA", away: "LEE", koUtc: "2026-09-05T14:00:00Z", venue: "Amex Stadium" },
  { round: 3, home: "FUL", away: "CRY", koUtc: "2026-09-05T14:00:00Z", venue: "Craven Cottage" },
  { round: 3, home: "MCI", away: "COV", koUtc: "2026-09-05T14:00:00Z", venue: "Etihad Stadium" },
  { round: 3, home: "NFO", away: "TOT", koUtc: "2026-09-05T14:00:00Z", venue: "The City Ground" },
  { round: 3, home: "HUL", away: "AVL", koUtc: "2026-09-05T16:30:00Z", venue: "MKM Stadium" },
  { round: 3, home: "EVE", away: "MUN", koUtc: "2026-09-06T13:00:00Z", venue: "Hill Dickinson Stadium" },
  { round: 3, home: "ARS", away: "CHE", koUtc: "2026-09-06T15:30:00Z", venue: "Emirates Stadium" },
];

export const PL_FIXTURES: PLFixture[] = [...MW1, ...MW2, ...MW3];

export function fixturesForRound(round: number): PLFixture[] {
  return PL_FIXTURES.filter((f) => f.round === round);
}

export const PL_ROUNDS = [1, 2, 3];

/** Season metadata for the seed + prototype. */
export const PL_SEASON = {
  competitionSlug: "premier-league",
  competitionName: "Premier League",
  seasonSlug:      "pl-2026-27",
  seasonLabel:     "2026/27",
  startsAt:        "2026-08-21T00:00:00Z",
  endsAt:          "2027-05-30T00:00:00Z",
};
