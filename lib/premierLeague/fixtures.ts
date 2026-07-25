/**
 * lib/premierLeague/fixtures.ts — real Premier League fixtures.
 *
 * The actual 2025/26 opening matchweeks: real match-ups, real kickoff
 * times-of-day (Friday night, Saturday 12:30 / 15:00 / 17:30, Sunday, Monday
 * night). Dates are on the 2026/27 calendar so the predictor reads as the
 * upcoming season rather than one already played — the football is real, the
 * year is shifted. Times are UK local (BST, UTC+1) expressed in UTC.
 *
 * Data, not architecture. The same match-ups seed production
 * (supabase/seeds/premier-league-2026-27.sql) and power the playable
 * prototype, so both tell the same real story.
 */

export interface PLFixture {
  round: number;         // matchweek
  home:  string;         // club code
  away:  string;         // club code
  koUtc: string;         // ISO UTC kickoff
  venue: string;
  // Real 2025/26 result — used by the prototype's "simulate results" so the
  // scores that come in are the ones that actually happened.
  result?: [number, number];
}

// ── Matchweek 1 — the real opening weekend ───────────────────
const MW1: PLFixture[] = [
  { round: 1, home: "LIV", away: "BOU", koUtc: "2026-08-14T19:00:00Z", venue: "Anfield",                     result: [4, 2] },
  { round: 1, home: "AVL", away: "NEW", koUtc: "2026-08-15T11:30:00Z", venue: "Villa Park",                  result: [0, 0] },
  { round: 1, home: "BHA", away: "FUL", koUtc: "2026-08-15T14:00:00Z", venue: "Amex Stadium",                result: [1, 1] },
  { round: 1, home: "SUN", away: "WHU", koUtc: "2026-08-15T14:00:00Z", venue: "Stadium of Light",            result: [3, 0] },
  { round: 1, home: "TOT", away: "BUR", koUtc: "2026-08-15T14:00:00Z", venue: "Tottenham Hotspur Stadium",   result: [3, 0] },
  { round: 1, home: "WOL", away: "MCI", koUtc: "2026-08-15T16:30:00Z", venue: "Molineux",                    result: [0, 4] },
  { round: 1, home: "CHE", away: "CRY", koUtc: "2026-08-16T13:00:00Z", venue: "Stamford Bridge",             result: [0, 0] },
  { round: 1, home: "NFO", away: "BRE", koUtc: "2026-08-16T13:00:00Z", venue: "The City Ground",             result: [3, 1] },
  { round: 1, home: "MUN", away: "ARS", koUtc: "2026-08-16T15:30:00Z", venue: "Old Trafford",                result: [0, 1] },
  { round: 1, home: "LEE", away: "EVE", koUtc: "2026-08-17T19:00:00Z", venue: "Elland Road",                 result: [1, 0] },
];

// ── Matchweek 2 — real fixtures, so "next week" works ────────
const MW2: PLFixture[] = [
  { round: 2, home: "WHU", away: "CHE", koUtc: "2026-08-22T19:00:00Z", venue: "London Stadium",              result: [1, 5] },
  { round: 2, home: "MCI", away: "TOT", koUtc: "2026-08-23T11:30:00Z", venue: "Etihad Stadium",              result: [0, 2] },
  { round: 2, home: "BOU", away: "WOL", koUtc: "2026-08-23T14:00:00Z", venue: "Vitality Stadium",            result: [1, 0] },
  { round: 2, home: "BRE", away: "AVL", koUtc: "2026-08-23T14:00:00Z", venue: "Gtech Community Stadium",     result: [1, 0] },
  { round: 2, home: "BUR", away: "SUN", koUtc: "2026-08-23T14:00:00Z", venue: "Turf Moor",                   result: [2, 0] },
  { round: 2, home: "ARS", away: "LEE", koUtc: "2026-08-23T16:30:00Z", venue: "Emirates Stadium",            result: [5, 0] },
  { round: 2, home: "CRY", away: "NFO", koUtc: "2026-08-24T13:00:00Z", venue: "Selhurst Park",               result: [1, 1] },
  { round: 2, home: "EVE", away: "BHA", koUtc: "2026-08-24T13:00:00Z", venue: "Hill Dickinson Stadium",      result: [2, 0] },
  { round: 2, home: "FUL", away: "MUN", koUtc: "2026-08-24T15:30:00Z", venue: "Craven Cottage",              result: [1, 1] },
  { round: 2, home: "NEW", away: "LIV", koUtc: "2026-08-25T19:00:00Z", venue: "St James' Park",              result: [2, 3] },
];

// ── Matchweek 3 — real fixtures ──────────────────────────────
const MW3: PLFixture[] = [
  { round: 3, home: "CHE", away: "FUL", koUtc: "2026-08-30T11:30:00Z", venue: "Stamford Bridge",             result: [2, 0] },
  { round: 3, home: "MUN", away: "BUR", koUtc: "2026-08-30T14:00:00Z", venue: "Old Trafford",                result: [3, 2] },
  { round: 3, home: "SUN", away: "BRE", koUtc: "2026-08-30T14:00:00Z", venue: "Stadium of Light",            result: [2, 1] },
  { round: 3, home: "TOT", away: "BOU", koUtc: "2026-08-30T14:00:00Z", venue: "Tottenham Hotspur Stadium",   result: [0, 1] },
  { round: 3, home: "WOL", away: "EVE", koUtc: "2026-08-30T14:00:00Z", venue: "Molineux",                    result: [2, 3] },
  { round: 3, home: "LEE", away: "NEW", koUtc: "2026-08-30T16:30:00Z", venue: "Elland Road",                 result: [0, 0] },
  { round: 3, home: "BHA", away: "MCI", koUtc: "2026-08-31T13:00:00Z", venue: "Amex Stadium",                result: [2, 1] },
  { round: 3, home: "NFO", away: "WHU", koUtc: "2026-08-31T13:00:00Z", venue: "The City Ground",             result: [0, 3] },
  { round: 3, home: "LIV", away: "ARS", koUtc: "2026-08-31T15:30:00Z", venue: "Anfield",                     result: [1, 0] },
  { round: 3, home: "AVL", away: "CRY", koUtc: "2026-08-31T15:30:00Z", venue: "Villa Park",                  result: [0, 3] },
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
  startsAt:        "2026-08-14T00:00:00Z",
  endsAt:          "2027-05-24T00:00:00Z",
};
