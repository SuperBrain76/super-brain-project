/**
 * lib/prototype/mw1Fixtures.ts — playable-prototype data, now REAL.
 *
 * Built from the real Premier League fixtures (lib/premierLeague/fixtures) so
 * the prototype plays the actual opening weekend — real clubs, real match-ups,
 * real kickoff times, real results when you simulate.
 */

import type { Fixture, Team } from "@/lib/predictor";
import { club } from "@/lib/premierLeague/clubs";
import { fixturesForRound, PL_SEASON } from "@/lib/premierLeague/fixtures";

const ROUND = 1;

function team(code: string): Team {
  const c = club(code)!;
  return { id: `team-${code}`, name: c.name, code, flagEmoji: null, groupName: null, fifaRanking: null };
}

export function mw1Fixtures(): Fixture[] {
  return fixturesForRound(ROUND).map((f, i) => ({
    id:            `mw1-${i}`,
    competitionId: "pl-proto",
    stage:         "league",
    groupName:     null,
    fixtureNumber: i + 1,
    homeTeam:      team(f.home),
    awayTeam:      team(f.away),
    homeScore:     null,
    awayScore:     null,
    kicksOffAt:    f.koUtc,
    venue:         f.venue,
    status:        "scheduled",
    myPrediction:  null,
  }));
}

/** Real 2025/26 opening-weekend results, keyed by fixture index. */
export const MW1_RESULTS: Record<number, [number, number]> =
  Object.fromEntries(fixturesForRound(ROUND).map((f, i) => [i, f.result ?? [0, 0]]));

export const MW1_ROUND = {
  id:           "round-mw1",
  seasonId:     "season-pl-2627",
  code:         "mw1",
  label:        "Matchweek 1",
  shortLabel:   "MW1",
  sortOrder:    1,
  kind:         "matchweek" as const,
  startsAt:     fixturesForRound(ROUND)[0].koUtc,
  endsAt:       fixturesForRound(ROUND).slice(-1)[0].koUtc,
  locksAt:      fixturesForRound(ROUND)[0].koUtc,   // Friday 20:00 — challenge deadline
  lockIsPinned: false,
  status:       "upcoming" as const,
};

export { PL_SEASON };
