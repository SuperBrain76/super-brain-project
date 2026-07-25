"use client";

/**
 * CompetitionSwitcher — move between simultaneously running competitions.
 *
 * Renders NOTHING when only one competition is visible. A switcher with one
 * option is noise, and today that is the World Cup's situation — so this
 * costs the current experience nothing and appears by itself the moment the
 * Premier League goes live.
 *
 * Switching preserves the sub-page where that makes sense: from
 * /premier-league/leaderboard the switcher goes to /la-liga/leaderboard, not
 * back to the hub. Fixture and league pages are excluded, because those ids
 * belong to one competition and would 404 in another.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCompetitionOptional } from "@/components/CompetitionProvider";
import { listVisibleCompetitions, type CompetitionSummary } from "@/lib/competitionEngine";
import { track } from "@/lib/analytics";

// Sub-paths that mean the same thing in any competition.
const PORTABLE = new Set(["leaderboard", "standings", "leagues", "rules", "bracket", "bonus", "prize"]);

export default function CompetitionSwitcher() {
  const ctx      = useCompetitionOptional();
  const router   = useRouter();
  const pathname = usePathname();

  const [comps, setComps] = useState<CompetitionSummary[]>([]);
  const [open,  setOpen]  = useState(false);

  useEffect(() => {
    let alive = true;
    listVisibleCompetitions()
      .then((c) => { if (alive) setComps(c); })
      .catch(() => { if (alive) setComps([]); });
    return () => { alive = false; };
  }, []);

  // The portable tail of the current path, if any.
  const tail = useMemo(() => {
    if (!pathname) return "";
    const parts = pathname.split("/").filter(Boolean);
    const sub   = parts[1];
    if (!sub || !PORTABLE.has(sub)) return "";
    // Only the first segment travels: /leagues/<id> is not portable.
    return `/${sub}`;
  }, [pathname]);

  if (!ctx || comps.length < 2) return null;

  const current = comps.find((c) => c.slug === ctx.slug);

  function switchTo(c: CompetitionSummary) {
    setOpen(false);
    if (c.slug === ctx?.slug) return;
    track.competitionSwitched(ctx?.slug ?? null, c.slug);
    router.push(`/${c.slug}${tail}`);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        style={{ background: "#ffffff", border: "1px solid #dde5d8", color: "#1a3a2a" }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current?.name ?? ctx.competition.name}
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          {/* Click-away layer. Sits under the menu, over everything else. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            className="absolute right-0 mt-1 z-50 min-w-[190px] rounded-lg overflow-hidden shadow-lg"
            style={{ background: "#ffffff", border: "1px solid #dde5d8" }}
          >
            {comps.map((c) => {
              const active = c.slug === ctx.slug;
              return (
                <li key={c.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => switchTo(c)}
                    className="w-full text-left px-3 py-2.5 text-xs transition-colors hover:bg-[#f0f3ef]"
                    style={{
                      color:      active ? "#1a3a2a" : "#2e4a37",
                      fontWeight: active ? 700 : 500,
                      background: active ? "#f0f3ef" : "transparent",
                    }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{c.name}</span>
                      {active && <span style={{ color: "#b8972a" }}>●</span>}
                    </span>
                    <span className="block text-[10px] mt-0.5" style={{ color: "#7a8f82" }}>
                      /{c.slug}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
