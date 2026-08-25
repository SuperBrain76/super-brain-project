"use client";

/**
 * /[competition]/matchweek/[code] — one matchweek, past / current / future.
 *
 * The browsable season that lets you predict every game, any week. One
 * template, three faces:
 *   open (future/current) → the full prediction sheet, inline (predict + autosave)
 *   past                  → results, your points per fixture
 * A scrollable MW1…MW38 rail jumps to any matchweek; chevrons walk one at a time.
 * See docs/PREMIER_LEAGUE_UX.md §4.3 and docs/SEASON_AND_ENGAGEMENT.md.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { resolveCompetition, getFixturesByRound, type Fixture } from "@/lib/predictor";
import { sportOf, FOOTBALL, type SportMeta } from "@/lib/sports";
import { getCurrentSeason, getRounds, type Round } from "@/lib/competitionEngine";
import { useCompetitionSlug } from "@/components/CompetitionProvider";
import MatchweekSheet from "@/components/premier/MatchweekSheet";

const GREEN = "#1a3a2a", GOLD = "#b8972a", MUTED = "#7a8f82";
const BORDER = "#dde5d8", CARD = "#fff", TEXT1 = "#0f1f17";
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
  const [sport,    setSport]    = useState<SportMeta>(FOOTBALL);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const { competition, error: e } = await resolveCompetition(competitionSlug);
      if (!alive) return;
      if (e || !competition) { setError(e ?? "Competition not found."); setLoading(false); return; }
      setSport(sportOf(competition.sportCode));

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

  // Keep the active matchweek pill centered as you walk the season. Scroll the
  // rail directly (scrollIntoView won't reliably move a horizontal container).
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (loading) return;   // the rail only exists once loading finishes
    const rail = railRef.current;
    const el = rail?.querySelector('[data-active="true"]') as HTMLElement | null;
    if (!rail || !el) return;
    const railRect = rail.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = (elRect.left - railRect.left) - (rail.clientWidth / 2 - el.clientWidth / 2);
    rail.scrollTo({ left: rail.scrollLeft + delta, behavior: "smooth" });
  }, [round?.id, rounds.length, loading]);

  // A matchweek is still predictable unless every fixture has kicked off.
  const openForPredictions = useMemo(() => {
    const now = Date.now();
    return fixtures.some((f) => f.status === "scheduled" && new Date(f.kicksOffAt).getTime() > now);
  }, [fixtures]);

  if (loading) return <Note>Loading…</Note>;
  if (error)   return <Note>{error}</Note>;

  const totalPts = fixtures.reduce((n, f) => n + (f.myPrediction?.pointsAwarded ?? 0), 0);
  const anyScored = fixtures.some((f) => f.myPrediction?.pointsAwarded != null);

  return (
    <div className="max-w-md mx-auto w-full">
      {/* Matchweek rail — jump to any week of the season */}
      <div className="px-3 pt-3">
        <div ref={railRef} className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {rounds.map((r) => {
            const active = r.id === round?.id;
            return (
              <Link key={r.id} href={`${base}/matchweek/${r.code}`}
                data-active={active ? "true" : undefined}
                className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                style={{
                  background: active ? GREEN : "#eef3ec",
                  color: active ? "#fff" : MUTED,
                  border: `1px solid ${active ? GREEN : BORDER}`,
                }}>
                {r.shortLabel ?? r.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Header + chevrons */}
      <div className="flex items-center justify-between px-4 mb-1">
        {prev
          ? <Link href={`${base}/matchweek/${prev.code}`} className="text-lg px-2 py-1" style={{ color: GREEN }}>←</Link>
          : <span className="w-8" />}
        <div className="text-center">
          <h1 className="text-lg font-bold" style={{ color: TEXT1 }}>{round?.label}</h1>
          {anyScored && <p className="text-xs" style={{ color: MUTED }}>You scored {totalPts} pts</p>}
        </div>
        {next
          ? <Link href={`${base}/matchweek/${next.code}`} className="text-lg px-2 py-1" style={{ color: GREEN }}>→</Link>
          : <span className="w-8" />}
      </div>

      {fixtures.length === 0 ? (
        <Note>No fixtures in this matchweek yet.</Note>
      ) : openForPredictions ? (
        // Open week → predict inline with the real sheet (autosave).
        <MatchweekSheet
          fixtures={fixtures}
          roundLabel={round?.label ?? "Matchweek"}
          sport={sport}
          nextHref={next ? `${base}/matchweek/${next.code}` : undefined}
          nextLabel={next?.shortLabel ?? next?.label}
          prevHref={prev ? `${base}/matchweek/${prev.code}` : undefined}
          prevLabel={prev?.shortLabel ?? prev?.label}
          onChanged={() => { /* optimistic */ }}
        />
      ) : (
        // Closed week → read-only results.
        <div className="flex flex-col gap-2 px-3 pb-24 pt-1">
          {fixtures.map((f) => <MatchweekRow key={f.id} f={f} />)}
          {(prev || next) && (
            <div className="flex items-center gap-2 mt-4">
              {prev
                ? <Link href={`${base}/matchweek/${prev.code}`} className="text-xs font-semibold px-3 py-3 rounded-lg shrink-0" style={{ color: MUTED, background: "#f4f7f2", border: `1px solid ${BORDER}` }}>← {prev.shortLabel ?? prev.label}</Link>
                : <span />}
              {next && <Link href={`${base}/matchweek/${next.code}`} className="flex-1 text-center text-sm font-bold px-3 py-3 rounded-lg" style={{ color: "#fff", background: GREEN }}>Next: {next.shortLabel ?? next.label} →</Link>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchweekRow({ f }: { f: Fixture }) {
  const done = f.status === "completed" && f.homeScore !== null;
  const live = f.status === "live";
  const pred = f.myPrediction;
  const pts  = pred?.pointsAwarded ?? null;

  const ptsColor = pts === 5 ? OK : pts === 3 ? GREEN : pts === 2 ? GOLD : pts === 0 ? LIVE : MUTED;
  const ko = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(f.kicksOffAt));

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
