/**
 * GET|POST /api/prospect/places — sweep Google Places for sports venues.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     ".../api/prospect/places?country=GB&cities=6&dry=1"
 *
 * Params:
 *   country  ISO-2 (GB|ES|FR|IT|DE). Required.
 *   cities   How many cities from the list to cover this run (default 5).
 *   offset   Skip the first N cities — lets successive runs walk the list.
 *   dry=1    Report what would be imported without writing.
 *
 * Venues land as status='prospect' with no contact email; /api/prospect/enrich
 * turns them into mailable rows. Dedupe is on google_place_id, so overlapping
 * runs are free — re-running the same city imports nothing new.
 *
 * Note DE is sweepable. German venues are worked by phone and never emailed
 * (UWG §7), so they are collected but the outreach sync skips them.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/venueDb";
import { emit, EVENT } from "@/lib/events";
import { searchPlaces, prefilter, CITIES, SEARCH_TERMS } from "@/lib/prospecting";
import { languageFor, competitionFor } from "@/lib/instantly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q       = req.nextUrl.searchParams;
  const country = (q.get("country") ?? "").toUpperCase();
  const dry     = q.get("dry") === "1";
  const nCities = Math.min(30, Number(q.get("cities")) || 5);
  const offset  = Math.max(0, Number(q.get("offset")) || 0);

  const cities = CITIES[country];
  const terms  = SEARCH_TERMS[country];
  if (!cities || !terms) {
    return NextResponse.json(
      { error: `unsupported country "${country}" — one of ${Object.keys(CITIES).join(", ")}` },
      { status: 400 },
    );
  }

  const db = admin();
  const result = {
    country, dry,
    cities: cities.slice(offset, offset + nCities),
    next_offset: offset + nCities,
    seen: 0, prefiltered_out: 0, imported: 0, already_known: 0, errors: [] as string[],
  };

  const lang = languageFor(country);
  const comp = competitionFor(country);
  const seenThisRun = new Set<string>();

  for (const city of result.cities) {
    for (const term of terms) {
      let pageToken: string | undefined;

      // Places caps a text search at 3 pages / 60 results.
      for (let page = 0; page < 3; page++) {
        let batch;
        try {
          batch = await searchPlaces(`${term} in ${city}`, lang, country, pageToken);
        } catch (e: any) {
          const msg = `${city}/${term}: ${String(e?.message ?? e).slice(0, 160)}`;
          result.errors.push(msg);
          await emit(db, EVENT.SYNC_FAILED, {
            source: "scraper", detail: { stage: "places_search", country, city, term, error: msg },
          });
          break;
        }

        for (const place of batch.places) {
          result.seen++;
          if (seenThisRun.has(place.placeId)) continue;
          seenThisRun.add(place.placeId);

          const check = prefilter(place);
          if (!check.keep) { result.prefiltered_out++; continue; }

          if (dry) { result.imported++; continue; }

          // onConflict on google_place_id makes re-runs a no-op. ignoreDuplicates
          // keeps any enrichment already done on a row we saw in an earlier run.
          const { data, error } = await db.from("venues").upsert({
            google_place_id:  place.placeId,
            name:             place.name,
            country,
            city:             place.city ?? city,
            address:          place.address,
            website:          place.website,
            contact_phone:    place.phone,
            google_rating:    place.rating,
            google_reviews:   place.reviews,
            place_types:      place.types,
            language:         lang,
            competition_slug: comp,
            source:           "google_maps",
            status:           "prospect",
          }, { onConflict: "google_place_id", ignoreDuplicates: true })
            .select("id");

          if (error) {
            result.errors.push(`${place.name}: ${error.message.slice(0, 120)}`);
          } else if (data?.length) {
            result.imported++;
            await emit(db, EVENT.PROSPECT_IMPORTED, {
              venueId: data[0].id, source: "scraper",
              detail: { place_id: place.placeId, city, term, country },
            });
          } else {
            result.already_known++;
          }
        }

        if (!batch.nextPageToken) break;
        pageToken = batch.nextPageToken;
      }
    }
  }

  await emit(db, EVENT.SCRAPER_RUN, {
    source: "scraper",
    severity: result.errors.length ? "warn" : "info",
    detail: { job: "places-sweep", ...result, errors: result.errors.length },
  });

  return NextResponse.json(result);
}
