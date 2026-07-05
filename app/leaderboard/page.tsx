"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getLeaderboard, getLeaderboardStats, type LeaderboardEntry, type LeaderboardStats } from "@/lib/leaderboard";
import { getRankingColor } from "@/lib/scoring";
import { isSupabaseConfigured } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { nameToFlag } from "@/lib/countries";
import { getContributionLeaderboard } from "@/lib/economy";
import { getNetworkLeaderboard } from "@/lib/network";
import { getBattleLeaderboard } from "@/lib/battle";
import { getPredictorLeaderboard, getCompetition } from "@/lib/predictor";
import { BRAND, MATERIAL } from "@/lib/brand";

type Segment = "predictions" | "iq" | "network" | "battles" | "tests";
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "predictions", label: "Predictions" },
  { key: "iq",          label: "IQ" },
  { key: "network",     label: "Network" },
  { key: "battles",     label: "Battles" },
  { key: "tests",       label: "Brain Tests" },
];

const TESTS = [
  { label: "Focus",         name: "Focus & Attention Test",       href: "/tests/focus" },
  { label: "Tap Speed",     name: "Tap Speed Test",               href: "/tests/tap-speed" },
  { label: "Verbal Memory", name: "Verbal Memory Test",           href: "/tests/verbal-memory" },
  { label: "Stroop",        name: "Stroop Test",                  href: "/tests/stroop" },
  { label: "Reaction",      name: "Reaction Speed Test",          href: "/tests/reaction" },
  { label: "Pressure",      name: "Pressure Decision Test",       href: "/tests/pressure" },
  { label: "Memory",        name: "Memory & Focus Test",          href: "/tests/memory" },
  { label: "Fighter Pilot", name: "Fighter Pilot Cognitive Test", href: "/test" },
] as const;

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, { bg: string; color: string; border: string; glow?: string }> = {
    1: { bg: "rgba(232,193,90,0.14)", color: BRAND.gold, border: "rgba(232,193,90,0.4)", glow: MATERIAL.shadowGold },
    2: { bg: "rgba(200,205,215,0.10)", color: "#C8CDD7", border: "rgba(200,205,215,0.28)" },
    3: { bg: "rgba(205,140,90,0.12)", color: "#CD8C5A", border: "rgba(205,140,90,0.3)" },
  };
  const s = styles[rank];
  if (s)
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
        style={{ background: s.bg, color: s.color, border: `0.5px solid ${s.border}`, boxShadow: s.glow }}
      >
        {rank}
      </div>
    );
  return (
    <div className="w-8 h-8 flex items-center justify-center text-sm font-mono" style={{ color: BRAND.dim }}>
      {rank}
    </div>
  );
}

function SkeletonRow({ i }: { i: number }) {
  return (
    <div className="flex items-center gap-4 px-2 py-4 border-b border-white/[0.07] last:border-0">
      <div className="w-8 h-8 rounded-sm bg-white/[0.07] animate-pulse" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3 w-28 bg-white/[0.07] rounded animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
        <div className="h-2.5 w-16 bg-white/[0.07] rounded animate-pulse opacity-60" style={{ animationDelay: `${i * 80}ms` }} />
      </div>
      <div className="h-5 w-8 bg-white/[0.07] rounded animate-pulse" />
    </div>
  );
}

