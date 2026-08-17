"use client";

/**
 * /[competition]/predict — the Matchweek prediction sheet page.
 *
 * Loads the current round's fixtures plus the previous round (for the
 * "copy last week" helper) and hands them to MatchweekSheet. All the
 * interaction lives in the sheet; this page is just the data boundary and
 * the auth gate. See docs/PREMIER_LEAGUE_UX.md §4.2.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { resolveCompetition, getFixturesByRound, type Fixture } from "@/lib/predictor";
import { sportOf } from "@/lib/sports";
import { getCurrentRoundContext, getRounds, type Round } from "@/lib/competitionEngine";
import { supabase } from "@/lib/supabase";
import { useCompetitionSlug } from "@/components/CompetitionProvider";
import MatchweekSheet, { type FixtureStats } from "@/components/premier/MatchweekSheet";

export default function MatchweekPredictPage() {
  const { competition: competitionSlug } = useParams<{ competition: string }>();
  const { user, loading: authLoading } = useAuth();
  const slug = useCompetitionSlug();
  const base = slug ? `/${slug}` : "/predict";

  const [round,     setRound]     = useState<Round | null>(null);
  const [fixtures,  setFixtures]  = useState<Fixture[]>([]);
  const [previous,  setPrevious]  = useState<Fixture[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [stats,       setStats]       = useState<Record<string, FixtureStats>>({});
  const [playerCount, setPlayerCount] = useState<number | undefined>(undefined);
  const [hasDraw,     setHasDraw]     = useState(true);
  const [nav, setNav] = useState<{ nextHref?: string; nextLabel?: string; prevHref?: string; prevLabel?: string }>({});

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const { competition, error: compErr } = await resolveCompetition(competitionSlug);
      if (!alive) return;
      if (compErr || !competition) { setError(compErr ?? "Competition not found."); setLoading(false); return; }
      setHasDraw(sportOf(competition.sportCode).hasDraw);

      const ctx = await getCurrentRoundContext(competition.id);
      if (!alive) return;
      if (!ctx.round) { setError("No matchweek is open yet."); setLoading(false); return; }
      setRound(ctx.round);

      const { fixtures: fx } = await getFixturesByRound(ctx.round.id);
      if (!alive) return;
      setFixtures(fx);

      // Community layer — the crowd's split + how many are playing. Best-effort;
      // the sheet simply hides these when absent.
      void Promise.all([
        supabase.rpc("get_round_prediction_stats", { p_round_id: ctx.round.id }),
        supabase.rpc("get_competition_predictor_count", { p_competition_id: competition.id }),
      ]).then(([s, c]) => {
        if (!alive) return;
        if (s.data) {
          const map: Record<string, FixtureStats> = {};
          for (const r of s.data as Record<string, unknown>[]) {
            map[r.fixture_id as string] = {
              total:   Number(r.total ?? 0),
              homePct: Number(r.home_pct ?? 0),
              drawPct: Number(r.draw_pct ?? 0),
              awayPct: Number(r.away_pct ?? 0),
            };
          }
          setStats(map);
        }
        if (typeof c.data === "number") setPlayerCount(c.data);
      }).catch(() => { /* community layer is non-critical */ });

      // Previous round for "copy last week's scores", plus next/prev links so
      // you can keep predicting from the bottom of the sheet.
      if (ctx.season) {
        const rounds = await getRounds(ctx.season.id);
        const idx = rounds.findIndex((r) => r.id === ctx.round!.id);
        const prevR = idx > 0 ? rounds[idx - 1] : null;
        const nextR = idx >= 0 && idx + 1 < rounds.length ? rounds[idx + 1] : null;
        if (alive) setNav({
          nextHref:  nextR ? `${base}/matchweek/${nextR.code}` : undefined,
          nextLabel: nextR?.shortLabel ?? nextR?.label,
          prevHref:  prevR ? `${base}/matchweek/${prevR.code}` : undefined,
          prevLabel: prevR?.shortLabel ?? prevR?.label,
        });
        if (prevR) {
          const { fixtures: prev } = await getFixturesByRound(prevR.id);
          if (alive) setPrevious(prev);
        }
      }

      if (alive) setLoading(false);
    }

    void load();
    return () => { alive = false; };
  }, [competitionSlug, reloadKey]);

  if (authLoading || loading) {
    return <CenteredNote>Loading matchweek…</CenteredNote>;
  }

  if (!user) {
    return (
      <CenteredNote>
        <p className="mb-3">Sign in to make your predictions.</p>
        <Link href="/login" className="text-sm font-semibold px-4 py-2 rounded-lg inline-block"
              style={{ background: "#1a3a2a", color: "#fff" }}>
          Sign in
        </Link>
      </CenteredNote>
    );
  }

  if (error) return <CenteredNote>{error}</CenteredNote>;

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="px-4 pt-3">
        <Link href={base} className="text-xs font-semibold" style={{ color: "#1a3a2a" }}>← Matchweek</Link>
      </div>
      <MatchweekSheet
        fixtures={fixtures}
        previousFixtures={previous}
        roundLabel={round?.label ?? "Matchweek"}
        hasDraw={hasDraw}
        statsByFixture={stats}
        playerCount={playerCount}
        nextHref={nav.nextHref}
        nextLabel={nav.nextLabel}
        prevHref={nav.prevHref}
        prevLabel={nav.prevLabel}
        onChanged={() => { /* optimistic; a background reload could go here */ }}
      />
    </div>
  );
}

function CenteredNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center flex flex-col items-center" style={{ color: "#7a8f82" }}>
      <div className="text-sm">{children}</div>
    </div>
  );
}
