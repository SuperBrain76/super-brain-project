"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import FixtureCard from "@/components/predictor/FixtureCard";
import {
  getCompetition,
  getFixtures,
  getMyStats,
  type Fixture,
  type Competition,
  type MyStats,
  formatKickoff,
  stageLabel,
} from "@/lib/predictor";

// ── Helpers ───────────────────────────────────────────────────

type Tab = "today" | "all" | "results";

function localDateKey(isoString: string): string {
  // Returns "Fri Jun 11" etc. in user's local timezone
  return new Date(isoString).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

function isToday(isoString: string): boolean {
  const d   = new Date(isoString);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth()    === now.getMonth()    &&
         d.getDate()     === now.getDate();
}

// ── Stat chip ─────────────────────────────────────────────────

function StatChip({ label, value, color = "#00d4ff" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2.5 bg-cockpit-card border border-cockpit-border rounded-sm min-w-[72px]">
      <span className="text-lg font-black number-display leading-none" style={{ color }}>{value}</span>
      <span className="text-[10px] text-cockpit-muted uppercase tracking-widest mt-0.5">{label}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function PredictHub() {
  const { user, loading: authLoading } = useAuth();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [fixtures,    setFixtures]    = useState<Fixture[]>([]);
  const [myStats,     setMyStats]     = useState<MyStats | null>(null);
  const [fetching,    setFetching]    = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [tab,         setTab]         = useState<Tab>("all");

  useEffect(() => {
    async function load() {
      setFetching(true);
      setLoadError(null);

      // Step 1: load competition
      const { competition: comp, error: compErr } = await getCompetition("wc2026");
      if (compErr) { setLoadError(compErr); setFetching(false); return; }
      if (!comp)   { setLoadError('Competition "wc2026" not found. Run the fixture seed SQL in Supabase.'); setFetching(false); return; }
      setCompetition(comp);

      // Step 2: load fixtures
      const { fixtures: fx, error: fxErr } = await getFixtures(comp.id);
      if (fxErr) { setLoadError(fxErr); setFetching(false); return; }
      setFixtures(fx);
      setFetching(false);
    }
    load();
  }, []);

  // Load user stats separately so fixture list isn't blocked
  useEffect(() => {
    if (!user || !competition) return;
    getMyStats(competition.id).then(setMyStats);
  }, [user, competition]);

  // ── Filter ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (tab === "today") return fixtures.filter((f) => isToday(f.kicksOffAt));
    if (tab === "results") return fixtures.filter((f) => f.status === "completed");
    return fixtures;
  }, [fixtures, tab]);

  // ── Group by date ─────────────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map<string, Fixture[]>();
    for (const f of filtered) {
      const key = localDateKey(f.kicksOffAt);
      const arr = map.get(key) ?? [];
      arr.push(f);
      map.set(key, arr);
    }
    return map;
  }, [filtered]);

  const todayCount = fixtures.filter((f) => isToday(f.kicksOffAt)).length;
  const openCount  = fixtures.filter((f) => {
    return f.status === "scheduled" && new Date(f.kicksOffAt) > new Date();
  }).length;

  if (fetching || authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading predictor…</p>
      </div>
    );
  }

  // ── Error state — show exactly what failed ───────────────────
  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-12">
        <div className="w-full max-w-md bg-cockpit-card border border-red-500 border-opacity-30 rounded-sm p-5 flex flex-col gap-3">
          <p className="text-red-400 text-sm font-semibold">Failed to load predictor</p>
          <p className="text-cockpit-dim text-xs font-mono leading-relaxed break-all">{loadError}</p>
          <div className="border-t border-cockpit-border pt-3 flex flex-col gap-1">
            <p className="text-cockpit-muted text-xs font-mono">Checklist:</p>
            <p className="text-cockpit-muted text-xs">1. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local</p>
            <p className="text-cockpit-muted text-xs">2. predictor-schema.sql has been run in Supabase SQL Editor</p>
            <p className="text-cockpit-muted text-xs">3. wc2026-fixtures.sql has been run (seeds 48 teams + 104 fixtures)</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn-ghost text-sm self-start"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-cockpit-muted text-sm">Competition not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 w-full flex flex-col gap-5">

        {/* ── Header ──────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-cockpit-muted mb-1">
            SuperBrain · Predictor
          </p>
          <h1 className="text-xl font-bold text-white leading-tight">
            {competition.name}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
              style={{
                background: competition.status === "active" ? "#00e67615" : "#00d4ff10",
                color:      competition.status === "active" ? "#00e676"   : "#00d4ff",
              }}
            >
              {competition.status}
            </span>
            {openCount > 0 && (
              <span className="text-cockpit-muted text-xs">
                {openCount} fixtures open for prediction
              </span>
            )}
          </div>
        </div>

        {/* ── Sign-in nudge ────────────────────────────────── */}
        {!user && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-sm border border-cockpit-accent border-opacity-30 bg-cockpit-accent bg-opacity-5">
            <p className="text-cockpit-dim text-sm">
              Sign in to predict results and track your score.
            </p>
            <Link href="/login" className="btn-primary text-sm py-2 px-4 shrink-0">
              Sign in
            </Link>
          </div>
        )}

        {/* ── My stats ─────────────────────────────────────── */}
        {user && myStats && myStats.predictions > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <StatChip label="Pts"         value={Number(myStats.totalPoints)} color="#00d4ff" />
            <StatChip label="Rank"        value={`#${myStats.globalRank}`}    color="#ffab00" />
            <StatChip label="Predicted"   value={Number(myStats.predictions)} color="#00e676" />
            <StatChip label="Exact"       value={Number(myStats.exactScores)} color="#ff6d00" />
          </div>
        )}

        {/* ── Quick actions ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/predict/leagues"
            className="flex items-center gap-2.5 px-4 py-3 bg-cockpit-card border border-cockpit-border rounded-sm hover:border-cockpit-accent transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.8" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <div>
              <p className="text-white text-sm font-semibold leading-none">My Leagues</p>
              <p className="text-cockpit-muted text-[10px] mt-0.5">Create or join</p>
            </div>
          </Link>

          <Link
            href="/predict/leaderboard"
            className="flex items-center gap-2.5 px-4 py-3 bg-cockpit-card border border-cockpit-border rounded-sm hover:border-cockpit-accent transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffab00" strokeWidth="1.8" strokeLinecap="round">
              <polyline points="18 20 18 10"/>
              <polyline points="12 20 12 4"/>
              <polyline points="6 20 6 14"/>
            </svg>
            <div>
              <p className="text-white text-sm font-semibold leading-none">Leaderboard</p>
              <p className="text-cockpit-muted text-[10px] mt-0.5">Global ranking</p>
            </div>
          </Link>
        </div>

        {/* ── Rules link ────────────────────────────────────── */}
        <Link
          href="/predict/rules"
          className="flex items-center justify-between px-4 py-3 bg-cockpit-card border border-cockpit-border rounded-sm hover:border-cockpit-accent transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8899aa" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="text-cockpit-dim text-sm">How scoring works · Rules &amp; FAQ</span>
          </div>
          <span className="text-cockpit-muted text-xs font-mono">View →</span>
        </Link>

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex gap-1 bg-cockpit-surface rounded-sm p-1 border border-cockpit-border">
          {([
            { id: "all",     label: "All fixtures"                           },
            { id: "today",   label: `Today${todayCount > 0 ? ` (${todayCount})` : ""}` },
            { id: "results", label: "Results"                                },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-sm text-xs font-semibold transition-all duration-150"
              style={{
                background: tab === t.id ? "#1e2a38" : "transparent",
                color:      tab === t.id ? "#fff"    : "#8899aa",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Fixture list ─────────────────────────────────── */}
        {fixtures.length === 0 ? (
          // Fixtures loaded but DB is empty — seed hasn't been run
          <div className="py-10 px-4 text-center flex flex-col gap-2">
            <p className="text-cockpit-dim text-sm">No fixtures in database.</p>
            <p className="text-cockpit-muted text-xs">
              Run <code className="font-mono text-cockpit-accent">wc2026-fixtures.sql</code> in the Supabase SQL Editor to seed all 104 fixtures.
            </p>
          </div>
        ) : groups.size === 0 ? (
          <div className="py-10 text-center">
            <p className="text-cockpit-muted text-sm">
              {tab === "today"   ? "No fixtures today."   :
               tab === "results" ? "No results yet."      :
               "No fixtures found."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {Array.from(groups.entries()).map(([dateLabel, dayFixtures]) => (
              <div key={dateLabel}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: isToday(dayFixtures[0].kicksOffAt) ? "#00d4ff" : "#8899aa" }}
                  >
                    {isToday(dayFixtures[0].kicksOffAt) ? "Today · " : ""}{dateLabel}
                  </span>
                  <div className="flex-1 h-px bg-cockpit-border" />
                  <span className="text-[10px] text-cockpit-muted font-mono">
                    {dayFixtures.length} match{dayFixtures.length === 1 ? "" : "es"}
                  </span>
                </div>

                {/* Fixtures */}
                <div className="flex flex-col gap-2">
                  {dayFixtures.map((fixture) => (
                    <FixtureCard
                      key={fixture.id}
                      fixture={fixture}
                      showPrediction={!!user}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
