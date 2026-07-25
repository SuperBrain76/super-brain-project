/**
 * GET /api/admin/backfill-provider-ids?competition=<slug>[&commit=1]
 *
 * Populates fixtures.provider_fixture_id for a competition — the backfill
 * that migration 039 depends on. Costs ONE provider API call.
 *
 * ────────────────────────────────────────────────────────────
 * DRY RUN BY DEFAULT
 * ────────────────────────────────────────────────────────────
 * Without `&commit=1` this writes nothing and returns exactly what it would
 * do. Always dry-run first and read the `ambiguous` and `unmatched` arrays.
 *
 * ────────────────────────────────────────────────────────────
 * WHY THIS IS SAFE EVEN THOUGH IT MATCHES ON KICKOFF TIME
 * ────────────────────────────────────────────────────────────
 * This is the ONE place kickoff-based matching is still legitimate, and it
 * differs from the code it replaces in three ways that matter:
 *
 *   1. BOTH team names must match, not either one.
 *   2. An ambiguous match (two candidates) is REFUSED and reported, never
 *      resolved by taking the first.
 *   3. It runs once, offline, against a completed or unstarted competition
 *      — with a human reading the output — rather than every 5 minutes
 *      against live results.
 *
 * For the World Cup the >=3h spacing that made the old ingest code safe
 * also makes this backfill safe. For the Premier League, both-team matching
 * is what disambiguates ten simultaneous kickoffs.
 *
 * ⚠️ Do NOT add the unique index in migration 039 PART 2 until this reports
 *    every fixture mapped and zero ambiguities.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }               from "@supabase/supabase-js";
import {
  fetchAllFixtures,
  findFixtureForBackfill,
  type BackfillCandidate,
  type CompetitionIngestConfig,
} from "@/lib/ingestion";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY          ?? "";
  const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const CRON_SECRET      = process.env.CRON_SECRET               ?? "";

  // Admin-only. This writes to the fixtures table.
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
      { error: "competition slug required, e.g. ?competition=wc2026" },
      { status: 400 },
    );
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { persistSession: false } });

  // ── Competition + provider config ───────────────────────────
  const { data: comp } = await db
    .from("competitions").select("id, slug").eq("slug", slug).single();

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
      { error: `competition "${slug}" has no provider_league_id / provider_season configured. Set them in competition_settings first.` },
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

  // ── Our fixtures, with team names ───────────────────────────
  const { data: rows, error: dbErr } = await db
    .from("fixtures")
    .select(`
      id, kicks_off_at, home_score, away_score, status, provider_fixture_id,
      home_team_id, away_team_id,
      home_team:teams!home_team_id ( name ),
      away_team:teams!away_team_id ( name )
    `)
    .eq("competition_id", compId);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const candidates: BackfillCandidate[] = (rows ?? []).map((r) => {
    const row = r as unknown as Record<string, unknown>;
    const ht  = row.home_team as { name?: string } | null;
    const at  = row.away_team as { name?: string } | null;
    return {
      id:                  row.id as string,
      kicks_off_at:        row.kicks_off_at as string,
      home_score:          row.home_score as number | null,
      away_score:          row.away_score as number | null,
      status:              row.status as string,
      provider_fixture_id: (row.provider_fixture_id as string) ?? null,
      home_team_id:        (row.home_team_id as string) ?? null,
      away_team_id:        (row.away_team_id as string) ?? null,
      home_team_name:      ht?.name ?? null,
      away_team_name:      at?.name ?? null,
    };
  });

  // ── One provider call for the whole schedule ────────────────
  const { fixtures: apiFixtures, apiCallsMade } = await fetchAllFixtures(FOOTBALL_API_KEY, cfg);

  if (apiFixtures.length === 0) {
    return NextResponse.json({ error: "provider returned no fixtures", apiCallsMade }, { status: 502 });
  }

  // ── Match ───────────────────────────────────────────────────
  const claimed   = new Set<string>();
  const mapped: { fixtureId: string; providerId: number; label: string }[] = [];
  const ambiguous: string[] = [];
  const unmatched: string[] = [];

  for (const apiFix of apiFixtures) {
    const label = `${apiFix.teams.home.name} v ${apiFix.teams.away.name} @ ${apiFix.fixture.date}`;
    const pool  = candidates.filter((c) => !claimed.has(c.id));

    const res = findFixtureForBackfill(
      {
        kickoffIso: apiFix.fixture.date,
        homeName:   apiFix.teams.home.name,
        awayName:   apiFix.teams.away.name,
      },
      pool,
    );

    if (!res.fixture) {
      const reason = (res as { reason: string }).reason;
      if (reason.startsWith("AMBIGUOUS")) ambiguous.push(`${label} — ${reason}`);
      else unmatched.push(`${label} — ${reason}`);
      continue;
    }

    claimed.add(res.fixture.id);
    mapped.push({ fixtureId: res.fixture.id, providerId: apiFix.fixture.id, label });
  }

  const dbUnmapped = candidates
    .filter((c) => !claimed.has(c.id))
    .map((c) => `${c.home_team_name ?? "TBD"} v ${c.away_team_name ?? "TBD"} @ ${c.kicks_off_at}`);

  // ── Refuse to commit an incomplete or ambiguous mapping ─────
  const clean = ambiguous.length === 0 && dbUnmapped.length === 0;

  if (commit && !clean) {
    return NextResponse.json({
      committed: false,
      reason:    "refusing to write a partial or ambiguous mapping — resolve these by hand first",
      competition: slug,
      dbFixtures:  candidates.length,
      apiFixtures: apiFixtures.length,
      wouldMap:    mapped.length,
      ambiguous,
      unmatchedFromProvider: unmatched,
      unmappedInDatabase:    dbUnmapped,
      apiCallsMade,
    }, { status: 409 });
  }

  if (!commit) {
    return NextResponse.json({
      dryRun:      true,
      competition: slug,
      dbFixtures:  candidates.length,
      apiFixtures: apiFixtures.length,
      wouldMap:    mapped.length,
      clean,
      ambiguous,
      unmatchedFromProvider: unmatched,
      unmappedInDatabase:    dbUnmapped,
      sample:      mapped.slice(0, 5),
      apiCallsMade,
      nextStep: clean
        ? "Re-run with &commit=1, then apply PART 2 of migration 039 (the unique index)."
        : "Resolve the ambiguous/unmapped fixtures by hand before committing.",
    });
  }

  // ── Commit ──────────────────────────────────────────────────
  let written = 0;
  const failures: string[] = [];

  for (const m of mapped) {
    const { error } = await db
      .from("fixtures")
      .update({
        provider:            cfg.provider,
        provider_fixture_id: String(m.providerId),
        updated_at:          new Date().toISOString(),
      })
      .eq("id", m.fixtureId);

    if (error) failures.push(`${m.label}: ${error.message}`);
    else written++;
  }

  console.log(`[backfill-provider-ids] ${slug}: wrote ${written}/${mapped.length}`);

  return NextResponse.json({
    committed:   true,
    competition: slug,
    written,
    expected:    candidates.length,
    complete:    written === candidates.length,
    failures,
    apiCallsMade,
    nextStep: written === candidates.length
      ? "Verify with scripts/verify-039-provider-ids.sql, then apply PART 2 of migration 039."
      : "INCOMPLETE — do NOT apply the unique index yet.",
  });
}
