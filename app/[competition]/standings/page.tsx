"use client";

/**
 * /[competition]/standings — the table.
 *
 * Two tabs for a league competition: the real league Table (standings + form)
 * and the Predictor table (who's winning the prediction game). A group-stage
 * competition (e.g. the World Cup) keeps its group-by-group view instead.
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { resolveCompetition, getFixtures, getPredictorLeaderboard, type Fixture, type LeaderboardRow } from "@/lib/predictor";
import { computeLeagueTable, tableHasResults, type LeagueRow } from "@/lib/leagueTable";
import { sportOf } from "@/lib/sports";
import GroupStandings from "@/components/predictor/GroupStandings";
import StandingsTable from "@/components/premier/StandingsTable";

const GREEN = "#1a3a2a", GOLD = "#b8972a", MUTED = "#7a8f82";
const BORDER = "#dde5d8", TEXT1 = "#0f1f17", CARD = "#fff", BG = "#f8f5f0";

export default function StandingsPage() {
  const { competition: competitionSlug } = useParams<{ competition: string }>();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [table, setTable]       = useState<LeagueRow[]>([]);
  const [predictors, setPredictors] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<"table" | "predictor">("table");
  const [hasDraw, setHasDraw]   = useState(true);

  useEffect(() => {
    async function load() {
      const { competition } = await resolveCompetition(competitionSlug);
      if (!competition) { setLoading(false); return; }
      setHasDraw(sportOf(competition.sportCode).hasDraw);
      const [{ fixtures: fx }, preds] = await Promise.all([
        getFixtures(competition.id),
        getPredictorLeaderboard(competition.id).catch(() => [] as LeaderboardRow[]),
      ]);
      setFixtures(fx);
      setTable(computeLeagueTable(fx));
      setPredictors(preds);
      setLoading(false);
    }
    load();
  }, [competitionSlug]);

  const hasGroups = fixtures.some((f) => f.groupName);
  const live = tableHasResults(table);

  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: BG }}>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-3xl mx-auto">
          <Link href={`/${competitionSlug}`} className="text-sm font-medium" style={{ color: MUTED }}>← Predictor</Link>
          <h1 className="text-xl font-bold mt-1" style={{ color: GREEN }}>Standings</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: "#e8ede6" }} />
            ))}
          </div>
        ) : hasGroups ? (
          <GroupStandings fixtures={fixtures} />
        ) : (
          <>
            {/* Tabs */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: "#f0f3ef" }}>
              {([["table", "🏆 League table"], ["predictor", "🧠 Predictors"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className="flex-1 py-2.5 text-xs font-bold transition-colors"
                  style={{ background: tab === key ? GREEN : "transparent", color: tab === key ? "#fff" : MUTED }}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "table" ? (
              <>
                {!live && (
                  <p className="text-xs text-center" style={{ color: MUTED }}>
                    The season hasn&apos;t kicked off yet — the table fills in as results come in.
                  </p>
                )}
                <StandingsTable rows={table} hasDraw={hasDraw} />
                <p className="text-[10px] text-center" style={{ color: MUTED }}>Form shows the last five results, most recent on the right.</p>
              </>
            ) : (
              <PredictorTable rows={predictors} slug={competitionSlug} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PredictorTable({ rows, slug }: { rows: LeaderboardRow[]; slug: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl py-12 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <p className="text-sm" style={{ color: TEXT1 }}>No predictor rankings yet.</p>
        <p className="text-xs mt-1" style={{ color: MUTED }}>Points land once matches are played.</p>
        <Link href={`/${slug}/predict`} className="text-xs font-bold mt-3 inline-block" style={{ color: GREEN }}>Make your predictions →</Link>
      </div>
    );
  }
  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        {rows.slice(0, 25).map((r) => (
          <div key={r.userId} className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderTop: `1px solid ${BORDER}` }}>
            <span className="w-6 text-center text-xs font-bold tabular-nums" style={{ color: r.rank <= 3 ? GOLD : MUTED }}>{r.rank}</span>
            <span className="flex-1 text-sm font-semibold truncate" style={{ color: TEXT1 }}>{r.displayName}</span>
            <span className="text-xs tabular-nums" style={{ color: MUTED }}>{r.exactScores > 0 ? `${r.exactScores} exact` : ""}</span>
            <span className="w-12 text-right text-sm font-extrabold tabular-nums" style={{ color: GREEN }}>{r.totalPoints}</span>
          </div>
        ))}
      </div>
      <Link href={`/${slug}/leaderboard`} className="text-xs font-semibold text-center" style={{ color: GREEN }}>
        Full rankings →
      </Link>
    </>
  );
}
