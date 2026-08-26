/**
 * The TypeScript ordering mirror MUST match migration 073's
 * apply_ordering_scoring exactly: exact-position hits across five slots,
 * mapped onto the scoring_rules values (5 hits→exact, 3–4→gd, 1–2→result,
 * 0→wrong). F1 predictions and the UI's points display depend on this
 * equivalence.
 */

import { describe, it, expect } from "vitest";
import {
  orderingHits,
  pointsForHits,
  scoreOrderingPrediction,
  ORDERING_SLOTS,
} from "@/lib/orderingModel";

// Five distinct entrant ids, readable in failures.
const [A, B, C, D, E, F, G] = ["ver", "nor", "ham", "lec", "rus", "ant", "pia"];
const ACTUAL = [A, B, C, D, E];

describe("orderingHits", () => {
  it("counts exact-position matches only", () => {
    expect(orderingHits([A, B, C, D, E], ACTUAL)).toBe(5);
    // Right drivers, positions 1↔2 swapped → those two slots miss.
    expect(orderingHits([B, A, C, D, E], ACTUAL)).toBe(3);
    // All five present but fully rotated → zero hits.
    expect(orderingHits([B, C, D, E, A], ACTUAL)).toBe(0);
  });

  it("a driver in the top 5 but the wrong slot is NOT a hit", () => {
    expect(orderingHits([E, D, C, B, A], ACTUAL)).toBe(1); // only P3 holds
  });

  it("ignores anything beyond the five slots", () => {
    expect(ORDERING_SLOTS).toBe(5);
    expect(orderingHits([A, B, C, D, E, F, G] as string[], ACTUAL)).toBe(5);
  });

  it("handles short predictions without throwing", () => {
    expect(orderingHits([A, B], ACTUAL)).toBe(2);
    expect(orderingHits([], ACTUAL)).toBe(0);
  });
});

describe("pointsForHits — the ladder", () => {
  it("maps hits onto the 5/3/2/0 values", () => {
    expect(pointsForHits(5)).toBe(5);
    expect(pointsForHits(4)).toBe(3);
    expect(pointsForHits(3)).toBe(3);
    expect(pointsForHits(2)).toBe(2);
    expect(pointsForHits(1)).toBe(2);
    expect(pointsForHits(0)).toBe(0);
  });

  it("respects per-competition rule overrides", () => {
    const rules = { exact: 10, gd: 6, result: 4, wrong: 1 };
    expect(pointsForHits(5, rules)).toBe(10);
    expect(pointsForHits(3, rules)).toBe(6);
    expect(pointsForHits(1, rules)).toBe(4);
    expect(pointsForHits(0, rules)).toBe(1);
  });
});

describe("scoreOrderingPrediction", () => {
  it("scores a full board", () => {
    expect(scoreOrderingPrediction([A, B, C, D, E], ACTUAL)).toBe(5);
    expect(scoreOrderingPrediction([A, B, C, E, D], ACTUAL)).toBe(3); // 3 hits
    expect(scoreOrderingPrediction([A, F, G, E, D], ACTUAL)).toBe(2); // 1 hit (P1)
    expect(scoreOrderingPrediction([F, G, E, A, B], ACTUAL)).toBe(0); // 0 hits
  });

  it("🔴 refuses a partial classification — mirrors the SQL guard", () => {
    // apply_ordering_scoring returns 0 rows scored when fewer than five
    // positions exist; the mirror signals the same with null, never a score.
    expect(scoreOrderingPrediction([A, B, C, D, E], [A, B, C])).toBeNull();
    expect(scoreOrderingPrediction([A, B, C, D, E], [])).toBeNull();
  });

  it("4 hits is impossible with distinct entrants, but the ladder still holds", () => {
    // With five DISTINCT picks vs five distinct actuals, exactly-4 hits cannot
    // occur (the fifth would be forced). The DB enforces distinctness; the
    // ladder is defined for 4 anyway so a rule change can't strand it.
    expect(pointsForHits(4)).toBe(pointsForHits(3));
  });
});
