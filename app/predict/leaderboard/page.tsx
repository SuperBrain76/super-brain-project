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

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const NAVY   = "#0e1e35";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";
const BG     = "#f0f3ef";

// ── Rank badge ────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black"
      style={{ color: GOLD, background: `${GOLD}18` }}>1</span>
  );
  if (rank === 2) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black"
      style={{ color: "#8899aa", background: "#8899aa15" }}>2</span>
  );
  if (rank === 3) return (
    <span className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black"
      style={{ color: "#cd7c32", background: "#cd7c3215" }}>3</span>
  );
  return (
    <span className="w-7 h-7 flex items-center justify-center text-xs" style={{ color: MUTED }}>
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
      if (compErr || !comp) { setError(compErr ?? "Competition not found."); setLoading(false); return; }
      setCompetition(comp);
      const leaderboard = await getPredictorLeaderboard(comp.id);
      setRows(leaderboard);
      setLoading(false);
    }
    if (!authLoading) load();
  }, [authLoading]);

  useEffect(() => {
    if (!user || !competition) return;
    getMyStats(competition.id).then(setMyStats);
  }, [user, competition]);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm animate-pulse" style={{ color: MUTED }}>Loading rankings…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/predict" className="text-sm hover:underline" style={{ color: GREEN }}>← Back</Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
          <Link href="/predict" style={{ color: MUTED }} className="hover:underline">Predictor</Link>
          <span>/</span>
          <span style={{ color: TEXT2, fontWeight: 600 }}>Global Rankings</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: TEXT1 }}>Global Rankings</h1>
          <p className="text-sm mt-1" style={{ color: TEXT2 }}>
            {competition?.name ?? "World Cup 2026"} · {rows.length} {rows.length === 1 ? "predictor" : "predictors"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GREEN }} />
            <p className="text-xs" style={{ color: MUTED }}>
              All players are automatically entered — no league required.
            </p>
          </div>
        </div>

        {/* My stats strip */}
        {user && myStats && myStats.predictions > 0 && (
          <div className="rounded-xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center divide-x divide-[#dde5d8]"
              style={{ borderBottom: `1px solid ${BORDER}` }}>
              {[
                { label: "Points",    value: String(Number(myStats.totalPoints)), color: GREEN },
                { label: "Rank",      value: `#${myStats.globalRank}`,            color: GOLD  },
                { label: "Match",     value: String(Number(myStats.matchPoints)), color: NAVY  },
                { label: "Exact",     value: String(Number(myStats.exactScores)), color: GREEN },
                ...(myStats.bonusPoints > 0
                  ? [{ label: "Bonus", value: `+${myStats.bonusPoints}`, color: GOLD }]
                  : []),
              ].map((s) => (
                <div key={s.label} className="flex-1 flex flex-col items-center py-3 gap-0.5">
                  <span className="font-extrabold text-lg leading-none"
                    style={{ color: s.color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px" }}>
                    {s.value}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2">
              <p className="text-xs" style={{ color: MUTED }}>Your stats · {myStats.predictions} / {104} predictions made</p>
            </div>
          </div>
        )}

        {/* Sign-in nudge */}
        {!user && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border"
            style={{ background: "#eef3ec", borderColor: `${GREEN}30` }}
          >
            <p className="text-sm" style={{ color: TEXT2 }}>
              Sign in to predict and appear on the rankings.
            </p>
            <Link
              href="/login"
              className="font-bold text-sm py-2 px-4 rounded-lg shrink-0"
              style={{ background: GREEN, color: "#fff" }}
            >
              Sign in
            </Link>
          </div>
        )}

        {/* Leaderboard table */}
        <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>

          {/* Column headers */}
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
            <div className="w-7 shrink-0" />
            <span className="flex-1 text-[10px] uppercase tracking-widest font-semibold" style={{ color: MUTED }}>Player</span>
            <span className="w-12 text-right text-[10px] uppercase tracking-widest font-semibold hidden sm:block" style={{ color: MUTED }}>Match</span>
            <span className="w-12 text-right text-[10px] uppercase tracking-widest font-semibold hidden sm:block" style={{ color: GOLD }}>Bonus</span>
            <span className="w-12 text-right text-[10px] uppercase tracking-widest font-semibold" style={{ color: GREEN }}>Total</span>
          </div>

          {/* Empty state */}
          {rows.length === 0 && (
            <div className="py-12 text-center flex flex-col gap-2">
              <p className="text-sm" style={{ color: TEXT2 }}>No results yet.</p>
              <p className="text-xs" style={{ color: MUTED }}>
                Points are awarded after match results are entered. Check back after the first match.
              </p>
              <Link href="/predict" className="text-xs mt-2 hover:underline" style={{ color: GREEN }}>
                Make your predictions →
              </Link>
            </div>
          )}

          {/* Rows */}
          {rows.map((row) => {
            const isMe = !!(user && row.userId === user.id);
            return (
              <div
                key={`${row.rank}-${row.displayName}`}
                className="flex items-center gap-2 px-3 py-3 transition-colors"
                style={{
                  borderBottom:  `1px solid ${BORDER}`,
                  background:    isMe ? "#eef3ec" : undefined,
                  borderLeft:    isMe ? `3px solid ${GREEN}` : "3px solid transparent",
                }}
              >
                <RankBadge rank={row.rank} />

                {/* Player */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  {row.country && nameToFlag(row.country) && (
                    <span className="text-sm shrink-0">{nameToFlag(row.country)}</span>
                  )}
                  <span className="text-sm font-medium truncate" style={{ color: TEXT1 }}>
                    {row.displayName}
                  </span>
                  {isMe && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ color: GREEN, background: "#eef3ec", border: `1px solid ${GREEN}30` }}>
                      YOU
                    </span>
                  )}
                </div>

                {/* Match pts */}
                <span className="w-12 text-right text-xs tabular-nums hidden sm:block" style={{ color: TEXT2 }}>
                  {row.matchPoints > 0 ? row.matchPoints : <span style={{ color: MUTED }}>—</span>}
                </span>

                {/* Bonus pts */}
                <span className="w-12 text-right text-xs tabular-nums hidden sm:block"
                  style={{ color: row.bonusPoints > 0 ? GOLD : MUTED }}>
                  {row.bonusPoints > 0 ? `+${row.bonusPoints}` : "—"}
                </span>

                {/* Total pts */}
                <span className="w-12 text-right font-bold text-sm tabular-nums"
                  style={{ color: row.totalPoints > 0 ? GREEN : MUTED }}>
                  {row.totalPoints}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scoring key */}
        <p className="text-[10px] text-center" style={{ color: MUTED }}>
          5 pts exact score · 3 pts correct goal diff · 2 pts correct result
        </p>

        {/* Footer links */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link href="/predict/leagues" className="text-xs hover:underline" style={{ color: GREEN }}>
            Create a private league →
          </Link>
          <Link href="/predict" className="text-xs hover:underline" style={{ color: MUTED }}>
            ← Back to predictor
          </Link>
        </div>
      </div>
    </div>
  );
}
