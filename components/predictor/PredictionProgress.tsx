"use client";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";

interface PredictionProgressProps {
  /** Number of open (schedulable + future) fixtures the user has predicted */
  predicted: number;
  /** Total open fixtures available to predict */
  total: number;
  /** Optional extra context shown on the right (e.g. "48 group-stage matches") */
  context?: string;
}

function motivationalMessage(pct: number, predicted: number, total: number): string {
  const remaining = total - predicted;
  if (pct === 0)   return `Predict all ${total} matches before they kick off`;
  if (pct === 100) return "All matches predicted — check back after kickoffs";
  if (pct >= 75)   return `Almost there — ${remaining} left to predict`;
  if (pct >= 50)   return `Halfway there — ${remaining} matches left`;
  if (pct >= 25)   return `Good start — ${remaining} more to go`;
  return `${remaining} matches left to predict`;
}

export default function PredictionProgress({
  predicted,
  total,
  context,
}: PredictionProgressProps) {
  if (total === 0) return null;

  const pct      = Math.min(100, Math.round((predicted / total) * 100));
  const complete = predicted >= total;
  const barColor = complete ? GOLD : GREEN;
  const message  = motivationalMessage(pct, predicted, total);

  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-2"
      style={{
        background:  "#fff",
        border:      `1px solid ${complete ? `${GOLD}50` : BORDER}`,
        borderLeft:  `3px solid ${barColor}`,
      }}
    >
      {/* Top row: label + fraction */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Pulse dot when incomplete */}
          {!complete && (
            <span
              className="w-2 h-2 rounded-full shrink-0 animate-pulse"
              style={{ background: GREEN }}
            />
          )}
          {complete && (
            <span className="text-sm shrink-0">🏆</span>
          )}
          <span className="text-sm font-bold truncate" style={{ color: "#0f1f17" }}>
            {complete
              ? "All matches predicted!"
              : `${predicted} of ${total} matches predicted`}
          </span>
        </div>
        <span
          className="text-sm font-black tabular-nums shrink-0"
          style={{ color: barColor, letterSpacing: "-0.5px" }}
        >
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e8ede6" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>

      {/* Motivational message */}
      <p className="text-[11px]" style={{ color: MUTED }}>
        {message}
        {context && (
          <span> · <span style={{ color: "#7a8f82" }}>{context}</span></span>
        )}
      </p>
    </div>
  );
}

// ── Group completion badge ─────────────────────────────────────
// Small inline chip: "3/6" (partial) or "✓" (complete)

interface GroupBadgeProps {
  predicted: number;
  total:     number;
}

export function GroupBadge({ predicted, total }: GroupBadgeProps) {
  if (total === 0) return null;
  const complete = predicted >= total;

  if (complete) {
    return (
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
        style={{ background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30` }}
      >
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
          <polyline points="2,5 4.5,7.5 8,3" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Done
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold tabular-nums"
      style={{ background: "#f0f3ef", color: MUTED, border: `1px solid ${BORDER}` }}
    >
      {predicted}/{total}
    </span>
  );
}
