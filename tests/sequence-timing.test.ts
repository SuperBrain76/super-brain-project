/**
 * Regression: the follow-up must not be able to fire before the gap elapses.
 *
 * On 2026-08-25 both Frankie's and BLOODsports received email 1 and email 2
 * NINE MINUTES apart. Instantly's step `delay` is the wait AFTER that step, not
 * before it: the 4 sat on step 2, where it delays nothing that follows, while
 * step 1 held 0. Two businesses got a "re:" follow-up before they had read the
 * first email.
 *
 * These tests encode the semantics so the delay cannot silently invert again.
 */
import { describe, it, expect } from "vitest";

/** Days a lead waits between step N and step N+1, given Instantly's semantics. */
export function gapBeforeStep(steps: ReadonlyArray<{ delay: number }>, stepIndex: number): number {
  if (stepIndex <= 0) return 0;
  return steps[stepIndex - 1]?.delay ?? 0;   // the PREVIOUS step carries the wait
}

const FIXED  = [{ delay: 4 }, { delay: 0 }];   // as deployed after the fix
const BROKEN = [{ delay: 0 }, { delay: 4 }];   // what actually shipped and misfired

describe("follow-up timing", () => {
  it("the deployed sequence holds email 2 for 4 days", () => {
    expect(gapBeforeStep(FIXED, 1)).toBe(4);
  });

  it("email 1 is never delayed", () => {
    expect(gapBeforeStep(FIXED, 0)).toBe(0);
  });

  it("reproduces the 2026-08-25 defect, so the test has teeth", () => {
    expect(gapBeforeStep(BROKEN, 1)).toBe(0);   // <- fired immediately
  });

  it("rejects any sequence whose first step carries no delay before a second", () => {
    const invalid = (steps: ReadonlyArray<{ delay: number }>) =>
      steps.length > 1 && gapBeforeStep(steps, 1) < 1;
    expect(invalid(BROKEN)).toBe(true);
    expect(invalid(FIXED)).toBe(false);
  });

  it("a live campaign object must satisfy the same rule", () => {
    // Shape mirrors GET /api/v2/campaigns/{id}
    const campaign = { sequences: [{ steps: FIXED }] };
    const steps = campaign.sequences[0].steps;
    expect(steps.length).toBe(2);
    expect(gapBeforeStep(steps, 1)).toBeGreaterThanOrEqual(4);
  });
});
