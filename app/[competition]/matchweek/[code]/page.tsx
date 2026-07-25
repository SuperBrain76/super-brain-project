"use client";

/**
 * /[competition]/matchweek/[code] — one matchweek, past / current / future.
 *
 * The browsable history that makes a 38-week season feel like a season.
 * docs/PREMIER_LEAGUE_UX.md §4.3. One template, three faces:
 *   future  → fixtures + kickoff times
 *   current → live scores, live points, your predictions inline
 *   past    → results, your points per fixture, your matchweek rank
 *
 * Chevrons walk MW12 ← MW13 → MW14.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { resolveCompetition, getFixturesByRound, type Fixture } from "@/lib/predictor";
import { getCurrentSeason, getRounds, type Round } from "@/lib/competitionEngine";
import { useCompetitionSlug } from "@/components/CompetitionProvider";

const GREEN = "#1a3a2a", GOLD = "#b8972a", MUTED = "#7a8f82";
const BORDER = "#dde5d8", CARD = "#fff", TEXT1 = "#0f1f17", TEXT2 = "#2e4a37";
const LIVE = "#c0392b", OK = "#1a7a4a";

export default function MatchweekPage() {
  const { competition: competitionSlug, code } = useParams<{ competition: string; code: string }>();
  const slug = useCompetitionSlug();
  const base = slug ? `/${slug}` : "/predict";

  const [round,    setRound]    = useState<Round | null>(null);
  const [rounds,   setRounds]   = useState<Round[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const { competition, error: e } = await resolveCompetition(competitionSlug);
      if (!alive) return;
      if (e || !competition) { setError(e ?? "Competition not found."); setLoading(false); return; }

      const season = await getCurrentSeason(competition.id);
      if (!alive || !season) { setError("No season."); setLoading(false); return; }

      const rs = await getRounds(season.id);
      if (!alive) return;
      setRounds(rs);

      const r = rs.find((x) => x.code === code) ?? null;
      setRound(r);
      if (!r) { setError("Matchweek not found."); setLoading(false); return; }

      const { fixtures: fx } = await getFixturesByRound(r.id);
      if (alive) { setFixtures(fx); setLoading(false); }
    }
    void load();
    return () => { alive = false; };
  }, [competitionSlug, code]);

  const idx  = rounds.findIndex((r) => r.id === round?.id);
  const prev = idx > 0 ? rounds[idx - 1] : null;
  const next = idx >= 0 && idx + 1 < rounds.length ? rounds[idx + 1] : null;

  if (loading) return <Note>Loading…</Note>;
  if (error)   return <Note>{error}</Note>;

  const totalPts = fixtures.reduce((n, f) => n + (f.myPrediction?.pointsAwarded ?? 0), 0);
  const anyScored = fixtures.some((f) => f.myPrediction?.pointsAwarded != null);

  return (
    <div className="max-w-md mx-auto w-full px-4 py-4">
      {/* Header + chevrons */}
      <div className="flex items-center justify-between mb-3">
        {prev
          ? <Link href={`${base}/matchweek/${prev.code}`} className="text-sm px-2 py-1" style={{ color: GREEN }}>←</Link>
          : <span className="w-8" />}
        <div className="text-center">
          <h1 className="text-lg font-bold" style={{ color: TEXT1 }}>{round?.label}</h1>
          {anyScored && <p className="text-xs" style={{ color: MUTED }}>You scored {totalPts} pts</p>}
        </div>
        {next
          ? <Link href={`${base}/matchweek/${next.code}`} className="text-sm px-2 py-1" style={{ color: GREEN }}>→</Link>
          : <span className="w-8" />}
      </div>

      <div className="flex flex-col gap-2">
        {fixtures.map((f) => <MatchweekRow key={f.id} f={f} />)}
      </div>

      {fixtures.length === 0 && <Note>No fixtures in this matchweek yet.</Note>}
    </div>
  );
}

function MatchweekRow({ f }: { f: Fixture }) {
  const done = f.status === "completed" && f.homeScore !== null;
  const live = f.status === "live";
  const pred = f.myPrediction;
  const pts  = pred?.pointsAwarded ?? null;

  const ptsColor = pts === 5 ? OK : pts === 3 ? GREEN : pts === 2 ? GOLD : pts === 0 ? LIVE : MUTED;
  const ko = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(f.kicksOffAt));

  return (
    <div className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold truncate flex-1" style={{ color: TEXT1 }}>{f.homeTeam?.name ?? "TBD"}</span>
        <span className="mx-2 text-sm font-bold" style={{ color: done || live ? TEXT1 : MUTED }}>
          {done || live ? `${f.homeScore}–${f.awayScore}` : ko}
          {live && <span className="ml-1 text-[10px]" style={{ color: LIVE }}>●</span>}
        </span>
        <span className="text-sm font-semibold truncate flex-1 text-right" style={{ color: TEXT1 }}>{f.awayTeam?.name ?? "TBD"}</span>
      </div>
      {pred && (
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px]" style={{ color: MUTED }}>Your pick: {pred.homeScore}–{pred.awayScore}</span>
          {pts != null && <span className="text-[11px] font-bold" style={{ color: ptsColor }}>+{pts}</span>}
        </div>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="max-w-md mx-auto px-4 py-16 text-center text-sm" style={{ color: MUTED }}>{children}</div>;
}
