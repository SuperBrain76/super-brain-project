/**
 * lib/footballData.ts — player scoring stats from football-data.org (free tier).
 *
 * TheSportsDB (our fixtures/results feed) doesn't carry goalscorers or assists,
 * so top-scorer / top-assist tables come from football-data.org's /scorers
 * endpoint. Free tier covers the five leagues below; it is football-only, so
 * SHL (ice hockey) has no player stats here.
 *
 * Auth: header `X-Auth-Token: <FOOTBALL_DATA_TOKEN>`. Usage is tiny — one call
 * per league per refresh — so it sits well inside the free rate limit.
 */

const BASE = "https://api.football-data.org/v4";

// Our competition slug → football-data.org competition code.
export const FD_LEAGUE_CODE: Record<string, string> = {
  "premier-league": "PL",
  "la-liga":        "PD",
  "bundesliga":     "BL1",
  "serie-a":        "SA",
  "ligue-1":        "FL1",
};

export interface Scorer {
  rank:      number;
  name:      string;
  team:      string;
  goals:     number;
  assists:   number;
  penalties: number;
  played:    number;
}

interface FdScorerRow {
  player?:  { name?: string | null } | null;
  team?:    { name?: string | null; shortName?: string | null } | null;
  goals?:   number | null;
  assists?: number | null;
  penalties?: number | null;
  playedMatches?: number | null;
}

/**
 * Top scorers for a league. Returns [] on any failure (missing token, rate
 * limit, unknown league) so callers can degrade gracefully. `limit` caps rows.
 */
export async function fetchScorers(slug: string, token: string, limit = 20): Promise<Scorer[]> {
  const code = FD_LEAGUE_CODE[slug];
  if (!code || !token) return [];

  const res = await fetch(`${BASE}/competitions/${code}/scorers?limit=${limit}`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`football-data ${code} HTTP ${res.status}`);

  const json = (await res.json()) as { scorers?: FdScorerRow[] };
  const rows = json.scorers ?? [];
  return rows.map((r, i) => ({
    rank:      i + 1,
    name:      r.player?.name ?? "—",
    team:      r.team?.shortName ?? r.team?.name ?? "—",
    goals:     r.goals ?? 0,
    assists:   r.assists ?? 0,
    penalties: r.penalties ?? 0,
    played:    r.playedMatches ?? 0,
  }));
}
