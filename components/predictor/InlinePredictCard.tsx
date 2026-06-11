"use client";

import { useState, useCallback } from "react";
import {
  type Fixture,
  isPredictionOpen,
  upsertPrediction,
  formatKickoff,
  kickoffCountdown,
  stageLabel,
} from "@/lib/predictor";
import { getKnockoutSeeds } from "@/lib/knockoutSeeds";
import SeedPill from "./SeedPill";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const NAVY   = "#0e1e35";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const BG     = "#f0f3ef";

// ── Team display ─────────────────────────────────────────────

function TeamDisplay({
  team,
  align,
  dim,
  seedLabel,
}: {
  team:       Fixture["homeTeam"];
  align:      "left" | "right";
  dim?:       boolean;
  seedLabel?: string | null;
}) {
  const name = team?.name ?? null;
  const flag = team?.flagEmoji ?? null;

  return (
    <div className={`flex items-center gap-1.5 flex-1 min-w-0 ${align === "right" ? "flex-row-reverse" : ""}`}>
      {/* Flag or placeholder */}
      {flag ? (
        <span className="text-xl shrink-0 leading-none">{flag}</span>
      ) : (
        <span className="text-lg shrink-0 leading-none opacity-30" aria-hidden="true">🛡</span>
      )}

      <div className={`flex flex-col min-w-0 gap-0.5 ${align === "right" ? "items-end" : ""}`}>
        {name ? (
          <>
            <span
              className={`text-sm font-semibold leading-tight truncate ${align === "right" ? "text-right" : ""}`}
              style={{ color: dim ? MUTED : "#0f1f17", fontWeight: dim ? 500 : 600 }}
            >
              {name}
            </span>
            {seedLabel && <SeedPill label={seedLabel} />}
          </>
        ) : seedLabel ? (
          <span className="text-sm font-semibold leading-tight" style={{ color: "#7a5e14", fontWeight: 600 }}>
            {seedLabel}
          </span>
        ) : (
          <span className="text-sm" style={{ color: MUTED }}>TBD</span>
        )}
      </div>
    </div>
  );
}

// ── Score stepper ─────────────────────────────────────────────

function ScoreStepper({
  value,
  onChange,
  disabled,
}: {
  value:    number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-0" style={{ userSelect: "none" }}>
      <button
        type="button"
        aria-label="Decrease score"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-9 h-9 flex items-center justify-center rounded-l-lg text-base font-bold transition-colors active:scale-95"
        style={{
          background: disabled || value <= 0 ? "#f0f3ef" : "#e8ede6",
          color:      disabled || value <= 0 ? "#c4cfc8" : GREEN,
          border:     `1px solid ${BORDER}`,
          borderRight: "none",
          fontSize:   "1.1rem",
          lineHeight: 1,
          touchAction: "manipulation",
        }}
      >
        −
      </button>
      <div
        className="w-10 h-9 flex items-center justify-center font-black text-xl tabular-nums"
        style={{
          background:  "#fff",
          border:      `1px solid ${BORDER}`,
          color:       NAVY,
          letterSpacing: "-0.5px",
        }}
      >
        {value}
      </div>
      <button
        type="button"
        aria-label="Increase score"
        disabled={disabled || value >= 20}
        onClick={() => onChange(Math.min(20, value + 1))}
        className="w-9 h-9 flex items-center justify-center rounded-r-lg text-base font-bold transition-colors active:scale-95"
        style={{
          background: disabled || value >= 20 ? "#f0f3ef" : "#e8ede6",
          color:      disabled || value >= 20 ? "#c4cfc8" : GREEN,
          border:     `1px solid ${BORDER}`,
          borderLeft: "none",
          fontSize:   "1.1rem",
          lineHeight: 1,
          touchAction: "manipulation",
        }}
      >
        +
      </button>
    </div>
  );
}

// ── Status badge (read-only states) ──────────────────────────

