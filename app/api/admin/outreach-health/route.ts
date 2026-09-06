/**
 * GET /api/admin/outreach-health — one honest sentence about the cold-outreach
 * engine, and the numbers behind it.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/admin/outreach-health"
 *
 * This exists because on 6 Sep 2026 the daily brief said "No emails sent, no
 * replies received" and every part of that sentence was misleading at once:
 *
 *   • 23 emails HAD gone out in the previous 7 days — the CRM mirror was frozen
 *     because the poller had been 401'ing for eleven days;
 *   • the day it was reporting on was a Sunday, which is not a sending day, so
 *     zero sends was correct behaviour and not a fault;
 *   • the campaign genuinely HAD run out of leads on 4 Sep — a real failure,
 *     which the two false alarms buried.
 *
 * So the route never returns a single verdict. It returns every state that is
 * currently true, drawn from four independent questions:
 *
 *   SENDING HEALTHY     sends are happening when the schedule says they should
 *   MONITORING DEGRADED we cannot see Instantly, or our mirror disagrees with it
 *   CAMPAIGN STARVED    Instantly has nothing left to send
 *   HIGH BOUNCE RISK    the bounce rate threatens the sending domain
 *
 * The cardinal rule, encoded in `expected_to_send`: silence outside the sending
 * window is never a failure. A Sunday with no sends is SENDING HEALTHY.
 *
 * STRICTLY READ-ONLY. Sends nothing, writes nothing.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/venueDb";
import { campaignState, campaignQueue, dailySends, senderHealth } from "@/lib/instantly";
import { schedulePhase, type HealthState } from "@/lib/outreachSchedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Bounce rate above which a sending domain is being actively damaged. */
const BOUNCE_THRESHOLD_PCT = Number(process.env.OUTREACH_BOUNCE_THRESHOLD_PCT ?? 5);
/** Below this many sending days of queued leads, the campaign is starving. */
const MIN_DAYS_INVENTORY = Number(process.env.OUTREACH_MIN_DAYS_INVENTORY ?? 2);

