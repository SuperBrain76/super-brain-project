"use client";

/**
 * LeagueChooser — pick a competition to predict.
 *
 * Shared by the landing page's picker and the /sports hub. Dark theme (BRAND),
 * coloured monogram crests (no official logos). Each card links to that
 * competition's home.
 *
 * Only shows leagues that are actually live (visible in the DB), so a league
 * being rolled out never shows a dead link — it appears the moment it goes
 * public, no redeploy. Falls back to the full list ONLY when the lookup
 * itself is unavailable; a lookup that succeeds and excludes every league of
 * a sport means none is live yet, and the chooser says "coming soon" rather
 * than leaking a draft competition's link (the F1 rollout lesson).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { LEAGUES } from "@/lib/leagues/list";
import ClubCrest from "@/components/premier/ClubCrest";
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
  const list = liveSlugs ? inSport.filter((l) => liveSlugs.has(l.slug)) : inSport;

  // Lookup succeeded and nothing in this sport is live yet: honest holding
  // state, never a link to a competition that isn't public.
  if (liveSlugs && list.length === 0) {
    return (
      <div className="rounded-2xl p-4 text-sm font-semibold"
           style={{ background: BRAND.surface, border: `0.5px solid ${BRAND.hairline}`, color: BRAND.dim }}>
        Coming soon.
      </div>
    );
  }

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
              {lg.clubs.map((code) => (
                <ClubCrest key={code} code={code} size={24} />
              ))}
            </div>
          </div>
          <span className="text-sm font-bold shrink-0 transition-transform group-hover:translate-x-1" style={{ color: BRAND.sports }}>Predict →</span>
        </Link>
      ))}
    </div>
  );
}
