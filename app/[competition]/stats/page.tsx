"use client";

/**
 * /[competition]/stats — the Stats tab.
 *
 * Talking-point stats to bring people back: team stats derived from our own
 * results (top-scoring teams, clean sheets, best defense, form, biggest wins,
 * highest-scoring games) and — for football — top scorers / most assists from
 * the football-data.org cache. Ice hockey shows team stats only.
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { resolveCompetition, getFixtures, type Fixture } from "@/lib/predictor";
import { computeTeamStats, getPlayerScorers, type TeamStats, type StatLeader, type MatchStat, type Scorer } from "@/lib/leagueStats";
import { sportOf } from "@/lib/sports";

const GREEN = "#1a3a2a", GOLD = "#b8972a", MUTED = "#7a8f82";
const BORDER = "#dde5d8", TEXT1 = "#0f1f17", CARD = "#fff", BG = "#f8f5f0";
const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);

export default function StatsPage() {
  const { competition: slug } = useParams<{ competition: string }>();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [team, setTeam]         = useState<TeamStats | null>(null);
  const [scorers, setScorers]   = useState<Scorer[]>([]);
  const [updatedAt, setUpdated] = useState<string | null>(null);
  const [isFootball, setIsFootball] = useState(true);
  const [cleanLabel, setCleanLabel] = useState("Clean Sheets");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const { competition } = await resolveCompetition(slug);
      if (!competition) { setLoading(false); return; }
      const football = competition.sportCode === "football";
      setIsFootball(football);
      setCleanLabel(sportOf(competition.sportCode).cleanSheetLabel);
      const [{ fixtures: fx }, players] = await Promise.all([
        getFixtures(competition.id),
        football ? getPlayerScorers(competition.id) : Promise.resolve({ updatedAt: null, scorers: [] }),
      ]);
      setFixtures(fx);
      setTeam(computeTeamStats(fx, sportOf(competition.sportCode)));
      setScorers(players.scorers);
      setUpdated(players.updatedAt);
      setLoading(false);
    }
    load();
  }, [slug]);

  const topAssists = [...scorers].filter((s) => s.assists > 0).sort((a, b) => b.assists - a.assists).slice(0, 10);

  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: BG }}>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-3xl mx-auto">
          <Link href={`/${slug}`} className="text-sm font-medium" style={{ color: MUTED }}>← Predictor</Link>
          <h1 className="text-xl font-bold mt-1" style={{ color: GREEN }}>Stats</h1>
          <div className="flex gap-2 mt-3">
            <Link href={`/${slug}/standings`} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ color: MUTED, background: "#eef2ec" }}>League table</Link>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ color: "#fff", background: GREEN }}>Stats</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 max-w-3xl mx-auto w-full flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "#e8ede6" }} />)}
          </div>
        ) : !team ? (
          <p className="text-sm" style={{ color: MUTED }}>Competition not found.</p>
        ) : (
          <>
            {/* ── Players (football only) ── */}
            {isFootball && (
              <section className="flex flex-col gap-3">
                <SectionTitle>⚽ Players</SectionTitle>
                {scorers.length === 0 ? (
                  <EmptyCard>Top scorers &amp; assists appear once the season kicks off.</EmptyCard>
                ) : (
                  <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <ScorerCard title="🥇 Top Scorers" rows={scorers.slice(0, 10)} metric="goals" />
                    {topAssists.length > 0 && <ScorerCard title="🅰️ Most Assists" rows={topAssists} metric="assists" />}
                  </div>
                )}
                {updatedAt && <p className="text-[10px]" style={{ color: MUTED }}>Player data updated {new Date(updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}.</p>}
              </section>
            )}

            {/* ── Teams ── */}
            <section className="flex flex-col gap-3">
              <SectionTitle>🛡️ Teams</SectionTitle>
              {team.played === 0 ? (
                <EmptyCard>Team stats appear once matches are played.</EmptyCard>
              ) : (
                <>
                  <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <LeaderCard title="⚽ Top-Scoring Teams" rows={team.topScoring} suffix=" goals" />
                    <LeaderCard title="🧱 Best Defense" rows={team.bestDefense} suffix=" conceded" />
                    <LeaderCard title={`🥅 Most ${cleanLabel}`} rows={team.cleanSheets} suffix="" />
                    <LeaderCard title="🔥 Hottest Form" rows={team.bestForm} suffix=" pts" showSub />
                  </div>
                  <MatchCard title="💥 Biggest Wins" rows={team.biggestWins} />
                  <MatchCard title="🎯 Highest-Scoring Matches" rows={team.highestScoring} />
                </>
              )}
            </section>

            <div className="text-center pt-2 pb-6">
              <Link href={`/${slug}`} className="text-xs font-bold px-4 py-2 rounded-full inline-block" style={{ color: "#fff", background: GOLD }}>
                Make your predictions →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold" style={{ color: GREEN }}>{children}</h2>;
}
function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl p-5 text-center text-xs" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>{children}</div>;
}

function LeaderCard({ title, rows, suffix, showSub }: { title: string; rows: StatLeader[]; suffix: string; showSub?: boolean }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>{title}</div>
      <div className="flex flex-col gap-1.5">
        {rows.length === 0 ? <span className="text-[11px]" style={{ color: MUTED }}>—</span> : rows.map((r, i) => (
          <div key={r.code} className="flex items-center gap-2">
            <span className="text-[11px] w-4 text-center" style={{ color: MUTED }}>{i + 1}</span>
            <span className="text-xs font-semibold flex-1 min-w-0 truncate" style={{ color: TEXT1 }}>
              {r.name}{showSub && r.sub ? <span className="ml-1 text-[10px]" style={{ color: MUTED }}>{r.sub}</span> : null}
            </span>
            <span className="text-xs font-bold" style={{ color: GOLD }}>{r.value}{r.value === 1 && (suffix === " goals" || suffix === " pts") ? suffix.replace(/s$/, "") : suffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScorerCard({ title, rows, metric }: { title: string; rows: Scorer[]; metric: "goals" | "assists" }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>{title}</div>
      <div className="flex flex-col gap-1.5">
        {rows.map((s, i) => (
          <div key={`${s.name}-${i}`} className="flex items-center gap-2">
            <span className="text-[11px] w-5 text-center">{medal(i)}</span>
            <span className="flex-1 min-w-0">
              <span className="text-xs font-semibold block truncate" style={{ color: TEXT1 }}>{s.name}</span>
              <span className="text-[10px] block truncate" style={{ color: MUTED }}>{s.team}</span>
            </span>
            <span className="text-sm font-bold" style={{ color: GOLD }}>{metric === "goals" ? s.goals : s.assists}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ title, rows }: { title: string; rows: MatchStat[] }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>{title}</div>
      <div className="flex flex-col gap-1.5">
        {rows.length === 0 ? <span className="text-[11px]" style={{ color: MUTED }}>—</span> : rows.map((m, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="flex-1 text-right truncate font-semibold" style={{ color: TEXT1 }}>{m.home}</span>
            <span className="font-bold px-2 py-0.5 rounded" style={{ color: "#fff", background: GREEN }}>{m.homeScore}–{m.awayScore}</span>
            <span className="flex-1 truncate font-semibold" style={{ color: TEXT1 }}>{m.away}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
