"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { nameToFlag } from "@/lib/countries";
import {
  getCompetition,
  getPredictorLeaderboard,
  getMyStats,
  type Competition,
  type LeaderboardRow,
  type MyStats,
} from "@/lib/predictor";

// ── Stat chip ─────────────────────────────────────────────────

function StatChip({
  label,
  value,
  color = "#00d4ff",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-2.5 bg-cockpit-card border border-cockpit-border rounded-sm min-w-[72px]">
      <span className="text-lg font-black number-display leading-none" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] text-cockpit-muted uppercase tracking-widest mt-0.5">{label}</span>
    </div>
  );
}

// ── Rank badge ────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-sm text-xs font-black"
      style={{ color: "#ffab00", background: "#ffab0018" }}>1</span>
  );
  if (rank === 2) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-sm text-xs font-black"
      style={{ color: "#a8b8cc", background: "#a8b8cc15" }}>2</span>
  );
  if (rank === 3) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-sm text-xs font-black"
      style={{ color: "#cd7c32", background: "#cd7c3215" }}>3</span>
  );
  return (
    <span className="w-7 h-7 flex items-center justify-center text-xs font-mono text-cockpit-muted">
      {rank}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function PredictorLeaderboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [rows,        setRows]        = useState<LeaderboardRow[]>([]);
  const [myStats,     setMyStats]     = useState<MyStats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { competition: comp, error: compErr } = await getCompetition("wc2026");
      if (compErr || !comp) {
        setError(compErr ?? "Competition not found.");
        setLoading(false);
        return;
      }
      setCompetition(comp);

      const leaderboard = await getPredictorLeaderboard(comp.id);
      setRows(leaderboard);
      setLoading(false);
    }
    if (!authLoading) load();
  }, [authLoading]);

  // Load user stats separately
  useEffect(() => {
    if (!user || !competition) return;
    getMyStats(competition.id).then(setMyStats);
  }, [user, competition]);

  // ── Loading ──────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading leaderboard…</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-cockpit-red text-sm">{error}</p>
        <Link href="/predict" className="text-cockpit-accent text-sm hover:underline">← Back</Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        {/* ── Header ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 text-xs text-cockpit-muted font-mono mb-3">
            <Link href="/predict" className="hover:text-cockpit-dim transition-colors">Predictor</Link>
            <span>/</span>
            <span className="text-cockpit-dim">Leaderboard</span>
          </div>
          <h1 className="text-xl font-bold text-white">SuperBrain World Cup Championship</h1>
          <p className="text-cockpit-dim text-sm mt-1">
            {competition?.name ?? "World Cup 2026"} · {rows.length} {rows.length === 1 ? "predictor" : "predictors"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cockpit-green shrink-0" />
            <p className="text-cockpit-muted text-xs">
              All players are automatically entered into the SuperBrain World Cup Championship — no league required.
            </p>
          </div>
        </div>

        {/* ── My stats strip ─────────────────────────────── */}
        {user && myStats && myStats.predictions > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-cockpit-muted text-[10px] font-mono uppercase tracking-widest">Your stats</p>
            <div className="flex items-center gap-2 flex-wrap">
              <StatChip label="Total"  value={myStats.totalPoints}      color="#00d4ff" />
              <StatChip label="Rank"   value={`#${myStats.globalRank}`}  color="#ffab00" />
              <StatChip label="Match"  value={myStats.matchPoints}       color="#00e676" />
              {myStats.bonusPoints > 0 && (
                <StatChip label="Bonus" value={`+${myStats.bonusPoints}`} color="#ffab00" />
              )}
              <StatChip label="Exact"  value={myStats.exactScores}       color="#ff6d00" />
            </div>
          </div>
        )}

        {/* ── Sign-in nudge (guest) ───────────────────────── */}
        {!user && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-sm border border-cockpit-accent border-opacity-30 bg-cockpit-accent bg-opacity-5">
            <p className="text-cockpit-dim text-sm">
              Sign in to predict and appear on the leaderboard.
            </p>
            <Link href="/login" className="btn-primary text-sm py-2 px-4 shrink-0">
              Sign in
            </Link>
          </div>
        )}

        {/* ── Leaderboard table ───────────────────────────── */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">

          {/* Column headers */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-cockpit-border bg-cockpit-surface">
            <div className="w-7 shrink-0" />
            <span className="flex-1 text-[10px] text-cockpit-muted uppercase tracking-widest font-mono">Player</span>
            <span className="w-12 text-right text-[10px] text-cockpit-muted uppercase tracking-widest font-mono hidden sm:block">Match</span>
            <span className="w-12 text-right text-[10px] text-cockpit-amber uppercase tracking-widest font-mono hidden sm:block">Bonus</span>
            <span className="w-12 text-right text-[10px] text-cockpit-accent uppercase tracking-widest font-mono">Total</span>
          </div>

          {/* Empty state */}
          {rows.length === 0 && (
            <div className="py-12 text-center flex flex-col gap-2">
              <p className="text-cockpit-dim text-sm">No results yet.</p>
              <p className="text-cockpit-muted text-xs">
                Points are awarded after match results are entered. Check back after the first match on June 11.
              </p>
              <Link href="/predict" className="text-cockpit-accent text-xs mt-2 hover:underline">
                Make your predictions →
              </Link>
            </div>
          )}

          {/* Rows */}
          {rows.map((row) => {
            const isMe = !!(user && row.displayName === (myStats ? row.displayName : null) &&
              row.totalPoints === myStats?.totalPoints &&
              row.rank === myStats?.globalRank);

            return (
              <div
                key={`${row.rank}-${row.displayName}`}
                className="flex items-center gap-2 px-3 py-3 border-b border-cockpit-border last:border-0 hover:bg-cockpit-surface transition-colors"
                style={{
                  background:   isMe ? "#00d4ff06" : undefined,
                  borderLeft:   isMe ? "2px solid #00d4ff40" : "2px solid transparent",
                }}
              >
                <RankBadge rank={row.rank} />

                {/* Player */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  {row.country && nameToFlag(row.country) && (
                    <span className="text-sm shrink-0">{nameToFlag(row.country)}</span>
                  )}
                  <span className="text-white text-sm font-medium truncate">
                    {row.displayName}
                  </span>
                  {isMe && (
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm shrink-0"
                      style={{ color: "#00d4ff", background: "#00d4ff15" }}>
                      YOU
                    </span>
                  )}
                </div>

                {/* Match pts */}
                <span
                  className="w-12 text-right text-xs font-mono tabular-nums hidden sm:block"
                  style={{ color: row.matchPoints > 0 ? "#a8b8cc" : "#8899aa" }}
                >
                  {row.matchPoints}
                </span>

                {/* Bonus pts */}
                <span
                  className="w-12 text-right text-xs font-mono tabular-nums hidden sm:block"
                  style={{ color: row.bonusPoints > 0 ? "#ffab00" : "#8899aa" }}
                >
                  {row.bonusPoints > 0 ? `+${row.bonusPoints}` : "—"}
                </span>

                {/* Total pts */}
                <span
                  className="w-12 text-right font-bold font-mono text-sm tabular-nums"
                  style={{ color: row.totalPoints > 0 ? "#00d4ff" : "#8899aa" }}
                >
                  {row.totalPoints}
                </span>

              </div>
            );
          })}
        </div>

        {/* Scoring key */}
        <p className="text-cockpit-muted text-[10px] text-center font-mono">
          5 pts exact score · 3 pts correct goal diff · 2 pts correct result
        </p>

        {/* CTA + back */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link href="/predict/leagues" className="text-cockpit-accent text-xs hover:underline font-mono">
            Create a private league →
          </Link>
          <Link href="/predict" className="text-cockpit-muted text-xs hover:text-cockpit-dim transition-colors font-mono">
            ← Back to predictor
          </Link>
        </div>
      </div>
    </div>
  );
}

