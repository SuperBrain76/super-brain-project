"use client";

/**
 * ChampionshipTable — drivers' / constructors' championship for an F1
 * competition. Renders INGESTED standings (competition_standings, refreshed
 * by the cron after each race settles) — the FIA points system is never
 * computed locally. Same visual language as StandingsTable, minus the
 * W/D/L/GF/GA columns that mean nothing here.
 */

import { f1DriverByCode } from "@/lib/f1/drivers2026";
import type { StandingRow } from "@/lib/motorsport";

const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";

export default function ChampionshipTable({
  rows,
  scope,
  throughRound,
}: {
  rows: StandingRow[];
  scope: "driver" | "constructor";
  throughRound: number | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px] py-8 text-center" style={{ color: MUTED }}>
        The championship table appears after the first race settles.
      </p>
    );
  }

  return (
    <div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: MUTED }}>
            <th className="py-2 pr-2 font-bold w-8">#</th>
            <th className="py-2 font-bold">{scope === "driver" ? "Driver" : "Constructor"}</th>
            <th className="py-2 text-right font-bold w-14">Wins</th>
            <th className="py-2 text-right font-bold w-14">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const reg = r.code ? f1DriverByCode(r.code) : undefined;
            return (
              <tr key={`${r.position}-${r.name}`} className="border-t" style={{ borderColor: BORDER }}>
                <td className="py-2 pr-2 font-extrabold" style={{ color: MUTED }}>{r.position}</td>
                <td className="py-2 font-bold" style={{ color: TEXT1 }}>
                  {r.code && (
                    <span className="inline-flex items-center justify-center rounded-full text-[9px] font-extrabold mr-2 align-middle"
                          style={{ width: 22, height: 22, background: reg?.primary ?? "#44584a", color: "#fff" }}>
                      {r.code}
                    </span>
                  )}
                  {r.name}
                  {scope === "driver" && reg?.constructorName && (
                    <span className="ml-1.5 text-[11px] font-semibold" style={{ color: MUTED }}>{reg.constructorName}</span>
                  )}
                </td>
                <td className="py-2 text-right" style={{ color: MUTED }}>{r.wins}</td>
                <td className="py-2 text-right font-extrabold" style={{ color: TEXT1 }}>{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {throughRound != null && (
        <p className="text-[11px] mt-2" style={{ color: MUTED }}>
          Official championship standings after round {throughRound}.
        </p>
      )}
    </div>
  );
}