function StatusBadge({
  fixture,
  showPrediction,
}: {
  fixture:        Fixture;
  showPrediction: boolean;
}) {
  const open    = isPredictionOpen(fixture);
  const done    = fixture.status === "completed";
  const live    = fixture.status === "live";
  const hasPred = !!fixture.myPrediction;
  const msUntil = new Date(fixture.kicksOffAt).getTime() - Date.now();
  const closing = open && msUntil < 24 * 3_600_000;

  if (live) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded-sm"
        style={{ color: "#e53e3e", background: "#fff0f0", border: "1px solid #fca5a5" }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "#e53e3e" }} />
        LIVE
      </span>
    );
  }

  if (done) {
    if (showPrediction && hasPred && fixture.myPrediction!.pointsAwarded !== null) {
      const pts     = fixture.myPrediction!.pointsAwarded;
      const isExact = pts === 5 || pts === 3;
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm shrink-0"
          style={{ color: isExact ? GOLD : MUTED, background: isExact ? `${GOLD}15` : "#f0f3ef" }}>
          {pts === 5 ? "⚡" : pts === 3 ? "✓" : pts === 2 ? "~" : "✗"} {pts}pts
        </span>
      );
    }
    if (showPrediction && !hasPred) {
      return <span className="text-[10px]" style={{ color: MUTED }}>Missed</span>;
    }
    return (
      <span className="text-[10px]" style={{ color: MUTED }}>
        {formatKickoff(fixture.kicksOffAt, { date: true, time: false })}
      </span>
    );
  }

  if (closing) {
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm"
        style={{ color: "#d97706", background: "#fef9e7" }}>
        ⏱ {kickoffCountdown(fixture.kicksOffAt)}
      </span>
    );
  }

  if (!open && !done && !live) {
    return <span className="text-[10px]" style={{ color: MUTED }}>🔒 Locked</span>;
  }

  return (
    <span className="text-[10px]" style={{ color: MUTED }}>
      {formatKickoff(fixture.kicksOffAt, { time: true })}
    </span>
  );
}

// ── PickStrip (saved state) ───────────────────────────────────

function PickStrip({
  fixture,
  localHome,
  localAway,
  onEdit,
}: {
  fixture:   Fixture;
  localHome: number;
  localAway: number;
  onEdit:    () => void;
}) {
  const done    = fixture.status === "completed";
  const open    = isPredictionOpen(fixture);
  const pts     = fixture.myPrediction?.pointsAwarded ?? null;
  const isExact = done && pts !== null && (pts === 5 || pts === 3);

  const bg        = isExact ? "#fdf9ee" : "#eef8f0";
  const topBorder = isExact ? "#e8d48a" : "#86c99a";
  const accent    = isExact ? GOLD : GREEN;

  return (
    <div className="flex items-center gap-2 px-3 py-2" style={{ background: bg, borderTop: `2px solid ${topBorder}` }}>
      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: accent }}>
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
          <polyline points="2,5 4.5,7.5 8,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: accent }}>
        {done && isExact ? "Exact Score" : done ? "Predicted" : "✓ Saved"}
      </span>
      <span className="text-base font-black tabular-nums leading-none" style={{ color: accent, letterSpacing: "0.04em" }}>
        {localHome}–{localAway}
      </span>
      {done && pts !== null ? (
        <span className="ml-auto text-[10px] font-bold" style={{ color: isExact ? GOLD : MUTED }}>
          {pts > 0 ? `+${pts} pts` : "0 pts"}{isExact ? " ★" : ""}
        </span>
      ) : open ? (
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto text-[10px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: GREEN }}
        >
          Edit →
        </button>
      ) : null}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface InlinePredictCardProps {
  fixture:         Fixture;
  showPrediction?: boolean;
  highlighted?:    boolean;
  /** Called after a successful save so the parent can update its fixture list */
  onSaved?: (fixtureId: string, home: number, away: number) => void;
}

