"use client";

/**
 * CompetitionHome — the single living dashboard.
 *
 * docs/PREMIER_LEAGUE_UX.md §2 and §9. ONE screen, changes state through the
 * matchweek (Preview → Open → Locked → Live → Results → Break). No separate
 * preview page — this is the competition's home, and it is always right.
 *
 * The state decision is lib/matchweek.ts (pure, tested). This component only
 * renders each state. Mobile-first: a phone-width column that widens on
 * desktop, never the reverse.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Fixture } from "@/lib/predictor";
import type { Round, CompetitionSettings } from "@/lib/competitionEngine";
import type { MyStats } from "@/lib/predictor";
import {
  deriveMatchweekView, stateHeadline, statePrimaryAction, formatCountdown,
  type MatchweekView,
} from "@/lib/matchweek";
import { useCompetitionSlug } from "@/components/CompetitionProvider";
import ClubCrest from "@/components/premier/ClubCrest";

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

export interface HomeData {
  round:          Round | null;
  fixtures:       Fixture[];
  nextRoundStartsMs: number | null;
  settings:       CompetitionSettings;
  stats:          MyStats | null;
  leaguePreview:  { name: string; rank: number; total: number } | null;
  biggestMatch:   Fixture | null;
  biggestWhy?:    string;
  challengeCount: number;
  challengesAnswered: number;
  editorial:      { headline: string; players: string[] } | null;
}

export default function CompetitionHome({
  data,
  clock = Date.now,
}: {
  data: HomeData;
  /**
   * Time source. Defaults to the real clock; the playable prototype injects
   * a shifted clock so the dashboard's state follows its time-travel. The
   * whole state machine is a function of "now", so this is the only hook the
   * prototype needs to walk it through every state.
   */
  clock?: () => number;
}) {
  const slug = useCompetitionSlug();
  const base = slug ? `/${slug}` : "/predict";

  const [nowMs, setNowMs] = useState(() => clock());
  useEffect(() => {
    // 1s tick when a countdown is on screen; the view recomputes cheaply.
    const t = setInterval(() => setNowMs(clock()), 1000);
    return () => clearInterval(t);
  }, [clock]);

  const view = useMemo(
    () => deriveMatchweekView(data.round, data.fixtures, nowMs, data.nextRoundStartsMs),
    [data.round, data.fixtures, data.nextRoundStartsMs, nowMs],
  );

  return (
    <div className="max-w-md mx-auto w-full px-4 py-4 flex flex-col gap-3">
      <StateHeader view={view} nowMs={nowMs} roundLabel={data.round?.label ?? "Matchweek"} />

      {/* The hero block is state-specific. */}
      {view.state === "preview" && <PreviewHero view={view} data={data} base={base} nowMs={nowMs} />}
      {view.state === "open"    && <OpenHero    view={view} base={base} />}
      {view.state === "locked"  && <LockedHero  view={view} base={base} />}
      {view.state === "live"    && <LiveHero    view={view} data={data} base={base} />}
      {view.state === "results" && <ResultsHero view={view} data={data} base={base} />}
      {view.state === "break"   && <BreakHero   data={data} base={base} nowMs={nowMs} />}

      {/* The persistent context strip — always present, below the hero. */}
      {view.state !== "break" && <BiggestMatch fixture={data.biggestMatch} base={base} why={data.biggestWhy} />}
      {data.challengeCount > 0 && view.state !== "results" && (
        <ChallengeStrip view={view} data={data} base={base} nowMs={nowMs} />
      )}
      <LeagueStrip data={data} base={base} />
      <SeasonStrip stats={data.stats} />

      <Link href={`${base}/matchweek/${data.round?.code ?? ""}`}
            className="text-center text-xs font-semibold py-2" style={{ color: GREEN }}>
        See all {view.total} fixtures →
      </Link>
    </div>
  );
}

// ── Header — state badge + one-line summary ──────────────────

function StateHeader({ view, nowMs, roundLabel }: { view: MatchweekView; nowMs: number; roundLabel: string }) {
  const badge: Record<string, { text: string; bg: string; fg: string }> = {
    preview: { text: "PREVIEW",  bg: "#eef3ec", fg: TEXT2 },
    open:    { text: "OPEN",     bg: "#e4f2e9", fg: OK },
    locked:  { text: "LOCKED",   bg: "#f0ede4", fg: MUTED },
    live:    { text: `● ${view.liveNow} LIVE`, bg: "#fbeae7", fg: LIVE },
    results: { text: "COMPLETE", bg: "#eef3ec", fg: TEXT2 },
    break:   { text: "BREAK",    bg: "#eef3ec", fg: MUTED },
  };
  const b = badge[view.state];

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-lg font-bold" style={{ color: TEXT1 }}>{roundLabel}</h1>
      <span className="text-[11px] font-bold px-2 py-1 rounded" style={{ background: b.bg, color: b.fg }}>
        {b.text}
      </span>
    </div>
  );
}

