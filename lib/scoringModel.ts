/**
 * lib/scoringModel.ts — Competition Engine
 *
 * A pure TypeScript mirror of the 5/3/2/0 scoring implemented in Postgres
 * (predictor-schema.sql `score_fixture_predictions` and migration 044's
 * `apply_fixture_scoring`).
 *
 * ⚠️ THIS MUST STAY BYTE-EQUIVALENT TO THE SQL. It exists so the playable
 * prototype can score a matchweek without a database, and so scoring is unit
 * testable in TypeScript. It is NOT a second source of truth — the SQL scores
 * production. `tests/scoring-model.test.ts` pins the shared rule matrix.
 *
 * Order of evaluation is load-bearing and identical to the SQL:
 *   exact → goal-difference → result → wrong.
 */

export interface ScoringRules {
  exact:  number;
  gd:     number;
  result: number;
  wrong:  number;
}

/** The historical / default rules — predictor-schema.sql:268-275. */
export const DEFAULT_SCORING: ScoringRules = { exact: 5, gd: 3, result: 2, wrong: 0 };

type Outcome = "home" | "away" | "draw";

function outcome(home: number, away: number): Outcome {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

/**
 * Points for one prediction against an actual result.
 *
 * Mirrors the SQL CASE exactly:
 *   both scores match           → exact
 *   goal difference matches     → gd
 *   winner/draw matches         → result
 *   otherwise                   → wrong
 */
export function scorePrediction(
  predHome: number, predAway: number,
  actualHome: number, actualAway: number,
  rules: ScoringRules = DEFAULT_SCORING,
): number {
  if (predHome === actualHome && predAway === actualAway) return rules.exact;
  if (predHome - predAway === actualHome - actualAway)    return rules.gd;
  if (outcome(predHome, predAway) === outcome(actualHome, actualAway)) return rules.result;
  return rules.wrong;
}

/** Which outcome bucket a points value falls in — for UI colouring. */
export function pointsBucket(pts: number | null, rules: ScoringRules = DEFAULT_SCORING):
  "exact" | "gd" | "result" | "wrong" | "pending" {
  if (pts === null) return "pending";
  if (pts === rules.exact)  return "exact";
  if (pts === rules.gd)     return "gd";
  if (pts === rules.result) return "result";
  return "wrong";
}