export default function InlinePredictCard({
  fixture,
  showPrediction = true,
  highlighted = false,
  onSaved,
}: InlinePredictCardProps) {
  const open    = isPredictionOpen(fixture);
  const done    = fixture.status === "completed";
  const hasPred = !!fixture.myPrediction;
  const isExact = hasPred && done && (fixture.myPrediction?.pointsAwarded === 3 || fixture.myPrediction?.pointsAwarded === 5);

  // Local score state — initialise from existing prediction or 0
  const [homeScore, setHomeScore] = useState<number>(fixture.myPrediction?.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState<number>(fixture.myPrediction?.awayScore ?? 0);

  // saved = true means PickStrip is shown; editing = true means steppers are shown
  const [saved,   setSaved]   = useState<boolean>(hasPred);
  const [editing, setEditing] = useState<boolean>(!hasPred && open);
  const [saving,  setSaving]  = useState<boolean>(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await upsertPrediction(fixture.id, homeScore, awayScore);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setSaved(true);
    setEditing(false);
    onSaved?.(fixture.id, homeScore, awayScore);
  }, [fixture.id, homeScore, awayScore, onSaved]);

  const handleEdit = useCallback(() => {
    setEditing(true);
    setSaved(false);
    setError(null);
  }, []);

  // Border / accent states
  const leftBorder  = showPrediction && (saved || hasPred) ? `3px solid ${GREEN}` : "3px solid transparent";
  const borderColor =
    highlighted              ? "#86b89a" :
    showPrediction && isExact ? `${GOLD}80` :
    showPrediction && (saved || hasPred) ? "#86b89a" :
    BORDER;

  return (
    <div
      id={`fixture-${fixture.id}`}
      className="rounded-xl overflow-hidden w-full"
      style={{
        background:  "#fff",
        border:      `1px solid ${borderColor}`,
        borderLeft:  leftBorder,
        boxShadow:   highlighted
          ? `0 0 0 2px ${GREEN}40, 0 2px 8px rgba(26,58,42,0.12)`
          : "0 1px 2px rgba(0,0,0,0.04)",
        transition:  "box-shadow 0.9s ease-out, border-color 0.15s",
      }}
    >
      {/* Header: stage + match number (knockout only) + status badge */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] uppercase tracking-widest truncate" style={{ color: MUTED }}>
            {fixture.groupName ? `Group ${fixture.groupName}` : stageLabel(fixture.stage)}
          </span>
          {!fixture.groupName && fixture.fixtureNumber >= 73 && (
            <span
              className="text-[9px] font-bold px-1 py-0.5 rounded-sm shrink-0 font-mono"
              style={{ color: "#5a6e60", background: "#e8ede6", border: "1px solid #c4d4c8" }}
            >
              M{fixture.fixtureNumber}
            </span>
          )}
        </div>
        <StatusBadge fixture={fixture} showPrediction={showPrediction} />
      </div>

      {/* Teams row */}
      {(() => {
        const seeds = getKnockoutSeeds(fixture.fixtureNumber);
        return (
          <div className="flex items-center gap-2 px-3 pt-2 pb-2">
            <TeamDisplay team={fixture.homeTeam} align="left" seedLabel={seeds?.home} />

            {/* Centre: score (completed or live) or "vs" */}
            {(done || live) && fixture.homeScore !== null ? (
              <div className="flex flex-col items-center justify-center shrink-0 px-2 gap-0.5">
                {live && (
                  <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#e53e3e" }}>Live</span>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-lg font-black tabular-nums" style={{ color: NAVY }}>{fixture.homeScore}</span>
                  <span className="font-bold" style={{ color: BORDER }}>–</span>
                  <span className="text-lg font-black tabular-nums" style={{ color: NAVY }}>{fixture.awayScore}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center shrink-0 px-2">
                <span className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: fixture.status === "live" ? "#e53e3e" : MUTED }}>
                  {fixture.status === "live" ? "Live" : "vs"}
                </span>
              </div>
            )}

            <TeamDisplay team={fixture.awayTeam} align="right" dim seedLabel={seeds?.away} />
          </div>
        );
      })()}

      {/* ── Prediction zone ─────────────────────────────── */}
      {showPrediction && (() => {
        // CASE 1: Completed match
        if (done) {
          if (hasPred) {
            return (
              <PickStrip
                fixture={fixture}
                localHome={fixture.myPrediction!.homeScore}
                localAway={fixture.myPrediction!.awayScore}
                onEdit={handleEdit}
              />
            );
          }
          return (
            <div className="px-3 pb-2.5">
              <p className="text-xs" style={{ color: MUTED }}>No prediction made</p>
            </div>
          );
        }

        // CASE 2: Not open (locked before kickoff — shouldn't happen much but safeguard)
        if (!open) {
          return (
            <div className="px-3 pb-2.5">
              <p className="text-xs flex items-center gap-1" style={{ color: MUTED }}>
                <span>🔒</span><span>Prediction locked</span>
              </p>
            </div>
          );
        }

        // CASE 3: Open + saved (not editing)
        if (saved && !editing) {
          return (
            <PickStrip
              fixture={fixture}
              localHome={homeScore}
              localAway={awayScore}
              onEdit={handleEdit}
            />
          );
        }

        // CASE 4: Open + editing / no prediction yet — show steppers
        return (
          <div
            className="px-3 pb-3 pt-1 flex flex-col gap-2.5"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            {/* Stepper row */}
            {(() => {
              const seeds = getKnockoutSeeds(fixture.fixtureNumber);
              const homeLabel = fixture.homeTeam?.name ?? seeds?.home ?? "Home";
              const awayLabel = fixture.awayTeam?.name ?? seeds?.away ?? "Away";
              return (
                <div className="flex items-center justify-between gap-2">
                  {/* Home team name */}
                  <span className="text-xs font-semibold truncate flex-1 min-w-0"
                    style={{ color: fixture.homeTeam ? "#0f1f17" : "#7a5e14" }}>
                    {homeLabel}
                  </span>

                  {/* Steppers + vs separator */}
                  <div className="flex items-center gap-2 shrink-0">
                    <ScoreStepper value={homeScore} onChange={setHomeScore} disabled={saving} />
                    <span className="text-xs font-bold" style={{ color: MUTED }}>–</span>
                    <ScoreStepper value={awayScore} onChange={setAwayScore} disabled={saving} />
                  </div>

                  {/* Away team name */}
                  <span className="text-xs font-semibold truncate flex-1 min-w-0 text-right"
                    style={{ color: fixture.awayTeam ? MUTED : "#7a5e14" }}>
                    {awayLabel}
                  </span>
                </div>
              );
            })()}

            {/* Error message */}
            {error && (
              <p className="text-xs text-center" style={{ color: "#e53e3e" }}>{error}</p>
            )}

            {/* Save button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-lg font-bold text-sm transition-all active:scale-[0.98]"
              style={{
                background:  saving ? "#7a8f82" : GREEN,
                color:       "#fff",
                opacity:     saving ? 0.85 : 1,
                touchAction: "manipulation",
              }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Saving…
                </span>
              ) : editing ? "Update prediction" : "Save prediction"}
            </button>

            {/* Cancel edit link */}
            {editing && (
              <button
                type="button"
                onClick={() => { setEditing(false); setSaved(true); setHomeScore(fixture.myPrediction!.homeScore); setAwayScore(fixture.myPrediction!.awayScore); }}
                className="text-xs text-center hover:underline"
                style={{ color: MUTED }}
              >
                Cancel
              </button>
            )}
          </div>
        );
      })()}

      {/* No-prediction fallback when showPrediction is off */}
      {!showPrediction && open && (
        <div className="px-3 pb-2.5">
          <p className="text-xs font-medium" style={{ color: GREEN }}>Sign in to predict →</p>
        </div>
      )}

      {/* Venue */}
      {fixture.venue && (
        <p className="text-[10px] px-3 pb-2" style={{ color: MUTED }}>{fixture.venue}</p>
      )}
    </div>
  );
}
