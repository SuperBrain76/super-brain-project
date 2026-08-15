"use client";

/**
 * MatchweekSheet — the one-screen Premier League prediction sheet.
 *
 * docs/PREMIER_LEAGUE_UX.md §4.2 and §9.
 *
 * ────────────────────────────────────────────────────────────
 * THE INTERACTION
 * ────────────────────────────────────────────────────────────
 *   • All fixtures on one screen, grouped by kickoff slot.
 *   • Inline Home / Draw / Away — ONE TAP autosaves a prediction.
 *   • Optional exact-score stepper per row for the 5s and 3s.
 *   • Autosave after every change. No Save button — that would be one
 *     moment where a 10-fixture form could be lost.
 *   • Mobile-first: this is built for a phone ten minutes before kickoff.
 *
 * Autosave is optimistic and debounced-per-fixture. The UI updates
 * instantly; the write follows. A failed write reverts that ONE row and
 * shows it, never discarding the rest of the sheet.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Fixture } from "@/lib/predictor";
import { upsertPrediction, setBanker } from "@/lib/predictor";
import {
  type Outcome, type ScorePick, type BulkTarget,
  scoreForOutcome, pickFromFixture, selectedOutcome,
  stepGoals, groupByKickoff, sheetProgress, matchweekDateRange,
  copyFromPreviousRound, fillRemaining,
} from "@/lib/matchweekPredictions";
import { track } from "@/lib/analytics";
import ClubCrest, { clubShort } from "@/components/premier/ClubCrest";
import CompletionCelebration from "@/components/premier/CompletionCelebration";
import { club, textOn } from "@/lib/premierLeague/clubs";
import { localZoneLabel } from "@/lib/localTime";

/** Aggregated community prediction split for one fixture (from the crowd). */
export interface FixtureStats {
  total:    number;   // predictions cast so far
  homePct:  number;
  drawPct:  number;
  awayPct:  number;
}

// ── Tokens (predict-shell light theme) ────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const CARD   = "#ffffff";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";
const OK      = "#1a7a4a";
const WARN    = "#b8972a";
const ERRC    = "#c0392b";

type RowStatus = "idle" | "saving" | "saved" | "error";

/**
 * How the sheet persists a pick. Defaults to the live Supabase upsert; the
 * playable prototype injects a local-storage version so the exact same sheet
 * can be tested end-to-end without a database.
 */
export type SavePrediction = (
  fixtureId: string, home: number, away: number,
) => Promise<{ error: string | null }>;

