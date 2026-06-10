"use client";

import { useMemo } from "react";
import type { Fixture } from "@/lib/predictor";

// ── Design tokens (matching predict page) ─────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const BG     = "#f8f5f0";

// ── Types ─────────────────────────────────────────────────────
interface TeamRow {
  code:      string;
  name:      string;
  flag:      string;
  played:    number;
  won:       number;
  drawn:     number;
  lost:      number;
  gf:        number;
  ga:        number;
  gd:        number;
  points:    number;
}

function buildStandings(fixtures: Fixture[]): Map<string, TeamRow[]> {
  const groups = new Map<string, Map<string, TeamRow>>();

  for (const f of fixtures) {
    if (f.stage !== "group" || !f.groupName || !f.homeTeam || !f.awayTeam) continue;

    const g = f.groupName;
    if (!groups.has(g)) groups.set(g, new Map());
    const table = groups.get(g)!;

    // Ensure both teams exist in the table
    for (const team of [f.homeTeam, f.awayTeam]) {
      if (!table.has(team.code)) {
        table.set(team.code, {
          code:   team.code,
          name:   team.name,
          flag:   team.flagEmoji ?? "",
          played: 0, won: 0, drawn: 0, lost: 0,
          gf: 0, ga: 0, gd: 0, points: 0,
        });
      }
    }

    // Only count completed fixtures with scores
    if (f.status !== "completed" || f.homeScore === null || f.awayScore === null) continue;

    const home = table.get(f.homeTeam.code)!;
    const away = table.get(f.awayTeam.code)!;

    home.played++; away.played++;
    home.gf += f.homeScore; home.ga += f.awayScore;
    away.gf += f.awayScore; away.ga += f.homeScore;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    if (f.homeScore > f.awayScore) {
      home.won++; home.points += 3;
      away.lost++;
    } else if (f.homeScore < f.awayScore) {
      away.won++; away.points += 3;
      home.lost++;
    } else {
      home.drawn++; home.points++;
      away.drawn++; away.points++;
    }
  }

  // Sort each group: points → GD → GF → name
  const result = new Map<string, TeamRow[]>();
  for (const [g, table] of groups) {
    const sorted = [...table.values()].sort((a, b) =>
      b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
    );
    result.set(g, sorted);
  }

  return result;
}

// ── Single group table ─────────────────────────────────────────
function GroupTable({ name, rows }: { name: string; rows: TeamRow[] }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: "#fff" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: GREEN }}>
        <span className="text-xs font-bold tracking-widest uppercase text-white">Group {name}</span>
      </div>

      {/* Column headers */}
      <div className="grid text-[10px] uppercase tracking-widest px-3 py-1.5"
        style={{ gridTemplateColumns: "1fr 28px 28px 28px 28px 28px 28px 32px", color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
        <span>Team</span>
        <span className="text-center">P</span>
        <span className="text-center">W</span>
        <span className="text-center">D</span>
        <span className="text-center">L</span>
        <span className="text-center">GD</span>
        <span className="text-center">GF</span>
        <span className="text-center font-bold" style={{ color: GOLD }}>PTS</span>
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div key={row.code}
          className="grid items-center px-3 py-2 text-sm"
          style={{
            gridTemplateColumns: "1fr 28px 28px 28px 28px 28px 28px 32px",
            borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : "none",
            background: i < 2 ? `${GREEN}08` : "transparent",  // top 2 qualify — subtle tint
          }}>
          {/* Qualification dot + flag + name */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${i < 2 ? "" : "opacity-0"}`}
              style={{ background: GOLD }} />
            <span className="text-base leading-none">{row.flag}</span>
            <span className="truncate font-medium text-[13px]" style={{ color: GREEN }}>{row.name}</span>
          </div>
          <span className="text-center text-xs" style={{ color: MUTED }}>{row.played}</span>
          <span className="text-center text-xs" style={{ color: MUTED }}>{row.won}</span>
          <span className="text-center text-xs" style={{ color: MUTED }}>{row.drawn}</span>
          <span className="text-center text-xs" style={{ color: MUTED }}>{row.lost}</span>
          <span className="text-center text-xs" style={{ color: row.gd > 0 ? GREEN : row.gd < 0 ? "#b91c1c" : MUTED }}>
            {row.gd > 0 ? `+${row.gd}` : row.gd}
          </span>
          <span className="text-center text-xs" style={{ color: MUTED }}>{row.gf}</span>
          <span className="text-center text-xs font-bold" style={{ color: GOLD }}>{row.points}</span>
        </div>
      ))}

      {/* Qualification legend */}
      <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ borderTop: `1px solid ${BORDER}`, background: BG }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
        <span className="text-[10px]" style={{ color: MUTED }}>Advances to Round of 32</span>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────
export default function GroupStandings({ fixtures }: { fixtures: Fixture[] }) {
  const standings = useMemo(() => buildStandings(fixtures), [fixtures]);

  if (standings.size === 0) return null;

  // Sort groups alphabetically: A, B, C ...
  const sortedGroups = [...standings.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="w-full">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {sortedGroups.map(([name, rows]) => (
          <GroupTable key={name} name={name} rows={rows} />
        ))}
      </div>
    </div>
  );
}
