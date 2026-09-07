/**
 * GET /api/admin/config-health — what is configured, and what is silently off.
 *
 * Written after a real incident. `notifyN8n()` returns early when
 * N8N_VENUE_WEBHOOK_URL is unset, so every venue lifecycle notification had
 * been a no-op since the day it was written. Nothing errored, nothing logged,
 * and the trial-ending email had never once been sent. The card-less trial
 * would have turned that into every trial expiring in silence.
 *
 * The pattern is the danger, not the variable: a missing key that throws is
 * found in minutes, a missing key that degrades is found in months. This route
 * makes the degrading ones visible.
 *
 * Severity is about consequence, not tidiness:
 *   critical  something advertised as working does not work, and says nothing
 *   degraded  runs on a fallback that is not fit for production use
 *   optional  wiring for a subsystem that is not built or not switched on; its
 *             absence changes nothing today, and it is listed so the day the
 *             subsystem IS built the wiring is not forgotten
 *   off       a deliberate flag, listed so "off" is always a decision
 *   ok        configured
 *
 * Only `critical` returns 503. That distinction is the whole point: this route
 * spent 30 Aug - 7 Sep 2026 returning 503 for a webhook URL pointing at a
 * workflow nobody had built, so its scheduled check failed on all eight runs it
 * ever made, was never once green, and became noise before anyone read it. A
 * health check that cries wolf on unbuilt work is worse than no health check —
 * it teaches the reader that red is the normal colour.
 *
 * Auth: any read-only observability secret (VENUE_STATE_SECRET,
 * MARKETING_API_SECRET or CRON_SECRET), same as /api/admin/venue-state.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Sev = "critical" | "degraded" | "optional" | "off" | "ok";

interface Check {
  key: string;
  set: boolean;
  severity: Sev;
  breaks: string;
}

const has = (k: string) => Boolean(process.env[k]?.trim());

function build(): Check[] {
  const out: Check[] = [];
  const add = (key: string, whenMissing: Sev, breaks: string) =>
    out.push({ key, set: has(key), severity: has(key) ? "ok" : whenMissing, breaks });

  // ── Silent degraders. These are the dangerous ones. ──────────
  // OPTIONAL, not critical — and the reasoning matters, because this was
  // classified critical for sixteen days on a description that had stopped
  // being true.
  //
  // notifyN8n() does return early without it. What it feeds is SB-VEN-01, the
  // n8n workflow whose own documentation says: "If this workflow is broken or
  // switched off, the customer is unaffected — that is the point." Its five
  // events (provisioned, paid, trial_will_end, payment_failed, churned) each
  // carry an internal action only: WhatsApp to Dylan, a Zoho invoice, a social
  // proof post. Every customer-facing email for those events is sent by Resend
  // from the app — the trial-ending one was deliberately moved off n8n on
  // 22 Aug — and every one is written to venue_events and to PostHog. So the
  // old text, "every venue lifecycle event is a no-op and nothing is logged",
  // was wrong on both halves.
  //
  // SB-VEN-01 has also never been imported: the n8n instance holds 24
  // workflows and not one of them is venue-related. There is no endpoint for
  // this URL to point at. Setting it would be inventing a value to turn a
  // light green, which is the opposite of what this route is for.
  //
  // It becomes critical the day SB-VEN-01 is imported and activated. Until
  // then it is listed, not alarmed on.
  add("N8N_VENUE_WEBHOOK_URL", "optional",
      "notifyN8n() returns early, so SB-VEN-01's internal hand-offs (WhatsApp to Dylan, Zoho invoice, social proof) do not fire. No customer-facing email and no logging depends on it. SB-VEN-01 is not imported into n8n, so there is nothing to point this at yet. Promote to critical when it is.");
  add("N8N_WEBHOOK_SECRET", "optional",
      "The SB-VEN-01 POST goes unauthenticated. Only matters once N8N_VENUE_WEBHOOK_URL is set; set both together or neither.");
  add("ANTHROPIC_API_KEY", "critical",
      "Enrichment falls back to mockScore(). Prospect fit scores are FAKE, and OUTREACH_MIN_FIT_SCORE gates real sends on them.");
  add("SEASON_EMAILS_ENABLED", "off",
      "The daily 08:00 cron returns skipped. Players get no matchday email at all.");
  add("VENUE_REQUIRE_CARD", "off",
      "Unset means the card-less trial is active. This is the intended default.");
  add("STRIPE_TAX_ENABLED", "off", "Stripe automatic tax is not applied.");
  add("VENUE_COMP_SECRET", "off", "Comp/free-forever links are disabled.");
  add("ENRICHMENT_MOCK", "off", "Not forcing mock mode (ANTHROPIC_API_KEY decides).");

  // ── Loud failures. Safe, because you find out immediately. ───
  add("GOOGLE_PLACES_API_KEY", "critical", "Prospecting throws. No new venues can be found.");
  add("INSTANTLY_API_KEY", "critical", "Cold outreach throws. No leads can be pushed.");
  add("INSTANTLY_CAMPAIGN_DEFAULT", "degraded",
      "campaignFor() returns null for any country without its own campaign, so those leads are skipped.");

  // ── Core. Nothing works without these. ───────────────────────
  add("NEXT_PUBLIC_SUPABASE_URL", "critical", "No database.");
  add("SUPABASE_SERVICE_ROLE_KEY", "critical", "No server-side database writes.");
  add("STRIPE_SECRET_KEY", "critical", "No checkout, no billing.");
  add("STRIPE_WEBHOOK_SECRET", "critical", "Stripe events are rejected. Nothing provisions.");
  add("RESEND_API_KEY", "critical", "No transactional email of any kind.");
  add("CRON_SECRET", "critical", "Every cron and admin route returns 401.");
  add("MARKETING_API_SECRET", "degraded",
      "The fixture endpoint 401s, so generated posts fall back to generic copy with no real fixtures.");

  return out;
}

export async function GET(req: NextRequest) {
  // Same accept-either set as venue-state and outreach-health. This route
  // returns variable NAMES and consequences, never values, so it is the same
  // exposure class as the other read-only observability routes — and tying it
  // to CRON_SECRET alone meant the daily brief, which reads with whichever
  // observability secret it has, could not see config state at all. `A || B`
  // is deliberately avoided: that collapse 401'd the poller for eleven days.
  const accepted = [process.env.VENUE_STATE_SECRET, process.env.MARKETING_API_SECRET, process.env.CRON_SECRET]
    .filter((s): s is string => !!s)
    .map((s) => `Bearer ${s}`);
  if (!accepted.length || !accepted.includes(req.headers.get("authorization") ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks = build();
  const critical = checks.filter((c) => c.severity === "critical");
  const degraded = checks.filter((c) => c.severity === "degraded");
  const optional = checks.filter((c) => c.severity === "optional");
  const off = checks.filter((c) => c.severity === "off");

  // One line a human can act on without reading the arrays.
  const state =
    critical.length ? "CRITICAL"
    : degraded.length ? "DEGRADED"
    : optional.length ? "OPTIONAL CONFIG MISSING"
    : "OK";

  return NextResponse.json({
    state,
    healthy: critical.length === 0,
    checkedAt: new Date().toISOString(),
    summary: {
      critical: critical.length,
      degraded: degraded.length,
      optionalMissing: optional.length,
      deliberatelyOff: off.length,
      ok: checks.filter((c) => c.severity === "ok").length,
    },
    critical: critical.map(({ key, breaks }) => ({ key, breaks })),
    degraded: degraded.map(({ key, breaks }) => ({ key, breaks })),
    optionalMissing: optional.map(({ key, breaks }) => ({ key, breaks })),
    deliberatelyOff: off.map(({ key, breaks }) => ({ key, breaks })),
    ok: checks.filter((c) => c.severity === "ok").map((c) => c.key),
  }, { status: critical.length ? 503 : 200 });
}