export default function MatchweekSheet({
  fixtures,
  previousFixtures = [],
  roundLabel,
  onChanged,
  onSave = upsertPrediction,
  clock = Date.now,
  maxIq = 500,
  playerCount,
  statsByFixture,
  onViewLeaderboard,
  onShare,
  onSetBanker = setBanker,
}: {
  fixtures:          Fixture[];
  previousFixtures?: Fixture[];
  roundLabel:        string;
  onChanged?:        () => void;
  onSave?:           SavePrediction;
  /** Persist the banker choice. Defaults to the live RPC; the prototype injects a local version. */
  onSetBanker?:      (fixtureId: string, isBanker: boolean) => Promise<{ error: string | null }>;
  /** Time source — the prototype injects a shifted clock so fixtures lock at the travelled time. */
  clock?:            () => number;
  /** Biggest possible IQ haul this matchweek — shown in the completion celebration. */
  maxIq?:            number;
  /** Social-proof count for the celebration. Hidden if absent. */
  playerCount?:      number;
  /** Community prediction split per fixture id — shows "the crowd" bar. Hidden if absent. */
  statsByFixture?:   Record<string, FixtureStats>;
  /** Where "View leaderboards" goes. If absent, the celebration hides that button. */
  onViewLeaderboard?: () => void;
  /** "Challenge a friend" share action. Hidden if absent. */
  onShare?:          () => void;
}) {
  // Local mirror of predictions so the UI is optimistic. Keyed by fixture id.
  const [picks, setPicks] = useState<Map<string, ScorePick>>(() => {
    const m = new Map<string, ScorePick>();
    for (const f of fixtures) { const p = pickFromFixture(f); if (p) m.set(f.id, p); }
    return m;
  });
  const [status, setStatus]     = useState<Map<string, RowStatus>>(new Map());
  const [nowMs, setNowMs]       = useState(() => clock());

  // The banker — one fixture per matchweek whose points double. Seeded from
  // the server, then optimistic.
  const [banker, setBankerId] = useState<string | null>(
    () => fixtures.find((f) => f.myPrediction?.isBanker)?.id ?? null,
  );

  // The "wow" moment. Fires ONCE, the first time all matches are predicted.
  const [celebrate, setCelebrate] = useState(false);
  const hasCelebrated = useRef(false);

  // Re-tick every 30s so fixtures lock in the UI as their kickoff passes.
  useEffect(() => {
    const t = setInterval(() => setNowMs(clock()), 30_000);
    return () => clearInterval(t);
  }, [clock]);

  // Merge server predictions into local state if the parent reloads them.
  useEffect(() => {
    setPicks((prev) => {
      const m = new Map(prev);
      for (const f of fixtures) {
        const p = pickFromFixture(f);
        if (p && !m.has(f.id)) m.set(f.id, p);
      }
      return m;
    });
  }, [fixtures]);

  const setRowStatus = useCallback((id: string, s: RowStatus) => {
    setStatus((prev) => new Map(prev).set(id, s));
  }, []);

  // ── The write ───────────────────────────────────────────────
  const save = useCallback(async (fixtureId: string, pick: ScorePick) => {
    setRowStatus(fixtureId, "saving");
    const { error } = await onSave(fixtureId, pick.home, pick.away);
    if (error) {
      // Revert this one row; keep the rest of the sheet intact.
      setRowStatus(fixtureId, "error");
      setPicks((prev) => {
        const m = new Map(prev);
        const original = pickFromFixture(fixtures.find((f) => f.id === fixtureId)!);
        if (original) m.set(fixtureId, original); else m.delete(fixtureId);
        return m;
      });
      return;
    }
    setRowStatus(fixtureId, "saved");
    onChanged?.();
  }, [fixtures, onChanged, onSave, setRowStatus]);

  const applyPick = useCallback((fixtureId: string, pick: ScorePick, isFirst: boolean) => {
    setPicks((prev) => new Map(prev).set(fixtureId, pick));
    void save(fixtureId, pick);
    if (isFirst) track.firstPredictionSaved(fixtureId);
    else track.predictionSaved(fixtureId, true);
  }, [save]);

  const onOutcome = useCallback((f: Fixture, outcome: Outcome) => {
    const existing = picks.get(f.id) ?? null;
    const pick = scoreForOutcome(outcome, existing);
    applyPick(f.id, pick, existing === null && f.myPrediction == null);
  }, [picks, applyPick]);

  const onStep = useCallback((f: Fixture, side: "home" | "away", delta: number) => {
    const cur = picks.get(f.id) ?? { home: 1, away: 1 };
    const next = { ...cur, [side]: stepGoals(cur[side], delta) };
    applyPick(f.id, next, false);
  }, [picks, applyPick]);

  const onBanker = useCallback((fixtureId: string) => {
    setBankerId((prev) => {
      const turnOn = prev !== fixtureId;   // tapping the current banker clears it
      void onSetBanker(fixtureId, turnOn);
      onChanged?.();
      return turnOn ? fixtureId : null;    // one per round — others clear in UI + server
    });
  }, [onSetBanker, onChanged]);

  const runBulk = useCallback((targets: BulkTarget[], label: string) => {
    if (targets.length === 0) return;
    setPicks((prev) => {
      const m = new Map(prev);
      for (const t of targets) m.set(t.fixtureId, t.pick);
      return m;
    });
    for (const t of targets) void save(t.fixtureId, t.pick);
    track.predictionSaved(`bulk:${label}:${targets.length}`, true);
  }, [save]);

  // ── Derived ─────────────────────────────────────────────────
  const liveFixtures = fixtures.map((f) => {
    const pick = picks.get(f.id);
    return pick
      ? { ...f, myPrediction: { homeScore: pick.home, awayScore: pick.away, pointsAwarded: f.myPrediction?.pointsAwarded ?? null } }
      : f;
  });
  const groups     = groupByKickoff(liveFixtures);
  const progress   = sheetProgress(liveFixtures, nowMs);
  const dateRange  = matchweekDateRange(liveFixtures);

  const isOpen = (f: Fixture) => f.status === "scheduled" && new Date(f.kicksOffAt).getTime() > nowMs;

  // Detect the completion moment: every match predicted, for the first time.
  const allPredicted = progress.total > 0 && progress.predicted === progress.total;
  useEffect(() => {
    if (allPredicted && !hasCelebrated.current) {
      hasCelebrated.current = true;
      setCelebrate(true);
      track.allGroupMatchesPredicted(progress.total);
    }
  }, [allPredicted, progress.total]);

  return (
    <div className="pb-24">
      {celebrate && (
        <CompletionCelebration
          roundLabel={roundLabel}
          matchCount={progress.total}
          maxIq={maxIq}
          playerCount={playerCount}
          onViewLeaderboard={onViewLeaderboard ? () => { setCelebrate(false); onViewLeaderboard(); } : () => setCelebrate(false)}
          onShare={onShare}
          onClose={() => setCelebrate(false)}
        />
      )}
      {/* Sticky progress header */}
      <div
        className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between"
        style={{ background: "#f0f3ef", borderBottom: `1px solid ${BORDER}` }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: TEXT1 }}>{roundLabel}</span>
            {dateRange && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: "#eaf1ea", color: TEXT2 }}>
                📅 {dateRange}
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: MUTED }}>
            {progress.predicted} of {progress.total} predicted
            {playerCount != null && playerCount > 0 && (
              <span> · <strong style={{ color: TEXT2 }}>{playerCount.toLocaleString()}</strong> playing</span>
            )}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: MUTED }}>
            🕒 Kickoff times in your local time{localZoneLabel() ? ` (${localZoneLabel()})` : ""}
          </div>
        </div>
        <ProgressRing done={progress.predicted} total={progress.total} complete={progress.complete} />
      </div>

      {/* First-time hint — the sheet must explain itself in one glance, so a
          new user can finish all ten in under two minutes with no help. Shown
          only before the first pick, then it disappears for good. */}
      {progress.predicted === 0 && (
        <div className="px-4 pt-3 text-center">
          <p className="text-xs font-medium" style={{ color: TEXT2 }}>
            👇 Tap who you think wins each match. That's it.
          </p>
        </div>
      )}

      {/* Kickoff groups — banded by day (broadcast-style), then by kickoff time */}
      {groups.map((g, i) => {
        const newDay = i === 0 || groups[i - 1].dayKey !== g.dayKey;
        return (
          <div key={g.key}>
            {/* Day band — every fixture now carries its real date */}
            {newDay && (
              <div className="px-4 pt-5 pb-1 flex items-center gap-2.5">
                <span
                  className="text-[13px] font-extrabold px-2.5 py-1 rounded-lg shrink-0"
                  style={{ background: GREEN, color: "#fff", letterSpacing: "0.01em" }}
                >
                  {g.dayLabel}
                </span>
                <div className="flex-1 h-px" style={{ background: BORDER }} />
              </div>
            )}

            {/* Kickoff-time row for this slot */}
            <div className="px-4 pt-2 pb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#eef3ec", color: TEXT2 }}>
                ⏱ {g.timeLabel}
              </span>
              {g.locksFirst && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "#fdf3d8", color: GOLD }}
                  title="This match locks first — and it's the Matchday Challenges deadline."
                >
                  🔒 locks first
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 px-3">
              {g.fixtures.map((f) => (
                <FixtureRow
                  key={f.id}
                  fixture={f}
                  pick={picks.get(f.id) ?? null}
                  open={isOpen(f)}
                  status={status.get(f.id) ?? "idle"}
                  stats={statsByFixture?.[f.id] ?? null}
                  nowMs={nowMs}
                  isBanker={banker === f.id}
                  onOutcome={(o) => onOutcome(f, o)}
                  onStep={(side, d) => onStep(f, side, d)}
                  onBanker={() => onBanker(f.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Bulk helpers — user-initiated only */}
      {!progress.complete && progress.predictable > 0 && (
        <div className="px-4 mt-5 flex flex-col gap-2">
          {previousFixtures.length > 0 && (
            <BulkButton
              label="Copy last week's scores"
              onClick={() => runBulk(copyFromPreviousRound(liveFixtures, previousFixtures, nowMs), "copy_last_week")}
            />
          )}
          <BulkButton
            label="Fill remaining as 1–1"
            onClick={() => runBulk(fillRemaining(liveFixtures, nowMs), "fill_draw")}
          />
        </div>
      )}

      {progress.complete && progress.predicted > 0 && (
        <div className="px-4 mt-6 text-center">
          <p className="text-sm font-semibold" style={{ color: OK }}>
            ✓ All set — {progress.predicted} predictions in
          </p>
          <p className="text-xs mt-1" style={{ color: MUTED }}>
            You can change any of them until each match kicks off.
          </p>
        </div>
      )}
    </div>
  );
}

// ── One fixture ───────────────────────────────────────────────

function FixtureRow({
  fixture, pick, open, status, stats, nowMs, isBanker,
  onOutcome, onStep, onBanker,
}: {
  fixture:   Fixture;
  pick:      ScorePick | null;
  open:      boolean;
  status:    RowStatus;
  stats:     FixtureStats | null;
  nowMs:     number;
  isBanker:  boolean;
  onOutcome: (o: Outcome) => void;
  onStep:    (side: "home" | "away", delta: number) => void;
  onBanker:  () => void;
}) {
  const selected = pick ? selectedOutcome({ ...fixture, myPrediction: { homeScore: pick.home, awayScore: pick.away, pointsAwarded: null } }) : null;
  const home = fixture.homeTeam?.name ?? "TBD";
  const away = fixture.awayTeam?.name ?? "TBD";
  const homeClub  = fixture.homeTeam?.code ? club(fixture.homeTeam.code) : undefined;
  const awayColor = fixture.awayTeam?.code ? club(fixture.awayTeam.code)?.primary : undefined;
  const homeColor = homeClub?.primary;
  const venue     = homeClub?.stadium;

  // A thin colour edge on the selected side makes the pick feel committed.
  const edge = selected === "home" ? homeColor : selected === "away" ? awayColor : selected === "draw" ? GREEN : BORDER;

  return (
    <div
      className="rounded-xl px-2.5 py-2 transition-shadow"
      style={{
        background: isBanker ? "#fffdf4" : CARD,
        border: `1px solid ${isBanker ? `${GOLD}66` : BORDER}`,
        borderLeft: `3px solid ${isBanker ? GOLD : edge}`,
        opacity: open ? 1 : 0.72,
      }}
    >
      {/* Scoreboard line: teams either side of the score, right in the middle.
          Crests + colours + the score inline make each row read like a fixture,
          not a form field. */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <ClubCrest code={fixture.homeTeam?.code} size={22} />
          <span className="text-[13px] font-semibold truncate" style={{ color: TEXT1 }}>{home}</span>
        </div>

        {/* Centre: inline score once picked, else the kickoff/countdown. */}
        {open && pick ? (
          <div className="flex items-center gap-1 shrink-0">
            <MiniStep label="−" onClick={() => onStep("home", -1)} />
            <span className="text-[15px] font-extrabold tabular-nums w-4 text-center" style={{ color: TEXT1 }}>{pick.home}</span>
            <MiniStep label="+" onClick={() => onStep("home", 1)} />
            <span className="text-[13px] font-bold mx-0.5" style={{ color: MUTED }}>–</span>
            <MiniStep label="−" onClick={() => onStep("away", -1)} />
            <span className="text-[15px] font-extrabold tabular-nums w-4 text-center" style={{ color: TEXT1 }}>{pick.away}</span>
            <MiniStep label="+" onClick={() => onStep("away", 1)} />
          </div>
        ) : (
          <KickoffChip iso={fixture.kicksOffAt} nowMs={nowMs} open={open} />
        )}

        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="text-[13px] font-semibold truncate text-right" style={{ color: TEXT1 }}>{away}</span>
          <ClubCrest code={fixture.awayTeam?.code} size={22} />
        </div>
      </div>

      {open ? (
        <>
          {venue && (
            <p className="text-[10px] text-center mt-0.5" style={{ color: MUTED }}>🏟 {venue}</p>
          )}
          {/* H / D / A — one tap, in club colours when chosen */}
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            <OutcomeBtn label={clubShort(fixture.homeTeam?.code)} active={selected === "home"} color={homeColor} onClick={() => onOutcome("home")} />
            <OutcomeBtn label="Draw" active={selected === "draw"} color={GREEN} onClick={() => onOutcome("draw")} />
            <OutcomeBtn label={clubShort(fixture.awayTeam?.code)} active={selected === "away"} color={awayColor} onClick={() => onOutcome("away")} />
          </div>

          {/* The crowd — a thin split bar, only when picked (keeps unpicked rows short) */}
          {pick && stats && stats.total > 0 && (
            <PredictionBar stats={stats} selected={selected} homeColor={homeColor} awayColor={awayColor} />
          )}

          {/* Banker toggle (once picked) + save state. */}
          {pick ? (
            <div className="mt-1.5 flex items-center justify-between">
              <BankerToggle active={isBanker} onClick={onBanker} />
              <RowStatusChip status={status} />
            </div>
          ) : status !== "idle" && (
            <div className="mt-1 text-right"><RowStatusChip status={status} /></div>
          )}
        </>
      ) : (
        // Locked: show the prediction, greyed. Never remove the row.
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs" style={{ color: MUTED }}>🔒 Locked</span>
          <span className="text-sm font-semibold" style={{ color: pick ? TEXT2 : MUTED }}>
            {isBanker && <span style={{ color: GOLD }}>⭐ </span>}
            {pick ? `Your pick: ${pick.home}–${pick.away}` : "No prediction"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Small UI pieces ───────────────────────────────────────────

/** Nominate this match as your Banker — double points if you're right. */
function BankerToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full transition-all active:scale-95"
      style={active
        ? { background: GOLD, color: "#2a2205" }
        : { background: "#f4f7f2", color: MUTED, border: `1px solid ${BORDER}` }}
      title="Your banker doubles its points if you're right — one per matchweek"
    >
      {active ? "⭐ Banker · 2×" : "☆ Make banker"}
    </button>
  );
}

function OutcomeBtn({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  const bg = active ? (color ?? GREEN) : "#f4f7f2";
  return (
    <button
      onClick={onClick}
      className="py-2.5 rounded-lg text-xs font-bold transition-all active:scale-[0.96]"
      style={{
        background: bg,
        color:      active ? textOn(bg) : TEXT2,
        border:     `1px solid ${active ? bg : BORDER}`,
        boxShadow:  active ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
      }}
    >
      {label}
    </button>
  );
}

/** The crowd's split — a live-feeling community bar under the H/D/A control. */
function PredictionBar({ stats, selected, homeColor, awayColor }: {
  stats: FixtureStats; selected: Outcome | null; homeColor?: string; awayColor?: string;
}) {
  const seg = (pct: number, color: string, on: boolean) => (
    <div style={{ width: `${pct}%`, background: color, opacity: on ? 1 : 0.5, transition: "width .4s ease" }} />
  );
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex h-1 rounded-full overflow-hidden flex-1" style={{ background: "#eef3ec" }}>
        {seg(stats.homePct, homeColor ?? GREEN, selected === "home")}
        {seg(stats.drawPct, "#b8c4bb", selected === "draw")}
        {seg(stats.awayPct, awayColor ?? "#5c6b60", selected === "away")}
      </div>
      <span className="text-[9px] shrink-0" style={{ color: MUTED }}>
        {stats.homePct}·{stats.drawPct}·{stats.awayPct}% · {stats.total.toLocaleString()}
      </span>
    </div>
  );
}

/** A compact +/- button for the inline scoreboard steppers. */
function MiniStep({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 rounded-md text-sm font-bold flex items-center justify-center active:scale-90 shrink-0"
      style={{ background: "#f4f7f2", color: GREEN, border: `1px solid ${BORDER}` }}
    >
      {label}
    </button>
  );
}

/** Kickoff time / live countdown chip — anticipation in every row. */
function KickoffChip({ iso, nowMs, open }: { iso: string; nowMs: number; open: boolean }) {
  const ko = new Date(iso).getTime();
  const ms = ko - nowMs;
  let label: string;
  if (!open || ms <= 0) {
    label = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  } else {
    const h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
    label = d >= 1 ? `${d}d` : h >= 1 ? `${h}h` : `${Math.max(1, Math.floor(ms / 60000))}m`;
  }
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full mx-1 shrink-0"
          style={{ background: "#f4f7f2", color: MUTED }}>
      {label}
    </span>
  );
}

function RowStatusChip({ status }: { status: RowStatus }) {
  if (status === "saving") return <span className="text-[10px]" style={{ color: MUTED }}>saving…</span>;
  if (status === "saved")  return <span className="text-[10px]" style={{ color: OK }}>✓ saved</span>;
  if (status === "error")  return <span className="text-[10px]" style={{ color: ERRC }}>couldn’t save — retry</span>;
  return <span className="text-[10px]" style={{ color: "transparent" }}>·</span>;
}

function ProgressRing({ done, total, complete }: { done: number; total: number; complete: boolean }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: complete ? OK : GREEN }} />
      </div>
      <span className="text-xs font-bold" style={{ color: complete ? OK : TEXT2 }}>{done}/{total}</span>
    </div>
  );
}

function BulkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2.5 rounded-lg text-xs font-semibold"
      style={{ background: "#ffffff", border: `1px solid ${BORDER}`, color: GREEN }}
    >
      {label}
    </button>
  );
}

// Compress a club name for the narrow H/A buttons on mobile.
function homeShort(name: string): string {
  if (name.length <= 10) return name;
  return name.split(" ")[0];
}
