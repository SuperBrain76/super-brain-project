"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getLeaderboard, getLeaderboardStats, type LeaderboardEntry, type LeaderboardStats } from "@/lib/leaderboard";
import { getRankingColor } from "@/lib/scoring";
import { isSupabaseConfigured } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { nameToFlag } from "@/lib/countries";

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
  const styles: Record<number, { bg: string; color: string; border: string }> = {
    1: { bg: "#ffab0020", color: "#ffab00", border: "#ffab0040" },
    2: { bg: "#94a3b820", color: "#94a3b8", border: "#94a3b840" },
    3: { bg: "#cd7c3220", color: "#cd7c32", border: "#cd7c3240" },
  };
  const s = styles[rank];
  if (s)
    return (
      <div
        className="w-8 h-8 rounded-sm flex items-center justify-center text-sm font-black"
        style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
      >
        {rank}
      </div>
    );
  return (
    <div className="w-8 h-8 flex items-center justify-center text-sm font-mono text-cockpit-muted">
      {rank}
    </div>
  );
}

function SkeletonRow({ i }: { i: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-cockpit-border last:border-0">
      <div className="w-8 h-8 rounded-sm bg-cockpit-border animate-pulse" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3 w-28 bg-cockpit-border rounded animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
        <div className="h-2.5 w-16 bg-cockpit-border rounded animate-pulse opacity-60" style={{ animationDelay: `${i * 80}ms` }} />
      </div>
      <div className="h-5 w-8 bg-cockpit-border rounded animate-pulse" />
    </div>
  );
}

export default function LeaderboardPage() {
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
    <div className="min-h-screen hud-grid">
      <div className="max-w-3xl mx-auto px-5 py-6">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono">Global Rankings</p>
          <h1 className="text-3xl font-extrabold text-white">Leaderboard</h1>
          <p className="text-cockpit-dim text-sm mt-1">Best score per player · sorted highest first.</p>
        </div>

        {/* ── Test filter tabs ───────────────────────────────── */}
        <div className="flex gap-1 mb-4 p-1 bg-cockpit-surface border border-cockpit-border rounded-sm overflow-x-auto scrollbar-none">
          {TESTS.map((t, i) => (
            <button
              key={t.name}
              onClick={() => { setTestIdx(i); setCountry(""); }}
              className={`shrink-0 px-3 py-2 rounded-sm text-xs font-semibold tracking-wide transition-all duration-150 ${
                i === testIdx
                  ? "bg-cockpit-card text-white border border-cockpit-border"
                  : "text-cockpit-muted hover:text-cockpit-dim"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Stats strip ────────────────────────────────────── */}
        {isSupabaseConfigured && stats && !hasError && (
          <div className="flex items-center gap-5 mb-3 px-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-cockpit-accent" />
              <span className="text-cockpit-muted text-xs">
                <span className="text-cockpit-dim font-medium">{stats.totalAttempts.toLocaleString()}</span>{" "}
                {stats.totalAttempts === 1 ? "attempt" : "attempts"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-cockpit-green" />
              <span className="text-cockpit-muted text-xs">
                <span className="text-cockpit-dim font-medium">{stats.totalPlayers.toLocaleString()}</span>{" "}
                {stats.totalPlayers === 1 ? "player" : "players"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-cockpit-border" />
              <span className="text-cockpit-muted text-xs">Best score per player shown</span>
            </div>
          </div>
        )}

        {/* ── Country filter ─────────────────────────────────── */}
        {countries.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-cockpit-muted text-xs">Filter:</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-cockpit-card border border-cockpit-border text-cockpit-dim rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-cockpit-accent transition-colors"
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
                className="text-cockpit-muted text-xs hover:text-cockpit-accent transition-colors"
              >
                ✕ Clear
              </button>
            )}
          </div>
        )}

        {/* ── Not configured ─────────────────────────────────── */}
        {!isSupabaseConfigured && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-10 text-center">
            <p className="text-cockpit-dim mb-2">Leaderboard requires Supabase.</p>
            <p className="text-cockpit-muted text-xs">
              Add{" "}
              <code className="font-mono text-cockpit-accent">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="font-mono text-cockpit-accent">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
              <code className="font-mono">.env.local</code>.
            </p>
          </div>
        )}

        {/* ── Error state ────────────────────────────────────── */}
        {isSupabaseConfigured && hasError && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-10 text-center">
            <p className="text-cockpit-dim mb-1">Could not load the leaderboard.</p>
            <p className="text-cockpit-muted text-xs mb-6">Check your connection and try again.</p>
            <button onClick={fetchData} className="btn-primary">
              Retry
            </button>
          </div>
        )}

        {/* ── Table ──────────────────────────────────────────── */}
        {isSupabaseConfigured && !hasError && (
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">

            {/* Column headers */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-cockpit-border bg-cockpit-surface">
              <div className="w-8 shrink-0" />
              <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
                <span className="text-cockpit-muted text-xs tracking-widest uppercase">Player</span>
                <span className="text-cockpit-muted text-xs tracking-widest uppercase w-14 text-right">Score</span>
                <span className="text-cockpit-muted text-xs tracking-widest uppercase w-20 text-right hidden sm:block">Percentile</span>
                <span className="text-cockpit-muted text-xs tracking-widest uppercase w-28 text-right hidden md:block">Title</span>
              </div>
            </div>

            {/* Skeleton */}
            {fetching && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} i={i} />)}

            {/* Empty */}
            {!fetching && entries.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-cockpit-dim mb-1">No entries yet.</p>
                <p className="text-cockpit-muted text-xs mb-6">
                  Be first — take the test and save your result.
                </p>
                <Link href={activeTest.href}>
                  <button className="btn-primary">Take the {activeTest.label} Test →</button>
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
                    className="flex items-center gap-4 px-5 py-4 border-b border-cockpit-border last:border-0 hover:bg-cockpit-surface transition-colors"
                  >
                    <div className="shrink-0">
                      <RankBadge rank={entry.rank} />
                    </div>

                    <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center min-w-0">
                      {/* Player */}
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{entry.displayName}</p>
                        {entry.country && (
                          <p className="text-cockpit-muted text-xs mt-0.5">
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
                        <span className="text-cockpit-dim text-xs">
                          Top <span className="text-cockpit-accent font-semibold number-display">{topPct}%</span>
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
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border border-cockpit-border rounded-sm">
            <p className="text-cockpit-dim text-sm">
              Not on the board?{" "}
              <span className="text-cockpit-muted">Sign in to save results.</span>
            </p>
            <Link href={activeTest.href}>
              <button className="btn-primary shrink-0">Take the Test →</button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
