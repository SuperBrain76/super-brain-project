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
import { upsertPrediction } from "@/lib/predictor";
import {
  type Outcome, type ScorePick, type BulkTarget,
  scoreForOutcome, pickFromFixture, selectedOutcome,
  stepGoals, groupByKickoff, sheetProgress,
  copyFromPreviousRound, fillRemaining,
} from "@/lib/matchweekPredictions";
import { track } from "@/lib/analytics";
import ClubCrest, { clubShort } from "@/components/premier/ClubCrest";
import CompletionCelebration from "@/components/premier/CompletionCelebration";

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
  onViewLeaderboard,
  onShare,
}: {
  fixtures:          Fixture[];
  previousFixtures?: Fixture[];
  roundLabel:        string;
  onChanged?:        () => void;
  onSave?:           SavePrediction;
  /** Time source — the prototype injects a shifted clock so fixtures lock at the travelled time. */
  clock?:            () => number;
  /** Biggest possible IQ haul this matchweek — shown in the completion celebration. */
  maxIq?:            number;
  /** Social-proof count for the celebration. Hidden if absent. */
  playerCount?:      number;
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nowMs, setNowMs]       = useState(() => clock());

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
  const groups   = groupByKickoff(liveFixtures);
  const progress = sheetProgress(liveFixtures, nowMs);

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
          <div className="text-sm font-bold" style={{ color: TEXT1 }}>{roundLabel}</div>
          <div className="text-xs" style={{ color: MUTED }}>
            {progress.predicted} of {progress.total} predicted
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

      {/* Kickoff groups */}
      {groups.map((g) => (
        <div key={g.key}>
          <div className="px-4 pt-4 pb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TEXT2 }}>
              {g.label}
            </span>
            {g.locksFirst && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: "#fdf3d8", color: GOLD }}
                title="This match locks first — and it's the Matchday Challenges deadline."
              >
                ⚠ locks first
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
                expanded={expanded.has(f.id)}
                onOutcome={(o) => onOutcome(f, o)}
                onStep={(side, d) => onStep(f, side, d)}
                onToggleExpand={() =>
                  setExpanded((prev) => {
                    const s = new Set(prev);
                    s.has(f.id) ? s.delete(f.id) : s.add(f.id);
                    return s;
                  })
                }
              />
            ))}
          </div>
        </div>
      ))}

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
  fixture, pick, open, status, expanded,
  onOutcome, onStep, onToggleExpand,
}: {
  fixture:        Fixture;
  pick:           ScorePick | null;
  open:           boolean;
  status:         RowStatus;
  expanded:       boolean;
  onOutcome:      (o: Outcome) => void;
  onStep:         (side: "home" | "away", delta: number) => void;
  onToggleExpand: () => void;
}) {
  const selected = pick ? selectedOutcome({ ...fixture, myPrediction: { homeScore: pick.home, awayScore: pick.away, pointsAwarded: null } }) : null;
  const home = fixture.homeTeam?.name ?? "TBD";
  const away = fixture.awayTeam?.name ?? "TBD";

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: CARD, border: `1px solid ${BORDER}`, opacity: open ? 1 : 0.75 }}
    >
      {/* Teams + crests — real club colours make this feel like football */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ClubCrest code={fixture.homeTeam?.code} size={26} />
          <span className="text-sm font-semibold truncate" style={{ color: TEXT1 }}>{home}</span>
        </div>
        <span className="text-[10px] px-2" style={{ color: MUTED }}>v</span>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-sm font-semibold truncate text-right" style={{ color: TEXT1 }}>{away}</span>
          <ClubCrest code={fixture.awayTeam?.code} size={26} />
        </div>
      </div>

      {/* H / D / A — the one-tap control */}
      {open ? (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <OutcomeBtn label={clubShort(fixture.homeTeam?.code)} active={selected === "home"} onClick={() => onOutcome("home")} />
            <OutcomeBtn label="Draw"             active={selected === "draw"} onClick={() => onOutcome("draw")} />
            <OutcomeBtn label={clubShort(fixture.awayTeam?.code)} active={selected === "away"} onClick={() => onOutcome("away")} />
          </div>

          {/* Once picked: show the scoreline, then a discoverable — NOT
              hidden — "Change score" beneath it. Exact scores are optional,
              never presented as an advanced feature. */}
          {pick ? (
            <div className="mt-2.5 flex flex-col items-center gap-1">
              {!expanded ? (
                <>
                  <div className="text-2xl font-extrabold leading-none" style={{ color: TEXT1 }}>
                    {pick.home} <span style={{ color: MUTED }}>–</span> {pick.away}
                  </div>
                  <button onClick={onToggleExpand} className="text-[11px] font-semibold underline" style={{ color: GREEN }}>
                    Change score
                  </button>
                </>
              ) : (
                <div className="w-full pt-1 flex flex-col items-center gap-2">
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-semibold truncate max-w-[90px]" style={{ color: MUTED }}>{homeShort(home)}</span>
                      <Stepper value={pick.home} onStep={(d) => onStep("home", d)} />
                    </div>
                    <span className="text-lg font-bold mt-4" style={{ color: MUTED }}>–</span>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-semibold truncate max-w-[90px]" style={{ color: MUTED }}>{homeShort(away)}</span>
                      <Stepper value={pick.away} onStep={(d) => onStep("away", d)} />
                    </div>
                  </div>
                  <button onClick={onToggleExpand} className="text-[11px] font-semibold" style={{ color: GREEN }}>
                    Done
                  </button>
                </div>
              )}
              <div className="h-3"><RowStatusChip status={status} /></div>
            </div>
          ) : (
            <div className="mt-2 text-center h-3"><RowStatusChip status={status} /></div>
          )}
        </>
      ) : (
        // Locked: show the prediction, greyed. Never remove the row.
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: MUTED }}>Locked</span>
          <span className="text-sm font-semibold" style={{ color: pick ? TEXT2 : MUTED }}>
            {pick ? `Your pick: ${pick.home}–${pick.away}` : "No prediction"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Small UI pieces ───────────────────────────────────────────

function OutcomeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="py-2.5 rounded-lg text-xs font-bold transition-colors active:scale-[0.97]"
      style={{
        background: active ? GREEN : "#f4f7f2",
        color:      active ? "#ffffff" : TEXT2,
        border:     `1px solid ${active ? GREEN : BORDER}`,
      }}
    >
      {label}
    </button>
  );
}

function Stepper({ value, onStep }: { value: number; onStep: (d: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <StepBtn label="−" onClick={() => onStep(-1)} />
      <span className="text-xl font-bold w-6 text-center" style={{ color: TEXT1 }}>{value}</span>
      <StepBtn label="+" onClick={() => onStep(1)} />
    </div>
  );
}

function StepBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-lg text-lg font-bold flex items-center justify-center active:scale-90"
      style={{ background: "#f4f7f2", color: GREEN, border: `1px solid ${BORDER}` }}
    >
      {label}
    </button>
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
