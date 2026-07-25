"use client";

/**
 * CompetitionHome — the living dashboard, redesigned to answer one question:
 * "Why should I care about this weekend?"
 *
 * You open SuperBrain on Friday and feel the weekend before you've made a
 * single prediction: the featured match, the countdown, the crowd, your
 * progress, and your growing SuperBrain (IQ). State-aware across the matchweek
 * (Preview → Open → Locked → Live → Results → Break). Mobile-first, dense.
 *
 * The state decision is lib/matchweek.ts (pure, tested); this component only
 * renders it.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Fixture, MyStats } from "@/lib/predictor";
import type { Round, CompetitionSettings } from "@/lib/competitionEngine";
import { deriveMatchweekView, formatCountdown, type MatchweekView } from "@/lib/matchweek";
import { iqStanding } from "@/lib/iqLevel";
import { useCompetitionSlug } from "@/components/CompetitionProvider";
import ClubCrest, { clubShort } from "@/components/premier/ClubCrest";
import { club } from "@/lib/premierLeague/clubs";
import type { FixtureStats } from "@/components/premier/MatchweekSheet";

// ── Tokens ────────────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const CARD   = "#ffffff";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const LIVE   = "#c0392b";
const OK     = "#1a7a4a";
const BG2    = "#f4f7f2";

export interface HomeData {
  round:             Round | null;
  fixtures:          Fixture[];
  nextRoundStartsMs: number | null;
  settings:          CompetitionSettings;
  stats:             MyStats | null;
  leaguePreview:     { name: string; rank: number; total: number } | null;
  biggestMatch:      Fixture | null;
  biggestWhy?:       string;
  challengeCount:    number;
  challengesAnswered: number;
  editorial:         { headline: string; players: string[] } | null;

  // ── Community + economy (the "why care") ──
  competitionName?:  string;
  playerCount?:      number;    // people playing this competition
  leagueCount?:      number;    // private leagues running
  iqAvailable?:      number;    // biggest IQ haul on offer this matchweek
  featuredStats?:    FixtureStats | null;   // the crowd's split on the featured match
  iqLifetime?:       number;    // building your SuperBrain
  iqThisCompetition?: number;   // season IQ in this competition
  lastWeekend?:      { roundLabel: string; rank: number; movement: number; iq: number } | null;
}

export default function CompetitionHome({ data, clock = Date.now }: { data: HomeData; clock?: () => number }) {
  const slug = useCompetitionSlug();
  const base = slug ? `/${slug}` : "/predict";

  const [nowMs, setNowMs] = useState(() => clock());
  useEffect(() => {
    const t = setInterval(() => setNowMs(clock()), 1000);
    return () => clearInterval(t);
  }, [clock]);

  const view = useMemo(
    () => deriveMatchweekView(data.round, data.fixtures, nowMs, data.nextRoundStartsMs),
    [data.round, data.fixtures, data.nextRoundStartsMs, nowMs],
  );

  const compName = data.competitionName ?? "Premier League";
  const pointsSoFar = data.fixtures.reduce((n, f) => n + (f.myPrediction?.pointsAwarded ?? 0), 0);

  return (
    <div className="max-w-md mx-auto w-full px-4 py-4 flex flex-col gap-3">
      <Header compName={compName} view={view} nowMs={nowMs} />

      {/* Break state gets its own quiet layout. */}
      {view.state === "break" ? (
        <BreakBlock data={data} base={base} nowMs={nowMs} />
      ) : (
        <>
          <FeaturedMatch data={data} view={view} base={base} nowMs={nowMs} pointsSoFar={pointsSoFar} />
          <ThisWeek data={data} view={view} />
          {data.featuredStats && data.featuredStats.total > 0 && data.biggestMatch && (
            <TrendingPicks fixture={data.biggestMatch} stats={data.featuredStats} />
          )}
          <YourWeekend data={data} view={view} base={base} pointsSoFar={pointsSoFar} />
        </>
      )}

      <YourSuperBrain data={data} base={base} />
      {data.lastWeekend && <LastWeekend lw={data.lastWeekend} base={base} />}
      <LeagueStrip data={data} base={base} />

      <Link href={`${base}/matchweek/${data.round?.code ?? ""}`}
            className="text-center text-xs font-semibold py-1" style={{ color: GREEN }}>
        See all {view.total} fixtures →
      </Link>
    </div>
  );
}

// ── Header — competition + matchweek + live countdown ────────

