"use client";

/**
 * CompletionCelebration — the "wow" moment.
 *
 * The first time a user predicts all ten matches, we do NOT just save. We
 * celebrate. This is the emotional payoff that turns a one-time visitor into
 * someone who comes back on Saturday to watch the points land.
 *
 * It is built to move the four metrics:
 *   • completed predictions — it rewards finishing, so people finish
 *   • return visits         — "earn up to N IQ this weekend" gives a reason to come back
 *   • sharing               — a share button, front and centre
 *   • signups               — social proof ("you've joined N players")
 *
 * Full-screen, celebratory, one obvious next step. Confetti is hand-rolled
 * CSS — no library, no dependency.
 */

import { useEffect, useMemo } from "react";

const GREEN = "#1a3a2a";
const GOLD  = "#b8972a";
const TEXT1 = "#0f1f17";
const MUTED = "#5c6b60";

export interface CelebrationProps {
  roundLabel:      string;             // "Matchweek 1"
  matchCount:      number;             // 10
  maxIq:           number;             // biggest possible IQ haul this week
  playerCount?:    number;             // social proof — hidden if absent
  onViewLeaderboard: () => void;
  onShare?:        () => void;
  onClose:         () => void;
}

export default function CompletionCelebration({
  roundLabel, matchCount, maxIq, playerCount,
  onViewLeaderboard, onShare, onClose,
}: CelebrationProps) {
  // Lock body scroll while the celebration is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const confetti = useMemo(() => makeConfetti(70), []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${roundLabel} complete`}
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      style={{ background: "rgba(9,16,12,0.55)", backdropFilter: "blur(3px)" }}
    >
      <style>{CONFETTI_CSS}</style>

      {/* Confetti layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c, i) => (
          <span key={i} className="sb-confetti" style={c} />
        ))}
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-sm rounded-3xl px-6 pt-8 pb-6 text-center sb-pop"
        style={{ background: "#ffffff", boxShadow: "0 24px 60px rgba(0,0,0,0.35)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-4 text-lg"
          style={{ color: MUTED }}
        >
          ✕
        </button>

        <div className="text-5xl mb-2 sb-trophy">🏆</div>

        <h2 className="text-2xl font-extrabold leading-tight" style={{ color: TEXT1 }}>
          {roundLabel} complete!
        </h2>
        <p className="text-sm mt-1.5 font-semibold" style={{ color: GREEN }}>
          You've predicted all {matchCount} matches.
        </p>

        <div className="my-5 rounded-2xl px-4 py-4" style={{ background: "#f4f7f2", border: "1px solid #e2eadd" }}>
          <div className="text-3xl font-extrabold" style={{ color: GOLD }}>
            up to {maxIq.toLocaleString()} IQ
          </div>
          <div className="text-xs mt-0.5" style={{ color: MUTED }}>
            up for grabs this weekend
          </div>
        </div>

        {playerCount != null && (
          <p className="text-sm mb-5" style={{ color: MUTED }}>
            You've joined <strong style={{ color: TEXT1 }}>{playerCount.toLocaleString()}</strong> SuperBrain players.
          </p>
        )}

        <button
          onClick={onViewLeaderboard}
          className="w-full py-3.5 rounded-xl text-base font-bold transition-transform active:scale-[0.98]"
          style={{ background: GREEN, color: "#fff" }}
        >
          View leaderboards →
        </button>

        {onShare && (
          <button
            onClick={onShare}
            className="w-full py-3 mt-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "#fff", color: GREEN, border: `1px solid #cfe0d3` }}
          >
            Challenge a friend
          </button>
        )}

        <button onClick={onClose} className="w-full mt-3 text-xs font-medium" style={{ color: MUTED }}>
          Back to my predictions
        </button>
      </div>
    </div>
  );
}

// ── Hand-rolled confetti ──────────────────────────────────────

const PALETTE = ["#EF0107", "#00e676", "#b8972a", "#0057B8", "#6CABDD", "#FDB913", "#1a3a2a"];

function makeConfetti(n: number): React.CSSProperties[] {
  return Array.from({ length: n }, (_, i) => {
    const left  = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const dur   = 2.2 + Math.random() * 1.6;
    const size  = 6 + Math.random() * 6;
    const color = PALETTE[i % PALETTE.length];
    const round = Math.random() > 0.5;
    return {
      left: `${left}%`,
      width: `${size}px`,
      height: `${size * (round ? 1 : 1.6)}px`,
      background: color,
      borderRadius: round ? "50%" : "1px",
      animationDelay: `${delay}s`,
      animationDuration: `${dur}s`,
    } as React.CSSProperties;
  });
}

const CONFETTI_CSS = `
@keyframes sb-fall {
  0%   { transform: translateY(-12vh) rotate(0deg);   opacity: 1; }
  100% { transform: translateY(110vh) rotate(540deg); opacity: 0.9; }
}
.sb-confetti { position: absolute; top: -12vh; animation-name: sb-fall; animation-timing-function: linear; animation-iteration-count: 1; }
@keyframes sb-pop { 0% { transform: scale(0.86); opacity: 0; } 60% { transform: scale(1.02); } 100% { transform: scale(1); opacity: 1; } }
.sb-pop { animation: sb-pop 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
@keyframes sb-trophy { 0% { transform: scale(0.4) rotate(-12deg); } 55% { transform: scale(1.25) rotate(6deg); } 100% { transform: scale(1) rotate(0deg); } }
.sb-trophy { display: inline-block; animation: sb-trophy 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .sb-confetti { display: none; }
  .sb-pop, .sb-trophy { animation: none; }
}
`;
