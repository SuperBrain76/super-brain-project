import type { SessionState, AssessmentResult } from "./types";

// ── Percentile lookup (approximates normal distribution) ──────

const SCORE_PERCENTILE: Array<[number, number]> = [
  [95, 99], [88, 97], [80, 93], [72, 85], [63, 72],
  [55, 55], [47, 40], [38, 27], [30, 15], [22, 7], [0, 2],
];

function toPercentile(score: number): number {
  for (const [threshold, pct] of SCORE_PERCENTILE) {
    if (score >= threshold) return pct;
  }
  return 2;
}

// ── Speed score ───────────────────────────────────────────────

function calcSpeedScore(attempts: SessionState["attempts"]): number {
  if (attempts.length === 0) return 50;
  const correctAttempts = attempts.filter(a => a.correct && a.responseMs > 0);
  if (correctAttempts.length === 0) return 30;

  // Normalise: average response time compared to time limit
  const avgRatio = correctAttempts.reduce((sum, a) => {
    // question timeLimit not stored in attempt — use difficulty proxy
    const limit = 40000 + (10 - a.difficulty) * 2000;
    return sum + Math.min(1, a.responseMs / limit);
  }, 0) / correctAttempts.length;

  // Lower ratio = faster = higher score
  return Math.round(Math.max(0, Math.min(100, (1 - avgRatio) * 100)));
}

// ── Consistency score ─────────────────────────────────────────

function calcConsistency(attempts: SessionState["attempts"]): number {
  if (attempts.length < 3) return 75;

  // Compute accuracy in first half vs second half
  const mid = Math.floor(attempts.length / 2);
  const acc1 = attempts.slice(0, mid).filter(a => a.correct).length / mid;
  const acc2 = attempts.slice(mid).filter(a => a.correct).length / (attempts.length - mid);

  const diff = Math.abs(acc1 - acc2);
  return Math.round(Math.max(0, Math.min(100, (1 - diff * 1.5) * 100)));
}

// ── Profile label ─────────────────────────────────────────────

function buildProfile(score: number, speedScore: number, accuracy: number) {
  if (score >= 88) {
    return {
      label: "Elite Fluid Reasoner",
      description:
        "You demonstrate exceptional abstract reasoning, reaching difficulty levels rarely achieved. Your pattern recognition and logical inference operate with minimal latency.",
      strengths: ["Advanced pattern abstraction", "Multi-rule integration", "High processing efficiency"],
    };
  }
  if (score >= 75) {
    return {
      label: "High-Range Fluid Reasoner",
      description:
        "Strong abstract reasoning with consistent performance at high difficulty. You identify complex relational structures efficiently.",
      strengths: ["Strong relational reasoning", "Consistent accuracy under time pressure", "Good rule abstraction"],
    };
  }
  if (score >= 60) {
    return {
      label: "Above-Average Fluid Reasoner",
      description:
        "Solid abstract reasoning capability. You handle multi-step patterns well and show good processing speed on moderate-complexity items.",
      strengths: ["Clear pattern recognition", "Good working memory usage", "Efficient processing on medium difficulty"],
    };
  }
  if (score >= 45) {
    return {
      label: "Average Fluid Reasoner",
      description:
        "Typical abstract reasoning performance. You perform well on foundational patterns and show developing ability on more complex structures.",
      strengths: ["Reliable on structured patterns", "Consistent rule tracking", "Good baseline processing"],
    };
  }
  return {
    label: "Developing Fluid Reasoner",
    description:
      "Your reasoning performance suggests room for growth in abstract pattern recognition. With targeted practice, fluid reasoning is highly trainable.",
    strengths: ["Pattern awareness", "Steady engagement", "Baseline rule recognition"],
  };
}

// ── Main scoring function ─────────────────────────────────────

export function calculateResult(session: SessionState): AssessmentResult {
  const { attempts, abilityEstimate, sessionId, suspiciousTimes, focusViolations } = session;
  if (attempts.length === 0) throw new Error("No attempts");

  const accuracy   = attempts.filter(a => a.correct).length / attempts.length;
  const maxDiff    = Math.max(...attempts.map(a => a.difficulty));
  const avgMs      = attempts.reduce((s, a) => s + a.responseMs, 0) / attempts.length;
  const speedScore = calcSpeedScore(attempts);
  const consistency = calcConsistency(attempts);

  // Core ability score: ability estimate (1–10) scaled to 0–80
  const baseScore    = (abilityEstimate / 10) * 80;
  // Accuracy modifier: 0.7–1.0
  const accMod       = 0.70 + accuracy * 0.30;
  // Speed bonus: up to 10 points
  const speedBonus   = (speedScore / 100) * 10;
  // Consistency bonus: up to 10 points
  const consBonus    = (consistency / 100) * 10;

  const rawScore = baseScore * accMod + speedBonus + consBonus;
  const fluidScore  = Math.round(Math.max(0, Math.min(100, rawScore)));
  const percentile  = toPercentile(fluidScore);

  // Flag if cheating signals are high
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
    profile:           buildProfile(fluidScore, speedScore, accuracy),
  };
}