// ── PREVIEW ───────────────────────────────────────────────────

function PreviewHero({ view, data, base, nowMs }: { view: MatchweekView; data: HomeData; base: string; nowMs: number }) {
  return (
    <Hero>
      <p className="text-xs" style={{ color: MUTED }}>
        {view.challengeLock ? `Predictions open — locks in ${formatCountdown(view.challengeLock, nowMs)}` : "Fixtures confirmed"}
      </p>
      {data.editorial && (
        <div className="mt-3">
          <p className="text-sm font-semibold" style={{ color: TEXT1 }}>{data.editorial.headline}</p>
          {data.editorial.players.length > 0 && (
            <p className="text-xs mt-1" style={{ color: TEXT2 }}>
              ⭐ Watch: {data.editorial.players.join(" · ")}
            </p>
          )}
        </div>
      )}
      <Link href={`${base}/predict`} className="mt-3">
        <PrimaryButton>See the fixtures →</PrimaryButton>
      </Link>
    </Hero>
  );
}

// ── OPEN — the predict-now hero ───────────────────────────────

function OpenHero({ view, base }: { view: MatchweekView; base: string }) {
  const action = statePrimaryAction(view);
  return (
    <Link href={`${base}/predict`}>
      <div className="rounded-2xl p-5 text-center" style={{ background: GREEN, color: "#fff" }}>
        <div className="text-xs opacity-80 mb-1">
          {view.predicted}/{view.total} predicted
        </div>
        <div className="text-lg font-bold mb-3">{action.label}</div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.25)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct(view.predicted, view.total)}%`, background: "#fff" }} />
        </div>
      </div>
    </Link>
  );
}

// ── LOCKED ────────────────────────────────────────────────────

function LockedHero({ view, base }: { view: MatchweekView; base: string }) {
  return (
    <Hero>
      <p className="text-sm font-bold" style={{ color: TEXT1 }}>You’re in.</p>
      <p className="text-xs mt-1" style={{ color: MUTED }}>
        {view.predicted}/{view.total} predicted. First match soon — points go live as goals go in.
      </p>
      <Link href={`${base}/predict`} className="mt-3">
        <SecondaryButton>Review your predictions</SecondaryButton>
      </Link>
    </Hero>
  );
}

// ── LIVE — the most exciting screen ───────────────────────────

function LiveHero({ view, data, base }: { view: MatchweekView; data: HomeData; base: string }) {
  // Sum points earned so far this round from predictions already scored.
  const pointsSoFar = data.fixtures.reduce(
    (n, f) => n + (f.myPrediction?.pointsAwarded ?? 0), 0);

  return (
    <div className="rounded-2xl p-5 text-center" style={{ background: "#1a1410", color: "#fff", border: `1px solid ${GOLD}` }}>
      <div className="text-xs" style={{ color: GOLD }}>● {view.liveNow} matches live</div>
      <div className="text-3xl font-extrabold my-1">{pointsSoFar} pts</div>
      <div className="text-xs opacity-70">so far this matchweek</div>
      <Link href={`${base}/matchweek/${data.round?.code ?? ""}`} className="inline-block mt-3">
        <span className="text-xs font-semibold px-4 py-2 rounded-lg inline-block" style={{ background: GOLD, color: "#1a1410" }}>
          Watch it live →
        </span>
      </Link>
    </div>
  );
}

// ── RESULTS — the payoff ──────────────────────────────────────

function ResultsHero({ view, data, base }: { view: MatchweekView; data: HomeData; base: string }) {
  const pts    = data.fixtures.reduce((n, f) => n + (f.myPrediction?.pointsAwarded ?? 0), 0);
  const exact  = data.fixtures.filter((f) => f.myPrediction?.pointsAwarded === 5).length;
  const gd     = data.fixtures.filter((f) => f.myPrediction?.pointsAwarded === 3).length;
  const result = data.fixtures.filter((f) => f.myPrediction?.pointsAwarded === 2).length;
  const miss   = data.fixtures.filter((f) => f.myPrediction?.pointsAwarded === 0).length;

  return (
    <Hero center>
      <div className="text-3xl font-extrabold" style={{ color: GREEN }}>{pts} points</div>
      <p className="text-xs mt-1" style={{ color: MUTED }}>
        {exact} exact · {gd} GD · {result} result · {miss} miss
      </p>
      <div className="flex gap-2 mt-4 justify-center">
        <Link href={`${base}/matchweek/${data.round?.code ?? ""}`}>
          <SecondaryButton>Full results</SecondaryButton>
        </Link>
        <Link href={`${base}/leaderboard`}>
          <PrimaryButton>Leaderboard →</PrimaryButton>
        </Link>
      </div>
      {view.total > 0 && (
        <p className="text-[11px] mt-3" style={{ color: MUTED }}>Next matchweek opens soon.</p>
      )}
    </Hero>
  );
}

// ── BREAK — retain without football ───────────────────────────

function BreakHero({ data, base, nowMs }: { data: HomeData; base: string; nowMs: number }) {
  const days = data.nextRoundStartsMs
    ? Math.ceil((data.nextRoundStartsMs - nowMs) / (24 * 3600_000))
    : null;
  return (
    <Hero center>
      <p className="text-sm font-bold" style={{ color: TEXT1 }}>International break</p>
      <p className="text-xs mt-1" style={{ color: MUTED }}>
        {days ? `No Premier League for ${days} days.` : "No matches this week."}
      </p>
      <div className="flex gap-2 mt-4 justify-center">
        <Link href={`${base}/standings`}><SecondaryButton>League table</SecondaryButton></Link>
        <Link href={`${base}/leaderboard`}><PrimaryButton>Your ranking</PrimaryButton></Link>
      </div>
    </Hero>
  );
}

// ── Context strips ────────────────────────────────────────────

function BiggestMatch({ fixture, base, why }: { fixture: Fixture | null; base: string; why?: string }) {
  if (!fixture) return null;
  const ko = new Date(fixture.kicksOffAt);
  const when = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(ko);
  return (
    <Link href={`${base}/fixture/${fixture.id}`}>
      <Strip>
        <span className="text-base">🔥</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <ClubCrest code={fixture.homeTeam?.code} size={20} />
            <span className="text-xs font-bold" style={{ color: TEXT1 }}>
              {fixture.homeTeam?.name} v {fixture.awayTeam?.name}
            </span>
            <ClubCrest code={fixture.awayTeam?.code} size={20} />
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>
            {why ?? `Biggest match · ${when}`}
          </div>
        </div>
      </Strip>
    </Link>
  );
}

function ChallengeStrip({ view, data, base, nowMs }: { view: MatchweekView; data: HomeData; base: string; nowMs: number }) {
  const done = data.challengesAnswered;
  return (
    <Link href={`${base}/challenges`}>
      <Strip>
        <span className="text-base">🧠</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold" style={{ color: TEXT1 }}>
            {data.challengeCount} Matchday Challenges
          </div>
          <div className="text-[11px]" style={{ color: MUTED }}>
            {done}/{data.challengeCount} answered
            {view.challengeLock ? ` · lock in ${formatCountdown(view.challengeLock, nowMs)}` : ""}
          </div>
        </div>
      </Strip>
    </Link>
  );
}

function LeagueStrip({ data, base }: { data: HomeData; base: string }) {
  const lp = data.leaguePreview;
  return (
    <Link href={`${base}/leagues`}>
      <Strip>
        <span className="text-base">⚔️</span>
        <div className="flex-1 min-w-0">
          {lp ? (
            <>
              <div className="text-xs font-bold" style={{ color: TEXT1 }}>{lp.name}</div>
              <div className="text-[11px]" style={{ color: MUTED }}>{ordinal(lp.rank)} of {lp.total}</div>
            </>
          ) : (
            <div className="text-xs font-bold" style={{ color: TEXT1 }}>Create or join a private league</div>
          )}
        </div>
      </Strip>
    </Link>
  );
}

function SeasonStrip({ stats }: { stats: MyStats | null }) {
  if (!stats) return null;
  return (
    <Strip>
      <span className="text-base">📈</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold" style={{ color: TEXT1 }}>Season · {stats.totalPoints} pts</div>
        <div className="text-[11px]" style={{ color: MUTED }}>
          {stats.globalRank ? `#${stats.globalRank} overall` : "Unranked"} · {stats.predictions} predictions
        </div>
      </div>
    </Strip>
  );
}

// ── Primitives ────────────────────────────────────────────────

function Hero({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${center ? "text-center" : ""}`} style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      {children}
    </div>
  );
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      {children}
    </div>
  );
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block w-full text-center text-xs font-bold px-4 py-2.5 rounded-lg" style={{ background: GREEN, color: "#fff" }}>
      {children}
    </span>
  );
}

function SecondaryButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block w-full text-center text-xs font-semibold px-4 py-2.5 rounded-lg" style={{ background: "#f4f7f2", color: GREEN, border: `1px solid ${BORDER}` }}>
      {children}
    </span>
  );
}

function pct(a: number, b: number) { return b ? Math.round((a / b) * 100) : 0; }
function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
