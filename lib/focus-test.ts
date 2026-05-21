// ── Focus & Attention Performance Test — scoring engine ──────────────────────

export interface PhaseResult {
  phase:         1 | 2 | 3 | 4 | 5;
  score:         number;         // 0-100 phase score
  accuracy:      number;         // 0-1
  avgReactionMs: number;         // average response time ms (0 = N/A)
  streakMax:     number;         // highest streak in this phase
  extras:        Record<string, number>;
}

export interface FocusMetrics {
  focusScore:            number; // 0-100 composite
  distractionResistance: number; // 0-100 — from Phase 2 signal accuracy
  sustainedAttention:    number; // 0-100 — consistency across all phases
  recoverySpeed:         number; // 0-100 — from Phase 3
  processingConsistency: number; // 0-100 — inverse of score variance
  cognitiveEndurance:    number; // 0-100 — late vs early phase performance
}

// Phase weights — later phases are harder and weighted higher
const PHASE_WEIGHTS = [1.0, 1.1, 1.2, 1.3, 1.5];

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function computeMetrics(phases: PhaseResult[]): FocusMetrics {
  const scores = phases.map((p) => p.score);

  // Weighted focus score
  const totalWeight = phases.reduce((s, _, i) => s + PHASE_WEIGHTS[i], 0);
  const weightedSum  = phases.reduce((s, p, i) => s + p.score * PHASE_WEIGHTS[i], 0);
  const focusScore   = clamp(weightedSum / totalWeight);

  // Distraction resistance — Phase 2 (Signal Filter)
  const p2 = phases.find((p) => p.phase === 2);
  const distractionResistance = clamp(p2 ? p2.score : 50);

  // Sustained attention — mean / penalised by spread
  const mean           = scores.reduce((s, v) => s + v, 0) / scores.length;
  const spread         = stddev(scores);
  const sustainedRaw   = mean - spread * 0.5; // penalise inconsistency
  const sustainedAttention = clamp(sustainedRaw);

  // Recovery speed — Phase 3 (Interruption Recovery)
  const p3 = phases.find((p) => p.phase === 3);
  const recoverySpeed = clamp(p3 ? p3.extras.recoveryScore ?? p3.score : 50);

  // Processing consistency — inverse of score variance (100 = perfect consistency)
  const consistencyRaw    = 100 - spread;
  const processingConsistency = clamp(consistencyRaw);

  // Cognitive endurance — last two phases vs first two phases
  const early = scores.slice(0, 2).reduce((s, v) => s + v, 0) / 2;
  const late  = scores.slice(3).reduce((s, v) => s + v, 0) / scores.slice(3).length;
  const enduranceRaw   = early > 0 ? (late / early) * 100 : 50;
  const cognitiveEndurance = clamp(enduranceRaw);

  return {
    focusScore,
    distractionResistance,
    sustainedAttention,
    recoverySpeed,
    processingConsistency,
    cognitiveEndurance,
  };
}

export function getResultTitle(score: number): string {
  if (score >= 90) return "Elite Focus";
  if (score >= 80) return "High Performer";
  if (score >= 70) return "Sharp";
  if (score >= 60) return "Solid";
  if (score >= 50) return "Average";
  return "Scattered";
}

export function getResultDescription(score: number): string {
  if (score >= 90) return "Top-tier attentional control. You filter noise, recover fast, and sustain performance under pressure.";
  if (score >= 80) return "Strong focus architecture. You handle distractions well and maintain high output across extended sessions.";
  if (score >= 70) return "Above-average focus. You manage most distractions effectively with minor lapses under pressure.";
  if (score >= 60) return "Solid baseline. You perform reliably in low-distraction environments but struggle under cognitive load.";
  if (score >= 50) return "Average attentional control. Room to improve distraction resistance and recovery speed.";
  return "High susceptibility to distraction. Performance degrades significantly under cognitive pressure.";
}

export function getPercentile(score: number): number {
  if (score >= 95) return 99;
  if (score >= 90) return 97;
  if (score >= 85) return 93;
  if (score >= 80) return 88;
  if (score >= 75) return 80;
  if (score >= 70) return 70;
  if (score >= 65) return 60;
  if (score >= 60) return 50;
  if (score >= 55) return 40;
  if (score >= 50) return 30;
  if (score >= 45) return 22;
  if (score >= 40) return 15;
  return 8;
}

export const METRIC_META: Record<
  keyof FocusMetrics,
  { label: string; description: string; low: string; high: string }
> = {
  focusScore: {
    label:       "Focus Score",
    description: "Weighted composite across all 5 phases — overall attentional performance.",
    low:         "Scattered",
    high:        "Elite",
  },
  distractionResistance: {
    label:       "Distraction Resistance",
    description: "How accurately you filtered signal from noise in the Signal Filter phase.",
    low:         "Reactive",
    high:        "Filtered",
  },
  sustainedAttention: {
    label:       "Sustained Attention",
    description: "Consistency of performance over the full session. Low variance = high sustained attention.",
    low:         "Inconsistent",
    high:        "Sustained",
  },
  recoverySpeed: {
    label:       "Recovery Speed",
    description: "How fast you re-engaged with your primary task after interruptions.",
    low:         "Slow",
    high:        "Instant",
  },
  processingConsistency: {
    label:       "Processing Consistency",
    description: "Inverse of performance variance. Consistent performers score high.",
    low:         "Variable",
    high:        "Consistent",
  },
  cognitiveEndurance: {
    label:       "Cognitive Endurance",
    description: "Late-session performance relative to early-session. Measures mental stamina.",
    low:         "Fatigue",
    high:        "Enduring",
  },
};

// Phase colour palette — one per phase
export const PHASE_COLORS = ["#00d4ff", "#ffab00", "#ff6d00", "#c084fc", "#00e676"] as const;

export const PHASE_NAMES = [
  "Target Lock",
  "Signal Filter",
  "Interruption Recovery",
  "Dual Track",
  "Priority Storm",
] as const;
