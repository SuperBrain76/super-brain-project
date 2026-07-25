/**
 * GET /api/admin/sync-kickoff-times?competition=<slug>[&commit=1]
 *
 * Fetches a competition's complete schedule from the provider (1 API call)
 * and updates every fixture's kicks_off_at to the official time.
 *
 * Why this exists: fixtures are seeded from published schedules, whose
 * kickoff times can differ from the provider's official times by up to
 * ~60 minutes. Under the old kickoff-matching ingestion that mismatch left
 * fixtures stuck on "live" forever.
 *
 * ────────────────────────────────────────────────────────────
 * CHANGED IN COMPETITION ENGINE V2
 * ────────────────────────────────────────────────────────────
 *   • Competition comes from the query string, not the `wc2026` literal.
 *   • Fixtures are matched by PROVIDER FIXTURE ID, not by kickoff proximity.
 *     Matching on kickoff time to CORRECT kickoff time was always circular;
 *     with several matches sharing a slot it is unsound. Run
 *     /api/admin/backfill-provider-ids first.
 *   • Dry run by default. Pass &commit=1 to write.
 *   • Requires the admin bearer token. It previously ran unauthenticated,
 *     which was acceptable for a write limited to kicks_off_at but is not
 *     worth keeping — rescheduling a fixture moves its prediction deadline.
 *
 * Only ever writes kicks_off_at. Never touches scores, status or points.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }               from "@supabase/supabase-js";
import {
  fetchAllFixtures,
  findDbFixtureByProviderId,
  type DbFixture,
  type CompetitionIngestConfig,
} from "@/lib/ingestion";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY          ?? "";
  const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const CRON_SECRET      = process.env.CRON_SECRET               ?? "";

  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!FOOTBALL_API_KEY || !SUPABASE_URL || !SUPABASE_SRK) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const slug   = req.nextUrl.searchParams.get("competition");
  const commit = req.nextUrl.searchParams.get("commit") === "1";

  if (!slug) {
    return NextResponse.json(
      { error: "competition slug required, e.g. ?competition=pl-2026-27" },
      { status: 400 },
    );
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { persistSession: false } });

  const { data: comp } = await db
    .from("competitions").select("id").eq("slug", slug).single();

  if (!comp) {
    return NextResponse.json({ error: `competition "${slug}" not found` }, { status: 404 });
  }
  const compId = (comp as { id: string }).id;

  const { data: settings } = await db.rpc("get_competition_settings", { p_competition_id: compId });
  const s = (settings ?? {}) as Record<string, unknown>;

  const leagueId = typeof s.provider_league_id === "number" ? s.provider_league_id : null;
  const season   = typeof s.provider_season    === "number" ? s.provider_season    : null;

  if (leagueId === null || season === null) {
    return NextResponse.json(
      { error: `competition "${slug}" has no provider configuration in competition_settings.` },
      { status: 400 },
    );
  }

  const cfg: CompetitionIngestConfig = {
    competitionId:    compId,
    slug,
    provider:         typeof s.provider === "string" ? s.provider : "api-football",
    providerLeagueId: leagueId,
    providerSeason:   season,
    ingestEnabled:    true,
    hasKnockout:      s.has_knockout === true,
  };

  const { data: dbFixtures, error: dbErr } = await db
    .from("fixtures")
    .select("id, kicks_off_at, home_score, away_score, status, provider_fixture_id")
    .eq("competition_id", compId);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const typedDb = (dbFixtures ?? []) as DbFixture[];
  const mapped  = typedDb.filter((f) => f.provider_fixture_id).length;

  if (mapped === 0) {
    return NextResponse.json({
      error:    "no fixture has a provider_fixture_id",
      nextStep: `Run /api/admin/backfill-provider-ids?competition=${slug} first.`,
    }, { status: 409 });
  }

  const { fixtures: apiFixtures, apiCallsMade } = await fetchAllFixtures(FOOTBALL_API_KEY, cfg);

  if (apiFixtures.length === 0) {
    return NextResponse.json({ error: "provider returned no fixtures", apiCallsMade }, { status: 502 });
  }

  let updated = 0;
  let skipped = 0;
  const changes: string[] = [];

  for (const apiFix of apiFixtures) {
    const dbFix = findDbFixtureByProviderId(apiFix.fixture.id, typedDb);
    if (!dbFix) { skipped++; continue; }

    const officialTime = new Date(apiFix.fixture.date).toISOString();
    if (dbFix.kicks_off_at === officialTime) continue;

    const change =
      `${dbFix.id.slice(0, 8)} | ${apiFix.teams.home.name} v ${apiFix.teams.away.name} | ` +
      `${dbFix.kicks_off_at} → ${officialTime}`;

    if (!commit) { changes.push(change); updated++; continue; }

    const { error } = await db
      .from("fixtures")
      .update({ kicks_off_at: officialTime, updated_at: new Date().toISOString() })
      .eq("id", dbFix.id);

    if (error) {
      console.error(`[sync-kickoff] update failed for ${dbFix.id}:`, error.message);
      continue;
    }

    updated++;
    changes.push(change);
  }

  console.log(
    `[sync-kickoff] ${slug} ${commit ? "committed" : "dry-run"} ` +
    `updated=${updated} skipped=${skipped} api=${apiFixtures.length}`,
  );

  return NextResponse.json({
    ok:          true,
    dryRun:      !commit,
    competition: slug,
    apiFixtures: apiFixtures.length,
    dbFixtures:  typedDb.length,
    withProviderId: mapped,
    updated,
    skipped,
    changes,
    apiCallsMade,
    // Rescheduling moves the round's derived lock time too — migration 042's
    // trigger recomputes rounds.locks_at automatically unless it is pinned.
    note: "Rounds' start/end/lock times are recomputed automatically by the fixtures_round_window_trigger.",
  });
}
