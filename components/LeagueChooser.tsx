"use client";

/**
 * LeagueChooser — pick a competition to predict.
 *
 * Shared by the landing page's picker and the /sports hub. Dark theme (BRAND),
 * coloured monogram crests (no official logos). Each card links to that
 * competition's home.
 *
 * Only shows leagues that are actually live (visible in the DB), so a league
 * being rolled out never shows a dead link — it appears the moment it's seeded,
 * no redeploy. Falls back to the full list if the lookup is unavailable, so the
 * chooser is never empty.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { LEAGUES } from "@/lib/leagues/list";
import { club, textOn } from "@/lib/premierLeague/clubs";
import { listVisibleCompetitions } from "@/lib/competitionEngine";

export default function LeagueChooser({ sport }: { sport?: string }) {
  const [liveSlugs, setLiveSlugs] = useState<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    listVisibleCompetitions()
      .then((cs) => { if (alive) setLiveSlugs(new Set(cs.map((c) => c.slug))); })
      .catch(() => { if (alive) setLiveSlugs(null); });
    return () => { alive = false; };
  }, []);

  // Optionally scope to one sport (the hub renders a chooser per sport section).
  const inSport = sport ? LEAGUES.filter((l) => l.sport === sport) : LEAGUES;
  const filtered = liveSlugs ? inSport.filter((l) => liveSlugs.has(l.slug)) : inSport;
  const list = filtered.length ? filtered : inSport;   // never render an empty chooser

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {list.map((lg) => (
        <Link key={lg.slug} href={`/${lg.slug}`}
          className="group flex items-center gap-4 rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
          style={{ background: BRAND.surface, border: `0.5px solid ${BRAND.hairline}` }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-extrabold" style={{ color: BRAND.ink }}>{lg.name}</h3>
              <span className="text-[11px]" style={{ color: BRAND.dim }}>{lg.country}</span>
            </div>
            <div className="flex items-center gap-1">
              {lg.clubs.map((code) => {
                const c = club(code);
                const bg = c?.primary ?? "#2a2a2e";
                return (
                  <span key={code} aria-hidden title={c?.name ?? code}
                    style={{ width: 24, height: 24, borderRadius: 6, background: bg, color: textOn(bg), display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800 }}>
                    {code}
                  </span>
                );
              })}
            </div>
          </div>
          <span className="text-sm font-bold shrink-0 transition-transform group-hover:translate-x-1" style={{ color: BRAND.sports }}>Predict →</span>
        </Link>
      ))}
    </div>
  );
}