function Header({ compName, view, nowMs }: { compName: string; view: MatchweekView; nowMs: number }) {
  const pill = statePill(view);
  const countdown = view.state === "open" && view.challengeLock
    ? `Starts in ${formatCountdown(view.challengeLock, nowMs)}`
    : view.state === "preview" && view.firstKickoff
      ? `Kicks off ${formatCountdown(view.firstKickoff, nowMs)}`
      : null;

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: GREEN }}>
          ⚽ {compName}
        </div>
        <h1 className="text-xl font-extrabold leading-tight" style={{ color: TEXT1 }}>
          {view.round?.label ?? "Matchweek"}
        </h1>
      </div>
      <div className="text-right">
        <span className="text-[11px] font-bold px-2 py-1 rounded" style={{ background: pill.bg, color: pill.fg }}>
          {pill.text}
        </span>
        {countdown && <div className="text-[11px] mt-1 font-semibold" style={{ color: TEXT2 }}>🟢 {countdown}</div>}
      </div>
    </div>
  );
}

function statePill(v: MatchweekView): { text: string; bg: string; fg: string } {
  switch (v.state) {
    case "preview": return { text: "PREVIEW",  bg: "#eef3ec", fg: TEXT2 };
    case "open":    return { text: "OPEN",     bg: "#e4f2e9", fg: OK };
    case "locked":  return { text: "LOCKED",   bg: "#f0ede4", fg: MUTED };
    case "live":    return { text: `● ${v.liveNow} LIVE`, bg: "#fbeae7", fg: LIVE };
    case "results": return { text: "COMPLETE", bg: "#eef3ec", fg: TEXT2 };
    case "break":   return { text: "BREAK",    bg: "#eef3ec", fg: MUTED };
  }
}

// ── Featured match — the emotional hook ──────────────────────

function FeaturedMatch({ data, view, base, nowMs, pointsSoFar }: {
  data: HomeData; view: MatchweekView; base: string; nowMs: number; pointsSoFar: number;
}) {
  const f = data.biggestMatch;
  if (!f) return null;
  const homeC = f.homeTeam?.code ? club(f.homeTeam.code)?.primary : undefined;
  const awayC = f.awayTeam?.code ? club(f.awayTeam.code)?.primary : undefined;
  const when = new Intl.DateTimeFormat("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(f.kicksOffAt));

  // The CTA follows the state.
  const cta = view.state === "results"
    ? { label: `You scored ${pointsSoFar} — see results →`, href: `${base}/matchweek/${data.round?.code ?? ""}` }
    : view.state === "live"
      ? { label: `${pointsSoFar} pts live — watch →`, href: `${base}/matchweek/${data.round?.code ?? ""}` }
      : view.state === "locked"
        ? { label: "You're in — review picks", href: `${base}/predict` }
        : { label: view.outstanding > 0 ? `Predict ${view.outstanding} match${view.outstanding === 1 ? "" : "es"} →` : "Edit your predictions", href: `${base}/predict` };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
      <div className="px-4 pt-3 pb-2" style={{ background: `linear-gradient(120deg, ${(homeC ?? GREEN)}14, ${(awayC ?? GREEN)}14)` }}>
        <div className="text-[10px] font-bold tracking-wide uppercase" style={{ color: LIVE }}>🔥 Featured match</div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-col items-center gap-1 flex-1">
            <ClubCrest code={f.homeTeam?.code} size={40} />
            <span className="text-xs font-bold text-center leading-tight" style={{ color: TEXT1 }}>{f.homeTeam?.name}</span>
          </div>
          <span className="text-sm font-bold px-2" style={{ color: MUTED }}>v</span>
          <div className="flex flex-col items-center gap-1 flex-1">
            <ClubCrest code={f.awayTeam?.code} size={40} />
            <span className="text-xs font-bold text-center leading-tight" style={{ color: TEXT1 }}>{f.awayTeam?.name}</span>
          </div>
        </div>
        <div className="text-center text-[11px] mt-1.5 font-semibold" style={{ color: TEXT2 }}>{when}</div>
      </div>
      {(data.biggestWhy || data.editorial?.headline) && (
        <div className="px-4 py-2 text-[12px] leading-snug" style={{ color: TEXT2, background: CARD }}>
          {data.biggestWhy ?? data.editorial?.headline}
        </div>
      )}
      <Link href={cta.href}>
        <div className="text-center py-2.5 text-sm font-bold" style={{ background: GREEN, color: "#fff" }}>
          {cta.label}
        </div>
      </Link>
    </div>
  );
}

