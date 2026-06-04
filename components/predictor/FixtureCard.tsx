"use client";

import Link from "next/link";
import {
  type Fixture,
  isPredictionOpen,
  formatKickoff,
  kickoffCountdown,
  stageLabel,
  pointsColor,
} from "@/lib/predictor";

// ── Team name + flag ─────────────────────────────────────────

function TeamDisplay({
  team,
  align,
}: {
  team: Fixture["homeTeam"];
  align: "left" | "right";
}) {
  const name = team?.name ?? "TBD";
  const flag = team?.flagEmoji ?? "🏳";

  return (
    <div
      className={`flex items-center gap-2 flex-1 min-w-0 ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
    >
      <span className="text-xl shrink-0 leading-none">{flag}</span>
      <span
        className={`text-sm font-semibold text-white leading-tight truncate ${
          align === "right" ? "text-right" : ""
        }`}
      >
        {name}
      </span>
    </div>
  );
}

// ── Centre score / vs ────────────────────────────────────────

function ScoreBadge({ fixture }: { fixture: Fixture }) {
  if (fixture.status === "completed" && fixture.homeScore !== null && fixture.awayScore !== null) {
    return (
      <div className="flex items-center justify-center gap-1 shrink-0 px-2">
        <span className="text-lg font-black number-display text-white tabular-nums">
          {fixture.homeScore}
        </span>
        <span className="text-cockpit-border font-bold">–</span>
        <span className="text-lg font-black number-display text-white tabular-nums">
          {fixture.awayScore}
        </span>
      </div>
    );
  }

  const open = isPredictionOpen(fixture);
  return (
    <div className="flex items-center justify-center shrink-0 px-2">
      <span
        className="text-xs font-mono tracking-widest uppercase"
        style={{ color: open ? "#00d4ff" : "#8899aa" }}
      >
        {fixture.status === "live" ? "LIVE" : "vs"}
      </span>
    </div>
  );
}

// ── Fixture status badge ──────────────────────────────────────
// Appears in the top-right of the card header. Shows one of:
//   • Countdown to deadline (when < 24 h away)
//   • "Saved" pill (predicted, plenty of time)
//   • "🔒 Locked" (kicked off, not complete)
//   • "LIVE" (live match)
//   • Points result (completed + predicted)
//   • "Missed" (completed + no prediction)
// Falls back to date + time when nothing actionable to show.

function StatusBadge({
  fixture,
  showPrediction,
}: {
  fixture: Fixture;
  showPrediction: boolean;
}) {
  const open      = isPredictionOpen(fixture);
  const done      = fixture.status === "completed";
  const live      = fixture.status === "live";
  const hasPred   = !!fixture.myPrediction;
  const msUntil   = new Date(fixture.kicksOffAt).getTime() - Date.now();
  const closing   = open && msUntil < 24 * 3_600_000;
  const countdown = closing ? kickoffCountdown(fixture.kicksOffAt) : "";

  // ── LIVE ──────────────────────────────────────────────────────
  if (live) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold font-mono tracking-widest px-1.5 py-0.5 rounded-sm"
        style={{ color: "#00e676", background: "#00e67615" }}>
        <span className="w-1.5 h-1.5 rounded-full bg-cockpit-green animate-pulse inline-block" />
        LIVE
      </span>
    );
  }

  // ── COMPLETED ─────────────────────────────────────────────────
  if (done) {
    if (showPrediction && hasPred && fixture.myPrediction!.pointsAwarded !== null) {
      const pts = fixture.myPrediction!.pointsAwarded;
      const col = pointsColor(pts);
      const icon = pts === 5 ? "⚡" : pts === 3 ? "✓" : pts === 2 ? "~" : "✗";
      return (
        <span
          className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-sm shrink-0"
          style={{ color: col, background: `${col}15` }}
        >
          {icon} {pts} pts
        </span>
      );
    }
    if (showPrediction && !hasPred) {
      return (
        <span className="text-[10px] font-mono text-cockpit-muted shrink-0">Missed</span>
      );
    }
    // No prediction context (compact mode or guest)
    return (
      <span className="text-[10px] font-mono text-cockpit-muted shrink-0">
        {formatKickoff(fixture.kicksOffAt, { date: true, time: false })}
      </span>
    );
  }

  // ── LOCKED (kicked off but not completed yet) ─────────────────
  if (!open && !done && !live) {
    return (
      <span className="text-[10px] font-mono text-cockpit-muted shrink-0">🔒 In progress</span>
    );
  }

  // ── OPEN — closing within 24h ─────────────────────────────────
  if (closing) {
    if (showPrediction && hasPred) {
      return (
        <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded-sm"
          style={{ color: "#ffab00", background: "#ffab0015" }}>
          ✓ Closes {countdown}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded-sm"
        style={{ color: "#ffab00", background: "#ffab0015" }}>
        ⏱ {countdown}
      </span>
    );
  }

  // ── OPEN — plenty of time ─────────────────────────────────────
  if (showPrediction && hasPred) {
    return (
      <span className="text-[10px] font-mono text-cockpit-dim shrink-0">
        ✓ Saved
      </span>
    );
  }

  // Default: date + time
  return (
    <span className="text-[10px] font-mono text-cockpit-muted shrink-0">
      {formatKickoff(fixture.kicksOffAt, { date: true, time: false })}
      {" · "}
      {formatKickoff(fixture.kicksOffAt, { time: true })}
    </span>
  );
}

// ── Prediction row ───────────────────────────────────────────

function PredictionRow({ fixture }: { fixture: Fixture }) {
  const pred = fixture.myPrediction;
  const open = isPredictionOpen(fixture);
  const done = fixture.status === "completed";

  if (!pred) {
    if (open) {
      return (
        <p className="text-cockpit-accent text-xs font-mono">
          Tap to predict →
        </p>
      );
    }
    if (done) {
      return (
        <p className="text-cockpit-muted text-xs font-mono">
          No prediction made
        </p>
      );
    }
    return (
      <p className="text-cockpit-muted text-xs font-mono flex items-center gap-1">
        <span>🔒</span>
        <span>Prediction locked</span>
      </p>
    );
  }

  const pts = pred.pointsAwarded;
  const col = pointsColor(pts);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-cockpit-muted text-xs font-mono">Your pick:</span>
      <span className="text-cockpit-dim text-xs font-mono font-semibold">
        {pred.homeScore}–{pred.awayScore}
      </span>
      {pts !== null && (
        <span className="text-xs font-bold font-mono" style={{ color: col }}>
          {pts === 5 ? "⚡" : pts === 3 ? "✓" : pts === 2 ? "~" : "✗"} {pts} pts
        </span>
      )}
      {open && (
        <span className="text-cockpit-muted text-[10px] font-mono">(edit)</span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface FixtureCardProps {
  fixture:         Fixture;
  showPrediction?: boolean;
  compact?:        boolean;  // tighter layout for league/leaderboard pages
}

export default function FixtureCard({
  fixture,
  showPrediction = true,
  compact = false,
}: FixtureCardProps) {
  const open    = isPredictionOpen(fixture);
  const done    = fixture.status === "completed";
  const hasPred = !!fixture.myPrediction;

  const borderColor =
    done && hasPred && fixture.myPrediction?.pointsAwarded === 5 ? "#00e67620" :
    done && hasPred && (fixture.myPrediction?.pointsAwarded ?? 0) > 0 ? "#00d4ff20" :
    open ? "#1e2a38" : "#131c27";

  const inner = (
    <div
      className="bg-cockpit-card border rounded-sm px-4 py-3 flex flex-col gap-2 w-full hover:border-cockpit-accent transition-colors duration-150"
      style={{ borderColor }}
    >
      {/* Header row: stage label + status badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-cockpit-muted truncate">
          {fixture.groupName ? `Group ${fixture.groupName}` : stageLabel(fixture.stage)}
        </span>
        <StatusBadge fixture={fixture} showPrediction={showPrediction} />
      </div>

      {/* Teams + score */}
      <div className="flex items-center gap-2">
        <TeamDisplay team={fixture.homeTeam} align="left" />
        <ScoreBadge fixture={fixture} />
        <TeamDisplay team={fixture.awayTeam} align="right" />
      </div>

      {/* Prediction row */}
      {showPrediction && !compact && (
        <PredictionRow fixture={fixture} />
      )}

      {/* Venue */}
      {!compact && fixture.venue && (
        <p className="text-[10px] text-cockpit-muted font-mono truncate">
          {fixture.venue}
        </p>
      )}
    </div>
  );

  return (
    <Link href={`/predict/${fixture.id}`} className="block w-full">
      {inner}
    </Link>
  );
}
