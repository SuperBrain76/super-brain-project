"use client";

import Link from "next/link";
import {
  type Fixture,
  isPredictionOpen,
  formatKickoff,
  stageLabel,
  pointsColor,
} from "@/lib/predictor";

// ── Helpers ───────────────────────────────────────────────────

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
        style={{ color: open ? "#00d4ff" : "#4a5568" }}
      >
        {open ? "vs" : fixture.status === "live" ? "LIVE" : "vs"}
      </span>
    </div>
  );
}

function PredictionRow({ fixture }: { fixture: Fixture }) {
  const pred = fixture.myPrediction;
  const open  = isPredictionOpen(fixture);

  if (!pred) {
    if (open) {
      return (
        <p className="text-cockpit-accent text-xs font-mono">
          Tap to predict →
        </p>
      );
    }
    return (
      <p className="text-cockpit-border text-xs font-mono">
        No prediction made
      </p>
    );
  }

  const pts  = pred.pointsAwarded;
  const col  = pointsColor(pts);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-cockpit-muted text-xs font-mono">
        Your pick:
      </span>
      <span className="text-cockpit-dim text-xs font-mono font-semibold">
        {pred.homeScore}–{pred.awayScore}
      </span>
      {pts !== null && (
        <span
          className="text-xs font-bold font-mono"
          style={{ color: col }}
        >
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
  fixture:        Fixture;
  showPrediction?: boolean;
  compact?:        boolean;  // tighter layout for league pages
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
      {/* Stage / group label */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-cockpit-muted">
          {fixture.groupName ? `Group ${fixture.groupName}` : stageLabel(fixture.stage)}
        </span>
        <span className="text-[10px] font-mono text-cockpit-border shrink-0">
          {formatKickoff(fixture.kicksOffAt, { date: true, time: false })}
          {" · "}
          {formatKickoff(fixture.kicksOffAt, { time: true })}
        </span>
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
        <p className="text-[10px] text-cockpit-border font-mono truncate">
          {fixture.venue}
        </p>
      )}
    </div>
  );

  // Wrap in Link so entire card is tappable
  return (
    <Link href={`/predict/${fixture.id}`} className="block w-full">
      {inner}
    </Link>
  );
}
