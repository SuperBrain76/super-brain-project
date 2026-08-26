"use client";

/**
 * MotorsportHome — the F1 competition home.
 *
 * The ordering counterpart of PremierLeagueHome/CompetitionHome. F1 gets its
 * own dashboard with a motorsport visual identity (F1Visuals): a dark paddock
 * hero with a checkered finish line, race-weekend session cards (lights-out
 * for the race, stopwatch for qualifying), the drivers'/constructors'
 * championships once a race has settled, and THE GRID — every driver laid out
 * in a staggered starting-grid, so a visitor sees the whole field at a glance.
 *
 * All artwork is our own (F1Visuals) — team colour + name + number only, no
 * logos or liveries (licence-safe).
 *
 * Rendered by app/[competition]/page.tsx when home_style is 'matchweek' AND
 * the sport's kind is 'ordering'.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Competition, Fixture, Team } from "@/lib/predictor";
import { getTeams } from "@/lib/predictor";
import { getCurrentRoundContext, getRoundFixtures, type Round } from "@/lib/competitionEngine";
import { getCompetitionStandings, type CompetitionStandings } from "@/lib/motorsport";
import { F1_DRIVERS_2026, f1DriverByCode, F1_CONSTRUCTOR_COLOURS } from "@/lib/f1/drivers2026";
import ChampionshipTable from "@/components/motorsport/ChampionshipTable";
import {
  CheckeredStrip, CheckeredFlag, LightsOut, Stopwatch, DriverPlate,
  F1_INK, F1_CARBON, F1_LINE,
} from "@/components/motorsport/F1Visuals";

const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const CARD   = "#ffffff";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const OK     = "#1a7a4a";

// Canonical driver order (registry ≈ championship order) so the grid reads
// top-team-first before any real standings exist.
const DRIVER_ORDER = F1_DRIVERS_2026.map((d) => d.code);

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

  // Order the field: by championship if we have it, else canonical order.
  const gridOrder = useMemo(() => {
    const champIndex = new Map((standings?.drivers ?? []).map((r, i) => [r.code ?? "", i]));
    return [...drivers].sort((a, b) => {
      const ca = champIndex.has(a.code) ? champIndex.get(a.code)! : 900 + (DRIVER_ORDER.indexOf(a.code) < 0 ? 99 : DRIVER_ORDER.indexOf(a.code));
      const cb = champIndex.has(b.code) ? champIndex.get(b.code)! : 900 + (DRIVER_ORDER.indexOf(b.code) < 0 ? 99 : DRIVER_ORDER.indexOf(b.code));
      return ca - cb;
    });
  }, [drivers, standings]);

  if (!loaded) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm" style={{ color: MUTED }}>Warming up the grid…</p>
      </div>
    );
  }

  const base = `/${competition.slug}`;
  const predicted = fixtures.filter((f) => f.myOrdering != null).length;
  const open = fixtures.filter((f) => f.status === "scheduled" && new Date(f.kicksOffAt).getTime() > Date.now()).length;
  const hasChampionship = (standings?.drivers.length ?? 0) > 0;
  const roundNo = round?.shortLabel?.replace(/[^0-9]/g, "") || null;

  return (
    <div className="max-w-md mx-auto pb-16">
      {/* ── Paddock hero ─────────────────────────────────────── */}
      <div style={{ background: F1_INK, position: "relative", overflow: "hidden" }}>
        {/* speed streaks */}
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(105deg, transparent 60%, rgba(255,255,255,0.05) 61%, transparent 62%), linear-gradient(105deg, transparent 72%, rgba(255,255,255,0.04) 73%, transparent 74%)",
        }} />
        <div className="px-4 pt-7 pb-5" style={{ position: "relative" }}>
          <div className="flex items-center gap-2">
            <CheckeredFlag size={18} />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#c9ced6" }}>
              2026 World Championship
            </span>
          </div>
          <h1 className="text-[30px] font-extrabold mt-1.5 leading-none" style={{ color: "#fff", letterSpacing: "-0.02em" }}>
            {competition.name}
          </h1>
          <p className="text-[12.5px] mt-2 max-w-[19rem]" style={{ color: "#9aa3ad" }}>
            Call the top five in qualifying and the race. Nail the exact positions and climb the table — beat your mates over a season.
          </p>
        </div>
        <CheckeredStrip height={12} cell={6} />
      </div>

      <div className="px-4">
      {/* ── Next / current Grand Prix, race-weekend styled ───── */}
      {round ? (
        <section className="rounded-2xl border mt-5 mb-5 overflow-hidden" style={{ background: CARD, borderColor: BORDER }}>
          <div className="px-4 pt-4 pb-3" style={{ background: F1_CARBON }}>
            <div className="flex items-center gap-2">
              {roundNo && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: "#e10600", color: "#fff", letterSpacing: "0.05em" }}>
                  ROUND {roundNo}
                </span>
              )}
              <span className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: "#9aa3ad" }}>
                {open > 0 ? "Next Grand Prix" : "This Grand Prix"}
              </span>
            </div>
            <div className="text-[19px] font-extrabold mt-1" style={{ color: "#fff" }}>{round.label}</div>
            {fixtures.length > 0 && (
              <div className="text-[12px] mt-0.5" style={{ color: "#9aa3ad" }}>{fmtRange(fixtures)}</div>
            )}
          </div>

          {/* Sessions */}
          <div className="px-4">
            {fixtures.map((f) => {
              const isRace = f.venue?.endsWith("Race");
              const label = isRace ? "Race" : f.venue?.endsWith("Qualifying") ? "Qualifying" : "Session";
              const done = f.myOrdering != null;
              const isOpen = f.status === "scheduled" && new Date(f.kicksOffAt).getTime() > Date.now();
              return (
                <div key={f.id} className="flex items-center gap-3 py-3 border-b last:border-b-0" style={{ borderColor: "#eef2ea" }}>
                  <span className="shrink-0">{isRace ? <LightsOut on size={15} /> : <Stopwatch size={16} color="#2e4a37" />}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-extrabold" style={{ color: TEXT1 }}>{label} — predict the top 5</div>
                    <div className="text-[11px]" style={{ color: MUTED }}>{fmtDay(f.kicksOffAt)}</div>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-full shrink-0"
                        style={done
                          ? { color: OK, background: "#eaf5ef" }
                          : isOpen ? { color: "#fff", background: TEXT2 } : { color: MUTED, background: "#f0f3ef" }}>
                    {done ? "Predicted ✓" : isOpen ? "Open" : "Locked"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="px-4 pt-3 pb-4">
            <div className="text-[12px] mb-2 font-semibold" style={{ color: predicted === fixtures.length && fixtures.length > 0 ? OK : MUTED }}>
              {fixtures.length === 0 ? "Sessions appear here once scheduled."
                : predicted === fixtures.length ? "Both sessions predicted ✓"
                : `${predicted}/${fixtures.length} sessions predicted`}
            </div>
            <Link href={`${base}/predict`}
                  className="block w-full text-center rounded-xl py-3 text-[14px] font-extrabold"
                  style={{ background: F1_INK, color: "#fff", letterSpacing: "0.02em" }}>
              {predicted === fixtures.length && fixtures.length > 0 ? "Review your picks" : "Lights out — predict the top five →"}
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border mt-5 mb-5 px-4 py-6 text-center" style={{ background: CARD, borderColor: BORDER }}>
          <p className="text-[13px]" style={{ color: MUTED }}>The next round hasn&apos;t been scheduled yet.</p>
        </section>
      )}

      {/* ── Championship ─────────────────────────────────────── */}
      {hasChampionship ? (
        <>
          <section className="rounded-2xl border mb-4 px-4 py-4" style={{ background: CARD, borderColor: BORDER }}>
            <SectionTitle label="Drivers' championship" href={`${base}/standings`} />
            <div className="mt-2">
              <ChampionshipTable rows={standings!.drivers.slice(0, 5)} scope="driver" throughRound={standings!.throughRound} />
            </div>
          </section>
          {standings!.constructors.length > 0 && (
            <section className="rounded-2xl border mb-5 px-4 py-4" style={{ background: CARD, borderColor: BORDER }}>
              <SectionTitle label="Constructors' championship" href={`${base}/standings`} />
              <div className="mt-2">
                <ChampionshipTable rows={standings!.constructors.slice(0, 5)} scope="constructor" throughRound={standings!.throughRound} />
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-2xl border mb-5 px-4 py-4 flex items-center gap-3" style={{ background: CARD, borderColor: BORDER }}>
          <CheckeredFlag size={22} />
          <div>
            <div className="text-[13px] font-extrabold" style={{ color: TEXT1 }}>Championship starts soon</div>
            <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
              The drivers&apos; and constructors&apos; tables light up after the {round?.label ?? "first Grand Prix"}.
            </p>
          </div>
        </section>
      )}

      {/* ── THE GRID — staggered starting grid ───────────────── */}
      {drivers.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center justify-between px-1 mb-2.5">
            <div className="flex items-center gap-1.5">
              <CheckeredFlag size={15} />
              <span className="text-[11px] uppercase tracking-[0.15em] font-bold" style={{ color: TEXT2 }}>
                The grid
              </span>
            </div>
            <span className="text-[11px]" style={{ color: MUTED }}>{drivers.length} drivers · {new Set(drivers.map((d) => d.groupName)).size} teams</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {gridOrder.map((car, i) => {
              const reg = f1DriverByCode(car.code);
              const colour = reg?.primary ?? F1_CONSTRUCTOR_COLOURS[""] ?? "#44584a";
              // Stagger the right column down half a slot for the grid look.
              const rightCol = i % 2 === 1;
              return (
                <div key={car.id}
                     className="rounded-xl border overflow-hidden"
                     style={{ background: CARD, borderColor: BORDER, marginTop: rightCol ? 18 : 0 }}>
                  <div style={{ height: 3, background: colour }} />
                  <div className="px-2.5 py-2.5 flex items-center gap-2.5">
                    <span className="text-[11px] font-black tabular-nums w-4 text-center shrink-0" style={{ color: MUTED }}>
                      {i + 1}
                    </span>
                    <DriverPlate code={car.code} colour={colour} number={reg?.number ?? null} size={38} />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-extrabold truncate leading-tight" style={{ color: TEXT1 }}>
                        {reg?.short ?? car.name}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: MUTED }}>{car.groupName ?? ""}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-center mt-3" style={{ color: MUTED }}>
            {hasChampionship ? "Ordered by the drivers' championship." : "The 2026 line-up — championship order once the lights go out."}
          </p>
        </section>
      )}

      {/* ── Leagues CTA ──────────────────────────────────────── */}
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
    </div>
  );
}

function SectionTitle({ label, href }: { label: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-[11px] uppercase tracking-[0.15em] font-bold" style={{ color: MUTED }}>{label}</div>
      <Link href={href} className="text-[11px] font-bold" style={{ color: TEXT2 }}>Full table →</Link>
    </div>
  );
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
