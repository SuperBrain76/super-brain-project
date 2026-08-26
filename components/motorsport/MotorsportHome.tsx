"use client";

/**
 * MotorsportHome — the F1 competition home.
 *
 * The ordering counterpart of PremierLeagueHome/CompetitionHome. That pair
 * is built around a featured two-team match, H/D/A crowd splits and a
 * computed W/D/L table — none of which exist for F1 — so F1 gets its own
 * lightweight dashboard rather than sport-branches inside a 600-line
 * component: next Grand Prix with its two sessions, your prediction state,
 * the championship top five, and the standing CTAs.
 *
 * Rendered by app/[competition]/page.tsx when home_style is 'matchweek' AND
 * the sport's kind is 'ordering'.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Competition, Fixture } from "@/lib/predictor";
import { getCurrentRoundContext, getRoundFixtures, type Round } from "@/lib/competitionEngine";
import { getCompetitionStandings, type CompetitionStandings } from "@/lib/motorsport";
import ChampionshipTable from "@/components/motorsport/ChampionshipTable";

const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const CARD   = "#ffffff";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const OK     = "#1a7a4a";

export default function MotorsportHome({ competition }: { competition: Competition }) {
  const [round, setRound]         = useState<Round | null>(null);
  const [fixtures, setFixtures]   = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<CompetitionStandings | null>(null);
  const [loaded, setLoaded]       = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const ctx = await getCurrentRoundContext(competition.id);
      if (!alive) return;
      setRound(ctx.round);
      if (ctx.round) {
        const { fixtures: fx } = await getRoundFixtures(ctx.round.id);
        if (!alive) return;
        setFixtures(fx);
      }
      const st = await getCompetitionStandings(competition.id).catch(() => null);
      if (!alive) return;
      setStandings(st);
      setLoaded(true);
    }
    void load().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [competition.id]);

  if (!loaded) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm" style={{ color: MUTED }}>Loading the Grand Prix…</p>
      </div>
    );
  }

  const base = `/${competition.slug}`;
  const predicted = fixtures.filter((f) => f.myOrdering != null).length;
  const open = fixtures.filter((f) => f.status === "scheduled" && new Date(f.kicksOffAt).getTime() > Date.now()).length;

  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      <header className="pt-6 pb-4">
        <h1 className="text-[22px] font-extrabold" style={{ color: TEXT1 }}>{competition.name}</h1>
        <p className="text-[12px] mt-1" style={{ color: MUTED }}>
          Call the top five in qualifying and the race. Exact positions score — beat your mates over a season.
        </p>
      </header>

      {/* Next / current Grand Prix */}
      {round ? (
        <section className="rounded-2xl border mb-5 px-4 py-4" style={{ background: CARD, borderColor: BORDER }}>
          <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: MUTED }}>
            {open > 0 ? "Next Grand Prix" : "This Grand Prix"}
          </div>
          <div className="text-[17px] font-extrabold mt-0.5" style={{ color: TEXT1 }}>{round.label}</div>
          <div className="text-[12px] mt-1" style={{ color: TEXT2 }}>
            {fixtures.length > 0 && fmtRange(fixtures)}
          </div>
          <div className="text-[12px] mt-2 font-semibold" style={{ color: predicted === fixtures.length && fixtures.length > 0 ? OK : MUTED }}>
            {fixtures.length === 0 ? "Sessions appear here once seeded."
              : predicted === fixtures.length ? "Both sessions predicted ✓"
              : `${predicted}/${fixtures.length} sessions predicted`}
          </div>
          <Link href={`${base}/predict`}
                className="mt-3 inline-block w-full text-center rounded-xl py-2.5 text-[14px] font-extrabold"
                style={{ background: TEXT2, color: "#fff" }}>
            {predicted === fixtures.length && fixtures.length > 0 ? "Review your picks" : "Predict the top five →"}
          </Link>
        </section>
      ) : (
        <section className="rounded-2xl border mb-5 px-4 py-6 text-center" style={{ background: CARD, borderColor: BORDER }}>
          <p className="text-[13px]" style={{ color: MUTED }}>The next round hasn&apos;t been scheduled yet.</p>
        </section>
      )}

      {/* Championship top five */}
      {standings && standings.drivers.length > 0 && (
        <section className="rounded-2xl border mb-5 px-4 py-4" style={{ background: CARD, borderColor: BORDER }}>
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: MUTED }}>
              Drivers&apos; championship
            </div>
            <Link href={`${base}/standings`} className="text-[11px] font-bold" style={{ color: TEXT2 }}>
              Full standings →
            </Link>
          </div>
          <div className="mt-2">
            <ChampionshipTable rows={standings.drivers.slice(0, 5)} scope="driver" throughRound={null} />
          </div>
        </section>
      )}

      {/* Leagues CTA — the point of the product */}
      <section className="rounded-2xl border px-4 py-4" style={{ background: CARD, borderColor: BORDER }}>
        <div className="text-[14px] font-extrabold" style={{ color: TEXT1 }}>Beat your mates</div>
        <p className="text-[12px] mt-1" style={{ color: MUTED }}>
          Create a private league, share the invite code, and settle who really knows Formula 1.
        </p>
        <div className="flex gap-2 mt-3">
          <Link href={`${base}/leagues`} className="flex-1 text-center rounded-xl py-2 text-[13px] font-bold border"
                style={{ color: TEXT2, borderColor: BORDER }}>
            Leagues
          </Link>
          <Link href={`${base}/leaderboard`} className="flex-1 text-center rounded-xl py-2 text-[13px] font-bold border"
                style={{ color: TEXT2, borderColor: BORDER }}>
            Leaderboard
          </Link>
        </div>
      </section>
    </div>
  );
}

function fmtRange(fixtures: Fixture[]): string {
  const times = fixtures.map((f) => new Date(f.kicksOffAt).getTime()).sort((a, b) => a - b);
  const fmt = (ms: number) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(ms));
  const a = fmt(times[0]), b = fmt(times[times.length - 1]);
  return a === b ? a : `${a} – ${b}`;
}
