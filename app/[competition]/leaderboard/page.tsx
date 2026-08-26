"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { nameToFlag } from "@/lib/countries";
import { track } from "@/lib/analytics";
import {
  resolveCompetition,
  getPredictorLeaderboard,
  getMyStats,
  getFixtureCount,
  type Competition,
  type LeaderboardRow,
  type MyStats,
} from "@/lib/predictor";
import { FALLBACK_COMPETITION_SLUG } from "@/lib/competitionEngine";
import { GrandPrizeLeaderboardBanner } from "@/components/GrandPrize";
import { sportOf, FOOTBALL, type SportMeta } from "@/lib/sports";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
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
  // Competition Engine V2: the competition is the first path segment
  // (/premier-league/...), not a hardcoded slug.
  const { competition: competitionSlug } = useParams<{ competition: string }>();
  const { user, loading: authLoading } = useAuth();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [rows,        setRows]        = useState<LeaderboardRow[]>([]);
  const [myStats,     setMyStats]     = useState<MyStats | null>(null);
  const [matchTotal,  setMatchTotal]  = useState<number>(0);   // total fixtures — 0 = unknown
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [tab,         setTab]         = useState<"overall" | "match">("overall");
  const [sport,       setSport]       = useState<SportMeta>(FOOTBALL);

  useEffect(() => {
    async function load() {
      const { competition: comp, error: compErr } = await resolveCompetition(competitionSlug);
      if (compErr || !comp) { setError(compErr ?? "Competition not found."); setLoading(false); return; }
      setCompetition(comp);
      setSport(sportOf(comp.sportCode));
      const [leaderboard, fixtureCount] = await Promise.all([
        getPredictorLeaderboard(comp.id),
        getFixtureCount(comp.id),
      ]);
      setRows(leaderboard);
      setMatchTotal(fixtureCount);
      track.predictorLeaderboardViewed();
      setLoading(false);
    }
    if (!authLoading) load();
  }, [authLoading, competitionSlug]);

  useEffect(() => {
    if (!user || !competition) return;
    getMyStats(competition.id).then(setMyStats);
  }, [user, competition]);

  // Re-rank rows for Match Prediction view (sort by matchPoints only)
  const displayRows = tab === "match"
    ? [...rows]
        .sort((a, b) => b.matchPoints - a.matchPoints || b.exactScores - a.exactScores || b.correctGd - a.correctGd)
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : rows;

  // The Grand Prize (Custom Champion Watch) is a World-Cup-2026-only
  // promotion — there is no generic prize concept in the Competition Engine,
  // so the banner and /prize page belong to the 2026 Tournament alone. Show it for
  // that competition, hide it for every other (Premier League, etc.).
  const isWorldCup = competition?.slug === FALLBACK_COMPETITION_SLUG;

  // Ordering sports (F1) score by exact grid/finish positions, have no bonus
  // questions and no "match" — so the football framing (⚽, "match", goal
  // difference, the Overall/Match tab split) is replaced with race language.
  const ordering = sport.kind === "ordering";
  const unit     = ordering ? "session" : "match";   // for "N predictions" copy

  if (authLoading || loading) {
    return (
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-12 flex flex-col gap-3">
        <div className="h-8 w-40 rounded animate-pulse" style={{ background: "#dde5d8" }} />
        {[1,2,3,4,5,6,7,8].map((i) => (
          <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "#dde5d8" }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href={`/${competitionSlug}`} className="text-sm hover:underline" style={{ color: GREEN }}>← Back</Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10 w-full flex flex-col gap-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
          <Link href={`/${competitionSlug}`} style={{ color: MUTED }} className="hover:underline">Predictor</Link>
          <span>/</span>
          <span style={{ color: TEXT2, fontWeight: 600 }}>Global Rankings</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: TEXT1 }}>Global Rankings</h1>
          <p className="text-sm mt-1" style={{ color: TEXT2 }}>
            {competition?.name ?? "Global Rankings"} · {rows.length} {rows.length === 1 ? "predictor" : "predictors"}
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
              {(ordering
                ? [
                    { label: "Points",  value: String(Number(myStats.totalPoints)), color: GREEN },
                    { label: "Rank",    value: `#${myStats.globalRank}`,            color: GOLD  },
                    { label: "Perfect", value: String(Number(myStats.exactScores)), color: GREEN },
                  ]
                : [
                    { label: "Points", value: String(Number(myStats.totalPoints)), color: GREEN },
                    { label: "Rank",   value: `#${myStats.globalRank}`,            color: GOLD  },
                    { label: "Match",  value: String(Number(myStats.matchPoints)), color: GREEN },
                    { label: "Exact",  value: String(Number(myStats.exactScores)), color: GREEN },
                    ...(myStats.bonusPoints > 0
                      ? [{ label: "Bonus", value: `+${myStats.bonusPoints}`, color: GOLD }]
                      : []),
                  ]
              ).map((s) => (
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
              <p className="text-xs" style={{ color: MUTED }}>
                Your stats · {matchTotal > 0
                  ? `${myStats.predictions} / ${matchTotal} ${unit === "session" ? "sessions" : "predictions"} predicted`
                  : `${myStats.predictions} ${myStats.predictions === 1 ? unit : unit + "s"} predicted`}
              </p>
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

        {/* Grand Prize banner — 2026 Tournament only (see isWorldCup above) */}
        {isWorldCup && <GrandPrizeLeaderboardBanner participantCount={rows.length} />}

        {/* Tab toggle — score sports split Overall vs Match-only (bonus vs not).
            Ordering sports (F1) have no bonus questions, so there is nothing to
            split: the single standings are shown without the football tab. */}
        {!ordering && (
          <>
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: BG }}>
              {[
                { key: "overall" as const, label: "🏆 Overall" },
                { key: "match"   as const, label: "⚽ Match only" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="flex-1 py-2.5 text-xs font-bold transition-colors"
                  style={{
                    background:   tab === key ? GREEN : "transparent",
                    color:        tab === key ? "#fff" : MUTED,
                    borderRadius: "0",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs px-1" style={{ color: MUTED }}>
              {tab === "overall"
                ? "Total points including any bonus questions — the overall standings."
                : "Match predictions only — fair for anyone who joined partway through."}
            </p>
          </>
        )}
        {ordering && (
          <p className="text-xs px-1" style={{ color: MUTED }}>
            Every predictor is ranked by total points across qualifying and the race.
          </p>
        )}

        {/* Leaderboard table */}
        <div className="rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>

          {/* Column headers */}
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
            <div className="w-7 shrink-0" />
            <span className="flex-1 text-[10px] uppercase tracking-widest font-semibold" style={{ color: MUTED }}>Player</span>
            <span className="w-10 text-right text-[10px] uppercase tracking-widest font-semibold hidden sm:block" style={{ color: MUTED }}>%</span>
            <span className="w-10 text-right text-[10px] uppercase tracking-widest font-semibold hidden sm:block" style={{ color: GREEN }}>
              {ordering ? "PERFECT" : "⚡"}
            </span>
            {tab === "overall" && !ordering && (
              <span className="w-10 text-right text-[10px] uppercase tracking-widest font-semibold hidden sm:block" style={{ color: GOLD }}>Bonus</span>
            )}
            <span className="w-12 text-right text-[10px] uppercase tracking-widest font-semibold" style={{ color: GREEN }}>
              {tab === "overall" ? "Total" : "Match"}
            </span>
          </div>

          {/* Empty state */}
          {rows.length === 0 && (
            <div className="py-12 text-center flex flex-col gap-2">
              <p className="text-sm" style={{ color: TEXT2 }}>No results yet.</p>
              <p className="text-xs" style={{ color: MUTED }}>
                {ordering
                  ? "Points are awarded once a session is classified. Check back after the first race."
                  : "Points are awarded after match results are entered. Check back after the first match."}
              </p>
              <Link href={`/${competitionSlug}`} className="text-xs mt-2 hover:underline" style={{ color: GREEN }}>
                Make your predictions →
              </Link>
            </div>
          )}

          {/* Rows */}
          {displayRows.map((row) => {
            const isMe     = !!(user && row.userId === user.id);
            // Completion % against the competition's real fixture count; null
            // when the total is unknown (fixtures not seeded / unconfigured).
            const matchPct = matchTotal > 0
              ? Math.min(100, Math.round((row.predictions / matchTotal) * 100))
              : null;
            const pts      = tab === "overall" ? row.totalPoints : row.matchPoints;
            return (
              <Link
                key={`${row.rank}-${row.displayName}`}
                href={`/predict/user/${row.userId}`}
                className="flex items-center gap-2 px-3 py-3 transition-colors hover:bg-[#f6f9f5]"
                style={{
                  borderBottom: `1px solid ${BORDER}`,
                  background:   isMe ? "#eef3ec" : undefined,
                  borderLeft:   isMe ? `3px solid ${GREEN}` : "3px solid transparent",
                  display:      "flex",
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

                {/* Completion % */}
                <span className="w-10 text-right text-xs tabular-nums hidden sm:block" style={{ color: matchPct !== null && matchPct >= 50 ? TEXT2 : MUTED }}>
                  {matchPct !== null ? `${matchPct}%` : "—"}
                </span>

                {/* Exact scores ⚡ */}
                <span className="w-10 text-right text-xs tabular-nums hidden sm:block"
                  style={{ color: row.exactScores > 0 ? GREEN : MUTED }}>
                  {row.exactScores > 0 ? row.exactScores : "—"}
                </span>

                {/* Bonus pts — only in overall tab, score sports only */}
                {tab === "overall" && !ordering && (
                  <span className="w-10 text-right text-xs tabular-nums hidden sm:block"
                    style={{ color: row.bonusPoints > 0 ? GOLD : MUTED }}>
                    {row.bonusPoints > 0 ? `+${row.bonusPoints}` : "—"}
                  </span>
                )}

                {/* Points */}
                <span className="w-12 text-right font-bold text-sm tabular-nums"
                  style={{ color: pts > 0 ? GREEN : MUTED }}>
                  {pts}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Scoring key */}
        <p className="text-[10px] text-center" style={{ color: MUTED }}>
          {ordering
            ? "5 pts perfect top 5 · 3 pts 3–4 in the exact spot · 2 pts 1–2 in the exact spot"
            : "5 pts exact score · 3 pts correct goal diff · 2 pts correct result"}
        </p>

        {/* Footer links */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link href={`/${competitionSlug}/leagues`} className="text-xs hover:underline" style={{ color: GREEN }}>
            Create a private league →
          </Link>
          <Link href={`/${competitionSlug}`} className="text-xs hover:underline" style={{ color: MUTED }}>
            ← Back to predictor
          </Link>
        </div>
      </div>
    </div>
  );
}
