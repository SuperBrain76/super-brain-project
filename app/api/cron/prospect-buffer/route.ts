/**
 * GET|POST /api/cron/prospect-buffer — stateful discovery, buffer-driven.
 *
 * Dylan, 30 Aug 2026: sourcing must continue quietly in the background —
 * never re-sweeping a completed city, never depending on a human remembering
 * to dispatch it, and never flooding Places. This route is the whole policy:
 *
 *   buffer healthy (>= PROSPECT_BUFFER_MIN eligible)  -> do nothing, report
 *   buffer low -> sweep exactly ONE unswept city (next in the priority list),
 *                 prefilter + import, record it in prospect_sweeps, then run
 *                 one enrich pass so imports become eligible or drop out
 *   everything swept and still low -> say so loudly; that is a strategy
 *                 decision (more cities/countries), not something to solve
 *                 by re-hammering the same streets
 *
 * A completed (country, city) is NEVER repeated unless explicitly forced:
 *   ?force=1&country=GB&city=Leeds   (manual, authenticated callers only)
 *
 * Discovery stays fully separate from Instantly: nothing here pushes, queues
 * or sends — the outreach sync keeps its own gate and its own approval rules.
 *
 * Auth: Vercel cron (CRON_SECRET) or Bearer MARKETING_API_SECRET for manual
 * runs. Scheduled daily; one city per invocation is the rate limit.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/venueDb";
import { emit, EVENT } from "@/lib/events";
import { searchPlaces, prefilter, CITIES, SEARCH_TERMS } from "@/lib/prospecting";
import { languageFor, competitionFor, campaignFor } from "@/lib/instantly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MIN_FIT = Number(process.env.OUTREACH_MIN_FIT_SCORE ?? 60);
const BUFFER_MIN = Number(process.env.PROSPECT_BUFFER_MIN ?? 30);
const BUFFER_TARGET = Number(process.env.PROSPECT_BUFFER_TARGET ?? 60);
/** Country order the sweep walks. Mailable markets only. */
const SWEEP_ORDER = ["GB", "ES", "FR", "IT"];

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const secret =
    (process.env.CRON_SECRET || "") && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
      ? "cron"
      : (process.env.MARKETING_API_SECRET || "") &&
        req.headers.get("authorization") === `Bearer ${process.env.MARKETING_API_SECRET}`
      ? "marketing"
      : null;
  if (!secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const dry = q.get("dry") === "1";
  const force = q.get("force") === "1";
  const db = admin();

  // ── the buffer: really-scored, mailable, sendable, untouched ─────────────
  const { data: pool, error: poolErr } = await db
    .from("venues")
    .select("id, country, fit_score, contact_email_status, status, outreach_pushed_at, enrichment")
    .eq("status", "verified")
    .eq("contact_email_status", "valid")
    .is("outreach_pushed_at", null)
    .gte("fit_score", MIN_FIT);
  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 });
  const eligible = (pool ?? []).filter(
    (v) => v?.enrichment?.mock === false && campaignFor(v.country) !== null,
  );
  const buffer = eligible.length;

  const { data: sweptRows } = await db.from("prospect_sweeps").select("country, city");
  const swept = new Set((sweptRows ?? []).map((s) => `${s.country}|${s.city}`));

  // Next target: first unswept city walking SWEEP_ORDER, largest cities first.
  let target: { country: string; city: string } | null = null;
  for (const country of SWEEP_ORDER) {
    const city = (CITIES[country] ?? []).find((c) => !swept.has(`${country}|${c}`));
    if (city) { target = { country, city }; break; }
  }

  if (force) {
    const country = (q.get("country") ?? "").toUpperCase();
    const city = q.get("city") ?? "";
    if (!CITIES[country]?.includes(city))
      return NextResponse.json({ error: `unknown country/city ${country}/${city}` }, { status: 400 });
    await db.from("prospect_sweeps").delete().eq("country", country).eq("city", city);
    target = { country, city };
  } else if (buffer >= BUFFER_MIN) {
    // Healthy buffer: hold. This is the "stop automatically" half of the policy.
    return NextResponse.json({
      action: "hold", buffer, buffer_min: BUFFER_MIN, buffer_target: BUFFER_TARGET,
      swept_cities: swept.size, next_city: target ?? "ALL SWEPT",
    });
  }

  if (!target) {
    await emit(db, EVENT.SCRAPER_RUN, {
      source: "scraper", severity: "warn",
      detail: { job: "prospect-buffer", action: "exhausted", buffer },
    });
    return NextResponse.json({
      action: "exhausted", buffer,
      note: "every city in every mailable market has been swept and the buffer is still low — expanding the city/country lists is a strategy decision, not a retry",
    });
  }

  if (dry) return NextResponse.json({ action: "would_sweep", buffer, target });

  // ── sweep exactly one city ───────────────────────────────────────────────
  const { country, city } = target;
  const lang = languageFor(country);
  const comp = competitionFor(country);
  const stats = { seen: 0, prefiltered_out: 0, imported: 0, already_known: 0, errors: [] as string[] };
  const seenRun = new Set<string>();

  for (const term of SEARCH_TERMS[country] ?? []) {
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      let batch;
      try { batch = await searchPlaces(`${term} in ${city}`, lang, country, pageToken); }
      catch (e: any) { stats.errors.push(`${term}: ${String(e?.message ?? e).slice(0, 120)}`); break; }
      for (const place of batch.places) {
        stats.seen++;
        if (seenRun.has(place.placeId)) continue;
        seenRun.add(place.placeId);
        const check = prefilter(place);
        if (!check.keep) { stats.prefiltered_out++; continue; }
        const { data, error } = await db.from("venues").upsert({
          google_place_id: place.placeId, name: place.name, country,
          city: place.city ?? city, address: place.address, website: place.website,
          contact_phone: place.phone, google_rating: place.rating,
          google_reviews: place.reviews, place_types: place.types,
          language: lang, competition_slug: comp, source: "google_maps",
          status: "prospect",
        }, { onConflict: "google_place_id", ignoreDuplicates: true }).select("id");
        if (error) stats.errors.push(`${place.name}: ${error.message.slice(0, 80)}`);
        else if (data?.length) stats.imported++;
        else stats.already_known++;
      }
      if (!batch.nextPageToken) break;
      pageToken = batch.nextPageToken;
    }
  }

  await db.from("prospect_sweeps").insert({
    country, city, terms_used: (SEARCH_TERMS[country] ?? []).length,
    seen: stats.seen, prefiltered_out: stats.prefiltered_out,
    imported: stats.imported, forced: force,
  });

  // ── one enrich pass so today's imports become eligible or drop out ───────
  // Reuses the hardened enrich route (fresh reads, fail-on-stall) rather than
  // duplicating its logic here.
  let enrich: unknown = "skipped";
  try {
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.superbrain.social";
    const r = await fetch(`${site}/api/prospect/enrich?limit=40`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
    });
    enrich = r.ok ? await r.json() : `enrich HTTP ${r.status}`;
  } catch (e: any) { enrich = `enrich unreachable: ${String(e?.message ?? e).slice(0, 100)}`; }

  await emit(db, EVENT.SCRAPER_RUN, {
    source: "scraper", severity: stats.errors.length ? "warn" : "info",
    detail: { job: "prospect-buffer", action: "swept", country, city, buffer_before: buffer, ...stats },
  });

  return NextResponse.json({ action: "swept", buffer_before: buffer, target, stats, enrich });
}