export default function LeaderboardPage() {
  const [segment,  setSegment]  = useState<Segment>("predictions");
  const [testIdx,  setTestIdx]  = useState(0);
  const [country,  setCountry]  = useState("");
  const [entries,  setEntries]  = useState<LeaderboardEntry[]>([]);
  const [fetching, setFetching] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [stats,    setStats]    = useState<LeaderboardStats | null>(null);

  // Cache: key = "testName|country"
  const cacheRef    = useRef<Map<string, LeaderboardEntry[]>>(new Map());
  const viewTracked = useRef(false);

  const activeTest = TESTS[testIdx];

  // Fire leaderboard_viewed once per page load
  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;
    track.leaderboardViewed(activeTest.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const key    = `${activeTest.name}|${country}`;
    const cached = cacheRef.current.get(key);
    if (cached) { setEntries(cached); setHasError(false); return; }

    setFetching(true);
    setHasError(false);

    const [rows, statsData] = await Promise.all([
      getLeaderboard(activeTest.name, country || undefined),
      getLeaderboardStats(activeTest.name),
    ]);

    setFetching(false);

    if (rows === null) {
      setHasError(true);
      setEntries([]);
    } else {
      cacheRef.current.set(key, rows);
      setEntries(rows);
    }
    setStats(statsData);
  }, [activeTest.name, country]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const countries = useMemo(
    () => [...new Set(entries.flatMap((e) => (e.country ? [e.country] : [])))].sort(),
    [entries],
  );

  return (
    <div className="min-h-screen" style={{ background: MATERIAL.vignette }}>
      <div className="max-w-3xl mx-auto px-5 py-8">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-xs tracking-[0.28em] uppercase mb-2" style={{ color: BRAND.dim }}>Global Rankings</p>
          <h1 className="text-4xl font-extrabold" style={{ color: BRAND.ink }}>Leaderboard</h1>
          <p className="text-sm mt-1.5" style={{ color: BRAND.muted }}>Best score per player · sorted highest first.</p>
        </div>

        {/* ── Segment switcher — boxless, pill-lit ──────────── */}
        <div className="flex gap-1.5 mb-7 overflow-x-auto scrollbar-none">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSegment(s.key)}
              className="shrink-0 px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-150 active:scale-95"
              style={segment === s.key
                ? { background: BRAND.ink, color: BRAND.black }
                : { background: "transparent", color: BRAND.dim, border: `0.5px solid ${BRAND.hairline}` }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {segment !== "tests" && <EconomyBoard kind={segment} />}

        {segment === "tests" && (<>
        {/* ── Test filter tabs ───────────────────────────────── */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto scrollbar-none">
          {TESTS.map((t, i) => (
            <button
              key={t.name}
              onClick={() => { setTestIdx(i); setCountry(""); }}
              className="shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-150 active:scale-95"
              style={i === testIdx
                ? { background: "rgba(255,255,255,0.08)", color: BRAND.ink, border: `0.5px solid ${BRAND.hairlineStrong}` }
                : { background: "transparent", color: BRAND.dim, border: `0.5px solid ${BRAND.hairline}` }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Stats strip ────────────────────────────────────── */}
        {isSupabaseConfigured && stats && !hasError && (
          <div className="flex items-center gap-5 mb-3 px-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-white/40" />
              <span className="text-[#6B6B73] text-xs">
                <span className="text-[#A0A0A8] font-medium">{stats.totalAttempts.toLocaleString()}</span>{" "}
                {stats.totalAttempts === 1 ? "attempt" : "attempts"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-[#35C56F]" />
              <span className="text-[#6B6B73] text-xs">
                <span className="text-[#A0A0A8] font-medium">{stats.totalPlayers.toLocaleString()}</span>{" "}
                {stats.totalPlayers === 1 ? "player" : "players"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-white/[0.07]" />
              <span className="text-[#6B6B73] text-xs">Best score per player shown</span>
            </div>
          </div>
        )}

        {/* ── Country filter ─────────────────────────────────── */}
        {countries.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#6B6B73] text-xs">Filter:</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-[#111116] border border-white/[0.07] text-[#A0A0A8] rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-white/30 transition-colors"
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {nameToFlag(c)} {c}
                </option>
              ))}
            </select>
            {country && (
              <button
                onClick={() => setCountry("")}
                className="text-[#6B6B73] text-xs hover:text-[#F5F5F2] transition-colors"
              >
                ✕ Clear
              </button>
            )}
          </div>
        )}

        {/* ── Not configured ─────────────────────────────────── */}
        {!isSupabaseConfigured && (
          <div className="bg-[#111116] border border-white/[0.07] rounded-sm p-10 text-center">
            <p className="text-[#A0A0A8] mb-2">Leaderboard requires Supabase.</p>
            <p className="text-[#6B6B73] text-xs">
              Add{" "}
              <code className="font-mono text-[#F5F5F2]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="font-mono text-[#F5F5F2]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
              <code className="font-mono">.env.local</code>.
            </p>
          </div>
        )}

        {/* ── Error state ────────────────────────────────────── */}
        {isSupabaseConfigured && hasError && (
          <div className="bg-[#111116] border border-white/[0.07] rounded-sm p-10 text-center">
            <p className="text-[#A0A0A8] mb-1">Could not load the leaderboard.</p>
            <p className="text-[#6B6B73] text-xs mb-6">Check your connection and try again.</p>
            <button onClick={fetchData} className="rounded-full bg-[#F5F5F2] text-[#0B0B0D] font-bold px-6 py-2.5 text-sm transition-transform active:scale-95">
              Retry
            </button>
          </div>
        )}

        {/* ── Table ──────────────────────────────────────────── */}
        {isSupabaseConfigured && !hasError && (
          <div className="overflow-hidden">

            {/* Column headers */}
            <div className="flex items-center gap-4 px-2 py-3 border-b border-white/[0.07]">
              <div className="w-8 shrink-0" />
              <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                <span className="text-[#6B6B73] text-xs tracking-widest uppercase">Player</span>
                <span className="text-[#6B6B73] text-xs tracking-widest uppercase w-14 text-right">Score</span>
                <span className="text-[#6B6B73] text-xs tracking-widest uppercase w-20 text-right hidden sm:block">Percentile</span>
                <span className="text-[#6B6B73] text-xs tracking-widest uppercase w-28 text-right hidden md:block">Title</span>
              </div>
            </div>

            {/* Skeleton */}
            {fetching && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} i={i} />)}

            {/* Empty */}
            {!fetching && entries.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-[#A0A0A8] mb-1">No entries yet.</p>
                <p className="text-[#6B6B73] text-xs mb-6">
                  Be first — take the test and save your result.
                </p>
                <Link href={activeTest.href}>
                  <button className="rounded-full bg-[#F5F5F2] text-[#0B0B0D] font-bold px-6 py-2.5 text-sm transition-transform active:scale-95">Take the {activeTest.label} Test →</button>
                </Link>
              </div>
            )}

            {/* Rows */}
            {!fetching &&
              entries.map((entry) => {
                const color  = getRankingColor(entry.score);
                const topPct = 100 - entry.percentile;
                const flag   = nameToFlag(entry.country);
                return (
                  <div
                    key={`${entry.displayName}-${entry.rank}`}
                    className="flex items-center gap-4 px-2 py-4 border-b border-white/[0.07] last:border-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="shrink-0">
                      <RankBadge rank={entry.rank} />
                    </div>

                    <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center min-w-0">
                      {/* Player */}
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{entry.displayName}</p>
                        {entry.country && (
                          <p className="text-[#6B6B73] text-xs mt-0.5">
                            {flag && <span className="mr-1">{flag}</span>}
                            {entry.country}
                          </p>
                        )}
                      </div>

                      {/* Score */}
                      <div className="w-14 text-right">
                        <span className="text-lg font-extrabold number-display" style={{ color }}>
                          {entry.score}
                        </span>
                      </div>

                      {/* Percentile */}
                      <div className="w-20 text-right hidden sm:block">
                        <span className="text-[#A0A0A8] text-xs">
                          Top <span className="text-[#F5F5F2] font-semibold number-display">{topPct}%</span>
                        </span>
                      </div>

                      {/* Title */}
                      <div className="w-28 text-right hidden md:block">
                        <span className="text-xs font-semibold tracking-wide" style={{ color }}>
                          {entry.resultTitle}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* ── CTA ────────────────────────────────────────────── */}
        {isSupabaseConfigured && !fetching && !hasError && (
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border border-white/[0.07] rounded-sm">
            <p className="text-[#A0A0A8] text-sm">
              Not on the board?{" "}
              <span className="text-[#6B6B73]">Sign in to save results.</span>
            </p>
            <Link href={activeTest.href}>
              <button className="rounded-full bg-[#F5F5F2] text-[#0B0B0D] font-bold px-6 py-2.5 text-sm transition-transform active:scale-95 shrink-0">Take the Test →</button>
            </Link>
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}

interface EconomyRow { rank: number; name: string; country: string | null; value: string; sub?: string }

const BOARD_META: Record<Exclude<Segment, "tests">, { metric: string; empty: string }> = {
  predictions: { metric: "Points", empty: "No prediction scores yet." },
  iq:          { metric: "IQ",     empty: "No IQ earned yet — start playing to climb." },
  network:     { metric: "Active", empty: "No active networks yet." },
  battles:     { metric: "Elo",    empty: "No battles played yet." },
};

function EconomyBoard({ kind }: { kind: Exclude<Segment, "tests"> }) {
  const [rows, setRows] = useState<EconomyRow[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setErr(false);
    (async () => {
      let out: EconomyRow[] | null = [];
      if (kind === "iq") {
        const d = await getContributionLeaderboard("IQ");
        out = d && d.map((e) => ({ rank: e.rank, name: e.displayName, country: e.country, value: `${e.balance.toLocaleString()} IQ` }));
      } else if (kind === "network") {
        const d = await getNetworkLeaderboard("IQ");
        out = d && d.map((e) => ({ rank: e.rank, name: e.displayName, country: e.country, value: `${e.activeMembers.toLocaleString()} active`, sub: `${e.networkIq.toLocaleString()} IQ` }));
      } else if (kind === "battles") {
        const d = await getBattleLeaderboard();
        out = d && d.map((e) => ({ rank: e.rank, name: e.displayName, country: e.country, value: `${e.elo} Elo`, sub: `${e.wins}W · ${e.losses}L` }));
      } else {
        const { competition } = await getCompetition("wc2026");
        if (competition) {
          const d = await getPredictorLeaderboard(competition.id);
          out = d.map((e) => ({ rank: e.rank, name: e.displayName, country: e.country, value: `${e.totalPoints.toLocaleString()} pts`, sub: `${e.exactScores} exact` }));
        } else {
          out = [];
        }
      }
      if (!alive) return;
      if (out === null) { setErr(true); setRows([]); } else { setRows(out); }
    })();
    return () => { alive = false; };
  }, [kind]);

  if (!isSupabaseConfigured) {
    return (
      <div className="bg-[#111116] border border-white/[0.07] rounded-sm p-10 text-center">
        <p className="text-[#A0A0A8] mb-2">Rankings require Supabase.</p>
      </div>
    );
  }

  const meta = BOARD_META[kind];

  return (
    <div className="overflow-hidden">
      <div className="flex items-center gap-4 px-2 py-3 border-b border-white/[0.07]">
        <div className="w-8 shrink-0" />
        <span className="flex-1 text-[#6B6B73] text-xs tracking-widest uppercase">Player</span>
        <span className="text-[#6B6B73] text-xs tracking-widest uppercase text-right">{meta.metric}</span>
      </div>

      {rows === null && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} i={i} />)}

      {rows !== null && err && (
        <div className="py-8 text-center"><p className="text-[#A0A0A8] text-sm">Could not load this leaderboard.</p></div>
      )}

      {rows !== null && !err && rows.length === 0 && (
        <div className="py-8 text-center"><p className="text-[#A0A0A8] text-sm">{meta.empty}</p></div>
      )}

      {rows !== null && !err && rows.map((r) => {
        const flag = nameToFlag(r.country);
        return (
          <div key={`${r.name}-${r.rank}`} className="flex items-center gap-4 px-2 py-4 border-b border-white/[0.07] last:border-0 hover:bg-white/[0.03] transition-colors">
            <div className="shrink-0"><RankBadge rank={r.rank} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{r.name}</p>
              {r.country && (
                <p className="text-[#6B6B73] text-xs mt-0.5">
                  {flag && <span className="mr-1">{flag}</span>}{r.country}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-base font-extrabold number-display" style={{ color: kind === "iq" ? BRAND.gold : BRAND.ink }}>{r.value}</p>
              {r.sub && <p className="text-[#6B6B73] text-xs mt-0.5">{r.sub}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
