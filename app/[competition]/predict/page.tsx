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
import { getCurrentRoundContext, getRounds, type Round } from "@/lib/competitionEngine";
import { useCompetitionSlug } from "@/components/CompetitionProvider";
import MatchweekSheet from "@/components/premier/MatchweekSheet";

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

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const { competition, error: compErr } = await resolveCompetition(competitionSlug);
      if (!alive) return;
      if (compErr || !competition) { setError(compErr ?? "Competition not found."); setLoading(false); return; }

      const ctx = await getCurrentRoundContext(competition.id);
      if (!alive) return;
      if (!ctx.round) { setError("No matchweek is open yet."); setLoading(false); return; }
      setRound(ctx.round);

      const { fixtures: fx } = await getFixturesByRound(ctx.round.id);
      if (!alive) return;
      setFixtures(fx);

      // Previous round for "copy last week's scores".
      if (ctx.season) {
        const rounds = await getRounds(ctx.season.id);
        const idx = rounds.findIndex((r) => r.id === ctx.round!.id);
        if (idx > 0) {
          const { fixtures: prev } = await getFixturesByRound(rounds[idx - 1].id);
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
