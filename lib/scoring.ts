import type { ModuleResult, TestSession } from "@/types";

export const MODULE_WEIGHTS = {
  reaction:  0.20,
  visual:    0.20,
  spatial:   0.15,
  multitask: 0.25,
  math:      0.20,
} as const;

export const MODULE_NAMES = {
  reaction:  "Reaction Speed",
  visual:    "Visual Memory",
  spatial:   "Spatial Reasoning",
  multitask: "Multitasking Stress",
  math:      "Mental Math",
} as const;

/** Reaction Speed: score from average RT (ms) */
export function scoreReaction(trials: { rt: number; falsStart: boolean }[]): number {
  if (trials.length === 0) return 0;
  const valid = trials.filter((t) => !t.falsStart);
  if (valid.length === 0) return 0;
  const avg = valid.reduce((s, t) => s + t.rt, 0) / valid.length;
  // 150ms → 100pts, 500ms → 0pts
  const base = Math.max(0, Math.min(100, ((500 - avg) / 350) * 100));
  const falsPenalty = (trials.filter((t) => t.falsStart).length / trials.length) * 20;
  return Math.max(0, Math.round(base - falsPenalty));
}

/** Visual Memory: passed levels with accuracy grades */
export function scoreVisual(results: { level: number; accuracy: number }[]): number {
  if (results.length === 0) return 0;
  let weighted = 0;
  let totalWeight = 0;
  results.forEach(({ level, accuracy }) => {
    const w = level;
    weighted += accuracy * w;
    totalWeight += w;
  });
  return Math.round(totalWeight > 0 ? weighted / totalWeight : 0);
}

/** Spatial Reasoning: correct / attempted percentage */
export function scoreSpatial(correct: number, attempted: number): number {
  if (attempted === 0) return 0;
  return Math.round((correct / attempted) * 100);
}

/**
 * Multitasking: 50% tracking + 50% recall.
 * recall = correct / total (total includes missed).
 */
export function scoreMultitask(trackingScore: number, recallScore: number): number {
  return Math.round(trackingScore * 0.5 + recallScore * 0.5);
}

/**
 * Mental Math: accuracy-dominant scoring.
 * accuracyScore = (correct / attempted) * 100
 * speedBonus    = min(attempted / 40, 1) * 10  (reward answering many questions)
 * final         = min(100, accuracyScore * 0.9 + speedBonus)
 */
export function scoreMath(correct: number, attempted: number): number {
  if (attempted === 0) return 0;
  const accuracyScore = (correct / attempted) * 100;
  const speedBonus = Math.min(attempted / 40, 1) * 10;
  return Math.min(100, Math.round(accuracyScore * 0.9 + speedBonus));
}

export function getRanking(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 80) return "High Performer";
  if (score >= 70) return "Strong";
  if (score >= 60) return "Average";
  return "Needs Work";
}

export function getRankingColor(score: number): string {
  if (score >= 90) return "#00d4ff";
  if (score >= 80) return "#00e676";
  if (score >= 70) return "#69f0ae";
  if (score >= 60) return "#ffab00";
  return "#ff3d00";
}

export function computeTotalScore(modules: ModuleResult[]): number {
  return Math.round(modules.reduce((sum, m) => sum + m.weightedScore, 0));
}

export function buildSession(modules: ModuleResult[], startedAt: number): TestSession {
  const totalScore = computeTotalScore(modules);
  return {
    sessionId: `pct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    startedAt,
    completedAt: Date.now(),
    modules,
    totalScore,
    ranking: getRanking(totalScore),
  };
}

export function exportCSV(session: TestSession): string {
  const rows: string[] = [
    "Module,Raw Score,Weight,Weighted Score",
    ...session.modules.map(
      (m) =>
        `"${m.moduleName}",${m.rawScore.toFixed(1)},${(m.weight * 100).toFixed(0)}%,${m.weightedScore.toFixed(2)}`,
    ),
    "",
    `Total Score,${session.totalScore},,`,
    `Ranking,${session.ranking},,`,
    `Session ID,${session.sessionId},,`,
    `Started,${new Date(session.startedAt).toISOString()},,`,
    `Completed,${new Date(session.completedAt).toISOString()},,`,
  ];
  return rows.join("\n");
}
