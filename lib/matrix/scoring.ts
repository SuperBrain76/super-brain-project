import type { SessionState, AssessmentResult } from "./types";

// ── Percentile lookup ─────────────────────────────────────────
// Calibrated to the new scoring formula.
// Scoring average: adaptive test converges to ~50% accuracy at your level,
// so a typical difficulty-8 user with 50% accuracy scores ~52 → ~50th percentile.

const SCORE_PERCENTILE: Array<[number, number]> = [
  [90, 99], [82, 97], [73, 93], [63, 85], [54, 72],
  [45, 55], [37, 40], [29, 27], [22, 15], [15, 7], [0, 2],
];

function toPercentile(score: number): number {
  for (const [threshold, pct] of SCORE_PERCENTILE) {
    if (score >= threshold) return pct;
  }
  return 2;
}

// ── Speed score ───────────────────────────────────────────────

function calcSpeedScore(attempts: SessionState["attempts"]): number {
  const correctAttempts = attempts.filter(a => a.correct && a.responseMs > 0);
  if (correctAttempts.length === 0) return 0;

  // Compare response time to a generous time budget (harder qs get more time)
  const avgRatio = correctAttempts.reduce((sum, a) => {
    const limit = 40_000 + (10 - a.difficulty) * 2_000;
    return sum + Math.min(1, a.responseMs / limit);
  }, 0) / correctAttempts.length;

  return Math.round(Math.max(0, Math.min(100, (1 - avgRatio) * 100)));
}

// ── Consistency score ─────────────────────────────────────────

function calcConsistency(attempts: SessionState["attempts"]): number {
  if (attempts.length < 4) return 60;
  const mid  = Math.floor(attempts.length / 2);
  const acc1 = attempts.slice(0, mid).filter(a => a.correct).length / mid;
  const acc2 = attempts.slice(mid).filter(a => a.correct).length / (attempts.length - mid);
  return Math.round(Math.max(0, Math.min(100, (1 - Math.abs(acc1 - acc2) * 2) * 100)));
}

// ── Profile label ─────────────────────────────────────────────

function buildProfile(score: number, accuracy: number) {
  if (score >= 90) {
    return {
      label: "Elite Fluid Reasoner",
      description:
        "Exceptional abstract reasoning reaching difficulty levels achieved by fewer than 1% of test-takers. Pattern recognition and logical inference operate at peak efficiency.",
      strengths: ["Advanced pattern abstraction", "Multi-rule integration", "High processing efficiency"],
    };
  }
  if (score >= 75) {
    return {
      label: "High-Range Fluid Reasoner",
      description:
        "Strong abstract reasoning with consistent accuracy at high difficulty. You identify complex relational structures and multi-rule patterns efficiently.",
      strengths: ["Strong relational reasoning", "Accurate rule tracking", "Good processing speed"],
    };
  }
  if (score >= 58) {
    return {
      label: "Above-Average Fluid Reasoner",
      description:
        "Solid abstract reasoning capability. You handle multi-step patterns well and show good processing speed on moderate-to-high complexity items.",
      strengths: ["Clear pattern recognition", "Good working memory", "Efficient mid-range processing"],
    };
  }
  if (score >= 42) {
    return {
      label: "Average Fluid Reasoner",
      description:
        "Typical abstract reasoning performance. You perform consistently on foundational patterns and show developing ability on complex structures.",
      strengths: ["Reliable on structured patterns", "Consistent rule tracking", "Solid baseline processing"],
    };
  }
  return {
    label: "Developing Fluid Reasoner",
    description:
      "Your reasoning performance shows room for growth in abstract pattern recognition. Fluid reasoning is highly trainable with targeted practice.",
    strengths: ["Pattern awareness", "Steady engagement", "Baseline rule recognition"],
  };
}

// ── Main scoring function ─────────────────────────────────────

export function calculateResult(session: SessionState): AssessmentResult {
  const { attempts, abilityEstimate, sessionId, suspiciousTimes, focusViolations } = session;
  if (attempts.length === 0) throw new Error("No attempts");

  const correctCount = attempts.filter(a => a.correct).length;
  const accuracy     = correctCount / attempts.length;
  const maxDiff      = Math.max(...attempts.map(a => a.difficulty));
  const avgMs        = attempts.reduce((s, a) => s + a.responseMs, 0) / attempts.length;
  const speedScore   = calcSpeedScore(attempts);
  const consistency  = calcConsistency(attempts);

  // ── Core score: ability × accuracy, no generous floor ────────
  //
  // Design goals:
  //   • Perfect (D10, 100% accuracy) → 100
  //   • High ability + guessing (D9, 50% accuracy) → ~52  (not 85!)
  //   • Adaptive convergence sweet-spot (D7, 60% accuracy) → ~55
  //   • Low difficulty, high accuracy (D4, 90%) → ~45
  //
  // Formula: raw = (abilityEstimate/10) * accuracy * 100
  //          curved = raw^0.72 * 100 / 100^0.72   (stretches mid-range)
  //
  // The curve prevents very-low accuracy from being too punishing at the
  // bottom while keeping high-accuracy scores appropriately separated.

  const rawBase    = (abilityEstimate / 10) * accuracy * 100;     // 0–100
  const curveExp   = 0.72;
  const curvedBase = rawBase <= 0
    ? 0
    : Math.pow(rawBase / 100, curveExp) * 100;

  // Small bonuses: speed (up to 5 pts) + consistency (up to 5 pts)
  // Weighted by accuracy so bonuses don't rescue a poor score
  const bonus = accuracy * ((speedScore / 100) * 5 + (consistency / 100) * 5);

  const fluidScore = Math.round(Math.max(0, Math.min(100, curvedBase + bonus)));
  const percentile = toPercentile(fluidScore);

  const flagged = suspiciousTimes > attempts.length * 0.4 || focusViolations > 4;

  return {
    sessionId,
    fluidScore,
    percentile,
    speedScore,
    accuracyRate:      parseFloat(accuracy.toFixed(3)),
    difficultyReached: maxDiff,
    consistencyScore:  consistency,
    questionsAnswered: attempts.length,
    avgResponseMs:     Math.round(avgMs),
    flagged,
    profile:           buildProfile(fluidScore, accuracy),
  };
}
