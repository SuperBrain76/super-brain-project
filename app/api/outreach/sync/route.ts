/**
 * GET|POST /api/outreach/sync — push qualified prospects into Instantly.
 *
 * Runs daily from GitHub Actions (same pattern as the fixture crons):
 *   curl -H "Authorization: Bearer $CRON_SECRET" .../api/outreach/sync
 *
 * This is the ONLY path from the CRM into a live send, and it is deliberately
 * conservative. A venue is pushed only when ALL of these hold:
 *
 *   status               = 'verified'      (we found a real contact)
 *   contact_email_status = 'valid'         (it passed verification)
 *   outreach_pushed_at   is null           (never pushed before)
 *   fit_score           >= OUTREACH_MIN_FIT_SCORE   (it is actually a sports venue)
 *   country not in (DE, AT)                (UWG §7 — see lib/instantly.ts)
 *   email not in email_suppressions        (bounced / unsubscribed / complained)
 *
 * ?limit= caps the run. Default comes from OUTREACH_DAILY_CAP and exists to
 * enforce the warmup ramp: a new sending domain that pushes 5,000 leads on day
 * one is a burned domain. Start at 200/day and climb.
 *
 * ?dry=1 reports exactly who WOULD be pushed without touching Instantly.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin, isSuppressed } from "@/lib/venueDb";
import { emit, EVENT } from "@/lib/events";
import { pushLead, campaignFor, InstantlyError } from "@/lib/instantly";
import { SITE } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MIN_FIT = Number(process.env.OUTREACH_MIN_FIT_SCORE ?? 60);

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  // Prefers its own secret so a dry run can be delegated without handing out
  // CRON_SECRET, which unlocks every other admin route. Scoped to this route
  // alone — nothing else reads OUTREACH_SYNC_SECRET. Falls back to CRON_SECRET
  // so existing callers are unaffected, and still fails closed when neither
  // is set. Same pattern as /api/admin/venue-state.
  const secret = (process.env.OUTREACH_SYNC_SECRET || process.env.CRON_SECRET) ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dry   = req.nextUrl.searchParams.get("dry") === "1";
  const limit = Math.min(
    2000,
    Number(req.nextUrl.searchParams.get("limit")) || Number(process.env.OUTREACH_DAILY_CAP ?? 200),
  );

  const db = admin();

  const { data: candidates, error } = await db
    .from("venues")
    .select("id, name, contact_email, contact_name, city, country, website, contact_phone, competition_slug, fit_score")
    .eq("status", "verified")
    .eq("contact_email_status", "valid")
    .is("outreach_pushed_at", null)
    .gte("fit_score", MIN_FIT)
    .not("country", "in", "(DE,AT)")
    .order("fit_score", { ascending: false })
    .limit(limit);

  if (error) {
    await emit(db, EVENT.SYNC_FAILED, {
      source: "instantly", detail: { stage: "select", error: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = {
    considered: candidates?.length ?? 0,
    pushed: 0, skipped_suppressed: 0, skipped_no_campaign: 0, failed: 0,
    dry, min_fit_score: MIN_FIT, limit,
    failures: [] as Array<{ venue: string; error: string }>,
  };

  for (const v of candidates ?? []) {
    if (!v.contact_email) continue;

    if (await isSuppressed(db, v.contact_email)) {
      result.skipped_suppressed++;
      if (!dry) {
        await db.from("venues").update({ status: "disqualified" }).eq("id", v.id);
      }
      continue;
    }

    if (!campaignFor(v.country)) {
      result.skipped_no_campaign++;
      continue;
    }

    if (dry) { result.pushed++; continue; }

    try {
      await pushLead({
        venueId: v.id,
        email: v.contact_email,
        venueName: v.name,
        contactName: v.contact_name,
        city: v.city,
        country: v.country,
        website: v.website,
        phone: v.contact_phone,
        competitionSlug: v.competition_slug,
        siteUrl: SITE,
      });

      await db.from("venues")
        .update({ outreach_pushed_at: new Date().toISOString() })
        .eq("id", v.id);

      result.pushed++;
    } catch (e: any) {
      result.failed++;
      result.failures.push({ venue: v.name, error: String(e?.message ?? e).slice(0, 200) });

      await emit(db, EVENT.SYNC_FAILED, {
        venueId: v.id, source: "instantly",
        detail: { error: String(e?.message ?? e).slice(0, 500), country: v.country },
      });

      // An auth failure or a rate limit will hit every remaining row the same
      // way — stop rather than burn the whole batch producing identical errors.
      if (e instanceof InstantlyError && (e.status === 401 || e.status === 403 || e.status === 429)) {
        result.failures.push({ venue: "—", error: `aborting run on ${e.status}` });
        break;
      }
    }
  }

  await emit(db, EVENT.SCRAPER_RUN, {
    source: "instantly",
    severity: result.failed > 0 ? "warn" : "info",
    detail: { job: "outreach-sync", ...result, failures: undefined },
  });

  return NextResponse.json(result);
}
