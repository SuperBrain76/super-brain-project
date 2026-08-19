/**
 * GET|POST /api/prospect/enrich — turn raw prospects into mailable rows.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/prospect/enrich?limit=100"
 *
 * For each un-enriched prospect: scrape the venue's own site for an email and
 * sport signals, then have Claude score how well it fits a prediction league.
 *
 * The gate to status='verified' — the only status the Instantly sync will
 * push — needs BOTH a findable email and a fit score at or above
 * OUTREACH_MIN_FIT_SCORE. Everything else is marked disqualified with a
 * reason, so the CRM records why a venue was never contacted rather than
 * leaving it in limbo.
 *
 * Venues are processed in small concurrent batches: the slow part is fetching
 * someone else's website, not our own work.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin, isSuppressed } from "@/lib/venueDb";
import { emit, EVENT } from "@/lib/events";
import { scrapeContact, scoreVenue, isMockMode } from "@/lib/enrichment";
import type { PlaceResult } from "@/lib/prospecting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Hobby-plan cap (max 300s); batch smaller if enrichment needs longer.

const MIN_FIT     = Number(process.env.OUTREACH_MIN_FIT_SCORE ?? 60);
const CONCURRENCY = 5;

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit   = Math.min(500, Number(req.nextUrl.searchParams.get("limit")) || 50);
  const country = req.nextUrl.searchParams.get("country")?.toUpperCase();
  const db      = admin();

  let query = db.from("venues")
    .select("id, name, country, city, address, website, contact_phone, google_rating, google_reviews, place_types")
    .eq("status", "prospect")
    .is("enriched_at", null)
    .order("google_reviews", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (country) query = query.eq("country", country);

  const { data: prospects, error } = await query;
  if (error) {
    await emit(db, EVENT.SYNC_FAILED, { source: "scraper", detail: { stage: "select", error: error.message } });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = {
    considered: prospects?.length ?? 0,
    verified: 0, no_email: 0, low_fit: 0, suppressed: 0, failed: 0,
    min_fit_score: MIN_FIT,
    // Loud on purpose: a run that scored offline must never be mistaken for a
    // qualified list. Mock rows are flagged in the CRM too.
    mock_mode: isMockMode(),
    failures: [] as string[],
  };

  // Fixed-size worker pool — the bottleneck is other people's web servers.
  const queue = [...(prospects ?? [])];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const v = queue.shift();
        if (!v) return;
        try {
          await enrichOne(db, v, result);
        } catch (e: any) {
          result.failed++;
          result.failures.push(`${v.name}: ${String(e?.message ?? e).slice(0, 160)}`);
          await emit(db, EVENT.SYNC_FAILED, {
            venueId: v.id, source: "scraper",
            detail: { stage: "enrich", error: String(e?.message ?? e).slice(0, 400) },
          });
        }
      }
    }),
  );

  await emit(db, EVENT.SCRAPER_RUN, {
    source: "scraper",
    severity: result.failed ? "warn" : "info",
    detail: { job: "enrich", ...result, failures: result.failures.length },
  });

  return NextResponse.json(result);
}

async function enrichOne(db: any, v: any, result: any) {
  const place: PlaceResult = {
    placeId: "", name: v.name, address: v.address, city: v.city,
    website: v.website, phone: v.contact_phone,
    rating: v.google_rating, reviews: v.google_reviews,
    types: v.place_types ?? [], primaryType: null,
  };

  const scrape = await scrapeContact(v.website);
  const now    = new Date().toISOString();

  // No email means no outreach, whatever the fit — don't pay for the AI call.
  if (!scrape.email) {
    result.no_email++;
    await db.from("venues").update({
      enriched_at: now, status: "disqualified",
      fit_reason: "no contact email found on website",
    }).eq("id", v.id);
    await emit(db, EVENT.PROSPECT_REJECTED, {
      venueId: v.id, source: "scraper", detail: { reason: "no_email", website: v.website },
    });
    return;
  }

  if (await isSuppressed(db, scrape.email)) {
    result.suppressed++;
    await db.from("venues").update({
      enriched_at: now, status: "disqualified",
      contact_email: scrape.email, fit_reason: "email on suppression list",
    }).eq("id", v.id);
    return;
  }

  const fit = await scoreVenue(place, scrape, v.country);
  const passes = fit.fit_score >= MIN_FIT && fit.venue_type !== "not_a_venue";

  await db.from("venues").update({
    enriched_at:          now,
    verified_at:          passes ? now : null,
    contact_email:        scrape.email,
    contact_email_status: passes ? "valid" : "unverified",
    contact_name:         fit.contact_name ?? v.contact_name ?? null,
    fit_score:            fit.fit_score,
    fit_reason:           fit.reason,
    shows_live_sport:     fit.shows_live_sport,
    status:               passes ? "verified" : "disqualified",
    enrichment: {
      mock:           fit.mock,
      venue_type:     fit.venue_type,
      league_name:    fit.suggested_league_name,
      sport_signals:  scrape.sportSignals,
      socials:        scrape.socials,
    },
  }).eq("id", v.id);

  if (passes) {
    result.verified++;
    await emit(db, EVENT.PROSPECT_ENRICHED, {
      venueId: v.id, source: "scraper",
      detail: { fit_score: fit.fit_score, venue_type: fit.venue_type, email: scrape.email },
    });
    await emit(db, EVENT.EMAIL_VERIFIED, {
      venueId: v.id, source: "scraper", detail: { email: scrape.email },
    });
  } else {
    result.low_fit++;
    await emit(db, EVENT.PROSPECT_REJECTED, {
      venueId: v.id, source: "scraper",
      detail: { reason: "low_fit", fit_score: fit.fit_score, why: fit.reason },
    });
  }
}
