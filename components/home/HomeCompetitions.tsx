"use client";

/**
 * HomeCompetitions — the homepage's competition band.
 *
 * The homepage always promotes the ACTIVE competition. Archived competitions
 * never compete for attention: they appear only under "Past Competitions",
 * small and clearly secondary.
 *
 * Renders nothing until data loads, so it never flashes stale content.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listActiveCompetitions, listArchivedCompetitions, type CompetitionSummary,
} from "@/lib/competitionEngine";

const INK = "#0f1f17", GREEN = "#1a3a2a", GOLD = "#b8972a", MUTED = "#5c6b60";

export default function HomeCompetitions() {
  const [active, setActive]     = useState<CompetitionSummary[] | null>(null);
  const [archived, setArchived] = useState<CompetitionSummary[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([listActiveCompetitions(), listArchivedCompetitions()])
      .then(([a, arc]) => { if (alive) { setActive(a); setArchived(arc); } })
      .catch(() => { if (alive) { setActive([]); setArchived([]); } });
    return () => { alive = false; };
  }, []);

  if (active === null) return null;          // still loading
  if (active.length === 0) return null;      // no active competition — legacy hero shows

  const hero = active[0];

  return (
    <section className="w-full max-w-3xl mx-auto px-4 pt-8 pb-4">
      {/* Active competition — the hero */}
      <Link href={`/${hero.slug}`}>
        <div
          className="rounded-3xl p-6 sm:p-8 relative overflow-hidden"
          style={{ background: GREEN, color: "#fff" }}
        >
          <div className="text-[11px] font-bold tracking-[0.2em] uppercase mb-2" style={{ color: "#9fe8c4" }}>
            ● Live now · Free to play
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-2">
            {hero.name} Predictor
          </h1>
          <p className="text-sm sm:text-base mb-5" style={{ color: "#cfe6d6" }}>
            Predict every match, build a private league, and climb the table. One tap per match — you're in in under two minutes.
          </p>
          <span
            className="inline-block px-6 py-3 rounded-xl text-sm font-bold"
            style={{ background: "#fff", color: GREEN }}
          >
            Make your predictions →
          </span>
        </div>
      </Link>

      {/* Other active competitions, if any */}
      {active.length > 1 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {active.slice(1).map((c) => (
            <Link key={c.id} href={`/${c.slug}`}
              className="text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ background: "#fff", border: "1px solid #dde5d8", color: GREEN }}>
              {c.name} →
            </Link>
          ))}
        </div>
      )}

      {/* Past Competitions — archived, small, secondary */}
      {archived.length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] tracking-[0.28em] uppercase mb-3" style={{ color: MUTED }}>
            Past Competitions
          </p>
          <div className="flex flex-col gap-2">
            {archived.map((c) => (
              <Link key={c.id} href={`/${c.slug}`}>
                <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                     style={{ background: "#fff", border: "1px solid #dde5d8" }}>
                  <div>
                    <div className="text-sm font-bold" style={{ color: INK }}>{c.name}</div>
                    <div className="text-[11px]" style={{ color: MUTED }}>🗄 Archived · read-only</div>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: GOLD }}>View →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Renders its children only when there is NO active competition. Wraps the
 * legacy World-Cup hero so it disappears the moment the Premier League goes
 * public — the archived competition must never compete with the active one.
 */
export function HideWhenActiveCompetition({ children }: { children: React.ReactNode }) {
  const [hasActive, setHasActive] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    listActiveCompetitions()
      .then((a) => { if (alive) setHasActive(a.length > 0); })
      .catch(() => { if (alive) setHasActive(false); });
    return () => { alive = false; };
  }, []);

  if (hasActive === null || hasActive) return null;
  return <>{children}</>;
}
