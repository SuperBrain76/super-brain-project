"use client";

/**
 * PremierLeagueHome — data loader for the living Competition Home.
 *
 * Loads exactly what the state-aware dashboard needs and hands it to
 * CompetitionHome. Round-scoped: it fetches one matchweek's fixtures, not
 * the whole season. See docs/PREMIER_LEAGUE_UX.md §2.
 *
 * Rendered by app/[competition]/page.tsx only when the competition's
 * home_style setting is 'matchweek'. The World Cup (home_style 'classic')
 * never reaches this component.
 */

import { useEffect, useState } from "react";
import type { Competition, Fixture, MyStats } from "@/lib/predictor";
import { getMyStats } from "@/lib/predictor";
import {
  getCurrentRoundContext, getRoundFixtures, getCompetitionSettings,
  type Round, type CompetitionSettings,
} from "@/lib/competitionEngine";
import { getMyIqBalance } from "@/lib/economy";
import { supabase } from "@/lib/supabase";
import CompetitionHome, { type HomeData } from "@/components/premier/CompetitionHome";
import type { FixtureStats } from "@/components/premier/MatchweekSheet";

const IQ_PER_EXACT = 50;   // biggest IQ per correct-score prediction (default economy)

export default function PremierLeagueHome({ competition }: { competition: Competition }) {
  const [data, setData]   = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      const [ctx, settings, stats] = await Promise.all([
        getCurrentRoundContext(competition.id),
        getCompetitionSettings(competition.id),
        getMyStats(competition.id).catch(() => null),
      ]);
      if (!alive) return;

      const round = ctx.round;
      const { fixtures } = round
        ? await getRoundFixtures(round.id)
        : { fixtures: [] as Fixture[] };
      if (!alive) return;

      const editorial = round ? await loadEditorial(round) : null;
      if (!alive) return;

      const biggest = pickBiggestMatch(fixtures, editorial?.biggestFixtureId ?? null);

      // Community + economy — the "why care" data. Best-effort and parallel;
      // the dashboard degrades gracefully when any of these is missing.
      const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn(); } catch { return fallback; }
      };
      const [players, leagues, roundStats, iqLifetime, history] = await Promise.all([
        safe(async () => { const r = await supabase.rpc("get_competition_predictor_count", { p_competition_id: competition.id }); return typeof r.data === "number" ? r.data : undefined; }, undefined as number | undefined),
        safe(async () => { const r = await supabase.from("prediction_leagues").select("id", { count: "exact", head: true }).eq("competition_id", competition.id); return r.count ?? undefined; }, undefined as number | undefined),
        round ? safe(async () => { const r = await supabase.rpc("get_round_prediction_stats", { p_round_id: round.id }); return r.data as Record<string, unknown>[] | null; }, null) : Promise.resolve(null),
        safe(() => getMyIqBalance(), null as number | null),
        safe(async () => { const r = await supabase.rpc("get_my_competition_history"); return r.data as Record<string, unknown>[] | null; }, null),
      ]);
      if (!alive) return;

      const featuredStats: FixtureStats | null = (() => {
        if (!biggest || !roundStats) return null;
        const row = roundStats.find((r) => r.fixture_id === biggest.id);
        if (!row) return null;
        return { total: Number(row.total ?? 0), homePct: Number(row.home_pct ?? 0), drawPct: Number(row.draw_pct ?? 0), awayPct: Number(row.away_pct ?? 0) };
      })();

      const seasonIq = (() => {
        const h = history?.find((r) => r.competition_id === competition.id);
        return h ? Number(h.iq_earned ?? 0) : 0;
      })();

      setData({
        round,
        fixtures,
        nextRoundStartsMs: ctx.nextRoundStartsMs,
        settings:          settings as CompetitionSettings,
        stats:             stats as MyStats | null,
        leaguePreview:     null,
        biggestMatch:      biggest,
        challengeCount:    0,
        challengesAnswered: 0,
        editorial:         editorial ? { headline: editorial.headline, players: editorial.players } : null,
        competitionName:   competition.name,
        playerCount:       players,
        leagueCount:       leagues,
        iqAvailable:       fixtures.length * IQ_PER_EXACT,
        featuredStats,
        iqLifetime:        iqLifetime ?? 0,
        iqThisCompetition: seasonIq,
        lastWeekend:       null,   // populated once a prior round has settled (Phase 3b)
      });
    }

    void load().catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [competition.id]);

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm" style={{ color: "#c0392b" }}>Could not load the matchweek.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm" style={{ color: "#7a8f82" }}>Loading matchweek…</p>
      </div>
    );
  }

  return <CompetitionHome data={data} />;
}

// ── Editorial ─────────────────────────────────────────────────

async function loadEditorial(round: Round): Promise<
  { headline: string; players: string[]; biggestFixtureId: string | null } | null
> {
  const { data, error } = await supabase
    .from("round_editorial")
    .select("headline, players, biggest_fixture_id")
    .eq("round_id", round.id)
    .maybeSingle();

  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  const headline = (r.headline as string) ?? "";
  if (!headline) return null;

  return {
    headline,
    players:          Array.isArray(r.players) ? (r.players as string[]) : [],
    biggestFixtureId: (r.biggest_fixture_id as string) ?? null,
  };
}

// ── Biggest match ─────────────────────────────────────────────
// Admin override wins. Otherwise a cheap heuristic: the marquee slot is
// usually the standalone Sunday/Monday fixture — the one whose kickoff slot
// has the fewest other matches, latest in the week. Good enough for 3a; a
// standings-based ranking (UX §7) is a Phase 3b refinement.

function pickBiggestMatch(fixtures: Fixture[], overrideId: string | null): Fixture | null {
  if (fixtures.length === 0) return null;
  if (overrideId) {
    const hit = fixtures.find((f) => f.id === overrideId);
    if (hit) return hit;
  }

  const bySlot = new Map<number, number>();
  for (const f of fixtures) {
    const slot = Math.floor(new Date(f.kicksOffAt).getTime() / 60000);
    bySlot.set(slot, (bySlot.get(slot) ?? 0) + 1);
  }

  // Prefer a standalone kickoff (slot size 1), latest such; else the last
  // fixture of the week.
  const standalone = fixtures
    .filter((f) => bySlot.get(Math.floor(new Date(f.kicksOffAt).getTime() / 60000)) === 1)
    .sort((a, b) => new Date(b.kicksOffAt).getTime() - new Date(a.kicksOffAt).getTime());

  if (standalone.length) return standalone[0];
  return [...fixtures].sort((a, b) => new Date(b.kicksOffAt).getTime() - new Date(a.kicksOffAt).getTime())[0];
}
