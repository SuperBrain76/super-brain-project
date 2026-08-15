/**
 * lib/leagueTable.ts — the league standings, computed from fixtures.
 *
 * A pure function: give it fixtures (with results), get the table back —
 * played, W/D/L, goals, goal difference, points, and a last-5 form guide.
 * Self-contained so the same table powers the dashboard rail and the full
 * standings screen, and it's always consistent with the fixtures we hold.
 *
 * 3 points a win, 1 a draw — real football. Pre-season (no results) it still
 * lists every club on zero, so the table exists from day one and fills in as
 * results arrive.
 */

import type { Fixture } from "@/lib/predictor";

export type FormResult = "W" | "D" | "L";

export interface LeagueRow {
  code:   string;
  name:   string;
  played: number;
  won:    number;
  drawn:  number;
  lost:   number;
  gf:     number;
  ga:     number;
  gd:     number;
  points: number;
  form:   FormResult[];   // most recent last, up to 5
  rank:   number;
}

function blank(code: string, name: string): LeagueRow {
  return { code, name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [], rank: 0 };
}

export function computeLeagueTable(fixtures: Fixture[]): LeagueRow[] {
  const rows = new Map<string, LeagueRow>();
  const ensure = (code?: string | null, name?: string | null) => {
    if (!code) return null;
    if (!rows.has(code)) rows.set(code, blank(code, name ?? code));
    return rows.get(code)!;
  };

  // Register every club first, so the table is complete even before kick-off.
  for (const f of fixtures) {
    ensure(f.homeTeam?.code, f.homeTeam?.name);
    ensure(f.awayTeam?.code, f.awayTeam?.name);
  }

  // Apply completed results in chronological order (so form reads left→right).
  const played = fixtures
    .filter((f) => f.status === "completed" && f.homeScore != null && f.awayScore != null)
    .sort((a, b) => new Date(a.kicksOffAt).getTime() - new Date(b.kicksOffAt).getTime());

  for (const f of played) {
    const home = ensure(f.homeTeam?.code, f.homeTeam?.name);
    const away = ensure(f.awayTeam?.code, f.awayTeam?.name);
    if (!home || !away) continue;
    const hs = f.homeScore as number, as = f.awayScore as number;

    home.played++; away.played++;
    home.gf += hs; home.ga += as;
    away.gf += as; away.ga += hs;

    if (hs > as) {
      home.won++; home.points += 3; home.form.push("W");
      away.lost++; away.form.push("L");
    } else if (hs < as) {
      away.won++; away.points += 3; away.form.push("W");
      home.lost++; home.form.push("L");
    } else {
      home.drawn++; home.points++; home.form.push("D");
      away.drawn++; away.points++; away.form.push("D");
    }
  }

  const table = [...rows.values()];
  for (const r of table) {
    r.gd = r.gf - r.ga;
    r.form = r.form.slice(-5);
  }

  // Points → goal difference → goals scored → name.
  table.sort((a, b) =>
    b.points - a.points ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name),
  );
  table.forEach((r, i) => { r.rank = i + 1; });
  return table;
}

/** True once at least one match has been played (so the table has real order). */
export function tableHasResults(rows: LeagueRow[]): boolean {
  return rows.some((r) => r.played > 0);
}
