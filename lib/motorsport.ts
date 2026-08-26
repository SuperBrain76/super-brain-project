/**
 * lib/motorsport.ts — read models for ordering (F1) competitions.
 *
 * Championship tables come from competition_standings (INGESTED from Jolpica
 * by the cron — never computed locally; see migration 073). Session results
 * come from fixture_entrant_results, written by settle_ordering_fixture.
 * Both are public-read under RLS, same as fixtures/teams.
 */

import { supabase, isSupabaseConfigured } from "./supabase";

export interface StandingRow {
  position: number;
  name:     string;
  code:     string | null;   // FIA code (drivers), null for constructors
  teamId:   string | null;
  points:   number;
  wins:     number;
}

export interface CompetitionStandings {
  drivers:      StandingRow[];
  constructors: StandingRow[];
  throughRound: number | null;   // provider round the tables reflect
}

export async function getCompetitionStandings(competitionId: string): Promise<CompetitionStandings> {
  const empty: CompetitionStandings = { drivers: [], constructors: [], throughRound: null };
  if (!isSupabaseConfigured) return empty;

  const { data, error } = await supabase
    .from("competition_standings")
    .select("scope, position, name, code, team_id, points, wins, through_round")
    .eq("competition_id", competitionId)
    .order("position", { ascending: true });

  if (error || !data) return empty;

  const out: CompetitionStandings = { drivers: [], constructors: [], throughRound: null };
  for (const r of data as Record<string, unknown>[]) {
    const row: StandingRow = {
      position: r.position as number,
      name:     r.name as string,
      code:     (r.code as string | null) ?? null,
      teamId:   (r.team_id as string | null) ?? null,
      points:   Number(r.points ?? 0),
      wins:     Number(r.wins ?? 0),
    };
    if (r.scope === "constructor") out.constructors.push(row);
    else out.drivers.push(row);
    if (r.through_round != null) out.throughRound = r.through_round as number;
  }
  return out;
}

export interface EntrantResult {
  teamId:   string;
  position: number;
  status:   string | null;
}

/** Classifications for a set of fixtures, keyed by fixture id (positions ascending). */
export async function getEntrantResults(fixtureIds: string[]): Promise<Map<string, EntrantResult[]>> {
  const map = new Map<string, EntrantResult[]>();
  if (!isSupabaseConfigured || fixtureIds.length === 0) return map;

  const { data, error } = await supabase
    .from("fixture_entrant_results")
    .select("fixture_id, team_id, position, status")
    .in("fixture_id", fixtureIds)
    .order("position", { ascending: true });

  if (error || !data) return map;

  for (const r of data as Record<string, unknown>[]) {
    const fid = r.fixture_id as string;
    if (!map.has(fid)) map.set(fid, []);
    map.get(fid)!.push({
      teamId:   r.team_id as string,
      position: r.position as number,
      status:   (r.status as string | null) ?? null,
    });
  }
  return map;
}

/** "Qualifying" / "Race" from a constructed F1 provider id ("f1-2026-13-q"). */
export function sessionLabelOf(providerFixtureId: string | null | undefined, fallback = "Session"): string {
  if (!providerFixtureId) return fallback;
  if (providerFixtureId.endsWith("-q")) return "Qualifying";
  if (providerFixtureId.endsWith("-r")) return "Race";
  return fallback;
}
