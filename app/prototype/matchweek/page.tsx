"use client";

/**
 * /prototype/matchweek — the playable Premier League Matchweek 1.
 *
 * A self-contained, database-free prototype of the whole end-to-end loop:
 * predict → autosave → simulate results → score (real 5/3/2/0) → leaderboard,
 * with the living dashboard changing state as you move the clock.
 *
 * It renders the REAL components (CompetitionHome, MatchweekSheet) and the
 * REAL logic (lib/matchweek, lib/matchweekPredictions, lib/scoringModel),
 * backed by lib/prototype/localStore instead of Supabase. So playing this IS
 * testing the actual experience, not a mock of it.
 *
 * Static route under /prototype — Next resolves it before /[competition], so
 * it never collides with a real competition.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CompetitionProvider } from "@/components/CompetitionProvider";
import CompetitionHome, { type HomeData } from "@/components/premier/CompetitionHome";
import MatchweekSheet, { type FixtureStats } from "@/components/premier/MatchweekSheet";

// Believable crowd splits so the prototype's community bar has life.
const PROTO_STATS: Record<string, FixtureStats> = {
  "mw1-0": { total: 3182, homePct: 71, drawPct: 18, awayPct: 11 },  // LIV v BOU
  "mw1-1": { total: 2740, homePct: 44, drawPct: 33, awayPct: 23 },  // AVL v NEW
  "mw1-2": { total: 2611, homePct: 39, drawPct: 34, awayPct: 27 },  // BHA v FUL
  "mw1-3": { total: 2498, homePct: 48, drawPct: 30, awayPct: 22 },  // NFO v BRE
  "mw1-4": { total: 2455, homePct: 35, drawPct: 31, awayPct: 34 },  // SUN v WHU
  "mw1-5": { total: 2603, homePct: 63, drawPct: 24, awayPct: 13 },  // TOT v BUR
  "mw1-6": { total: 3044, homePct: 9,  drawPct: 17, awayPct: 74 },  // WOL v MCI
  "mw1-7": { total: 2733, homePct: 55, drawPct: 28, awayPct: 17 },  // CHE v CRY
  "mw1-8": { total: 4120, homePct: 33, drawPct: 27, awayPct: 40 },  // MUN v ARS
  "mw1-9": { total: 2288, homePct: 42, drawPct: 33, awayPct: 25 },  // LEE v EVE
};
import { DEFAULT_SETTINGS, type Season } from "@/lib/competitionEngine";
import type { Competition, MyStats } from "@/lib/predictor";
import { MW1_ROUND } from "@/lib/prototype/mw1Fixtures";
import { editorialForRound } from "@/lib/premierLeague/matchweekCopy";
import {
  protoFixtures, protoSave, protoLeague, simulateResults, hasResults,
  clearAll, jumpTo, nowMs, type LeagueRow,
} from "@/lib/prototype/localStore";

const GREEN = "#1a3a2a", GOLD = "#b8972a", MUTED = "#7a8f82";
const BORDER = "#dde5d8", TEXT1 = "#0f1f17", OK = "#1a7a4a";

const FAKE_COMP: Competition = {
  id: "pl-proto", name: "Premier League", slug: "prototype/matchweek",
  status: "active", startsAt: null, endsAt: null,
};

type Tab = "home" | "predict" | "league";

export default function MatchweekPrototype() {
  const [tab, setTab]   = useState<Tab>("home");
  const [tick, setTick] = useState(0);   // bump to re-read the store
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // The store reads localStorage, so its values differ between the server
  // render (no storage) and the client. Gate everything store-derived behind
  // a mount flag so hydration matches, then fill in on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Re-read on mount and whenever we mutate the store.
  const [fixtures, setFixtures] = useState(() => protoFixtures());
  const [resulted, setResulted] = useState(false);
  useEffect(() => {
    setFixtures(protoFixtures());
    setResulted(hasResults());
  }, [tick, tab]);

  const settings = { ...DEFAULT_SETTINGS, homeStyle: "matchweek" as const, visible: true };

  const league = useMemo(() => protoLeague(), [tick]);
  const myRank = league.rows.findIndex((r) => r.isMe) + 1;

  const homeData: HomeData = useMemo(() => {
    const fx = protoFixtures();
    const pts = fx.reduce((n, f) => n + (f.myPrediction?.pointsAwarded ?? 0), 0);
    const exact = fx.filter((f) => f.myPrediction?.pointsAwarded === 5).length;
    const predictions = fx.filter((f) => f.myPrediction != null).length;

    const stats: MyStats = {
      totalPoints: pts, predictions, exactScores: exact,
      globalRank: hasResults() ? 131 : 0,
    } as MyStats;

    const ed = editorialForRound(1);
    const biggest = ed
      ? fx.find((f) => f.homeTeam?.code === ed.biggest[0] && f.awayTeam?.code === ed.biggest[1])
      : null;

    return {
      round: MW1_ROUND,
      fixtures: fx,
      nextRoundStartsMs: null,
      settings,
      stats,
      leaguePreview: { name: league.name, rank: myRank, total: league.rows.length },
      biggestMatch: biggest ?? fx[fx.length - 1] ?? null,
      biggestWhy: ed?.biggestWhy,
      challengeCount: 0,
      challengesAnswered: 0,
      editorial: ed ? { headline: ed.headline, players: ed.watch } : null,
    };
  }, [tick, league, myRank]);

  function control(fn: () => void) {
    return () => { fn(); refresh(); };
  }

  // Before hydration completes, render a stable shell (no store reads) so
  // the server and first client render agree.
  if (!mounted) {
    return (
      <div style={{ background: "#f0f3ef", minHeight: "100vh" }}>
        <div className="max-w-md mx-auto px-4 py-16 text-center text-sm" style={{ color: "#7a8f82" }}>
          Loading the prototype…
        </div>
      </div>
    );
  }

  const clockNote = describeClock();

  return (
    <div style={{ background: "#f0f3ef", minHeight: "100vh" }}>
      {/* ── Prototype control bar ── */}
      <div className="sticky top-0 z-30 px-3 py-2" style={{ background: "#1a1410", color: "#fff" }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold" style={{ color: GOLD }}>⚙ PROTOTYPE · {clockNote}</span>
            <button onClick={control(() => clearAll())} className="text-[10px] underline" style={{ color: "#c99" }}>reset</button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["before", "open", "friday", "saturday", "after"] as const).map((m) => (
              <button key={m} onClick={control(() => jumpTo(m))}
                className="text-[10px] px-2 py-1 rounded font-semibold"
                style={{ background: "#2a2018", color: "#e8d9b0", border: `1px solid ${GOLD}44` }}>
                {m}
              </button>
            ))}
            <button onClick={control(() => simulateResults())}
              className="text-[10px] px-2 py-1 rounded font-bold"
              style={{ background: resulted ? "#2a2018" : GOLD, color: resulted ? MUTED : "#1a1410" }}>
              {resulted ? "results ✓" : "simulate results"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-md mx-auto flex" style={{ borderBottom: `1px solid ${BORDER}`, background: "#fff" }}>
        {(["home", "predict", "league"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-xs font-bold capitalize transition-colors"
            style={{
              color: tab === t ? GREEN : MUTED,
              borderBottom: tab === t ? `2px solid ${GREEN}` : "2px solid transparent",
            }}>
            {t === "home" ? "This Week" : t}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {/* key={tick} remounts on a clock jump so the injected clock is re-read
          immediately rather than on the next tick. */}
      <CompetitionProvider competition={FAKE_COMP} settings={settings} stages={[]}>
        <div className="predict-shell" key={tick}>
          {tab === "home" && <CompetitionHome data={homeData} clock={nowMs} />}
          {tab === "predict" && (
            <div className="max-w-md mx-auto">
              <MatchweekSheet
                fixtures={fixtures}
                roundLabel="Matchweek 1"
                onSave={protoSave}
                onChanged={refresh}
                clock={nowMs}
                maxIq={500}
                playerCount={4287}
                statsByFixture={PROTO_STATS}
                onViewLeaderboard={() => setTab("league")}
                onShare={() => {
                  const text = "I've made my Premier League Matchweek 1 predictions on SuperBrain. Beat me →";
                  if (typeof navigator !== "undefined" && navigator.share) {
                    void navigator.share({ title: "SuperBrain", text }).catch(() => {});
                  } else {
                    void navigator.clipboard?.writeText(text).catch(() => {});
                  }
                }}
              />
            </div>
          )}
          {tab === "league" && <LeagueBoard name={league.name} rows={league.rows} resulted={resulted} />}
        </div>
      </CompetitionProvider>
    </div>
  );
}

function LeagueBoard({ name, rows, resulted }: { name: string; rows: LeagueRow[]; resulted: boolean }) {
  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">⚔️</span>
        <h1 className="text-lg font-bold" style={{ color: TEXT1 }}>{name}</h1>
      </div>
      {!resulted && (
        <p className="text-xs mb-3" style={{ color: MUTED }}>
          Standings update as results come in — hit “simulate results” in the bar above.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={r.name} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{
              background: r.isMe ? "#eef6f0" : "#fff",
              border: `1px solid ${r.isMe ? OK : BORDER}`,
            }}>
            <span className="text-sm font-bold w-6 text-center" style={{ color: i === 0 ? GOLD : MUTED }}>{i + 1}</span>
            <span className="flex-1 text-sm font-semibold" style={{ color: TEXT1 }}>
              {r.name} {r.isMe && <span className="text-[10px]" style={{ color: OK }}>· you</span>}
            </span>
            <span className="text-xs" style={{ color: MUTED }}>{r.exact} exact</span>
            <span className="text-sm font-bold w-10 text-right" style={{ color: GREEN }}>{r.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function describeClock(): string {
  const now = nowMs();
  const first = new Date(MW1_ROUND.startsAt).getTime();
  const days = Math.round((first - now) / (24 * 3600_000));
  if (days > 1)  return `${days}d to kickoff`;
  if (days === 1) return `1d to kickoff`;
  if (days === 0 && now < first) return `kickoff today`;
  return `matchweek under way`;
}
