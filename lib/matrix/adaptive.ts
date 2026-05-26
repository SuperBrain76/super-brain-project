import type { SessionState, QuestionAttempt } from "./types";
import { generateQuestion } from "./patterns";
import type { MatrixQuestion } from "./types";
// ── Configuration ─────────────────────────────────────────────

export const TOTAL_QUESTIONS  = 18;
export const START_DIFFICULTY  = 3;  // calibration entry point (easier start = better calibration)
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
 *
 * Correct: ability nudges upward — but only modestly (avoids runaway inflation
 *          from lucky guesses at high difficulty).
 * Wrong:   ability drops more aggressively — prevents high ability from being
 *          "locked in" by a few early correct answers then many wrong ones.
 *
 * Asymmetric smoothing: wrong answers pull harder (0.45 weight) vs
 * correct answers (0.25 weight). This counteracts the natural bias of adaptive
 * tests where difficulty climbs quickly but ability estimate lags behind.
 */
export function updateAbility(current: number, difficulty: number, correct: boolean): number {
  if (correct) {
    const target  = difficulty + 0.5;          // modest climb
    const updated = current * 0.75 + target * 0.25;
    return Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, updated));
  } else {
    const target  = difficulty - 2;            // sharper drop
    const updated = current * 0.55 + target * 0.45;
    return Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, updated));
  }
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
