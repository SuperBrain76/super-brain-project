/**
 * lib/outreachCapacity.ts — how many emails a tranche actually needs.
 *
 * Instantly's campaign `daily_limit` counts EMAILS, and every sequence step
 * consumes one. On 2026-08-25 a limit of 5 was set intending "5 venues"; it was
 * spent by 2 venues x 2 steps + 1, so two approved venues were never contacted
 * at all.
 *
 * The input here is therefore a number of VENUES. Follow-ups genuinely due that
 * day are counted separately and always protected: a venue already mid-sequence
 * has been promised a second email, and dropping it to make room for a new
 * prospect is the one thing this must never do. When demand exceeds the safety
 * ceiling, NEW venues are reduced instead.
 */

/**
 * Emails/day this sender may send.
 *
 * Was a flat 10, set on 25 Aug when alex@superbrain.bar was days old. The
 * mailbox now reports warmup_score 100 and a 30/day limit, and the campaign
 * itself is capped at 12 — so a ceiling of 10 no longer protects anything, it
 * just silently withholds two sends a day below a cap that is already in force
 * one layer down. Instantly's own daily_limit is the governing number; this is
 * a second, lower guard for the days when it is not.
 *
 * Keep this at or below the campaign's daily_limit. Raising the campaign cap is
 * a deliberate decision about sender reputation, never a side effect of a push.
 */
export const SAFETY_CEILING = Number(process.env.OUTREACH_SAFETY_CEILING ?? 12);

export interface FollowUpCandidate {
  venue_id: string;
  /** When step 1 actually went out. */
  first_sent_at: string | null;
  /** Steps already sent for this venue. */
  steps_sent: number;
  /** Anything that ends the sequence: a reply, bounce, unsubscribe, suppression. */
  sequence_stopped: boolean;
}

export interface CapacityPlan {
  requested_new_venues: number;
  pending_first_sends: number;
  follow_ups_due: number;
  required: number;
  daily_limit: number;
  new_venues_released: number;
  ceiling: number;
  account_limit: number;
  reduced: boolean;
  reason: string;
}

/**
 * Follow-ups genuinely due today: step 1 sent at least `gapDays` ago, step 2 not
 * yet sent, and nothing has stopped the sequence.
 *
 * A replied, bounced, unsubscribed or suppressed venue is NOT counted — those
 * emails will never be sent, so reserving capacity for them would silently
 * shrink the tranche for no reason.
 */
export function followUpsDue(
  candidates: readonly FollowUpCandidate[],
  now: Date,
  gapDays: number,
): number {
  if (!Number.isFinite(gapDays) || gapDays < 0) {
    throw new Error("followUpsDue: gapDays must be a non-negative number");
  }
  let due = 0;
  for (const c of candidates) {
    if (c.sequence_stopped) continue;
    if (c.steps_sent < 1) continue;          // never started
    if (c.steps_sent >= 2) continue;         // follow-up already sent
    if (!c.first_sent_at) continue;          // cannot tell — see planCapacity's fail-closed
    const elapsed = (now.getTime() - new Date(c.first_sent_at).getTime()) / 86_400_000;
    if (!Number.isFinite(elapsed)) continue;
    if (elapsed >= gapDays) due++;
  }
  return due;
}

/**
 * Venues already pushed into the campaign whose FIRST email has still not gone
 * out — because a previous day ran out of capacity, or the campaign was paused.
 *
 * These consume a slot the moment sending resumes, but they are neither "new"
 * (already pushed) nor a "follow-up" (no step 1 yet). Chequers Walthamstow and
 * Duke of Edinburgh Brixton sat in exactly this state after 2026-08-25, and
 * leaving them uncounted would under-provision the next day by two emails.
 */
export function pendingFirstSends(candidates: readonly FollowUpCandidate[]): number {
  return candidates.filter(c => !c.sequence_stopped && c.steps_sent < 1).length;
}

/**
 * Turn "release N venues" into an Instantly daily_limit.
 *
 * Fails closed: an unknown follow-up count, a bad ceiling or a bad account
 * limit throws rather than guessing, because guessing low silently drops a
 * promised follow-up and guessing high burns a young sending domain.
 */
export function planCapacity(input: {
  newVenues: number;
  followUpsDue: number | null | undefined;
  /** Already-queued venues still awaiting their first email. */
  pendingFirstSends?: number;
  ceiling?: number;
  accountLimit: number | null | undefined;
}): CapacityPlan {
  const { newVenues } = input;
  const ceiling = input.ceiling ?? SAFETY_CEILING;

  if (!Number.isInteger(newVenues) || newVenues < 0) {
    throw new Error(`planCapacity: newVenues must be a non-negative integer, got ${newVenues}`);
  }
  if (input.followUpsDue === null || input.followUpsDue === undefined || !Number.isInteger(input.followUpsDue) || input.followUpsDue < 0) {
    throw new Error("planCapacity: follow-ups due could not be determined — refusing to plan a send");
  }
  if (!Number.isInteger(ceiling) || ceiling <= 0) {
    throw new Error(`planCapacity: ceiling must be a positive integer, got ${ceiling}`);
  }
  if (input.accountLimit === null || input.accountLimit === undefined || !Number.isInteger(input.accountLimit) || input.accountLimit <= 0) {
    throw new Error("planCapacity: mailbox daily limit unknown — refusing to plan a send");
  }

  const pending = input.pendingFirstSends ?? 0;
  if (!Number.isInteger(pending) || pending < 0) {
    throw new Error("planCapacity: pending first sends could not be determined — refusing to plan a send");
  }
  // Already promised, exactly like a follow-up: committed before any new venue.
  const followUps = input.followUpsDue + pending;
  const accountLimit = input.accountLimit;
  // Never above the safety ceiling, and never above what the mailbox allows.
  const hardMax = Math.min(ceiling, accountLimit);
  const required = newVenues + followUps;   // followUps already includes pending

  if (followUps >= hardMax) {
    // Follow-ups alone fill the day. They are already promised, so they win and
    // no new venue goes out — but capacity is still raised to cover them.
    return {
      requested_new_venues: newVenues, pending_first_sends: pending, follow_ups_due: input.followUpsDue,
      required, daily_limit: Math.min(followUps, accountLimit),
      new_venues_released: 0, ceiling, account_limit: accountLimit, reduced: newVenues > 0,
      reason: `${followUps} follow-up(s) due meet or exceed the ceiling of ${hardMax}; ` +
              `follow-ups are protected, so no new venue is released today`,
    };
  }

  if (required <= hardMax) {
    return {
      requested_new_venues: newVenues, pending_first_sends: pending, follow_ups_due: input.followUpsDue,
      required, daily_limit: required,
      new_venues_released: newVenues, ceiling, account_limit: accountLimit, reduced: false,
      reason: `${newVenues} new venue(s) + ${pending} already-queued first send(s) + ${input.followUpsDue} follow-up(s) = ${required} emails, within the ceiling of ${hardMax}`,
    };
  }

  // Over the ceiling: cut NEW venues, never the follow-ups.
  const released = hardMax - followUps;
  return {
    requested_new_venues: newVenues, pending_first_sends: pending, follow_ups_due: input.followUpsDue,
    required, daily_limit: hardMax,
    new_venues_released: released, ceiling, account_limit: accountLimit, reduced: true,
    reason: `${required} emails required but the ceiling is ${hardMax}; ` +
            `follow-ups are protected, so new venues drop from ${newVenues} to ${released}`,
  };
}
