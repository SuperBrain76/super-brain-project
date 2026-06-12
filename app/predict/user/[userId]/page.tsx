"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getCompetition,
  getPredictorLeaderboard,
  getUserPublicPredictions,
  formatKickoff,
  stageLabel,
  type Fixture,
  type LeaderboardRow,
} from "@/lib/predictor";
import { nameToFlag } from "@/lib/countries";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const CARD   = "#ffffff";
const BG     = "#f0f3ef";

// ── Points pill ───────────────────────────────────────────────
function PtsPill({ pts }: { pts: number | null }) {
  if (pts === null) return null;
  const isExact = pts === 5 || pts === 3;
  const col = pts === 5 ? GOLD : pts === 3 ? GREEN : pts === 2 ? "#d97706" : MUTED;
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
      style={{ color: col, background: `${col}18` }}>
      {pts > 0 ? `+${pts}` : "0"}{isExact ? "★" : ""}
    </span>
  );
}

export default function UserPredictionsPage() {
  const { userId } = useParams<{ userId: string }>();

  const [profile,  setProfile]  = useState<LeaderboardRow | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      const { competition } = await getCompetition("wc2026");
      if (!competition) { setLoading(false); return; }

      // Run in parallel: leaderboard profile + public predictions
      const [rows, { fixtures: fx }] = await Promise.all([
        getPredictorLeaderboard(competition.id),
        getUserPublicPredictions(userId, competition.id),
      ]);
      setProfile(rows.find((r) => r.userId === userId) ?? null);
      setFixtures(fx);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm animate-pulse" style={{ color: MUTED }}>Loading…</p>
      </div>
    );
  }

  const matchPct = profile ? Math.round((profile.predictions / 104) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
          <Link href="/predict" className="hover:underline" style={{ color: MUTED }}>Predictor</Link>
          <span>/</span>
          <Link href="/predict/leaderboard" className="hover:underline" style={{ color: MUTED }}>Rankings</Link>
          <span>/</span>
          <span style={{ color: TEXT2, fontWeight: 600 }}>{profile?.displayName ?? "Player"}</span>
        </div>

        {/* Player header */}
        {profile ? (
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg shrink-0"
                style={{ background: `${GREEN}12`, color: GREEN }}
              >
                {profile.displayName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {profile.country && nameToFlag(profile.country) && (
                    <span className="text-lg">{nameToFlag(profile.country)}</span>
                  )}
                  <h1 className="font-extrabold text-lg leading-tight" style={{ color: TEXT1 }}>{profile.displayName}</h1>
                </div>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                  {matchPct}% match completion · {profile.predictions}/104 matches predicted
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-extrabold text-xl" style={{ color: GREEN }}>{profile.totalPoints}</p>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>pts</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-4 pt-2 flex-wrap" style={{ borderTop: `1px solid ${BORDER}` }}>
              {[
                { label: "Rank",         value: `#${profile.rank}`,       color: GOLD  },
                { label: "Match pts",    value: profile.matchPoints,       color: GREEN },
                { label: "Bonus pts",    value: `+${profile.bonusPoints}`, color: GOLD  },
                { label: "Exact scores", value: profile.exactScores,       color: GREEN },
              ].map((s) => (
                <div key={s.label} className="flex flex-col gap-0">
                  <span className="font-bold text-sm" style={{ color: s.color }}>{s.value}</span>
                  <span className="text-[10px]" style={{ color: MUTED }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-6 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-sm" style={{ color: TEXT2 }}>Player not found on the leaderboard.</p>
          </div>
        )}

        {/* Predictions section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm" style={{ color: TEXT1 }}>Match Predictions</h2>
            <span className="text-[10px]" style={{ color: MUTED }}>Visible after kickoff only</span>
          </div>

          {fixtures.length === 0 && (
            <div className="rounded-xl p-5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="text-sm" style={{ color: TEXT2 }}>No kicked-off matches yet.</p>
              <p className="text-xs mt-1" style={{ color: MUTED }}>Predictions become visible as the tournament progresses.</p>
            </div>
          )}

          {fixtures.map((f) => {
            const pred = f.myPrediction;
            const done = f.status === "completed";
            const isExact = pred && done && (pred.pointsAwarded === 5 || pred.pointsAwarded === 3);

            return (
              <div
                key={f.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderLeft: pred ? `3px solid ${isExact ? GOLD : GREEN}` : `3px solid ${BORDER}`,
                }}
              >
                {/* Stage + date */}
                <div className="flex items-center justify-between px-3 pt-2.5 pb-0">
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>
                    {f.groupName ? `Group ${f.groupName}` : stageLabel(f.stage)}
                  </span>
                  <span className="text-[10px]" style={{ color: MUTED }}>
                    {formatKickoff(f.kicksOffAt, { date: true, time: false })}
                  </span>
                </div>

                {/* Teams + result */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-lg leading-none">{f.homeTeam?.flagEmoji ?? "🏳"}</span>
                    <span className="text-sm font-semibold truncate" style={{ color: TEXT1 }}>{f.homeTeam?.name ?? "TBD"}</span>
                  </div>
                  <div className="shrink-0 text-center px-2 flex flex-col items-center gap-0.5">
                    {(done || f.status === "live") && f.homeScore !== null ? (
                      <>
                        {f.status === "live" && (
                          <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#e53e3e" }}>Live</span>
                        )}
                        <span className="text-sm font-black" style={{ color: TEXT1 }}>
                          {f.homeScore}–{f.awayScore}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs uppercase tracking-widest" style={{ color: f.status === "live" ? "#e53e3e" : MUTED }}>
                        {f.status === "live" ? "LIVE" : "vs"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-row-reverse">
                    <span className="text-lg leading-none">{f.awayTeam?.flagEmoji ?? "🏳"}</span>
                    <span className="text-sm font-semibold truncate text-right" style={{ color: MUTED }}>{f.awayTeam?.name ?? "TBD"}</span>
                  </div>
                </div>

                {/* Prediction strip */}
                {pred ? (
                  <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ background: isExact ? "#fdf9ee" : "#eef8f0", borderTop: `1px solid ${isExact ? "#e8d48a" : "#86c99a"}` }}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: isExact ? GOLD : GREEN }}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <polyline points="2,5 4.5,7.5 8,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isExact ? GOLD : GREEN }}>
                      {done && isExact ? "Exact" : "Predicted"}
                    </span>
                    <span className="font-black text-base tabular-nums" style={{ color: isExact ? GOLD : GREEN }}>
                      {pred.homeScore}–{pred.awayScore}
                    </span>
                    <PtsPill pts={pred.pointsAwarded} />
                  </div>
                ) : (
                  <div className="px-3 pb-2.5">
                    <p className="text-xs" style={{ color: MUTED }}>No prediction made</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Back links */}
        <div className="flex items-center justify-between">
          <Link href="/predict/leaderboard" className="text-xs hover:underline" style={{ color: MUTED }}>
            ← Global Rankings
          </Link>
          <Link href="/predict" className="text-xs hover:underline" style={{ color: MUTED }}>
            Predictor
          </Link>
        </div>
      </div>
    </div>
  );
}