export async function GET(req: NextRequest) {
  // Same accept-either set as /api/admin/venue-state: any read-only
  // observability secret unlocks it, and `A || B` is deliberately not used —
  // that collapse is what silently 401'd the poller for eleven days.
  const accepted = [process.env.VENUE_STATE_SECRET, process.env.MARKETING_API_SECRET, process.env.CRON_SECRET]
    .filter((s): s is string => !!s)
    .map((s) => `Bearer ${s}`);
  if (!accepted.length || !accepted.includes(req.headers.get("authorization") ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = admin();
  const now = new Date();
  const states = new Set<HealthState>();
  const notes: string[] = [];

  // ── Instantly, if it can be read at all ────────────────────────────────
  let campaign: any = null, queue: any = null, daily: Array<{ date: string; sent: number }> = [];
  let sender: any = null, instantlyError: string | null = null;
  try {
    [campaign, queue, daily, sender] = await Promise.all([
      campaignState(), campaignQueue(), dailySends(), senderHealth(),
    ]);
  } catch (e: any) {
    instantlyError = String(e?.message ?? e).slice(0, 200);
    states.add("MONITORING DEGRADED");
    notes.push(`Instantly is not readable from this environment: ${instantlyError}`);
  }

  // ── the schedule decides what silence means ────────────────────────────
  const phase = schedulePhase(campaign?.schedule ?? null, now);
  // Sends are only EXPECTED once today's window has actually opened. Before it
  // opens, and on any non-sending day, zero is the correct number.
  const expectedToSend = phase.is_sending_day && (phase.phase === "during" || phase.phase === "after");

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: campaign?.schedule?.timezone ?? "UTC",
  }).format(now);
  const sentToday = daily.find((d) => d.date === today)?.sent ?? 0;
  const cutoff = new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const sent7d = daily.filter((d) => d.date > cutoff).reduce((a, d) => a + d.sent, 0);
  const lastSendDay = [...daily].reverse().find((d) => d.sent > 0)?.date ?? null;

  // ── does our mirror agree with Instantly? ──────────────────────────────
  const { count: mirrored } = await db
    .from("outreach_messages")
    .select("*", { count: "exact", head: true })
    .not("sent_at", "is", null);
  const instantlyTotal = daily.reduce((a, d) => a + d.sent, 0);
  const mirrorGap = instantlyError ? null : instantlyTotal - (mirrored ?? 0);
  if (mirrorGap !== null && mirrorGap > 0) {
    states.add("MONITORING DEGRADED");
    notes.push(
      `The CRM has recorded ${mirrored} sends; Instantly has sent ${instantlyTotal}. ` +
      `${mirrorGap} are missing, so every funnel figure derived from the CRM understates reality. ` +
      `Check /api/cron/instantly-poll is running and returning 200.`,
    );
  }

  // ── supply ─────────────────────────────────────────────────────────────
  const { count: buffer } = await db
    .from("venues")
    .select("*", { count: "exact", head: true })
    .eq("status", "verified").eq("contact_email_status", "valid")
    .is("outreach_pushed_at", null)
    .gte("fit_score", Number(process.env.OUTREACH_MIN_FIT_SCORE ?? 60))
    // Same gates the push applies, or "days of inventory" counts leads that can
    // never be sent: a mock score is not a qualification, and DE/AT are blocked
    // in code under UWG §7.
    .eq("enrichment->>mock", "false")
    .not("country", "in", "(DE,AT)");
  const perDay = Number(campaign?.daily_limit) || 12;
  const queued = queue?.queued ?? null;
  const daysInventory = queued === null ? null : +((queued + (buffer ?? 0)) / perDay).toFixed(1);
  if (daysInventory !== null && daysInventory < MIN_DAYS_INVENTORY) {
    states.add("CAMPAIGN STARVED");
    notes.push(
      `${queued} lead(s) queued in Instantly and ${buffer} in the local buffer — ` +
      `${daysInventory} day(s) at ${perDay}/day. Discovery and the push job need to run.`,
    );
  }

  // ── bounce risk ────────────────────────────────────────────────────────
  const contacted = queue?.contacted ?? null;
  const bounced = queue?.bounced ?? null;
  const bounceRate =
    contacted && contacted > 0 && bounced !== null ? +((bounced / contacted) * 100).toFixed(1) : null;
  if (bounceRate !== null && bounceRate >= BOUNCE_THRESHOLD_PCT) {
    states.add("HIGH BOUNCE RISK");
    notes.push(
      `${bounced} of ${contacted} contacted addresses bounced (${bounceRate}%), against a ` +
      `${BOUNCE_THRESHOLD_PCT}% ceiling. Every address must clear verification before it is pushed.`,
    );
  }

  // ── sending ────────────────────────────────────────────────────────────
  if (!instantlyError) {
    if (campaign?.status !== "active") {
      states.add("CAMPAIGN STARVED");
      notes.push(`The campaign is ${campaign?.status}, not active — nothing will send until it is resumed.`);
    } else if (!expectedToSend) {
      // The rule this whole route exists for.
      states.add("SENDING HEALTHY");
      notes.push(
        phase.phase === "not_a_sending_day"
          ? `Not a sending day (${campaign?.window}). Zero sends today is correct, not a fault.`
          : `Today's window has not opened yet (${campaign?.window}, now ${phase.local_time}). Zero sends so far is expected.`,
      );
    } else if (sentToday > 0) {
      states.add("SENDING HEALTHY");
      notes.push(`${sentToday} email(s) sent today inside the ${campaign?.window} window.`);
    } else if (queued === 0) {
      states.add("CAMPAIGN STARVED");
      notes.push(`The window is open and nothing has sent — there are no uncontacted leads left.`);
    } else {
      notes.push(
        `The window is open, ${queued} lead(s) are queued and nothing has sent. ` +
        `Check the sending mailbox: ${sender?.email} active=${sender?.active} warmup=${sender?.warmup_score}.`,
      );
    }
  }

  // Never claim health while something is actually wrong.
  if (states.size > 1) states.delete("SENDING HEALTHY");
  if (states.size === 0) states.add("SENDING HEALTHY");

  const ORDER: HealthState[] = ["CAMPAIGN STARVED", "HIGH BOUNCE RISK", "MONITORING DEGRADED", "SENDING HEALTHY"];
  const list = ORDER.filter((s) => states.has(s));

  return NextResponse.json({
    headline: list[0],
    states: list,
    checked_at: now.toISOString(),
    sending: {
      campaign_status: campaign?.status ?? "unknown",
      window: campaign?.window ?? null,
      daily_limit: campaign?.daily_limit ?? null,
      is_sending_day: phase.is_sending_day,
      phase: phase.phase,
      local_time: phase.local_time,
      expected_to_send: expectedToSend,
      sent_today: sentToday,
      sent_last_7_days: sent7d,
      last_day_with_sends: lastSendDay,
    },
    monitoring: {
      instantly_readable: !instantlyError,
      instantly_error: instantlyError,
      instantly_total_sent: instantlyError ? null : instantlyTotal,
      crm_recorded_sent: mirrored ?? null,
      mirror_gap: mirrorGap,
    },
    supply: {
      queued_in_instantly: queued,
      local_buffer: buffer ?? null,
      per_day: perDay,
      days_of_inventory: daysInventory,
      min_days_inventory: MIN_DAYS_INVENTORY,
    },
    bounce: {
      contacted, bounced, rate_pct: bounceRate, threshold_pct: BOUNCE_THRESHOLD_PCT,
    },
    sender: sender ?? null,
    notes,
  });
}
