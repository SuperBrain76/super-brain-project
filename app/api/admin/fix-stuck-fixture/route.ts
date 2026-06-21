/**
 * GET /api/admin/fix-stuck-fixture?date=YYYY-MM-DD
 *
 * Fetches all WC2026 results for a given date from API-Football and
 * force-updates any fixtures that are stuck in 'live' status.
 * Bypasses the normal ±3h window used by the ingest cron.
 *
 * Unauthenticated — read-only against API-Football, writes only to
 * fixtures that are genuinely stuck (status = live but API says FT).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchFixturesByDate,
  mapStatus,
  extractScore,
  findDbFixtureByKickoff,
  type DbFixture,
} from "@/lib/ingestion";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY ?? "";
  const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!FOOTBALL_API_KEY || !SUPABASE_URL || !SUPABASE_SRK) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  // Default to yesterday UTC if no date provided
  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam ?? (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const db = createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { persistSession: false } });

  // Fetch all stuck (live) fixtures from DB regardless of date
  const { data: stuckFixtures, error: dbErr } = await db
    .from("fixtures")
    .select("id, kicks_off_at, home_score, away_score, status")
    .eq("status", "live");

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  const typedDb = (stuckFixtures ?? []) as DbFixture[];

  if (typedDb.length === 0) {
    return NextResponse.json({ message: "No stuck live fixtures found", updated: 0 });
  }

  // Fetch API-Football results for the given date
  const { fixtures: apiFixtures, apiCallsMade } = await fetchFixturesByDate(FOOTBALL_API_KEY, date);

  if (apiFixtures.length === 0) {
    return NextResponse.json({ message: `No API fixtures found for ${date}`, apiCallsMade, stuckCount: typedDb.length });
  }

  let updated = 0;
  const changes: string[] = [];

  for (const apiFix of apiFixtures) {
    // Use 90-min tolerance here (vs 30-min in normal ingest) to catch seeding
    // mismatches like Türkiye-Paraguay where DB has 04:00 UTC, API has 03:00 UTC.
    const apiMs = new Date(apiFix.fixture.date).getTime();
    const dbFix = typedDb.find((f) => Math.abs(new Date(f.kicks_off_at).getTime() - apiMs) <= 90 * 60 * 1000);
    if (!dbFix) continue;

    const newStatus               = mapStatus(apiFix.fixture.status.short);
    const { homeScore, awayScore } = extractScore(apiFix);

    if (newStatus === "live") continue; // Still live on API side — skip

    const updatePayload: Record<string, unknown> = {
      status:     newStatus,
      updated_at: new Date().toISOString(),
    };

    if (homeScore !== null && awayScore !== null) {
      updatePayload.home_score = homeScore;
      updatePayload.away_score = awayScore;
    }

    const { error: updateErr } = await db
      .from("fixtures")
      .update(updatePayload)
      .eq("id", dbFix.id);

    if (updateErr) {
      console.error(`[fix-stuck] update failed for ${dbFix.id}:`, updateErr.message);
      continue;
    }

    updated++;
    const label = `${dbFix.id.slice(0, 8)} → ${newStatus} ${homeScore}-${awayScore}`;
    changes.push(label);
    console.log(`[fix-stuck] ${label}`);
  }

  return NextResponse.json({
    date,
    stuckFixtures: typedDb.map((f) => ({ id: f.id.slice(0, 8), kicks_off_at: f.kicks_off_at, status: f.status })),
    apiFixtures: apiFixtures.map((f) => ({ date: f.fixture.date, status: f.fixture.status.short, home: f.teams.home.name, away: f.teams.away.name })),
    updated,
    changes,
    apiCallsMade,
  });
}
