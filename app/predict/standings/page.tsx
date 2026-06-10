"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCompetition, getFixtures, type Fixture } from "@/lib/predictor";
import GroupStandings from "@/components/predictor/GroupStandings";

const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";

export default function StandingsPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const { competition } = await getCompetition("wc2026");
      if (!competition) { setLoading(false); return; }
      const { fixtures } = await getFixtures(competition.id);
      setFixtures(fixtures);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: "#f8f5f0" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3" style={{ background: "#f8f5f0", borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-1">
            <Link href="/predict"
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: MUTED }}>
              ← Predictor
            </Link>
            <Link href="/predict/standings"
              className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{ background: GREEN, color: "#fff" }}>
              Standings
            </Link>
          </div>
          <h1 className="text-xl font-bold" style={{ color: GREEN }}>Group Standings</h1>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>FIFA World Cup 2026 · Updates after every match</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl animate-pulse" style={{ background: "#e8ede6" }} />
            ))}
          </div>
        ) : (
          <GroupStandings fixtures={fixtures} />
        )}
      </div>

      {/* Footer link back */}
      <div className="px-4 pb-6 max-w-3xl mx-auto w-full">
        <Link href="/predict"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: GREEN, color: "#fff" }}>
          ← Back to Predictor
        </Link>
      </div>
    </div>
  );
}
