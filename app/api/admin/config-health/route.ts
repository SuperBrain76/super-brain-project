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
 *   off       a deliberate flag, listed so "off" is always a decision
 *   ok        configured
 *
 * Auth: Bearer CRON_SECRET, same as the other admin routes.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Sev = "critical" | "degraded" | "off" | "ok";

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
  add("N8N_VENUE_WEBHOOK_URL", "critical",
      "notifyN8n() returns early. Every venue lifecycle event is a no-op and nothing is logged.");
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
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks = build();
  const critical = checks.filter((c) => c.severity === "critical");
  const degraded = checks.filter((c) => c.severity === "degraded");
  const off = checks.filter((c) => c.severity === "off");

  return NextResponse.json({
    healthy: critical.length === 0,
    checkedAt: new Date().toISOString(),
    summary: {
      critical: critical.length,
      degraded: degraded.length,
      deliberatelyOff: off.length,
      ok: checks.filter((c) => c.severity === "ok").length,
    },
    critical: critical.map(({ key, breaks }) => ({ key, breaks })),
    degraded: degraded.map(({ key, breaks }) => ({ key, breaks })),
    deliberatelyOff: off.map(({ key, breaks }) => ({ key, breaks })),
    ok: checks.filter((c) => c.severity === "ok").map((c) => c.key),
  }, { status: critical.length ? 503 : 200 });
}
