/**
 * GET /api/admin/sync-kickoff-times
 *
 * One-shot: fetches the complete WC2026 schedule from API-Football (1 API call)
 * and updates every fixture's kicks_off_at in our DB to match the official time.
 *
 * Why this exists: our DB was seeded from NBC Sports schedule data, which has
 * kickoff times that can differ from API-Football's official times by up to
 * ~60 minutes. This mismatch caused the ingest cron to fail to match fixtures
 * after their game finished, leaving them stuck on "live" forever.
 *
 * After running this once, the ingest cron also keeps times in sync on every
 * update, so the problem cannot recur.
 *
 * Unauthenticated — only writes kicks_off_at, never touches scores or status.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAllFixtures, findDbFixtureByKickoff, type DbFixture } from "@/lib/ingestion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY ?? "";
  const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!FOOTBALL_API_KEY || !SUPABASE_URL || !SUPABASE_SRK) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { persistSession: false } });

  // Load all our fixtures
  const { data: compRow } = await db
    .from("competitions")
    .select("id")
    .eq("slug", "wc2026")
    .single();

  const { data: dbFixtures, error: dbErr } = await db
    .from("fixtures")
    .select("id, kicks_off_at, home_score, away_score, status")
    .eq("competition_id", (compRow as Record<string, unknown>)?.id);

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  const typedDb = (dbFixtures ?? []) as DbFixture[];

  // Fetch the full WC2026 schedule from API-Football (1 API call)
  const { fixtures: apiFixtures, apiCallsMade } = await fetchAllFixtures(FOOTBALL_API_KEY);

  if (apiFixtures.length === 0) {
    return NextResponse.json({ error: "API returned no fixtures", apiCallsMade });
  }

  let updated = 0;
  let skipped = 0;
  const changes: string[] = [];

  for (const apiFix of apiFixtures) {
    const officialTime = new Date(apiFix.fixture.date).toISOString();
    const dbFix = findDbFixtureByKickoff(apiFix.fixture.date, typedDb);

    if (!dbFix) {
      skipped++;
      continue;
    }

    // Already correct — skip
    if (dbFix.kicks_off_at === officialTime) continue;

    const { error } = await db
      .from("fixtures")
      .update({ kicks_off_at: officialTime, updated_at: new Date().toISOString() })
      .eq("id", dbFix.id);

    if (error) {
      console.error(`[sync-kickoff] update failed for ${dbFix.id}:`, error.message);
      continue;
    }

    updated++;
    changes.push(
      `${dbFix.id.slice(0, 8)} | ${apiFix.teams.home.name} vs ${apiFix.teams.away.name} | ` +
      `${dbFix.kicks_off_at} → ${officialTime}`
    );
  }

  console.log(`[sync-kickoff] updated=${updated} skipped=${skipped} apiFixtures=${apiFixtures.length}`);

  return NextResponse.json({
    ok: true,
    apiFixtures: apiFixtures.length,
    dbFixtures: typedDb.length,
    updated,
    skipped,
    changes,
    apiCallsMade,
  });
}
