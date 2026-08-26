/**
 * lib/orderingModel.ts — ordering (top-5) prediction scoring.
 *
 * A pure TypeScript mirror of migration 073's `apply_ordering_scoring`, in
 * exactly the relationship lib/scoringModel.ts has to `apply_fixture_scoring`:
 *
 * ⚠️ THIS MUST STAY BYTE-EQUIVALENT TO THE SQL. The SQL scores production;
 * this exists for UI display and unit tests. `tests/ordering-model.test.ts`
 * pins the shared rule matrix.
 *
 * The ladder counts EXACT-POSITION HITS across the five slots and maps them
 * onto the same ScoringRules values every sport uses:
 *   5 hits  → exact   (default 5)
 *   3–4     → gd      (default 3)
 *   1–2     → result  (default 2)
 *   0       → wrong   (default 0)
 * Monotone in hits, pub-explainable ("how many of the five did you nail?"),
 * and every emitted value is already an IQ amount_map key — the economy
 * needs no changes.
 */

import { DEFAULT_SCORING, type ScoringRules } from "./scoringModel";

export const ORDERING_SLOTS = 5;

/** Exact-position hits between a predicted and an actual top-5. */
export function orderingHits(
  predicted: readonly string[],
  actual: readonly string[],
): number {
  let hits = 0;
  for (let i = 0; i < ORDERING_SLOTS; i++) {
    if (predicted[i] !== undefined && predicted[i] === actual[i]) hits++;
  }
  return hits;
}

/** Points for hit count — mirrors the SQL CASE in apply_ordering_scoring. */
export function pointsForHits(
  hits: number,
  rules: ScoringRules = DEFAULT_SCORING,
): number {
  if (hits === 5) return rules.exact;
  if (hits >= 3) return rules.gd;
  if (hits >= 1) return rules.result;
  return rules.wrong;
}

/**
 * Points for one ordering prediction against the actual classification.
 * `actual` is positions 1..5 in order; a partial actual (< 5 entries) is a
 * partial classification and must not be scored — the SQL refuses too.
 */
export function scoreOrderingPrediction(
  predicted: readonly string[],
  actual: readonly string[],
  rules: ScoringRules = DEFAULT_SCORING,
): number | null {
  if (actual.length < ORDERING_SLOTS) return null;
  return pointsForHits(orderingHits(predicted, actual), rules);
}
