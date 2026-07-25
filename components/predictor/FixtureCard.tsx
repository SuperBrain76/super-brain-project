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
import { getKnockoutSeeds } from "@/lib/knockoutSeeds";
import { useCompetitionSlug } from "@/components/CompetitionProvider";
import SeedPill from "./SeedPill";

const LAST_FIXTURE_KEY = "lastPredictedFixture";

// ── Design tokens (premium green/gold/navy) ───────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const NAVY   = "#0e1e35";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";

// ── Team name + flag ─────────────────────────────────────────

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
  const isTbd = !team;
  const name  = team?.name ?? null;
  const flag  = team?.flagEmoji ?? null;

  return (
    <div
      className={`flex items-center gap-2 flex-1 min-w-0 ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
    >
      {/* Flag or placeholder shield */}
      {flag ? (
        <span className="text-xl shrink-0 leading-none">{flag}</span>
      ) : (
        <span
          className="text-lg shrink-0 leading-none opacity-30"
          aria-hidden="true"
        >
          🛡
        </span>
      )}

      <div
        className={`flex flex-col min-w-0 gap-0.5 ${align === "right" ? "items-end" : ""}`}
      >
        {/* Team name or seed label as primary */}
        {name ? (
          <>
            <span
              className="text-sm font-semibold leading-tight truncate"
              style={{ color: dim ? MUTED : "#0f1f17", fontWeight: dim ? 500 : 600 }}
            >
              {name}
            </span>
            {team?.fifaRanking && (
              <span className="text-[9px] font-semibold" style={{ color: MUTED }}>
                FIFA #{team.fifaRanking}
              </span>
            )}
          </>
        ) : seedLabel ? (
          <span
            className="text-sm font-semibold leading-tight"
            style={{ color: "#7a5e14", fontWeight: 600 }}
          >
            {seedLabel}
          </span>
        ) : (
          <span className="text-sm" style={{ color: MUTED }}>TBD</span>
        )}

        {/* Seed pill only shown when team is TBD — once team is known, suppress it */}
        {!name && seedLabel && (
          <SeedPill label={seedLabel} />
        )}
      </div>
    </div>
  );
}

// ── Centre score / vs ────────────────────────────────────────

function ScoreBadge({ fixture }: { fixture: Fixture }) {
  const showScore = (fixture.status === "completed" || fixture.status === "live") &&
    fixture.homeScore !== null && fixture.awayScore !== null;

  if (showScore) {
    return (
      <div className="flex flex-col items-center justify-center shrink-0 px-2 gap-0.5">
        {fixture.status === "live" && (
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#e53e3e" }}>Live</span>
        )}
        <div className="flex items-center gap-1">
          <span className="text-lg font-black number-display tabular-nums" style={{ color: NAVY }}>
            {fixture.homeScore}
          </span>
          <span className="font-bold" style={{ color: BORDER }}>–</span>
          <span className="text-lg font-black number-display tabular-nums" style={{ color: NAVY }}>
            {fixture.awayScore}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center shrink-0 px-2">
      <span
        className="text-xs font-semibold tracking-widest uppercase"
        style={{ color: fixture.status === "live" ? "#e53e3e" : MUTED }}
      >
        {fixture.status === "live" ? "LIVE" : "vs"}
      </span>
    </div>
  );
}

// ── Status badge (top-right of card) ─────────────────────────

function StatusBadge({
  fixture,
  showPrediction,
}: {
  fixture:        Fixture;
  showPrediction: boolean;
}) {
  const open      = isPredictionOpen(fixture);
  const done      = fixture.status === "completed";
  const live      = fixture.status === "live";
  const hasPred   = !!fixture.myPrediction;
  const msUntil   = new Date(fixture.kicksOffAt).getTime() - Date.now();
  const closing   = open && msUntil < 24 * 3_600_000;
  const countdown = closing ? kickoffCountdown(fixture.kicksOffAt) : "";

  if (live) {
    return (
      <span
        className="flex items-center gap-1 text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded-sm"
        style={{ color: "#e53e3e", background: "#fff0f0", border: "1px solid #fca5a5" }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "#e53e3e" }} />
        LIVE
      </span>
    );
  }

  if (done) {
    if (showPrediction && hasPred && fixture.myPrediction!.pointsAwarded !== null) {
      const pts = fixture.myPrediction!.pointsAwarded;
      const isExact = pts === 5 || pts === 3;
      return (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm shrink-0"
          style={{ color: isExact ? GOLD : MUTED, background: isExact ? `${GOLD}15` : "#f0f3ef" }}
        >
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

  if (!open && !done && !live) {
    return <span className="text-[10px]" style={{ color: MUTED }}>🔒 Locked</span>;
  }

  if (closing) {
    if (showPrediction && hasPred) {
      return (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm"
          style={{ color: "#d97706", background: "#fef9e7" }}>
          ✓ Closes {countdown}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm"
        style={{ color: "#d97706", background: "#fef9e7" }}>
        ⏱ {countdown}
      </span>
    );
  }

  return (
    <span className="text-[10px]" style={{ color: MUTED }}>
      {formatKickoff(fixture.kicksOffAt, { time: true })}
    </span>
  );
}

// ── YOUR PICK strip ──────────────────────────────────────────
// Prominent green bar, always visible when a prediction is saved.
// Shows: ✓ PREDICTED · score · Edit link / points result.

function PickStrip({ fixture }: { fixture: Fixture }) {
  const pred = fixture.myPrediction;
  if (!pred) return null;

  const open    = isPredictionOpen(fixture);
  const done    = fixture.status === "completed";
  const pts     = pred.pointsAwarded;
  const isExact = done && (pts === 5 || pts === 3);

  // Background: gold tint for exact/3pt, green tint otherwise
  const bg        = isExact ? "#fdf9ee" : "#eef8f0";
  const topBorder = isExact ? "#e8d48a" : "#86c99a";
  const accent    = isExact ? GOLD : GREEN;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{ background: bg, borderTop: `2px solid ${topBorder}` }}
    >
      {/* ✓ Tick */}
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
        style={{ background: accent }}
      >
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
          <polyline points="2,5 4.5,7.5 8,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Label */}
      <span
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {done && isExact ? "Exact Score" : done ? "Predicted" : "✓ Predicted"}
      </span>

      {/* Score — large and bold */}
      <span
        className="text-base font-black tabular-nums leading-none"
        style={{ color: accent, letterSpacing: "0.04em" }}
      >
        {pred.homeScore}–{pred.awayScore}
      </span>

      {/* Right side: points OR edit link */}
      {done && pts !== null ? (
        <span
          className="ml-auto text-[10px] font-bold"
          style={{ color: isExact ? GOLD : MUTED }}
        >
          {pts > 0 ? `+${pts} pts` : "0 pts"}{isExact ? " ★" : ""}
        </span>
      ) : open ? (
        <span className="ml-auto text-[10px] font-semibold" style={{ color: GREEN }}>
          Edit →
        </span>
      ) : null}
    </div>
  );
}

// ── Fallback prediction row (no prediction, open fixture) ─────

function NoPredRow({ fixture }: { fixture: Fixture }) {
  const open = isPredictionOpen(fixture);
  const done = fixture.status === "completed";

  if (open) return (
    <p className="text-xs font-medium" style={{ color: GREEN }}>
      Tap to predict →
    </p>
  );
  if (done) return (
    <p className="text-xs" style={{ color: MUTED }}>No prediction made</p>
  );
  return (
    <p className="text-xs flex items-center gap-1" style={{ color: MUTED }}>
      <span>🔒</span>
      <span>Prediction locked</span>
    </p>
  );
}

// ── Main component ────────────────────────────────────────────

interface FixtureCardProps {
  fixture:         Fixture;
  showPrediction?: boolean;
  compact?:        boolean;
  highlighted?:    boolean;
}

export default function FixtureCard({
  fixture,
  showPrediction = true,
  compact = false,
  highlighted = false,
}: FixtureCardProps) {
  // Rendered only inside /[competition]/*; falls back to the legacy
  // prefix if ever rendered outside, which redirects correctly.
  const competitionSlug = useCompetitionSlug() ?? "predict";
  const open    = isPredictionOpen(fixture);
  const done    = fixture.status === "completed";
  const hasPred = !!fixture.myPrediction;
  const isExact = hasPred && done && (fixture.myPrediction?.pointsAwarded === 3 || fixture.myPrediction?.pointsAwarded === 5);

  // Left accent + border when predicted
  const leftBorder  = showPrediction && hasPred ? `3px solid ${GREEN}` : "3px solid transparent";
  const borderColor =
    highlighted                 ? "#86b89a" :
    showPrediction && isExact   ? `${GOLD}80` :
    showPrediction && hasPred   ? "#86b89a" :
    BORDER;

  return (
    <Link
      href={`/${competitionSlug}/fixture/${fixture.id}`}
      id={`fixture-${fixture.id}`}
      className="block w-full"
      onClick={() => {
        try { sessionStorage.setItem(LAST_FIXTURE_KEY, fixture.id); } catch { /* private mode */ }
      }}
    >
      <div
        className="rounded-xl overflow-hidden w-full transition-all duration-150"
        style={{
          background:   "#fff",
          border:       `1px solid ${borderColor}`,
          borderLeft:   leftBorder,
          boxShadow:    highlighted ? `0 0 0 2px ${GREEN}40, 0 2px 8px rgba(26,58,42,0.12)` : "0 1px 2px rgba(0,0,0,0.04)",
          transition:   "box-shadow 0.9s ease-out, border-color 0.15s",
        }}
      >
        {/* Header row: stage label + match number (knockout) + status badge */}
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

        {/* Teams + score */}
        {(() => {
          const seeds = getKnockoutSeeds(fixture.fixtureNumber);
          return (
            <div className="flex items-center gap-2 px-3 py-2">
              <TeamDisplay
                team={fixture.homeTeam}
                align="left"
                seedLabel={seeds?.home}
              />
              <ScoreBadge fixture={fixture} />
              <TeamDisplay
                team={fixture.awayTeam}
                align="right"
                dim
                seedLabel={seeds?.away}
              />
            </div>
          );
        })()}

        {/* YOUR PICK strip — only when there is a prediction */}
        {showPrediction && hasPred && !compact && (
          <PickStrip fixture={fixture} />
        )}

        {/* No prediction fallback row */}
        {showPrediction && !hasPred && !compact && (
          <div className="px-3 pb-2.5">
            <NoPredRow fixture={fixture} />
          </div>
        )}

        {/* Venue */}
        {!compact && fixture.venue && (
          <p className="text-[10px] px-3 pb-2" style={{ color: MUTED }}>
            {fixture.venue}
          </p>
        )}
      </div>
    </Link>
  );
}
