"use client";

/**
 * MotorsportHome — the F1 competition home.
 *
 * The ordering counterpart of PremierLeagueHome/CompetitionHome. That pair is
 * built around a featured two-team match, H/D/A crowd splits and a computed
 * W/D/L table — none of which exist for F1 — so F1 gets its own dashboard:
 * the next Grand Prix and its two predictable sessions, the drivers' and
 * constructors' championships (ingested from Jolpica), and THE GRID — every
 * driver grouped by team, so a visitor immediately sees who they're
 * predicting even before a wheel has turned.
 *
 * Rendered by app/[competition]/page.tsx when home_style is 'matchweek' AND
 * the sport's kind is 'ordering'.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Competition, Fixture, Team } from "@/lib/predictor";
import { getTeams } from "@/lib/predictor";
import { getCurrentRoundContext, getRoundFixtures, type Round } from "@/lib/competitionEngine";
import { getCompetitionStandings, sessionLabelOf, type CompetitionStandings } from "@/lib/motorsport";
import { F1_DRIVERS_2026, f1DriverByCode, F1_CONSTRUCTOR_COLOURS } from "@/lib/f1/drivers2026";
import ChampionshipTable from "@/components/motorsport/ChampionshipTable";

const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const CARD   = "#ffffff";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const OK     = "#1a7a4a";

// Canonical constructor order (registry order = roughly championship order),
// so THE GRID reads top-team-first before any real standings exist.
const CONSTRUCTOR_ORDER: string[] = (() => {
  const seen: string[] = [];
  for (const d of F1_DRIVERS_2026) if (!seen.includes(d.constructorName)) seen.push(d.constructorName);
  return seen;
})();

export default function MotorsportHome({ competition }: { competition: Competition }) {
  const [round, setRound]         = useState<Round | null>(null);
  const [fixtures, setFixtures]   = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<CompetitionStandings | null>(null);
  const [drivers, setDrivers]     = useState<Team[]>([]);
  const [loaded, setLoaded]       = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [ctx, grid] = await Promise.all([
        getCurrentRoundContext(competition.id),
        getTeams(competition.id),
      ]);
      if (!alive) return;
      setRound(ctx.round);
      setDrivers(grid);
      if (ctx.round) {
        const { fixtures: fx } = await getRoundFixtures(ctx.round.id);
        if (!alive) return;
        setFixtures(fx);
      }
      const st = await getCompetitionStandings(competition.id).catch(() => null);
      if (!alive) return;
      setStandings(st);
      setLoaded(true);
    }
    void load().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [competition.id]);

  // Group the grid by constructor, in canonical order.
  const byConstructor = useMemo(() => {
    const groups = new Map<string, Team[]>();
    for (const d of drivers) {
      const c = d.groupName ?? "—";
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push(d);
    }
    const ordered = [...groups.entries()].sort((a, b) => {
      const ia = CONSTRUCTOR_ORDER.indexOf(a[0]); const ib = CONSTRUCTOR_ORDER.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return ordered;
  }, [drivers]);

  if (!loaded) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm" style={{ color: MUTED }}>Loading the Grand Prix…</p>
      </div>
    );
  }

  const base = `/${competition.slug}`;
  const predicted = fixtures.filter((f) => f.myOrdering != null).length;
  const open = fixtures.filter((f) => f.status === "scheduled" && new Date(f.kicksOffAt).getTime() > Date.now()).length;
  const hasChampionship = (standings?.drivers.length ?? 0) > 0;

  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      <header className="pt-6 pb-4">
        <h1 className="text-[22px] font-extrabold" style={{ color: TEXT1 }}>{competition.name}</h1>
        <p className="text-[12px] mt-1" style={{ color: MUTED }}>
          Call the top five in qualifying and the race. Exact positions score — beat your mates over a season.
        </p>
      </header>

      {/* Next / current Grand Prix, with BOTH sessions */}
      {round ? (
        <section className="rounded-2xl border mb-5 overflow-hidden" style={{ background: CARD, borderColor: BORDER }}>
          <div className="px-4 pt-4 pb-2">
            <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: MUTED }}>
              {open > 0 ? "Next Grand Prix" : "This Grand Prix"}
            </div>
            <div className="text-[18px] font-extrabold mt-0.5" style={{ color: TEXT1 }}>{round.label}</div>
            {fixtures.length > 0 && (
              <div className="text-[12px] mt-0.5" style={{ color: TEXT2 }}>{fmtRange(fixtures)}</div>
            )}
          </div>

          {/* The two sessions */}
          <div className="px-4 pb-1">
            {fixtures.map((f) => {
              const label = f.venue?.endsWith("Qualifying") ? "Qualifying" : f.venue?.endsWith("Race") ? "Race" : sessionLabelOf(null);
              const done = f.myOrdering != null;
              const isOpen = f.status === "scheduled" && new Date(f.kicksOffAt).getTime() > Date.now();
              return (
                <div key={f.id} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "#eef2ea" }}>
                  <div>
                    <div className="text-[14px] font-bold" style={{ color: TEXT1 }}>{label} — top 5</div>
                    <div className="text-[11px]" style={{ color: MUTED }}>{fmtDay(f.kicksOffAt)}</div>
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: done ? OK : isOpen ? TEXT2 : MUTED }}>
                    {done ? "Predicted ✓" : isOpen ? "Open" : "Locked"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="px-4 pt-2 pb-4">
            <div className="text-[12px] mb-2 font-semibold" style={{ color: predicted === fixtures.length && fixtures.length > 0 ? OK : MUTED }}>
              {fixtures.length === 0 ? "Sessions appear here once scheduled."
                : predicted === fixtures.length ? "Both sessions predicted ✓"
                : `${predicted}/${fixtures.length} sessions predicted`}
            </div>
            <Link href={`${base}/predict`}
                  className="block w-full text-center rounded-xl py-2.5 text-[14px] font-extrabold"
                  style={{ background: TEXT2, color: "#fff" }}>
              {predicted === fixtures.length && fixtures.length > 0 ? "Review your picks" : "Predict the top five →"}
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border mb-5 px-4 py-6 text-center" style={{ background: CARD, borderColor: BORDER }}>
          <p className="text-[13px]" style={{ color: MUTED }}>The next round hasn&apos;t been scheduled yet.</p>
        </section>
      )}

      {/* Championship — drivers + constructors (once a race has settled) */}
      {hasChampionship ? (
        <>
          <section className="rounded-2xl border mb-4 px-4 py-4" style={{ background: CARD, borderColor: BORDER }}>
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: MUTED }}>Drivers&apos; championship</div>
              <Link href={`${base}/standings`} className="text-[11px] font-bold" style={{ color: TEXT2 }}>Full table →</Link>
            </div>
            <div className="mt-2">
              <ChampionshipTable rows={standings!.drivers.slice(0, 5)} scope="driver" throughRound={standings!.throughRound} />
            </div>
          </section>
          {standings!.constructors.length > 0 && (
            <section className="rounded-2xl border mb-5 px-4 py-4" style={{ background: CARD, borderColor: BORDER }}>
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: MUTED }}>Constructors&apos; championship</div>
                <Link href={`${base}/standings`} className="text-[11px] font-bold" style={{ color: TEXT2 }}>Full table →</Link>
              </div>
              <div className="mt-2">
                <ChampionshipTable rows={standings!.constructors.slice(0, 5)} scope="constructor" throughRound={standings!.throughRound} />
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-2xl border mb-5 px-4 py-4" style={{ background: CARD, borderColor: BORDER }}>
          <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: MUTED }}>Championship</div>
          <p className="text-[12px] mt-1" style={{ color: TEXT2 }}>
            The drivers&apos; and constructors&apos; standings begin after the {round?.label ?? "first Grand Prix"}.
          </p>
        </section>
      )}

      {/* THE GRID — every driver, by team */}
      {drivers.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: MUTED }}>
              The grid · {drivers.length} drivers
            </div>
            <div className="text-[11px]" style={{ color: MUTED }}>{byConstructor.length} teams</div>
          </div>
          <div className="rounded-2xl border overflow-hidden" style={{ background: CARD, borderColor: BORDER }}>
            {byConstructor.map(([constructor, cars], ci) => {
              const colour = F1_CONSTRUCTOR_COLOURS[constructorKey(constructor)] ?? "#44584a";
              return (
                <div key={constructor} className="flex items-stretch" style={{ borderTop: ci === 0 ? "none" : `1px solid ${BORDER}` }}>
                  <span style={{ width: 4, background: colour }} />
                  <div className="flex-1 px-3 py-2.5">
                    <div className="text-[12px] font-extrabold" style={{ color: TEXT1 }}>{constructor}</div>
                    <div className="mt-1 flex flex-col gap-1">
                      {cars.map((car) => {
                        const reg = f1DriverByCode(car.code);
                        return (
                          <div key={car.id} className="flex items-center gap-2.5">
                            <span className="inline-flex items-center justify-center rounded-full text-[9px] font-extrabold shrink-0"
                                  style={{ width: 22, height: 22, background: colour, color: "#fff" }}>
                              {car.code}
                            </span>
                            <span className="text-[13px] font-semibold truncate" style={{ color: TEXT2 }}>{car.name}</span>
                            {reg?.number != null && (
                              <span className="ml-auto text-[11px] tabular-nums font-bold" style={{ color: MUTED }}>#{reg.number}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Leagues CTA */}
      <section className="rounded-2xl border px-4 py-4" style={{ background: CARD, borderColor: BORDER }}>
        <div className="text-[14px] font-extrabold" style={{ color: TEXT1 }}>Beat your mates</div>
        <p className="text-[12px] mt-1" style={{ color: MUTED }}>
          Create a private league, share the invite code, and settle who really knows Formula 1.
        </p>
        <div className="flex gap-2 mt-3">
          <Link href={`${base}/leagues`} className="flex-1 text-center rounded-xl py-2 text-[13px] font-bold border"
                style={{ color: TEXT2, borderColor: BORDER }}>
            Leagues
          </Link>
          <Link href={`${base}/leaderboard`} className="flex-1 text-center rounded-xl py-2 text-[13px] font-bold border"
                style={{ color: TEXT2, borderColor: BORDER }}>
            Rankings
          </Link>
        </div>
      </section>
    </div>
  );
}

/** Map a constructor display name back to the colour-map key (e.g. "Racing Bulls" → "rb"). */
function constructorKey(name: string): string {
  const d = F1_DRIVERS_2026.find((x) => x.constructorName === name);
  return d?.constructorId ?? "";
}

function fmtRange(fixtures: Fixture[]): string {
  const times = fixtures.map((f) => new Date(f.kicksOffAt).getTime()).sort((a, b) => a - b);
  const fmt = (ms: number) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(ms));
  const a = fmt(times[0]), b = fmt(times[times.length - 1]);
  return a === b ? a : `${a} – ${b}`;
}
function fmtDay(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  } catch { return iso; }
}
