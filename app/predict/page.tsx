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
        <p className="text-sm animate-pulse" style={{ color: "#7a8f82" }}>Loading predictor…</p>
      </div>
    );
  }

  // ── Error state — show exactly what failed ───────────────────
  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-12">
        <div className="w-full max-w-md rounded-xl p-5 flex flex-col gap-3"
          style={{ background: "#fff", border: "1px solid #fca5a5" }}>
          <p className="text-red-600 text-sm font-semibold">Failed to load predictor</p>
          <p className="text-xs font-mono leading-relaxed break-all" style={{ color: "#64748b" }}>{loadError}</p>
          <div className="pt-3 flex flex-col gap-1" style={{ borderTop: "1px solid #dde5d8" }}>
            <p className="text-xs font-semibold" style={{ color: "#334155" }}>Checklist:</p>
            <p className="text-xs" style={{ color: "#64748b" }}>1. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local</p>
            <p className="text-xs" style={{ color: "#64748b" }}>2. predictor-schema.sql has been run in Supabase SQL Editor</p>
            <p className="text-xs" style={{ color: "#64748b" }}>3. wc2026-fixtures.sql has been run (seeds 48 teams + 104 fixtures)</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-semibold py-2 px-4 rounded-lg self-start"
            style={{ background: "#f0f3ef", border: "1px solid #dde5d8", color: "#1a3a2a" }}
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
        <p className="text-sm" style={{ color: "#7a8f82" }}>Competition not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-12 w-full flex flex-col gap-4">

        {/* ── Hero banner ──────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden relative"
          style={{ background: "#1a3a2a" }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 60% 120% at 90% 50%, rgba(184,151,42,0.08), transparent)" }}
          />
          <div className="relative px-5 py-4">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#4ade80" }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "#b8972a" }}
              >
                FIFA World Cup 2026 · Predictor
              </span>
            </div>

            {/* Title row — headline + CTA side by side */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-white font-extrabold leading-tight" style={{ fontSize: "1.25rem" }}>
                  Predict Every Match.<br />Win The Watch.
                </h1>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                  FIFA World Cup 2026 Championship
                </p>
              </div>
              <a
                href="#fixture-list"
                onClick={(e) => { e.preventDefault(); document.getElementById("fixture-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className="shrink-0 font-bold text-sm px-4 py-2.5 rounded-lg whitespace-nowrap"
                style={{ background: "#b8972a", color: "#1a3a2a" }}
              >
                ⚽ Predict Now
              </a>
            </div>

            {/* Stats strip */}
            <div
              className="flex mt-4 pt-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.09)" }}
            >
              {[
                { val: "104", label: "Matches" },
                { val: "48",  label: "Teams"   },
                { val: "7",   label: "Bonus Qs" },
                { val: "Free", label: "Always", gold: true },
              ].map((s) => (
                <div key={s.label} className="flex-1 flex flex-col gap-0.5 [&+&]:border-l [&+&]:pl-3 [&+&]:ml-3" style={{ borderLeftColor: "rgba(255,255,255,0.09)" }}>
                  <span className="text-lg font-extrabold leading-none font-variant-numeric" style={{ color: s.gold ? "#b8972a" : "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px" }}>{s.val}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.38)" }}>{s.label}</span>
                </div>
              ))}
            </div>
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
          <div
            className="rounded-xl border"
            style={{ background: "#fff", borderColor: "#dde5d8" }}
          >
            {/* Stat chips row */}
            <div className="flex items-center divide-x divide-[#dde5d8]" style={{ borderBottomColor: "#dde5d8", borderBottomWidth: 1 }}>
              {[
                { label: "Points",    value: String(Number(myStats.totalPoints)), color: "#1a3a2a" },
                { label: "Rank",      value: `#${myStats.globalRank}`,            color: "#b8972a" },
                { label: "Predicted", value: String(Number(myStats.predictions)), color: "#0e1e35" },
                { label: "Exact",     value: String(Number(myStats.exactScores)), color: "#1a3a2a" },
                { label: "Bonus",     value: `+${myStats.bonusPoints}`,           color: "#b8972a" },
              ].map((s) => (
                <div key={s.label} className="flex-1 flex flex-col items-center py-3 gap-0.5" style={{ borderRightColor: "#dde5d8" }}>
                  <span className="font-extrabold text-lg leading-none" style={{ color: s.color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px" }}>{s.value}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "#7a8f82" }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Completion tracker — matches + bonus combined */}
            {(() => {
              const matchTotal  = fixtures.length || 104;
              const bonusTotal  = myStats.bonusTotal || 7;
              const grandTotal  = matchTotal + bonusTotal;
              const done        = myStats.predictions + myStats.bonusAnswered;
              const pct         = Math.round((done / grandTotal) * 100);
              const complete    = done >= grandTotal;
              return (
                <div className="px-4 py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between flex-wrap gap-x-2">
                    <span className="text-xs font-semibold" style={{ color: "#2e4a37" }}>
                      {pct}% Complete
                    </span>
                    <span className="text-[10px]" style={{ color: "#7a8f82" }}>
                      {myStats.predictions}/{matchTotal} Matches · {myStats.bonusAnswered}/{bonusTotal} Bonus
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#e8ede6" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: complete ? "#b8972a" : "#1a3a2a" }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Large action cards ───────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          {/* Make Predictions */}
          <Link
            href="#fixture-list"
            onClick={() => document.getElementById("fixture-list")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex flex-col gap-3 p-4 rounded-xl border transition-all hover:border-[#1a3a2a] active:scale-[0.98]"
            style={{ background: "#fff", borderColor: "#dde5d8", borderLeft: "3px solid #1a3a2a" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#eef3ec" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 7l2.5 3-1 3.5h-3L9 10l3-3z"/>
                <path d="M9 10l-3.5 1.5M15 10l3.5 1.5M10.5 13.5L9 17.5M13.5 13.5L15 17.5"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: "#0f1f17" }}>Make Predictions</p>
              <p className="text-[11px] mt-1" style={{ color: "#7a8f82" }}>
                {myStats ? `${myStats.predictions} / ${fixtures.length || 104} predicted` : "Pick your scores"}
              </p>
              {myStats && (
                <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "#e8ede6" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round((myStats.predictions / (fixtures.length || 104)) * 100)}%`, background: "#1a3a2a" }}
                  />
                </div>
              )}
            </div>
          </Link>

          {/* Leagues */}
          <Link
            href="/predict/leagues"
            className="flex flex-col gap-3 p-4 rounded-xl border transition-all hover:border-[#1a3a2a] active:scale-[0.98]"
            style={{ background: "#fff", borderColor: "#dde5d8" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#eef3ec" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: "#0f1f17" }}>My Leagues</p>
              <p className="text-[11px] mt-1" style={{ color: "#7a8f82" }}>Create or join</p>
            </div>
          </Link>

          {/* Bonus Questions */}
          <Link
            href="/predict/bonus"
            className="flex flex-col gap-3 p-4 rounded-xl border transition-all active:scale-[0.98]"
            style={{ background: "#fff", borderColor: "#dde5d8" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#fdf6e3" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b8972a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: "#0f1f17" }}>Bonus Questions</p>
              <p className="text-[11px] mt-1" style={{ color: "#7a8f82" }}>
                {myStats ? `${myStats.bonusAnswered} / ${myStats.bonusTotal || 7} answered` : "Up to 75 extra pts"}
              </p>
              {myStats && myStats.bonusTotal > 0 && (
                <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "#f0e8cc" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round((myStats.bonusAnswered / myStats.bonusTotal) * 100)}%`, background: "#b8972a" }}
                  />
                </div>
              )}
            </div>
          </Link>

          {/* Global Rankings */}
          <Link
            href="/predict/leaderboard"
            className="flex flex-col gap-3 p-4 rounded-xl border transition-all active:scale-[0.98]"
            style={{ background: "#fff", borderColor: "#dde5d8" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#edf0f5" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0e1e35" strokeWidth="1.8" strokeLinecap="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6"  y1="20" x2="6"  y2="14"/>
                <line x1="3"  y1="20" x2="21" y2="20"/>
              </svg>
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: "#0f1f17" }}>Global Rankings</p>
              <p className="text-[11px] mt-1" style={{ color: "#7a8f82" }}>
                {myStats ? `You're ranked #${myStats.globalRank}` : "See where you stand"}
              </p>
            </div>
          </Link>
        </div>

        {/* ── Discover public leagues ───────────────────────── */}
        <Link
          href="/predict/leagues/discover"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
          style={{ background: "#fff", borderColor: "#dde5d8" }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#eef3ec" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: "#0f1f17" }}>Discover Public Leagues</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#7a8f82" }}>Browse featured &amp; open leagues</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7a8f82" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </Link>

        {/* ── Prize banner ─────────────────────────────────── */}
        <div
          className="flex items-stretch rounded-xl border overflow-hidden relative"
          style={{ background: "#fff", borderColor: "rgba(184,151,42,0.3)" }}
        >
          {/* Gold top accent */}
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, #b8972a 40%, transparent)" }} />

          {/* Watch illustration panel */}
          <div
            className="w-20 shrink-0 flex items-center justify-center"
            style={{ background: "linear-gradient(160deg, #1a3a2a 0%, #0e1e35 100%)" }}
          >
            <svg width="48" height="48" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="19" y="2" width="16" height="10" rx="3" fill="#8a7020"/>
              <rect x="19" y="42" width="16" height="10" rx="3" fill="#8a7020"/>
              <rect x="10" y="11" width="34" height="32" rx="7" fill="#c9a84c"/>
              <rect x="13" y="14" width="28" height="26" rx="5" fill="#1a3a2a"/>
              <circle cx="27" cy="27" r="10" fill="#0e1e35"/>
              <rect x="26.5" y="18" width="1" height="2.5" rx="0.5" fill="#b8972a"/>
              <rect x="26.5" y="33.5" width="1" height="2.5" rx="0.5" fill="#b8972a"/>
              <rect x="18" y="26.5" width="2.5" height="1" rx="0.5" fill="#b8972a"/>
              <rect x="33.5" y="26.5" width="2.5" height="1" rx="0.5" fill="#b8972a"/>
              <line x1="27" y1="27" x2="27" y2="21.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="27" y1="27" x2="31" y2="24" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
              <circle cx="27" cy="27" r="1.2" fill="#b8972a"/>
              <rect x="43" y="25.5" width="3" height="3" rx="1" fill="#c9a84c"/>
              <circle cx="14" cy="15" r="1" fill="#9a7a22"/><circle cx="40" cy="15" r="1" fill="#9a7a22"/>
              <circle cx="14" cy="39" r="1" fill="#9a7a22"/><circle cx="40" cy="39" r="1" fill="#9a7a22"/>
            </svg>
          </div>

          {/* Text body */}
          <div className="flex-1 px-4 py-3 flex flex-col justify-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#b8972a" }}>Grand Prize</span>
            <p className="font-extrabold text-sm leading-tight" style={{ color: "#0f1f17" }}>SB Championship Watch</p>
            <p className="text-[11px] leading-snug" style={{ color: "#7a8f82" }}>
              Top the global leaderboard when the final whistle blows.
            </p>
            <Link
              href="/predict/leaderboard"
              className="self-start mt-1 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg"
              style={{ background: "#1a3a2a", color: "#fff" }}
            >
              View Rankings
            </Link>
          </div>
        </div>

        {/* ── Rules link + lock notice ──────────────────────── */}
        <div className="flex flex-col items-center gap-1">
          <Link
            href="/predict/rules"
            className="flex items-center gap-2 py-1 text-sm transition-colors"
            style={{ color: "#7a8f82" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Scoring rules &amp; FAQ
          </Link>
          <p className="text-[10px] text-center" style={{ color: "#9eada5" }}>
            🔒 Each match locks at kickoff — the tournament does not lock all at once.
          </p>
        </div>

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
