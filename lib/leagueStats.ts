/**
 * lib/leagueStats.ts — the numbers behind the Stats tab.
 *
 * Team stats are derived purely from our own fixtures/results (via the same
 * league-table computation the standings use), so they're always consistent
 * and need no extra feed. Player stats (top scorers / assists) come from the
 * football-data.org cache written by /api/cron/refresh-player-stats and stored
 * in competition_settings — football only; ice hockey has none.
 */

import { supabase } from "@/lib/supabase";
import { computeLeagueTable, type LeagueRow } from "@/lib/leagueTable";
import type { Fixture } from "@/lib/predictor";
import type { Scorer } from "@/lib/footballData";

export type { Scorer } from "@/lib/footballData";

export interface StatLeader { code: string; name: string; value: number; sub?: string; }
export interface MatchStat { home: string; away: string; homeScore: number; awayScore: number; total: number; margin: number; }

export interface TeamStats {
  played:        number;      // total completed matches (0 = pre-season)
  topScoring:    StatLeader[]; // most goals for
  bestDefense:   StatLeader[]; // fewest goals against
  cleanSheets:   StatLeader[]; // most matches conceding 0 (hockey: shutouts)
  bestForm:      StatLeader[]; // most points in last 5
  biggestWins:   MatchStat[];  // largest winning margin
  highestScoring:MatchStat[];  // most goals in a match
}

const formPoints = (form: LeagueRow["form"]) =>
  form.reduce((n, r) => n + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);

/** Read the cached top scorers/assists for a competition (football only). */
export async function getPlayerScorers(competitionId: string): Promise<{ updatedAt: string | null; scorers: Scorer[] }> {
  try {
    const { data } = await supabase
      .from("competition_settings")
      .select("value")
      .eq("competition_id", competitionId)
      .eq("key", "player_scorers")
      .maybeSingle();
    const v = (data?.value ?? null) as { updatedAt?: string; scorers?: Scorer[] } | null;
    return { updatedAt: v?.updatedAt ?? null, scorers: v?.scorers ?? [] };
  } catch {
    return { updatedAt: null, scorers: [] };
  }
}

/** Derive the team talking-points from fixtures. Safe on empty/pre-season data. */
export function computeTeamStats(fixtures: Fixture[]): TeamStats {
  const table = computeLeagueTable(fixtures);
  const withGames = table.filter((r) => r.played > 0);

  const lead = (rows: LeagueRow[], value: (r: LeagueRow) => number, sub?: (r: LeagueRow) => string) =>
    rows.slice(0, 5).map((r) => ({ code: r.code, name: r.name, value: value(r), sub: sub?.(r) }));

  const topScoring = lead(
    [...withGames].sort((a, b) => b.gf - a.gf || a.ga - b.ga),
    (r) => r.gf,
    (r) => `${(r.gf / r.played).toFixed(1)}/game`,
  );
  const bestDefense = lead(
    [...withGames].sort((a, b) => a.ga - b.ga || b.gf - a.gf),
    (r) => r.ga,
    (r) => `${r.played} played`,
  );
  const bestForm = lead(
    [...withGames].sort((a, b) => formPoints(b.form) - formPoints(a.form) || b.points - a.points),
    (r) => formPoints(r.form),
    (r) => r.form.join(" "),
  );

  // Clean sheets — count completed matches where the team conceded 0.
  const cs = new Map<string, { name: string; n: number }>();
  const bump = (code?: string | null, name?: string | null) => {
    if (!code) return;
    if (!cs.has(code)) cs.set(code, { name: name ?? code, n: 0 });
    cs.get(code)!.n++;
  };
  const played = fixtures.filter((f) => f.status === "completed" && f.homeScore != null && f.awayScore != null);
  for (const f of played) {
    if ((f.awayScore as number) === 0) bump(f.homeTeam?.code, f.homeTeam?.name);
    if ((f.homeScore as number) === 0) bump(f.awayTeam?.code, f.awayTeam?.name);
  }
  const cleanSheets = [...cs.entries()]
    .map(([code, v]) => ({ code, name: v.name, value: v.n }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const toMatch = (f: Fixture): MatchStat => ({
    home: f.homeTeam?.name ?? "—", away: f.awayTeam?.name ?? "—",
    homeScore: f.homeScore as number, awayScore: f.awayScore as number,
    total: (f.homeScore as number) + (f.awayScore as number),
    margin: Math.abs((f.homeScore as number) - (f.awayScore as number)),
  });
  const biggestWins = [...played].map(toMatch).filter((m) => m.margin > 0).sort((a, b) => b.margin - a.margin || b.total - a.total).slice(0, 5);
  const highestScoring = [...played].map(toMatch).sort((a, b) => b.total - a.total || b.margin - a.margin).slice(0, 5);

  return { played: played.length, topScoring, bestDefense, cleanSheets, bestForm, biggestWins, highestScoring };
}