// ── This Week — the numbers that make it feel big ────────────

function ThisWeek({ data, view }: { data: HomeData; view: MatchweekView }) {
  const cells: [string, string][] = [
    [`${view.total}`, "Matches"],
    [data.iqAvailable ? `${data.iqAvailable} IQ` : "—", "Available"],
    [data.playerCount != null ? data.playerCount.toLocaleString() : "—", "Players"],
    [data.leagueCount != null ? data.leagueCount.toLocaleString() : "—", "Leagues"],
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map(([v, l]) => (
        <div key={l} className="rounded-xl py-2.5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <div className="text-sm font-extrabold" style={{ color: TEXT1 }}>{v}</div>
          <div className="text-[9px] uppercase tracking-wide" style={{ color: MUTED }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// ── Trending picks — the crowd on the featured match ─────────

function TrendingPicks({ fixture, stats }: { fixture: Fixture; stats: FixtureStats }) {
  const homeC = fixture.homeTeam?.code ? club(fixture.homeTeam.code)?.primary : GREEN;
  const awayC = fixture.awayTeam?.code ? club(fixture.awayTeam.code)?.primary : MUTED;
  const rows: [string, number, string][] = [
    [clubShort(fixture.homeTeam?.code), stats.homePct, homeC ?? GREEN],
    ["Draw", stats.drawPct, "#b8c4bb"],
    [clubShort(fixture.awayTeam?.code), stats.awayPct, awayC ?? MUTED],
  ];
  return (
    <div className="rounded-2xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: LIVE }}>🔥 Trending picks</div>
      <div className="flex flex-col gap-1.5">
        {rows.map(([label, pct, color]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs font-bold w-8" style={{ color: TEXT1 }}>{pct}%</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: BG2 }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width .4s" }} />
            </div>
            <span className="text-[11px] font-semibold w-20 truncate" style={{ color: TEXT2 }}>{label}</span>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-center mt-1.5" style={{ color: MUTED }}>{stats.total.toLocaleString()} predictions so far</div>
    </div>
  );
}

// ── Your Weekend — progress / payoff by state ────────────────

function YourWeekend({ data, view, base, pointsSoFar }: { data: HomeData; view: MatchweekView; base: string; pointsSoFar: number }) {
  if (view.state === "results") {
    const exact = data.fixtures.filter((f) => f.myPrediction?.pointsAwarded === 5).length;
    return (
      <Panel icon="🏆" title="Your weekend">
        <div className="text-center">
          <div className="text-2xl font-extrabold" style={{ color: GREEN }}>{pointsSoFar} points</div>
          <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>{exact} exact · {data.stats?.globalRank ? `#${data.stats.globalRank} overall` : "ranked soon"}</div>
        </div>
      </Panel>
    );
  }
  if (view.state === "live") {
    return (
      <Panel icon="🏆" title="Your weekend">
        <div className="text-center">
          <div className="text-2xl font-extrabold" style={{ color: LIVE }}>{pointsSoFar} pts</div>
          <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>and counting — {view.liveNow} live now</div>
        </div>
      </Panel>
    );
  }
  // preview / open / locked → progress
  const done = view.predicted, total = view.total;
  const need = view.outstanding;
  return (
    <Link href={`${base}/predict`}>
      <Panel icon="🏆" title="Your weekend">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-bold" style={{ color: TEXT1 }}>
            {done === total ? "All predicted ✓" : `${done} of ${total} predicted`}
          </span>
          {need > 0 && <span className="text-[11px] font-semibold" style={{ color: GOLD }}>Need {need} more</span>}
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: BG2 }}>
          <div className="h-full rounded-full" style={{ width: `${total ? (done / total) * 100 : 0}%`, background: done === total ? OK : GREEN }} />
        </div>
      </Panel>
    </Link>
  );
}

// ── Your SuperBrain — the IQ economy ─────────────────────────

function YourSuperBrain({ data, base }: { data: HomeData; base: string }) {
  const lifetime = data.iqLifetime ?? 0;
  const st = iqStanding(lifetime);
  const season = data.iqThisCompetition ?? 0;

  return (
    <Link href="/iq">
      <div className="rounded-2xl p-3.5" style={{ background: "#12100b", color: "#fff", border: `1px solid ${GOLD}55` }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>🧠 Your SuperBrain</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${st.level.color}22`, color: st.level.color }}>
            {st.level.icon} {st.level.name}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center mb-2.5">
          <IqStat label="This season" value={season} />
          <IqStat label="Lifetime" value={lifetime} gold />
          <IqStat label="Level" value={st.level.name} isText />
        </div>
        {st.next && (
          <>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.12)" }}>
              <div className="h-full rounded-full" style={{ width: `${st.progressPct}%`, background: st.next.color }} />
            </div>
            <div className="text-[10px] mt-1" style={{ color: "#9aa0a6" }}>
              {st.toNext.toLocaleString()} IQ to <span style={{ color: st.next.color }}>{st.next.icon} {st.next.name}</span>
            </div>
          </>
        )}
      </div>
    </Link>
  );
}

function IqStat({ label, value, gold, isText }: { label: string; value: number | string; gold?: boolean; isText?: boolean }) {
  return (
    <div>
      <div className="text-base font-extrabold" style={{ color: gold ? GOLD : "#fff" }}>
        {isText ? value : (value as number).toLocaleString()}
      </div>
      <div className="text-[9px] uppercase tracking-wide" style={{ color: "#9aa0a6" }}>{label}</div>
    </div>
  );
}

// ── Last Weekend — the return-hook memory ────────────────────

function LastWeekend({ lw, base }: { lw: NonNullable<HomeData["lastWeekend"]>; base: string }) {
  const up = lw.movement > 0;
  return (
    <Panel icon="📈" title={`Last weekend · ${lw.roundLabel}`}>
      <div className="flex items-center justify-around text-center">
        <div>
          <div className="text-lg font-extrabold" style={{ color: TEXT1 }}>#{lw.rank}</div>
          <div className="text-[9px] uppercase" style={{ color: MUTED }}>Finished</div>
        </div>
        <div>
          <div className="text-lg font-extrabold" style={{ color: up ? OK : lw.movement < 0 ? LIVE : MUTED }}>
            {up ? "↑" : lw.movement < 0 ? "↓" : "–"} {Math.abs(lw.movement)}
          </div>
          <div className="text-[9px] uppercase" style={{ color: MUTED }}>Places</div>
        </div>
        <div>
          <div className="text-lg font-extrabold" style={{ color: GOLD }}>+{lw.iq}</div>
          <div className="text-[9px] uppercase" style={{ color: MUTED }}>IQ</div>
        </div>
      </div>
    </Panel>
  );
}

// ── League strip ─────────────────────────────────────────────

function LeagueStrip({ data, base }: { data: HomeData; base: string }) {
  const lp = data.leaguePreview;
  return (
    <Link href={`${base}/leagues`}>
      <div className="rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <span className="text-base">⚔️</span>
        <div className="flex-1 min-w-0">
          {lp ? (
            <>
              <div className="text-xs font-bold" style={{ color: TEXT1 }}>{lp.name}</div>
              <div className="text-[11px]" style={{ color: MUTED }}>{ordinal(lp.rank)} of {lp.total}</div>
            </>
          ) : (
            <div className="text-xs font-bold" style={{ color: TEXT1 }}>Create or join a private league →</div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Break state ──────────────────────────────────────────────

function BreakBlock({ data, base, nowMs }: { data: HomeData; base: string; nowMs: number }) {
  const days = data.nextRoundStartsMs ? Math.ceil((data.nextRoundStartsMs - nowMs) / (24 * 3600_000)) : null;
  return (
    <div className="rounded-2xl p-5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="text-sm font-bold" style={{ color: TEXT1 }}>International break</p>
      <p className="text-xs mt-1" style={{ color: MUTED }}>
        {days ? `No football for ${days} days.` : "No matches this week."} Good time to check the table.
      </p>
      <div className="flex gap-2 mt-4 justify-center">
        <Link href={`${base}/standings`}><SecondaryBtn>League table</SecondaryBtn></Link>
        <Link href={`${base}/leaderboard`}><PrimaryBtn>Your ranking</PrimaryBtn></Link>
      </div>
    </div>
  );
}

// ── Primitives ───────────────────────────────────────────────

function Panel({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>{icon} {title}</div>
      {children}
    </div>
  );
}

function PrimaryBtn({ children }: { children: React.ReactNode }) {
  return <span className="inline-block text-xs font-bold px-4 py-2 rounded-lg" style={{ background: GREEN, color: "#fff" }}>{children}</span>;
}
function SecondaryBtn({ children }: { children: React.ReactNode }) {
  return <span className="inline-block text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: BG2, color: GREEN, border: `1px solid ${BORDER}` }}>{children}</span>;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
