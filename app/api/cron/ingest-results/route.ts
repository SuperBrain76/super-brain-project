/**
 * POST /api/cron/ingest-results
 *
 * Called every 5 minutes by a GitHub Actions scheduled workflow.
 * Also supports GET (Vercel cron format) so it works with Vercel Pro if needed.
 *
 * Authentication: Authorization: Bearer <CRON_SECRET>
 *
 * Flow:
 *   1. Fetch live WC2026 fixtures from API-Football
 *   2. If none live, fetch today's fixtures (catches FT results up to 3h after kickoff)
 *   3. Match each to our DB fixture by kickoff timestamp (±5 min)
 *   4. Update status for live matches (never write partial scores)
 *   5. Write home_score + away_score + status=completed for finished matches
 *      → auto_score_predictions DB trigger fires automatically
 *      → predictions.points_awarded is set for all predictors
 *      → leaderboards update on next read (computed on demand, no action needed)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import {
  fetchLiveFixtures,
  fetchFixturesByDate,
  mapStatus,
  extractScore,
  findDbFixtureByKickoff,
} from "@/lib/ingestion";

// ── Environment ───────────────────────────────────────────────

const CRON_SECRET       = process.env.CRON_SECRET              ?? "";
const FOOTBALL_API_KEY  = process.env.FOOTBALL_API_KEY         ?? "";
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SRK      = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// ── DB types ──────────────────────────────────────────────────

interface DbFixture {
  id:         string;
  kicks_off_at: string;
  home_score: number | null;
  away_score: number | null;
  status:     string;
}

// ── Auth helper ───────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;

  // GitHub Actions / external callers: Authorization: Bearer <secret>
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${CRON_SECRET}`) return true;

  // Vercel cron (if ever used): includes vercel-cron user agent
  // Vercel also sends the secret as a query param when configured
  const urlSecret = req.nextUrl.searchParams.get("secret");
  if (urlSecret === CRON_SECRET) return true;

  return false;
}

// ── Handler (supports both GET and POST) ─────────────────────

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!FOOTBALL_API_KEY) {
    return NextResponse.json(
      { error: "FOOTBALL_API_KEY not configured" },
      { status: 500 },
    );
  }

  if (!SUPABASE_URL || !SUPABASE_SRK) {
    return NextResponse.json(
      { error: "Supabase service role credentials not configured" },
      { status: 500 },
    );
  }

  // Service-role client — bypasses RLS for server-side ingestion
  const db = createClient(SUPABASE_URL, SUPABASE_SRK);

  const startedAt = Date.now();

  try {
    // ── Step 1: Fetch from API-Football ──────────────────────
    // Try live first; if nothing live, fall back to today's full schedule
    // (catches FT results in the minutes after a match ends while status settles)
    let apiFixtures = await fetchLiveFixtures(FOOTBALL_API_KEY);

    const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (apiFixtures.length === 0) {
      apiFixtures = await fetchFixturesByDate(FOOTBALL_API_KEY, todayUtc);
    }

    if (apiFixtures.length === 0) {
      return NextResponse.json({
        updated:  0,
        checked:  0,
        message:  "No WC2026 fixtures found for today",
        duration: Date.now() - startedAt,
      });
    }

    // ── Step 2: Load our DB fixtures for a ±3h window ────────
    // This covers any match that started in the last 3 hours or kicks off
    // in the next 3 hours, which is sufficient for all edge cases.
    const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const windowEnd   = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    const { data: dbFixtures, error: dbErr } = await db
      .from("fixtures")
      .select("id, kicks_off_at, home_score, away_score, status")
      .gte("kicks_off_at", windowStart)
      .lte("kicks_off_at", windowEnd);

    if (dbErr) {
      throw new Error(`DB query failed: ${dbErr.message}`);
    }

    if (!dbFixtures || dbFixtures.length === 0) {
      return NextResponse.json({
        updated:  0,
        checked:  apiFixtures.length,
        message:  "No DB fixtures in current 6-hour window",
        duration: Date.now() - startedAt,
      });
    }

    const typedDb = dbFixtures as DbFixture[];

    // ── Step 3: Diff and update ───────────────────────────────

    let updated = 0;
    const log: string[] = [];

    for (const apiFix of apiFixtures) {
      const dbFix = findDbFixtureByKickoff(apiFix.fixture.date, typedDb);
      if (!dbFix) continue; // Not a WC2026 fixture in our window

      const newStatus = mapStatus(apiFix.fixture.status.short);
      const { homeScore, awayScore } = extractScore(apiFix);

      // Build update payload
      // SAFETY: Only write scores when status is 'completed'
      //         Never write partial live scores — prevents trigger misfiring
      const statusChanged = newStatus !== dbFix.status;
      const scoreChanged  =
        newStatus === "completed" &&
        (homeScore !== dbFix.home_score || awayScore !== dbFix.away_score);

      if (!statusChanged && !scoreChanged) continue;

      const updatePayload: Record<string, unknown> = {
        status:     newStatus,
        updated_at: new Date().toISOString(),
      };

      if (scoreChanged && homeScore !== null && awayScore !== null) {
        updatePayload.home_score = homeScore;
        updatePayload.away_score = awayScore;
        // ↑ Writing scores triggers auto_score_predictions DB trigger
        //   which sets predictions.points_awarded for all predictors.
        //   Leaderboard RPCs are computed on-demand — nothing else needed.
      }

      const { error: updateErr } = await db
        .from("fixtures")
        .update(updatePayload)
        .eq("id", dbFix.id);

      if (updateErr) {
        console.error(`[ingest] Failed to update fixture ${dbFix.id}:`, updateErr.message);
        continue;
      }

      updated++;
      log.push(
        `${dbFix.id.slice(0, 8)} | ${dbFix.status}→${newStatus}` +
        (scoreChanged ? ` | score: ${homeScore}-${awayScore}` : " | status only"),
      );
    }

    const duration = Date.now() - startedAt;
    console.log(`[ingest] done in ${duration}ms — ${updated} updated of ${apiFixtures.length} checked`);
    if (log.length > 0) console.log("[ingest] changes:", log.join("\n"));

    return NextResponse.json({
      updated,
      checked:  apiFixtures.length,
      duration,
      changes:  log,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ingest] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET  = handler;
export const POST = handler;
