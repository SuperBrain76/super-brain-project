"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import FixtureCard from "@/components/predictor/FixtureCard";
import GettingStarted from "@/components/predictor/GettingStarted";
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

function StatChip({ label, value, color = "#2563eb" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2.5 rounded-lg min-w-[72px]"
      style={{ background: "#fff", border: "1px solid #dde3ec", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <span className="text-lg font-black number-display leading-none" style={{ color }}>{value}</span>
      <span className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "#64748b" }}>{label}</span>
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
  const [tab,           setTab]           = useState<Tab>("all");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

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

  // Scroll-restore: after fixtures load, return to last predicted card
  useEffect(() => {
    if (fixtures.length === 0) return;
    let id: string | null = null;
    try { id = sessionStorage.getItem("lastPredictedFixture"); } catch { /* private mode */ }
    if (!id) return;
    try { sessionStorage.removeItem("lastPredictedFixture"); } catch { /* ignore */ }
    setHighlightedId(id);
    // Wait one frame for React to paint the list, then scroll
    requestAnimationFrame(() => {
      const el = document.getElementById(`fixture-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // Fade the highlight out after 1.4s (card's CSS transition handles the visual fade)
    const t = setTimeout(() => setHighlightedId(null), 1400);
    return () => clearTimeout(t);
  }, [fixtures]);

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
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-12 w-full flex flex-col gap-4">

        {/* ── Hero banner ──────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)" }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 70% 80% at 10% 50%, rgba(255,255,255,0.06), transparent)" }}
          />
          <div className="relative px-5 py-5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">⚽</span>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.15)", color: "#bbf7d0" }}
                >
                  {competition.status === "active" ? "Live" : competition.status} · {openCount > 0 ? `${openCount} open` : "Predictions open"}
                </span>
              </div>
              <h1 className="text-white text-xl font-extrabold leading-tight">
                {competition.name}
              </h1>
              <p className="text-green-200 text-xs mt-0.5 opacity-80">
                Predict every match · earn points · win the Watch
              </p>
            </div>
            <span className="text-4xl shrink-0 select-none">🏆</span>
          </div>
        </div>

        {/* ── Sign-in nudge ────────────────────────────────── */}
        {!user && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-4 rounded-xl border"
            style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}
          >
            <div>
              <p className="text-green-900 text-sm font-semibold">Sign in to start predicting</p>
              <p className="text-green-700 text-xs mt-0.5">Free to play — predict every match</p>
            </div>
            <Link
              href="/login"
              className="shrink-0 text-sm font-bold px-5 py-2.5 rounded-lg transition-colors"
              style={{ background: "#16a34a", color: "#fff", minHeight: 44 + "px", display: "flex", alignItems: "center" }}
            >
              Sign in →
            </Link>
          </div>
        )}

        {/* ── Getting Started onboarding panel ─────────────── */}
        {user && (
          <GettingStarted
            userId={user.id}
            predictions={myStats?.predictions ?? 0}
            bonusAnswered={myStats?.bonusAnswered ?? 0}
            bonusTotal={myStats?.bonusTotal ?? 0}
          />
        )}

        {/* ── My stats ─────────────────────────────────────── */}
        {user && myStats && myStats.predictions > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatChip label="Pts"   value={Number(myStats.totalPoints)} color="#16a34a" />
              <StatChip label="Rank"  value={`#${myStats.globalRank}`}    color="#d97706" />
              <StatChip label="Match" value={Number(myStats.matchPoints)} color="#2563eb" />
              <StatChip label="Bonus" value={`+${myStats.bonusPoints}`}   color="#d97706" />
              <StatChip label="Exact" value={Number(myStats.exactScores)} color="#dc2626" />
            </div>
            <div
              className="flex items-center gap-4 px-4 py-2.5 rounded-lg flex-wrap"
              style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold"
                  style={{ color: myStats.predictions >= fixtures.length && fixtures.length > 0 ? "#16a34a" : "#64748b" }}>
                  {myStats.predictions}/{fixtures.length || 104}
                </span>
                <span className="text-[11px]" style={{ color: "#64748b" }}>match predictions</span>
              </div>
              {myStats.bonusTotal > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold"
                    style={{ color: myStats.bonusAnswered >= myStats.bonusTotal ? "#16a34a" : "#64748b" }}>
                    {myStats.bonusAnswered}/{myStats.bonusTotal}
                  </span>
                  <span className="text-[11px]" style={{ color: "#64748b" }}>bonus questions</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Large action cards ───────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Make Predictions */}
          <Link
            href="#fixture-list"
            onClick={() => document.getElementById("fixture-list")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex flex-col gap-2 p-4 rounded-xl border transition-all hover:shadow-md active:scale-[0.98]"
            style={{ background: "#16a34a", borderColor: "#15803d" }}
          >
            <span className="text-2xl">⚽</span>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Make Predictions</p>
              <p className="text-green-100 text-[11px] mt-0.5 opacity-90">Pick your scores</p>
            </div>
          </Link>

          {/* Leagues */}
          <Link
            href="/predict/leagues"
            className="flex flex-col gap-2 p-4 rounded-xl border transition-all hover:shadow-md active:scale-[0.98]"
            style={{ background: "#1e40af", borderColor: "#1d4ed8" }}
          >
            <span className="text-2xl">👥</span>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Leagues</p>
              <p className="text-blue-100 text-[11px] mt-0.5 opacity-90">Create or join</p>
            </div>
          </Link>

          {/* Bonus Questions */}
          <Link
            href="/predict/bonus"
            className="flex flex-col gap-2 p-4 rounded-xl border transition-all hover:shadow-md active:scale-[0.98]"
            style={{ background: "#92400e", borderColor: "#b45309" }}
          >
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Bonus Questions</p>
              <p className="text-amber-100 text-[11px] mt-0.5 opacity-90">Up to 75 extra pts</p>
            </div>
          </Link>

          {/* Leaderboard */}
          <Link
            href="/predict/leaderboard"
            className="flex flex-col gap-2 p-4 rounded-xl border transition-all hover:shadow-md active:scale-[0.98]"
            style={{ background: "#4c1d95", borderColor: "#6d28d9" }}
          >
            <span className="text-2xl">📈</span>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Leaderboard</p>
              <p className="text-purple-100 text-[11px] mt-0.5 opacity-90">Global ranking</p>
            </div>
          </Link>
        </div>

        {/* ── Discover public leagues ───────────────────────── */}
        <Link
          href="/predict/leagues/discover"
          className="flex items-center gap-3 px-4 py-4 rounded-xl border transition-all hover:shadow-md"
          style={{ background: "#fffbeb", borderColor: "#fde68a" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#fef3c7" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-none" style={{ color: "#78350f" }}>Discover Public Leagues</p>
            <p className="text-xs mt-1" style={{ color: "#92400e" }}>Browse featured &amp; open leagues — no invite needed</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>

        {/* ── Prize strip ──────────────────────────────────── */}
        <div
          className="flex items-center gap-4 px-4 py-4 rounded-xl border"
          style={{ background: "linear-gradient(135deg, #1c1400, #2d1f00)", borderColor: "#d97706a0" }}
        >
          <span className="text-3xl shrink-0">⌚</span>
          <div className="flex-1">
            <p className="text-white font-bold text-sm leading-tight">SB Champion Watch</p>
            <p className="text-amber-300 text-xs mt-0.5">Top the global leaderboard · win the grand prize</p>
          </div>
          <Link
            href="/predict/leaderboard"
            className="shrink-0 text-xs font-bold px-3 py-2 rounded-lg"
            style={{ background: "#d97706", color: "#fff" }}
          >
            See board
          </Link>
        </div>

        {/* ── Rules link ───────────────────────────────────── */}
        <Link
          href="/predict/rules"
          className="flex items-center justify-center gap-2 py-2 text-sm transition-colors"
          style={{ color: "#64748b" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Scoring rules &amp; FAQ
        </Link>

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div
          id="fixture-list"
          className="flex gap-1 rounded-xl p-1"
          style={{ background: "#e2e8f0" }}
        >
          {([
            { id: "all",     label: "All fixtures"                           },
            { id: "today",   label: `Today${todayCount > 0 ? ` (${todayCount})` : ""}` },
            { id: "results", label: "Results"                                },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{
                background: tab === t.id ? "#ffffff" : "transparent",
                color:      tab === t.id ? "#0f172a" : "#64748b",
                boxShadow:  tab === t.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Fixture list ─────────────────────────────────── */}
        {fixtures.length === 0 ? (
          <div className="py-10 px-4 text-center flex flex-col gap-2">
            <p className="text-sm" style={{ color: "#334155" }}>No fixtures in database.</p>
            <p className="text-xs" style={{ color: "#64748b" }}>
              Run <code className="font-mono" style={{ color: "#16a34a" }}>wc2026-fixtures.sql</code> in the Supabase SQL Editor to seed all 104 fixtures.
            </p>
          </div>
        ) : groups.size === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: "#64748b" }}>
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
                    style={{ color: isToday(dayFixtures[0].kicksOffAt) ? "#16a34a" : "#94a3b8" }}
                  >
                    {isToday(dayFixtures[0].kicksOffAt) ? "Today · " : ""}{dateLabel}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "#e2e8f0" }} />
                  <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
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
                      highlighted={fixture.id === highlightedId}
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
