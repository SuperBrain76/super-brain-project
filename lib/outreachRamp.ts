/**
 * How many emails may go out today.
 *
 * Dylan, 21 Oct 2026: "start with the 12, but ramp it up day by day and we
 * see". This is that, with the trigger changed from the calendar to the bounce
 * rate — because a calendar ramp is what produced the 28 September suspension.
 * Volume climbed while the list quality was never checked, the rate reached
 * 12.1%, and Instantly stopped the campaign for 23 days.
 *
 * So the ramp advances on EVIDENCE: one step for every sending day that stayed
 * clean, and straight back to the floor the moment it does not. It needs no
 * stored state — both inputs are derived from Instantly on each run, so there
 * is no counter to drift, reset or disagree with reality.
 *
 * WHAT THIS CANNOT DO. The mailbox's own cap is the physical ceiling, and
 * alex@superbrain.bar is set to 30/day. One mailbox is roughly 30-50 cold
 * emails a day before deliverability suffers whatever the warmup score says —
 * warmup proves the mailbox is not in a spam folder for its warmup peers, it
 * says nothing about the list or the copy. Going meaningfully past 30 is a
 * different job: more mailboxes on more domains, each warmed separately.
 */

/** Emails/day the campaign starts and falls back to. */
export const RAMP_BASE = Number(process.env.OUTREACH_RAMP_BASE ?? 12);
/** Added per clean sending day. */
export const RAMP_STEP = Number(process.env.OUTREACH_RAMP_STEP ?? 2);
/**
 * Bounce rate at or above which the ramp retreats to the floor. Instantly's own
 * protection triggers somewhere near here, and a burned domain is not
 * recoverable, so this sits below where we think their threshold is.
 */
export const RAMP_HOLD_PCT = Number(process.env.OUTREACH_RAMP_HOLD_PCT ?? 3);

export interface RampInput {
  /** The sending mailbox's own daily cap. The physical ceiling. */
  mailboxLimit: number;
  /** Days since the ramp epoch on which at least one email actually went out. */
  cleanSendingDays: number;
  /** Bounce rate over the trailing window, as a percentage. Null when unknown. */
  trailingBouncePct: number | null;
  base?: number;
  step?: number;
  holdPct?: number;
}

export interface RampDecision {
  ceiling: number;
  ramping: boolean;
  reason: string;
}

/**
 * Fails closed in both directions: an unknown bounce rate does not ramp, and an
 * unusable mailbox limit throws rather than guessing a number that governs how
 * much real mail leaves the building.
 */
export function computeDailyCeiling(input: RampInput): RampDecision {
  const base = input.base ?? RAMP_BASE;
  const step = input.step ?? RAMP_STEP;
  const holdPct = input.holdPct ?? RAMP_HOLD_PCT;
  const { mailboxLimit, cleanSendingDays, trailingBouncePct } = input;

  if (!Number.isInteger(mailboxLimit) || mailboxLimit <= 0) {
    throw new Error(`computeDailyCeiling: unusable mailbox limit ${mailboxLimit}`);
  }
  if (!Number.isInteger(base) || base <= 0) throw new Error(`computeDailyCeiling: bad base ${base}`);
  if (!Number.isFinite(step) || step < 0) throw new Error(`computeDailyCeiling: bad step ${step}`);
  if (!Number.isInteger(cleanSendingDays) || cleanSendingDays < 0) {
    throw new Error(`computeDailyCeiling: bad cleanSendingDays ${cleanSendingDays}`);
  }

  // The floor is itself capped by the mailbox: a mailbox that only allows 5
  // cannot be asked for 12.
  const floor = Math.min(base, mailboxLimit);

  if (trailingBouncePct === null || !Number.isFinite(trailingBouncePct)) {
    return {
      ceiling: floor, ramping: false,
      reason: `bounce rate unknown — holding at ${floor}/day rather than ramping blind`,
    };
  }
  if (trailingBouncePct >= holdPct) {
    return {
      ceiling: floor, ramping: false,
      reason:
        `trailing bounce rate ${trailingBouncePct.toFixed(1)}% is at or above the ${holdPct}% ` +
        `ramp threshold — held at ${floor}/day. It climbs again once recent sends are clean.`,
    };
  }

  const wanted = floor + Math.floor(step * cleanSendingDays);
  const ceiling = Math.min(wanted, mailboxLimit);
  return {
    ceiling,
    ramping: ceiling > floor,
    reason:
      `trailing bounce rate ${trailingBouncePct.toFixed(1)}% is under ${holdPct}% and ` +
      `${cleanSendingDays} clean sending day(s) banked → ${ceiling}/day` +
      (ceiling === mailboxLimit && wanted > mailboxLimit
        ? ` (capped by the mailbox's own ${mailboxLimit}/day — more volume needs more mailboxes)`
        : ""),
  };
}
