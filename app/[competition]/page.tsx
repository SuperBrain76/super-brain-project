"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { track } from "@/lib/analytics";
import FixtureCard from "@/components/predictor/FixtureCard";
import InlinePredictCard from "@/components/predictor/InlinePredictCard";
import PredictionProgress, { GroupBadge } from "@/components/predictor/PredictionProgress";
import { WhatsAppFirstPredictionBanner } from "@/components/WhatsAppChannelCard";
import GettingStarted from "@/components/predictor/GettingStarted";
import GroupStandings from "@/components/predictor/GroupStandings";
import {
  resolveCompetition,
  getFixtures,
  invalidateFixturesCache,
  getMyStats,
  isPredictionOpen,
  type Fixture,
  type Competition,
  type MyStats,
  formatKickoff,
  stageLabel,
} from "@/lib/predictor";
import { getCompetitionSettings, FALLBACK_COMPETITION_SLUG } from "@/lib/competitionEngine";
import PremierLeagueHome from "@/components/premier/PremierLeagueHome";

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
  // Competition Engine V2: the competition is the first path segment
  // (/premier-league/...), not a hardcoded slug.
  const { competition: competitionSlug } = useParams<{ competition: string }>();
  const { user, loading: authLoading } = useAuth();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [fixtures,    setFixtures]    = useState<Fixture[]>([]);
  const [myStats,     setMyStats]     = useState<MyStats | null>(null);
  const [fetching,    setFetching]    = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  // Competition Engine V2: which home screen? Resolved from the competition's
  // home_style setting. 'matchweek' → the living dashboard (Premier League);
  // anything else → the classic hub below (WC, unchanged).
  const [homeStyle,   setHomeStyle]   = useState<"classic" | "matchweek" | null>(null);
  const [tab,           setTab]           = useState<Tab>("all");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showWaBanner,  setShowWaBanner]  = useState(false);

  // Track prize card impression on page load
  useEffect(() => { track.grandPrizeCardViewed("predict_hub"); }, []);

  useEffect(() => {
    async function load() {
      setFetching(true);
      setLoadError(null);

      // Step 1: load competition
      const { competition: comp, error: compErr } = await resolveCompetition(competitionSlug);
      if (compErr) { setLoadError(compErr); setFetching(false); return; }
      if (!comp)   { setLoadError('Competition not found. Check that it exists in the competitions table and that one competition has is_default set in competition_settings.'); setFetching(false); return; }
      setCompetition(comp);

      // Step 1b: which home style? Delegates to the matchweek dashboard below
      // if configured, and skips the classic fixture load entirely.
      const settings = await getCompetitionSettings(comp.id);
      setHomeStyle(settings.homeStyle);
      if (settings.homeStyle === "matchweek") { setFetching(false); return; }

      // Step 2: classic hub — load all fixtures
      const { fixtures: fx, error: fxErr } = await getFixtures(comp.id);
      if (fxErr) { setLoadError(fxErr); setFetching(false); return; }
      setFixtures(fx);
      setFetching(false);
    }
    load();
  }, [competitionSlug]);

  // Poll for live score updates every 15 seconds during WC2026
  useEffect(() => {
    if (!competition) return;
    const interval = setInterval(async () => {
      invalidateFixturesCache(competition.id);
      const { fixtures: fx } = await getFixtures(competition.id);
      if (fx.length > 0) setFixtures(fx);
    }, 15_000);
    return () => clearInterval(interval);
  }, [competition]);

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

  // ── Prediction progress (open fixtures only) ──────────────
  // Derived from already-fetched fixtures — zero extra DB calls.
  const { openTotal, openPredicted } = useMemo(() => {
    const open = fixtures.filter(
      (f) => f.status === "scheduled" && new Date(f.kicksOffAt) > new Date()
    );
    return {
      openTotal:     open.length,
      openPredicted: open.filter((f) => !!f.myPrediction).length,
    };
  }, [fixtures]);

  // ── Per-date group progress (for GroupBadge on headers) ───
  const groupProgress = useMemo(() => {
    const map = new Map<string, { predicted: number; total: number }>();
    for (const [dateKey, dayFixtures] of Array.from(groups.entries())) {
      const open = dayFixtures.filter(
        (f) => f.status === "scheduled" && new Date(f.kicksOffAt) > new Date()
      );
      if (open.length === 0) continue; // skip past/completed date groups
      map.set(dateKey, {
        total:     open.length,
        predicted: open.filter((f) => !!f.myPrediction).length,
      });
    }
    return map;
  }, [groups]);

  // ── Inline prediction save handler ───────────────────────
  // Updates the fixture's myPrediction in local state so PickStrip renders
  // immediately without a refetch, and increments the stats counter.
  const handlePredictionSaved = useCallback((fixtureId: string, home: number, away: number) => {
    const wasNew = !fixtures.find((f) => f.id === fixtureId)?.myPrediction;

    setFixtures((prev) => {
      const updated = prev.map((f) =>
        f.id !== fixtureId ? f : {
          ...f,
          myPrediction: {
            homeScore:     home,
            awayScore:     away,
            pointsAwarded: null,
          },
        }
      );

      // Check if all open fixtures are now predicted (for milestone event)
      const openFixtures  = updated.filter(
        (f) => f.status === "scheduled" && new Date(f.kicksOffAt) > new Date()
      );
      const nowAllDone = openFixtures.length > 0 &&
        openFixtures.every((f) => f.id === fixtureId || !!f.myPrediction);
      if (nowAllDone) {
        track.allGroupMatchesPredicted(openFixtures.length);
      }

      return updated;
    });

    // Fire analytics events
    if (wasNew) {
      track.firstPredictionSaved(fixtureId);
      // Show WhatsApp channel banner once per session on first ever save
      try {
        const dismissed = sessionStorage.getItem("waBannerDismissed");
        if (!dismissed) setShowWaBanner(true);
      } catch { /* private mode */ }
    }
    track.predictionSaved(fixtureId, !wasNew);

    // Increment predictions count in myStats if this was a new prediction
    setMyStats((prev) => {
      if (!prev) return prev;
      return wasNew ? { ...prev, predictions: prev.predictions + 1 } : prev;
    });
  }, [fixtures]);

  const todayCount = fixtures.filter((f) => isToday(f.kicksOffAt)).length;
  const openCount  = fixtures.filter((f) => {
    return f.status === "scheduled" && new Date(f.kicksOffAt) > new Date();
  }).length;

  if (fetching || authLoading) {
    return (
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-12 flex flex-col gap-4">
        {/* Skeleton: stat strip */}
        <div className="flex gap-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="h-14 flex-1 rounded-lg animate-pulse" style={{ background: "#dde5d8" }} />
          ))}
        </div>
        {/* Skeleton: fixture cards */}
        {[1,2,3].map((i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#dde5d8" }} />
        ))}
      </div>
    );
  }

  // ── Matchweek dashboard (Premier League) ─────────────────────
  // Delegated home for competitions with home_style = 'matchweek'. The
  // classic WC hub below is untouched.
  if (homeStyle === "matchweek" && competition) {
    return <PremierLeagueHome competition={competition} />;
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
            <p className="text-xs" style={{ color: "#64748b" }}>3. A competition exists with teams and fixtures seeded, and one competition has is_default set in competition_settings</p>
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
                2026 · Predictor
              </span>
            </div>

            {/* Title row — headline + CTA side by side */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-white font-extrabold leading-tight" style={{ fontSize: "1.25rem" }}>
                  Predict Every Match.<br />Win The Watch.
                </h1>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                  2026 Championship
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
            href={`/${competitionSlug}/leagues`}
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
            href={`/${competitionSlug}/bonus`}
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
            href={`/${competitionSlug}/leaderboard`}
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

        {/* ── Group Overview banner (full width) ───────────── */}
        <Link
          href={`/${competitionSlug}/standings`}
          className="w-full rounded-xl border overflow-hidden transition-all active:scale-[0.99] flex flex-col"
          style={{ background: "#fff", borderColor: "#dde5d8", textDecoration: "none" }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "#1a3a2a" }}>
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b8972a" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              <span className="font-bold text-sm text-white">Group Overview</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide" style={{ background: "#b8972a", color: "#fff" }}>Live</span>
            </div>
            <span className="text-xs font-semibold" style={{ color: "#b8972a" }}>All 12 groups →</span>
          </div>

          {/* Mini preview of 2 groups side by side */}
          <div className="grid grid-cols-2 divide-x" style={{ borderColor: "#dde5d8" }}>
            {(["A", "B"] as const).map((grp) => {
              const grpFixtures = fixtures.filter((f) => f.groupName === grp && f.stage === "group");
              const teamMap = new Map<string, { name: string; flag: string; pts: number; played: number }>();
              for (const f of grpFixtures) {
                for (const t of [f.homeTeam, f.awayTeam]) {
                  if (!t) continue;
                  if (!teamMap.has(t.code)) teamMap.set(t.code, { name: t.name, flag: t.flagEmoji ?? "", pts: 0, played: 0 });
                }
                if (f.status === "completed" && f.homeScore !== null && f.awayScore !== null && f.homeTeam && f.awayTeam) {
                  const h = teamMap.get(f.homeTeam.code)!;
                  const a = teamMap.get(f.awayTeam.code)!;
                  h.played++; a.played++;
                  if (f.homeScore > f.awayScore) { h.pts += 3; }
                  else if (f.homeScore < f.awayScore) { a.pts += 3; }
                  else { h.pts++; a.pts++; }
                  teamMap.set(f.homeTeam.code, h);
                  teamMap.set(f.awayTeam.code, a);
                }
              }
              const rows = [...teamMap.values()].sort((a, b) => b.pts - a.pts);
              return (
                <div key={grp} className="px-3 py-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#7a8f82" }}>Group {grp}</p>
                  <div className="flex flex-col gap-1">
                    {rows.map((r, i) => (
                      <div key={r.name} className="flex items-center gap-1.5">
                        <span className="text-[9px] w-3 text-right shrink-0" style={{ color: i < 2 ? "#b8972a" : "#c4d4c8", fontWeight: i < 2 ? 700 : 400 }}>{i + 1}</span>
                        <span className="text-[11px]">{r.flag}</span>
                        <span className="text-[10px] flex-1 truncate" style={{ color: "#0f1f17" }}>{r.name}</span>
                        <span className="text-[10px] font-bold w-4 text-right" style={{ color: "#b8972a" }}>{r.pts}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 flex items-center gap-1.5" style={{ borderTop: `1px solid #dde5d8`, background: "#f8f5f0" }}>
            <span className="text-[10px]" style={{ color: "#7a8f82" }}>Tap to see all 12 group tables</span>
          </div>
        </Link>

        {/* ── Discover public leagues ───────────────────────── */}
        <Link
          href={`/${competitionSlug}/leagues/discover`}
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

        {/* ── Prize card — World-Cup-only; hidden for venue/other leagues ── */}
        {competitionSlug === FALLBACK_COMPETITION_SLUG && (
        <Link
          href={`/${competitionSlug}/prize`}
          onClick={() => { track.grandPrizeCardClicked("predict_hub"); track.grandPrizeDetailsViewed("predict_hub"); }}
          className="flex items-center gap-0 rounded-xl border overflow-hidden relative transition-all active:scale-[0.99]"
          style={{ background: "#fff", borderColor: "rgba(184,151,42,0.4)", textDecoration: "none" }}
        >
          {/* Gold top accent */}
          <div className="absolute top-0 left-0 right-0 h-0.5 z-10" style={{ background: "linear-gradient(90deg, #b8972a 60%, transparent)" }} />

          {/* Watch image panel */}
          <div
            className="w-24 h-24 shrink-0 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #f5f0e8 0%, #efe8d5 100%)" }}
          >
            <Image
              src="/watch-prize.png"
              alt="Grand Prize Watch"
              fill
              className="object-contain p-1.5"
            />
          </div>

          {/* Text body */}
          <div className="flex-1 px-4 py-3 flex flex-col gap-1 min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#b8972a" }}>Grand Prize</span>
            <p className="font-extrabold text-sm leading-tight" style={{ color: "#0f1f17" }}>Custom Champion Watch</p>
            <p className="text-[11px] leading-snug" style={{ color: "#7a8f82" }}>
              Top the global leaderboard to win the engraved champion watch.
            </p>
          </div>

          {/* CTA arrow */}
          <div className="px-4 flex items-center shrink-0">
            <span
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
              style={{ background: "#b8972a", color: "#fff" }}
            >
              View Prize
            </span>
          </div>
        </Link>
        )}

        {/* ── Rules link + bracket path + lock notice ──────── */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-4">
            <Link
              href={`/${competitionSlug}/rules`}
              className="flex items-center gap-2 py-1 text-sm transition-colors"
              style={{ color: "#7a8f82" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Scoring rules
            </Link>
            <span style={{ color: "#c4d4c8" }}>·</span>
            <Link
              href={`/${competitionSlug}/bracket`}
              className="flex items-center gap-2 py-1 text-sm transition-colors"
              style={{ color: "#7a8f82" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="16 3 21 3 21 8"/>
                <line x1="4" y1="20" x2="21" y2="3"/>
                <polyline points="21 16 21 21 16 21"/>
                <line x1="15" y1="15" x2="21" y2="21"/>
              </svg>
              Knockout path
            </Link>
          </div>
          <p className="text-[10px] text-center" style={{ color: "#9eada5" }}>
            🔒 Each match locks at kickoff — the tournament does not lock all at once.
          </p>
        </div>

        {/* ── WhatsApp first-prediction banner ─────────────── */}
        {showWaBanner && (
          <WhatsAppFirstPredictionBanner
            onDismiss={() => {
              setShowWaBanner(false);
              try { sessionStorage.setItem("waBannerDismissed", "1"); } catch { /* ignore */ }
            }}
          />
        )}

        {/* ── Prediction progress bar ──────────────────────── */}
        {user && openTotal > 0 && (
          <PredictionProgress
            predicted={openPredicted}
            total={openTotal}
          />
        )}

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
              Import this competition&apos;s fixtures from the admin panel, or seed them in the Supabase SQL Editor.
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
                    className="text-xs font-bold uppercase tracking-widest shrink-0"
                    style={{ color: isToday(dayFixtures[0].kicksOffAt) ? "#16a34a" : "#94a3b8" }}
                  >
                    {isToday(dayFixtures[0].kicksOffAt) ? "Today · " : ""}{dateLabel}
                  </span>
                  {/* Group progress badge — only for logged-in users on future date groups */}
                  {user && groupProgress.has(dateLabel) && (
                    <GroupBadge
                      predicted={groupProgress.get(dateLabel)!.predicted}
                      total={groupProgress.get(dateLabel)!.total}
                    />
                  )}
                  <div className="flex-1 h-px" style={{ background: "#e2e8f0" }} />
                  <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
                    {dayFixtures.length} match{dayFixtures.length === 1 ? "" : "es"}
                  </span>
                </div>

                {/* Fixtures */}
                <div className="flex flex-col gap-2">
                  {dayFixtures.map((fixture) => {
                    const open = isPredictionOpen(fixture);
                    // Open fixtures: inline steppers (or sign-in nudge if not authed)
                    if (open) {
                      return (
                        <InlinePredictCard
                          key={fixture.id}
                          fixture={fixture}
                          showPrediction={!!user}
                          highlighted={fixture.id === highlightedId}
                          onSaved={handlePredictionSaved}
                        />
                      );
                    }
                    return (
                      <FixtureCard
                        key={fixture.id}
                        fixture={fixture}
                        showPrediction={!!user}
                        highlighted={fixture.id === highlightedId}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Group Standings ──────────────────────────────── */}
        {fixtures.some((f) => f.stage === "group") && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#1a3a2a" }}>
                Group Overview
              </h2>
              <Link href={`/${competitionSlug}/standings`} className="text-xs font-semibold" style={{ color: "#b8972a" }}>
                Full tables →
              </Link>
            </div>
            <GroupStandings fixtures={fixtures} />
          </div>
        )}
      </div>
    </div>
  );
}
