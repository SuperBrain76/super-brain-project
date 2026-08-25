/**
 * Regression: campaign capacity is planned in VENUES, not email slots.
 *
 * On 2026-08-25 a daily_limit of 5 was set meaning "5 venues". Instantly counts
 * emails and every step consumes one, so it was spent by 2 venues x 2 steps + 1
 * and two approved venues were never contacted.
 */
import { describe, it, expect } from "vitest";
import { planCapacity, followUpsDue, SAFETY_CEILING, type FollowUpCandidate } from "@/lib/outreachCapacity";

const NOW = new Date("2026-08-29T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const candidate = (over: Partial<FollowUpCandidate> = {}): FollowUpCandidate => ({
  venue_id: Math.random().toString(36).slice(2),
  first_sent_at: daysAgo(4),
  steps_sent: 1,
  sequence_stopped: false,
  ...over,
});

describe("follow-ups genuinely due", () => {
  it("counts a venue whose gap has elapsed and has had only step 1", () => {
    expect(followUpsDue([candidate()], NOW, 4)).toBe(1);
  });

  it("does not count one whose gap has not elapsed", () => {
    expect(followUpsDue([candidate({ first_sent_at: daysAgo(3) })], NOW, 4)).toBe(0);
  });

  it("does not count one that already had its follow-up", () => {
    expect(followUpsDue([candidate({ steps_sent: 2 })], NOW, 4)).toBe(0);
  });

  it("does not reserve capacity for a stopped sequence", () => {
    // A replied / bounced / unsubscribed / suppressed venue will never receive
    // step 2, so holding a slot for it would shrink the tranche for nothing.
    expect(followUpsDue([candidate({ sequence_stopped: true })], NOW, 4)).toBe(0);
  });

  it("does not count a venue that was never sent to", () => {
    expect(followUpsDue([candidate({ steps_sent: 0, first_sent_at: null })], NOW, 4)).toBe(0);
  });

  it("reproduces the real 2026-08-25 batch four days on", () => {
    const batch: FollowUpCandidate[] = [
      candidate({ venue_id: "frankies", steps_sent: 2 }),                    // both steps already sent
      candidate({ venue_id: "bloodsports", steps_sent: 2 }),                 // both steps already sent
      candidate({ venue_id: "brigadiers", steps_sent: 1, sequence_stopped: true }), // replied
    ];
    expect(followUpsDue(batch, NOW, 4)).toBe(0);
  });
});

describe("capacity planning", () => {
  const base = { accountLimit: 30, ceiling: SAFETY_CEILING };

  it("5 venues with no follow-ups needs 5 emails", () => {
    const p = planCapacity({ newVenues: 5, followUpsDue: 0, ...base });
    expect(p.daily_limit).toBe(5);
    expect(p.new_venues_released).toBe(5);
    expect(p.reduced).toBe(false);
  });

  it("5 venues with 3 follow-ups due raises the limit to 8, not to 5", () => {
    const p = planCapacity({ newVenues: 5, followUpsDue: 3, ...base });
    expect(p.daily_limit).toBe(8);
    expect(p.new_venues_released).toBe(5);   // new venues NOT reduced
    expect(p.reduced).toBe(false);
  });

  it("never exceeds the safety ceiling", () => {
    const p = planCapacity({ newVenues: 8, followUpsDue: 6, ...base });
    expect(p.daily_limit).toBeLessThanOrEqual(SAFETY_CEILING);
  });

  it("over the ceiling, follow-ups are protected and NEW venues are cut", () => {
    const p = planCapacity({ newVenues: 8, followUpsDue: 6, ...base });
    expect(p.follow_ups_due).toBe(6);        // all six still funded
    expect(p.new_venues_released).toBe(4);   // 10 - 6
    expect(p.daily_limit).toBe(10);
    expect(p.reduced).toBe(true);
  });

  it("releases no new venue when follow-ups alone fill the day", () => {
    const p = planCapacity({ newVenues: 5, followUpsDue: 10, ...base });
    expect(p.new_venues_released).toBe(0);
    expect(p.daily_limit).toBe(10);          // follow-ups still all sent
    expect(p.reduced).toBe(true);
  });

  it("still funds follow-ups that exceed the ceiling, up to the mailbox limit", () => {
    const p = planCapacity({ newVenues: 3, followUpsDue: 12, ...base });
    expect(p.new_venues_released).toBe(0);
    expect(p.daily_limit).toBe(12);          // a promised follow-up is never dropped
    expect(p.daily_limit).toBeLessThanOrEqual(30);
  });

  it("never exceeds the mailbox limit even when the ceiling would allow it", () => {
    const p = planCapacity({ newVenues: 5, followUpsDue: 0, ceiling: 10, accountLimit: 3 });
    expect(p.daily_limit).toBeLessThanOrEqual(3);
    expect(p.new_venues_released).toBe(3);
  });
});

describe("fails closed rather than guessing", () => {
  const base = { newVenues: 5, accountLimit: 30 };
  it("throws when follow-ups due are unknown", () => {
    expect(() => planCapacity({ ...base, followUpsDue: null })).toThrow(/could not be determined/i);
    expect(() => planCapacity({ ...base, followUpsDue: undefined })).toThrow(/could not be determined/i);
    expect(() => planCapacity({ ...base, followUpsDue: NaN })).toThrow(/could not be determined/i);
  });
  it("throws when the mailbox limit is unknown", () => {
    expect(() => planCapacity({ newVenues: 5, followUpsDue: 0, accountLimit: null })).toThrow(/mailbox daily limit unknown/i);
  });
  it("throws on a nonsensical venue count or ceiling", () => {
    expect(() => planCapacity({ newVenues: -1, followUpsDue: 0, accountLimit: 30 })).toThrow();
    expect(() => planCapacity({ newVenues: 2.5, followUpsDue: 0, accountLimit: 30 })).toThrow();
    expect(() => planCapacity({ newVenues: 5, followUpsDue: 0, accountLimit: 30, ceiling: 0 })).toThrow();
  });
  it("throws on a negative gap", () => {
    expect(() => followUpsDue([], NOW, -1)).toThrow();
  });
});

describe("overlapping tranches over a week", () => {
  it("keeps 5 new venues flowing while follow-ups land", () => {
    // Day 0: five new, nothing due.
    const d0 = planCapacity({ newVenues: 5, followUpsDue: 0, accountLimit: 30 });
    expect(d0.daily_limit).toBe(5);
    expect(d0.new_venues_released).toBe(5);

    // Day 4: day 0's five now need their follow-up, and we want five more.
    // 10 emails - exactly the ceiling, nothing is cut.
    const d4 = planCapacity({ newVenues: 5, followUpsDue: 5, accountLimit: 30 });
    expect(d4.daily_limit).toBe(10);
    expect(d4.new_venues_released).toBe(5);
    expect(d4.reduced).toBe(false);

    // Day 8: day 4's five need follow-ups, but two of them replied and stopped.
    const d8 = planCapacity({ newVenues: 5, followUpsDue: 3, accountLimit: 30 });
    expect(d8.daily_limit).toBe(8);
    expect(d8.new_venues_released).toBe(5);
  });

  it("cuts new venues, never follow-ups, when a day is oversubscribed", () => {
    const p = planCapacity({ newVenues: 5, followUpsDue: 7, accountLimit: 30 });
    expect(p.follow_ups_due).toBe(7);
    expect(p.new_venues_released).toBe(3);
    expect(p.new_venues_released + p.follow_ups_due).toBe(SAFETY_CEILING);
  });
});
