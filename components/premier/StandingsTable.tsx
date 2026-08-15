"use client";

/**
 * StandingsTable — the full league table, broadcast-style.
 *
 * Pos · Club · Pl · W · D · L · GF · GA · GD · Pts · Form, matching how every
 * football site shows it. Form is the last five as coloured W/D/L pills.
 * Responsive: the detail columns (W/D/L/GF/GA) hide on narrow screens, leaving
 * Pos/Club/Pl/GD/Pts/Form — the essentials — always readable.
 *
 * Data comes from lib/leagueTable.ts (computed from fixtures), so it's always
 * consistent with what we hold and fills in as results arrive.
 */

import ClubCrest, { clubShort } from "@/components/premier/ClubCrest";
import type { LeagueRow, FormResult } from "@/lib/leagueTable";

const GREEN = "#1a3a2a", MUTED = "#7a8f82", BORDER = "#e4e0d6";
const TEXT1 = "#0f1f17", TEXT2 = "#2e4a37", CARD = "#ffffff", HEAD = "#f4f1ea";
const WIN = "#1a7a4a", DRAW = "#9aa7b4", LOSS = "#c0392b";

function FormPills({ form }: { form: FormResult[] }) {
  if (form.length === 0) return <span className="text-xs" style={{ color: MUTED }}>–</span>;
  const bg = (f: FormResult) => (f === "W" ? WIN : f === "D" ? DRAW : LOSS);
  return (
    <span className="inline-flex gap-1 justify-end">
      {form.map((f, i) => (
        <span key={i} title={f}
          className="inline-flex items-center justify-center font-bold"
          style={{ width: 18, height: 18, borderRadius: 999, background: bg(f), color: "#fff", fontSize: 10 }}>
          {f}
        </span>
      ))}
    </span>
  );
}

export default function StandingsTable({ rows, hasDraw = true }: { rows: LeagueRow[]; hasDraw?: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 340 }}>
          <thead>
            <tr className="text-[10px] uppercase tracking-wide" style={{ background: HEAD, color: MUTED }}>
              <th className="text-center font-bold py-2 w-8">#</th>
              <th className="text-left font-bold py-2 pl-1">Club</th>
              <th className="text-center font-bold py-2 w-8">Pl</th>
              <th className="text-center font-bold py-2 w-8 hidden sm:table-cell">W</th>
              {hasDraw && <th className="text-center font-bold py-2 w-8 hidden sm:table-cell">D</th>}
              <th className="text-center font-bold py-2 w-8 hidden sm:table-cell">L</th>
              <th className="text-center font-bold py-2 w-9 hidden md:table-cell">GF</th>
              <th className="text-center font-bold py-2 w-9 hidden md:table-cell">GA</th>
              <th className="text-center font-bold py-2 w-9">GD</th>
              <th className="text-center font-bold py-2 w-9" style={{ color: TEXT2 }}>Pts</th>
              <th className="text-right font-bold py-2 pr-3 w-[110px]">Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td className="text-center py-2 text-xs tabular-nums" style={{ color: MUTED }}>{r.rank}</td>
                <td className="py-2 pl-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <ClubCrest code={r.code} size={20} />
                    <span className="text-[13px] font-semibold truncate" style={{ color: TEXT1 }}>{clubShort(r.code)}</span>
                  </span>
                </td>
                <td className="text-center py-2 text-xs tabular-nums" style={{ color: TEXT2 }}>{r.played}</td>
                <td className="text-center py-2 text-xs tabular-nums hidden sm:table-cell" style={{ color: TEXT2 }}>{r.won}</td>
                {hasDraw && <td className="text-center py-2 text-xs tabular-nums hidden sm:table-cell" style={{ color: TEXT2 }}>{r.drawn}</td>}
                <td className="text-center py-2 text-xs tabular-nums hidden sm:table-cell" style={{ color: TEXT2 }}>{r.lost}</td>
                <td className="text-center py-2 text-xs tabular-nums hidden md:table-cell" style={{ color: TEXT2 }}>{r.gf}</td>
                <td className="text-center py-2 text-xs tabular-nums hidden md:table-cell" style={{ color: TEXT2 }}>{r.ga}</td>
                <td className="text-center py-2 text-xs tabular-nums" style={{ color: TEXT2 }}>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                <td className="text-center py-2 text-sm font-extrabold tabular-nums" style={{ color: GREEN }}>{r.points}</td>
                <td className="text-right py-2 pr-3"><FormPills form={r.form} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
