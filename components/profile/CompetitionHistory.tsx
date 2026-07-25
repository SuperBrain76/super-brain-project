"use client";

/**
 * CompetitionHistory — the profile's record across every competition.
 *
 * Final rank, total points, IQ earned, and best private-league finish, per
 * competition the user has played. The foundation for a future Hall of Fame.
 *
 * Reads get_my_competition_history() (migration 052). Renders nothing until it
 * has data, and nothing at all if the user has never predicted — so it never
 * shows an empty shell.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const CARD = "rgba(255,255,255,0.03)";
const LINE = "rgba(255,255,255,0.08)";
const TEXT = "#e8e8ea", GOLD = "#e8c15a", MUTED = "#9aa0a6", GREEN = "#00e676";

interface Row {
  slug:             string;
  name:             string;
  lifecycle:        string;
  totalPoints:      number;
  finalRank:        number;
  iqEarned:         number;
  predictions:      number;
  bestLeagueName:   string | null;
  bestLeagueRank:   number | null;
  bestLeagueSize:   number | null;
}

export default function CompetitionHistory() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (!isSupabaseConfigured) { setRows([]); return; }

    supabase.rpc("get_my_competition_history").then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) { setRows([]); return; }
      setRows((data as Record<string, unknown>[]).map((r) => ({
        slug:           r.slug as string,
        name:           r.name as string,
        lifecycle:      (r.lifecycle as string) ?? "",
        totalPoints:    Number(r.total_points ?? 0),
        finalRank:      Number(r.final_rank ?? 0),
        iqEarned:       Number(r.iq_earned ?? 0),
        predictions:    Number(r.predictions ?? 0),
        bestLeagueName: (r.best_league_name as string) ?? null,
        bestLeagueRank: r.best_league_rank != null ? Number(r.best_league_rank) : null,
        bestLeagueSize: r.best_league_size != null ? Number(r.best_league_size) : null,
      })));
    });
    return () => { alive = false; };
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="px-1">
      <p className="text-[11px] tracking-[0.24em] uppercase mb-2.5" style={{ color: MUTED }}>
        Competition History
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <Link key={r.slug} href={`/${r.slug}`}>
            <div className="rounded-2xl p-3.5" style={{ background: CARD, border: `0.5px solid ${LINE}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold" style={{ color: TEXT }}>{r.name}</span>
                {r.lifecycle === "archived" && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ color: MUTED, border: `0.5px solid ${LINE}` }}>
                    🗄 ARCHIVED
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Final rank" value={r.finalRank > 0 ? `#${r.finalRank}` : "—"} color={GOLD} />
                <Stat label="Points"     value={r.totalPoints.toLocaleString()} color={TEXT} />
                <Stat label="IQ earned"  value={r.iqEarned.toLocaleString()} color={GREEN} />
              </div>
              {r.bestLeagueName && r.bestLeagueRank && (
                <p className="text-[11px] mt-2 text-center" style={{ color: MUTED }}>
                  ⚔️ {ordinal(r.bestLeagueRank)} of {r.bestLeagueSize} in <span style={{ color: TEXT }}>{r.bestLeagueName}</span>
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-base font-black" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide" style={{ color: MUTED }}>{label}</div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
