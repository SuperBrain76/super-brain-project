import { describe, it, expect } from "vitest";
import { computeDailyCeiling, RAMP_BASE, RAMP_STEP, RAMP_HOLD_PCT } from "@/lib/outreachRamp";

const base = { mailboxLimit: 30, base: 12, step: 2, holdPct: 3 };

describe("computeDailyCeiling", () => {
  it("holds at the floor on day one even with a clean rate", () => {
    const d = computeDailyCeiling({ ...base, cleanSendingDays: 0, trailingBouncePct: 0 });
    expect(d.ceiling).toBe(12);
    expect(d.ramping).toBe(false);
  });

  it("adds a step for each clean sending day", () => {
    for (const [days, want] of [[1, 14], [2, 16], [5, 22], [9, 30]] as const) {
      expect(computeDailyCeiling({ ...base, cleanSendingDays: days, trailingBouncePct: 1 }).ceiling).toBe(want);
    }
  });

  it("NEVER exceeds the mailbox's own cap, however many days are banked", () => {
    // The thing Dylan is really asking for — "a lot of emails" — is bounded by
    // the mailbox, not by this function. One mailbox is one mailbox.
    for (const days of [10, 20, 100, 10_000]) {
      const d = computeDailyCeiling({ ...base, cleanSendingDays: days, trailingBouncePct: 0.5 });
      expect(d.ceiling).toBe(30);
      expect(d.reason).toMatch(/more volume needs more mailboxes/);
    }
  });

  it("retreats to the floor the moment bounces reach the threshold", () => {
    // This is the September suspension, prevented. Volume had climbed while the
    // rate went unchecked.
    for (const pct of [3, 3.1, 6.7, 12.1, 40]) {
      const d = computeDailyCeiling({ ...base, cleanSendingDays: 9, trailingBouncePct: pct });
      expect(d.ceiling).toBe(12);
      expect(d.ramping).toBe(false);
      expect(d.reason).toMatch(/at or above/);
    }
  });

  it("refuses to ramp on an unknown bounce rate", () => {
    for (const v of [null, NaN, Infinity]) {
      const d = computeDailyCeiling({ ...base, cleanSendingDays: 9, trailingBouncePct: v as number });
      expect(d.ceiling).toBe(12);
      expect(d.reason).toMatch(/unknown/);
    }
  });

  it("today's real numbers do not ramp", () => {
    // 21 Oct 2026: 6.7% over the last 30 contacted, all sent before the
    // ownership gate existed. The ramp must refuse, and open by itself later.
    const d = computeDailyCeiling({ ...base, cleanSendingDays: 0, trailingBouncePct: 6.7 });
    expect(d.ceiling).toBe(12);
    expect(d.ramping).toBe(false);
  });

  it("never asks a small mailbox for more than it allows", () => {
    const d = computeDailyCeiling({ ...base, mailboxLimit: 5, cleanSendingDays: 4, trailingBouncePct: 0 });
    expect(d.ceiling).toBeLessThanOrEqual(5);
  });

  it("rejects nonsense rather than guessing a sending volume", () => {
    for (const bad of [0, -1, 1.5, NaN]) {
      expect(() => computeDailyCeiling({ ...base, mailboxLimit: bad as number, cleanSendingDays: 0, trailingBouncePct: 0 })).toThrow();
    }
    expect(() => computeDailyCeiling({ ...base, cleanSendingDays: -1, trailingBouncePct: 0 })).toThrow();
  });

  it("ships with a floor of 12 and a threshold under Instantly's own", () => {
    expect(RAMP_BASE).toBe(12);
    expect(RAMP_STEP).toBeGreaterThan(0);
    expect(RAMP_HOLD_PCT).toBeLessThan(5);
  });
});
