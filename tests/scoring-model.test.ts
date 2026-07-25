/**
 * The TypeScript scoring mirror MUST match the SQL 5/3/2/0 model exactly.
 * These are the same cases the World Cup was scored on; the prototype and any
 * TS-side scoring depend on this equivalence.
 */

import { describe, it, expect } from "vitest";
import { scorePrediction, pointsBucket, DEFAULT_SCORING } from "@/lib/scoringModel";

describe("scorePrediction — the 5/3/2/0 matrix", () => {
  it("awards 5 for an exact score", () => {
    expect(scorePrediction(2, 1, 2, 1)).toBe(5);
    expect(scorePrediction(0, 0, 0, 0)).toBe(5);
  });

  it("awards 3 for the correct goal difference (not exact)", () => {
    // Predicted 2-0 (+2), actual 3-1 (+2): same GD, different score.
    expect(scorePrediction(2, 0, 3, 1)).toBe(3);
    // Away GD too: predicted 0-2, actual 1-3.
    expect(scorePrediction(0, 2, 1, 3)).toBe(3);
  });

  it("awards 2 for the correct result only (win with a different GD)", () => {
    // Predicted 1-0 (home win, +1), actual 3-1 (home win, +2): right winner,
    // different goal difference → 2.
    expect(scorePrediction(1, 0, 3, 1)).toBe(2);
    // Away win with a different GD: predicted 0-1 (−1), actual 1-3 (−2).
    expect(scorePrediction(0, 1, 1, 3)).toBe(2);
  });

  it("🔴 a correct-but-not-exact draw always scores 3, never 2", () => {
    // Every draw has GD 0, so a predicted draw against any actual draw matches
    // on goal difference and is checked BEFORE the result rule → 3.
    expect(scorePrediction(1, 1, 2, 2)).toBe(3);
    expect(scorePrediction(0, 0, 3, 3)).toBe(3);
  });

  it("awards 0 for a wrong prediction", () => {
    expect(scorePrediction(2, 0, 0, 2)).toBe(0);   // predicted home win, got away win
    expect(scorePrediction(1, 1, 2, 0)).toBe(0);   // predicted draw, got home win
  });

  it("🔴 evaluates exact before GD before result — order is load-bearing", () => {
    // A 0-0 draw predicted as 0-0 is EXACT (5), never merely 'result'.
    expect(scorePrediction(0, 0, 0, 0)).toBe(5);
    // Same GD, non-exact win → 3 (GD wins over result).
    // Predicted 3-1 (+2 home), actual 2-0 (+2 home): GD matches → 3, not 2.
    expect(scorePrediction(3, 1, 2, 0)).toBe(3);
  });

  it("honours competition-specific rules", () => {
    const resultOnly = { exact: 3, gd: 3, result: 3, wrong: 0 };
    // Under result-only scoring (the pure-1X2 fallback), any correct outcome
    // is 3 and only wrong is 0.
    expect(scorePrediction(1, 0, 4, 2, resultOnly)).toBe(3);
    expect(scorePrediction(1, 0, 0, 2, resultOnly)).toBe(0);
  });
});

describe("pointsBucket", () => {
  it("maps points to a bucket for colouring", () => {
    expect(pointsBucket(5)).toBe("exact");
    expect(pointsBucket(3)).toBe("gd");
    expect(pointsBucket(2)).toBe("result");
    expect(pointsBucket(0)).toBe("wrong");
    expect(pointsBucket(null)).toBe("pending");
  });

  it("uses the same defaults as the engine", () => {
    expect(DEFAULT_SCORING).toEqual({ exact: 5, gd: 3, result: 2, wrong: 0 });
  });
});
