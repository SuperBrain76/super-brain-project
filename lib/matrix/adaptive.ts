import type { SessionState, QuestionAttempt } from "./types";
import { generateQuestion } from "./patterns";
import type { MatrixQuestion } from "./types";
// ── Configuration ─────────────────────────────────────────────

export const TOTAL_QUESTIONS  = 18;
export const START_DIFFICULTY  = 4;  // calibration entry point
const MIN_DIFFICULTY           = 1;
const MAX_DIFFICULTY           = 10;
const SUSPICIOUS_RESPONSE_MS   = 350; // < this = flag

// ── Session factory ───────────────────────────────────────────

export function createSession(): SessionState {
  return {
    sessionId:         crypto.randomUUID(),
    attempts:          [],
    abilityEstimate:   START_DIFFICULTY,
    currentDifficulty: START_DIFFICULTY,
    questionsTotal:    TOTAL_QUESTIONS,
    startedAt:         Date.now(),
    focusViolations:   0,
    suspiciousTimes:   0,
  };
}

// ── Ability update (exponential smoothing + direction) ────────

/**
 * Update the ability estimate after an answer.
 * Correct: ability climbs toward difficulty + 1.
 * Wrong:   ability retreats toward difficulty - 2.
 */
export function updateAbility(current: number, difficulty: number, correct: boolean): number {
  const target = correct ? difficulty + 1 : difficulty - 1.5;
  const updated = current * 0.65 + target * 0.35;
  return Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, updated));
}

/** Next question difficulty, clamped and stepped. */
export function nextDifficulty(ability: number, correct: boolean, prevDiff: number): number {
  const step = correct ? 1 : -1;
  const raw  = prevDiff + step;
  return Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, raw));
}

// ── Question selection ────────────────────────────────────────

/**
 * Pick the next question to show.
 * seedOffset ensures no two adjacent questions share the same pattern+variant.
 */
export function selectNextQuestion(
  session: SessionState,
  seedOffset: number,
): MatrixQuestion {
  return generateQuestion(session.currentDifficulty, seedOffset);
}

// ── Record attempt + advance state ────────────────────────────

export function recordAttempt(
  session: SessionState,
  attempt: QuestionAttempt,
): SessionState {
  const suspicious = attempt.responseMs < SUSPICIOUS_RESPONSE_MS && attempt.responseMs > 0;
  const newAbility = updateAbility(session.abilityEstimate, attempt.difficulty, attempt.correct);
  const newDiff    = nextDifficulty(newAbility, attempt.correct, session.currentDifficulty);

  return {
    ...session,
    attempts:          [...session.attempts, attempt],
    abilityEstimate:   newAbility,
    currentDifficulty: newDiff,
    suspiciousTimes:   session.suspiciousTimes + (suspicious ? 1 : 0),
  };
}

// ── Terminal check ────────────────────────────────────────────

export function isComplete(session: SessionState): boolean {
  return session.attempts.length >= TOTAL_QUESTIONS;
}
