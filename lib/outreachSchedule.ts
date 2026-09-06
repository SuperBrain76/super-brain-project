/**
 * Sending-calendar arithmetic for the outreach health check.
 *
 * Lives here rather than in the route because a Next route file may only export
 * handlers and route config — and because this is the one piece of logic that
 * decides whether "nothing sent" is a fault or the schedule working, which is
 * worth being able to test on its own.
 */

/** The four states the outreach engine can be in. They are not exclusive. */
export type HealthState =
  | "SENDING HEALTHY"
  | "MONITORING DEGRADED"
  | "CAMPAIGN STARVED"
  | "HIGH BOUNCE RISK";

export interface CampaignSchedule {
  timezone: string;
  from: string | null;
  to: string | null;
  /** JS day numbers the campaign sends on: 0 = Sunday. */
  day_numbers: number[];
}

/**
 * Where the clock is relative to the campaign's own schedule.
 *
 * Instantly stores days as a map keyed by JS day number (0 = Sunday) and the
 * window in the campaign's timezone, so both have to be evaluated there — not
 * in UTC and not in the reader's locale, or a 13:00 Helsinki cutoff reads as
 * still-open from Dubai and the brief reports a fault two hours early.
 */
export function schedulePhase(
  schedule: CampaignSchedule | null,
  now: Date,
): { is_sending_day: boolean; phase: "before" | "during" | "after" | "not_a_sending_day" | "unknown"; local_time: string | null } {
  if (!schedule || !schedule.from || !schedule.to) {
    return { is_sending_day: false, phase: "unknown", local_time: null };
  }
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: schedule.timezone, hour12: false,
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const DAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayNum = DAY[String(parts.weekday)];
  const local = `${parts.hour}:${parts.minute}`;
  if (!schedule.day_numbers.includes(dayNum)) {
    return { is_sending_day: false, phase: "not_a_sending_day", local_time: local };
  }
  const phase = local < schedule.from ? "before" : local >= schedule.to ? "after" : "during";
  return { is_sending_day: true, phase, local_time: local };
}

