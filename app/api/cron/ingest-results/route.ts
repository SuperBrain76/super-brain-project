/**
 * GET|POST /api/cron/ingest-results
 *
 * Triggered every 5 minutes by GitHub Actions. Also accepts Vercel cron
 * format (GET) if Vercel Pro is ever enabled.
 *
 * Authentication: Authorization: Bearer <CRON_SECRET>
 *
 * Request-efficient polling — three pre-flight checks before any API call:
 *
 *   CHECK 1 — Tournament window
 *     If today is outside WC2026 dates (Jun 11 – Jul 19), return immediately.
 *     Zero API calls on off-season days regardless of cron schedule.
 *
 *   CHECK 2 — DB fixtures in window
 *     Query our own fixtures table for matches in the next ±3 hours.
 *     If none exist, return immediately. Zero API calls on non-match days.
 *
 *   CHECK 3 — Active match window
 *     Inspect those fixtures: is any match live, recently started (< 3h ago
 *     and not completed), or kicking off within 30 minutes?
 *     If none qualify, return immediately. Zero API calls between matches.
 *
 *   Only if all three checks pass does the handler call API-Football.
 *
 * Scoring safety:
 *   - extractScore() returns null/null for all non-final statuses
 *   - Scores are only written to DB when status = 'completed'
 *   - This ensures auto_score_predictions trigger fires exactly once per
 *     fixture, with confirmed fulltime scores (never partial live scores)
 */

import { NextRequest, NextResponse }    from "next/server";
import { createClient }                  from "@supabase/supabase-js";
import {
  isTournamentWindow,
  getPollReason,
  fetchLiveFixtures,
  fetchFixturesByDate,
  mapStatus,
  extractScore,
  findDbFixtureByKickoff,
  RateLimitError,
  AuthError,
  type DbFixture,
  type QuotaMeta,
} from "@/lib/ingestion";

// ── Handler ───────────────────────────────────────────────────
// All env vars are read inside the handler (not at module level)
// to ensure they are evaluated at request time, not build time.

async function handler(req: NextRequest): Promise<NextResponse> {

  // ── Environment (read at request time) ──────────────────────
  const CRON_SECRET      = process.env.CRON_SECRET               ?? "";
  const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY          ?? "";
  const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  // ── Auth ────────────────────────────────────────────────────
  const cronSecret = CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  if (auth !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Config check ────────────────────────────────────────────
  if (!FOOTBALL_API_KEY || !SUPABASE_URL || !SUPABASE_SRK) {
    const missing = [
      !FOOTBALL_API_KEY ? "FOOTBALL_API_KEY" : null,
      !SUPABASE_URL     ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !SUPABASE_SRK     ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter(Boolean).join(", ");
    return NextResponse.json(
      { error: `Missing env vars: ${missing}` },
      { status: 500 },
    );
  }

  const startedAt = Date.now();

  // ── CHECK 1: Tournament window ───────────────────────────────
  // Hard cutoff — zero API requests outside WC2026 dates.
  if (!isTournamentWindow()) {
    return NextResponse.json({
      skipped:  true,
      reason:   "outside_tournament_window",
      apiCalls: 0,
      duration: Date.now() - startedAt,
    });
  }

  // Service-role DB client (bypasses RLS — server-side only)
  const db = createClient(SUPABASE_URL, SUPABASE_SRK);

  // ── CHECK 2: DB fixtures in window ───────────────────────────
  // Query our own DB before touching the external API.
  // Include: fixtures within ±3h of now, PLUS any stuck "live" fixtures
  // regardless of age (catches matches that completed outside the window).
  const now         = Date.now();
  const windowStart = new Date(now - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd   = new Date(now + 3 * 60 * 60 * 1000).toISOString();

  // Resolve competition ID by slug (one fast PK-range index lookup)
  const { data: compRow } = await db
    .from("competitions")
    .select("id")
    .eq("slug", "wc2026")
    .single();

  const competitionId = (compRow as Record<string, unknown> | null)?.id as string | null;

  if (!competitionId) {
    console.error("[ingest] competition wc2026 not found in DB");
    return NextResponse.json({ error: "Competition wc2026 not found" }, { status: 500 });
  }

  // Windowed fixtures (upcoming + recent)
  const { data: windowFixtures, error: dbErr } = await db
    .from("fixtures")
    .select("id, kicks_off_at, home_score, away_score, status, home_team_id, away_team_id")
    .eq("competition_id", competitionId)
    .gte("kicks_off_at", windowStart)
    .lte("kicks_off_at", windowEnd)
    .order("kicks_off_at", { ascending: true });

  // Also fetch any stuck "live" or "postponed" fixtures outside the window
  // "postponed" can occur when API-Football marks a match as postponed then completes it
  const { data: stuckLive } = await db
    .from("fixtures")
    .select("id, kicks_off_at, home_score, away_score, status, home_team_id, away_team_id")
    .eq("competition_id", competitionId)
    .in("status", ["live", "postponed"])
    .lt("kicks_off_at", windowStart)
    .order("kicks_off_at", { ascending: true });

  // Merge, deduplicating by id
  const seen = new Set<string>();
  const merged = [...(windowFixtures ?? []), ...(stuckLive ?? [])].filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  const dbFixtures = merged;

  if (dbErr) {
    // DB error is a real error — return 500 so GitHub marks the run failed
    console.error("[ingest] DB query failed:", dbErr.message);
    return NextResponse.json({ error: `DB error: ${dbErr.message}` }, { status: 500 });
  }

  // Load team names so we can match simultaneous fixtures by team, not just time
  const teamIds = [...new Set([
    ...(dbFixtures ?? []).map((f) => f.home_team_id as string),
    ...(dbFixtures ?? []).map((f) => f.away_team_id as string),
  ])];
  const { data: teamsData } = await db.from("teams").select("id, name").in("id", teamIds);
  const teamNameMap = new Map((teamsData ?? []).map((t) => [t.id as string, t.name as string]));

  const TEAM_ALIASES: Record<string, string> = {
    "czechia":                    "czechrepublic",
    "türkiye":                    "turkey",
    "turkiye":                    "turkey",
    "coteivoire":                 "ivorycoast",
    "congodr":                    "drcongo",
    "democraticrepublicofcongo":  "drcongo",
    "northmacedonia":             "macedonia",
    "bosniaandherzegovina":       "bosniaherzegovina",
  };
  function normalizeName(name: string) {
    const raw = name.toLowerCase().replace(/[^a-z]/g, "");
    return TEAM_ALIASES[raw] ?? raw;
  }

  const typedDb = (dbFixtures ?? []) as DbFixture[];

  if (typedDb.length === 0) {
    return NextResponse.json({
      skipped:  true,
      reason:   "no_fixtures_in_window",
      apiCalls: 0,
      duration: Date.now() - startedAt,
    });
  }

  // ── CHECK 3: Active match window ─────────────────────────────
  // Only proceed if a match is live, in-progress, or imminent.
  const pollReason = getPollReason(typedDb, now);

  if (!pollReason) {
    // No active window — next match is more than 30 min away
    const nextFixture = typedDb
      .filter((f) => f.status === "scheduled")
      .sort((a, b) => new Date(a.kicks_off_at).getTime() - new Date(b.kicks_off_at).getTime())[0];

    const nextKickoffMs = nextFixture
      ? new Date(nextFixture.kicks_off_at).getTime()
      : null;

    const minsUntilNext = nextKickoffMs
      ? Math.round((nextKickoffMs - now) / 60_000)
      : null;

    return NextResponse.json({
      skipped:       true,
      reason:        "no_active_match_window",
      nextKickoffIn: minsUntilNext !== null ? `${minsUntilNext}m` : null,
      apiCalls:      0,
      duration:      Date.now() - startedAt,
    });
  }

  // ── All checks passed — call API-Football ────────────────────

  let apiCallsMade = 0;
  let quota: QuotaMeta = {
    requestsLimit: null,
    requestsRemaining: null,
    requestsUsed: null,
  };

  try {
    // Step A: Fetch live fixtures first (most request-efficient path)
    console.log(`[ingest:API] calling GET /fixtures?league=1&season=2026&live=all | reason: ${pollReason}`);
    const liveResult = await fetchLiveFixtures(FOOTBALL_API_KEY);
    apiCallsMade += liveResult.apiCallsMade;
    quota = liveResult.quota;

    let apiFixtures = liveResult.fixtures;
    console.log(`[ingest:API] live response: ${apiFixtures.length} fixtures | quota used: ${quota.requestsUsed ?? "?"}/${quota.requestsLimit ?? "?"} (${quota.requestsRemaining ?? "?"} remaining)`);

    // Step B: If nothing live, fetch the full schedule for the date(s) the
    //         in-progress fixtures actually kicked off on — NOT wall-clock
    //         "today". Matches kicking off late (e.g. 22:00-23:00 UTC) can
    //         run past midnight UTC; by the time API-Football stops listing
    //         them under live=all (i.e. FT), wall-clock "today" has already
    //         rolled to the next day, so a today-only date query silently
    //         misses them and the DB status gets stuck on "live" forever
    //         (getPollReason keeps reporting live_match based on that same
    //         stale status, so the bug never self-corrects).
    if (apiFixtures.length === 0) {
      const relevantDates = new Set<string>([
        new Date().toISOString().slice(0, 10), // always check wall-clock today too
        ...typedDb
          .filter((f) => f.status !== "completed" && f.status !== "postponed")
          .map((f) => f.kicks_off_at.slice(0, 10)),
      ]);

      for (const dateStr of relevantDates) {
        console.log(`[ingest:API] no live matches — calling GET /fixtures?league=1&season=2026&date=${dateStr}`);
        const dateResult = await fetchFixturesByDate(FOOTBALL_API_KEY, dateStr);
        apiCallsMade += dateResult.apiCallsMade;
        quota = dateResult.quota;
        apiFixtures = apiFixtures.concat(dateResult.fixtures);
        console.log(`[ingest:API] date=${dateStr} response: ${dateResult.fixtures.length} fixtures | quota used: ${quota.requestsUsed ?? "?"}/${quota.requestsLimit ?? "?"} (${quota.requestsRemaining ?? "?"} remaining)`);
      }
    }

    if (apiFixtures.length === 0) {
      return NextResponse.json({
        updated:     0,
        checked:     0,
        apiCalls:    apiCallsMade,
        quota,
        pollReason,
        message:     "API returned no fixtures for today",
        duration:    Date.now() - startedAt,
      });
    }

    // ── Diff and update ───────────────────────────────────────
    console.log(
      `[ingest:CHECK] api fixtures: ${apiFixtures.length} | ` +
      `db window fixtures: ${typedDb.length} | ` +
      `api calls this run: ${apiCallsMade}`,
    );

    let updated    = 0;
    let skippedNoMatch = 0;
    const changes: string[] = [];

    // When live endpoint returns exactly 1 match and we have exactly 1
    // in-progress DB fixture, skip time-matching entirely — the API already
    // confirmed it's live so it must be the same fixture. This handles
    // timezone/clock differences between API-Football and our seeded times.
    const inProgressDb = typedDb.filter(
      (f) => f.status !== "completed" && f.status !== "postponed",
    );
    const useSingleMatchFallback =
      apiFixtures.length === 1 &&
      inProgressDb.length === 1 &&
      pollReason !== "kickoff_imminent"; // Don't confuse pre-match with live

    // Track which DB fixtures have been claimed so simultaneous kickoffs
    // (group-stage final round: 2 matches at exactly the same time) each
    // get matched to a distinct DB row instead of both hitting the same one.
    const claimedDbIds = new Set<string>();

    for (const apiFix of apiFixtures) {
      const availableDb = typedDb.filter((f) => !claimedDbIds.has(f.id));

      let dbFix: typeof typedDb[0] | undefined;
      if (useSingleMatchFallback) {
        dbFix = inProgressDb[0];
      } else {
        const apiMs       = new Date(apiFix.fixture.date).getTime();
        const apiHomeName = normalizeName(apiFix.teams.home.name);
        const apiAwayName = normalizeName(apiFix.teams.away.name);
        // Match by team name within 90-min window (handles simultaneous kickoffs)
        dbFix = availableDb.find((f) => {
          if (Math.abs(new Date(f.kicks_off_at).getTime() - apiMs) > 90 * 60 * 1000) return false;
          const row  = f as unknown as Record<string, unknown>;
          const home = normalizeName(teamNameMap.get(row.home_team_id as string) ?? "");
          const away = normalizeName(teamNameMap.get(row.away_team_id as string) ?? "");
          return home === apiHomeName || away === apiAwayName;
        }) ?? findDbFixtureByKickoff(apiFix.fixture.date, availableDb); // fallback: time-only
      }

      if (dbFix) claimedDbIds.add(dbFix.id);

      if (!dbFix) {
        skippedNoMatch++;
        console.log(
          `[ingest:NOMATCH] api_date=${apiFix.fixture.date} | ` +
          `db_fixtures=${typedDb.map((f) => f.kicks_off_at).join(",")}`,
        );
        continue; // Fixture not in our ±3h window
      }

      const newStatus               = mapStatus(apiFix.fixture.status.short);
      const { homeScore, awayScore } = extractScore(apiFix);

      const newKicksOffAt = new Date(apiFix.fixture.date).toISOString();
      const statusChanged    = newStatus !== dbFix.status;
      const kickoffChanged   = newKicksOffAt !== dbFix.kicks_off_at;

      // Write scores for both live and completed matches so points
      // fluctuate in real-time during a match (every 5-min cron tick).
      // extractScore() returns null/null for non-started/postponed fixtures
      // so those are never written. The auto_score_predictions trigger
      // re-scores all predictions whenever the score changes.
      const scoreChanged =
        (newStatus === "live" || newStatus === "completed") &&
        homeScore !== null &&
        awayScore !== null &&
        (homeScore !== dbFix.home_score || awayScore !== dbFix.away_score);

      if (!statusChanged && !scoreChanged && !kickoffChanged) continue;

      const updatePayload: Record<string, unknown> = {
        status:       newStatus,
        kicks_off_at: newKicksOffAt, // Always sync to API-Football's official time
        updated_at:   new Date().toISOString(),
      };

      if (scoreChanged) {
        // Writing both scores triggers the auto_score_predictions AFTER UPDATE
        // trigger, which sets predictions.points_awarded for all users.
        // Leaderboard RPCs are computed on-demand — no further action needed.
        updatePayload.home_score = homeScore;
        updatePayload.away_score = awayScore;
        // Log score writes explicitly so they're easy to find in Vercel logs
        console.log(
          `[ingest:SCORE] fixture ${dbFix.id.slice(0, 8)} | ` +
          `api_status=${apiFix.fixture.status.short} | ` +
          `score=${homeScore}-${awayScore} | ` +
          `type=${newStatus === "completed" ? "FINAL" : "LIVE"} | ` +
          `writing to DB → auto_score_predictions trigger will fire`,
        );
      }

      const { error: updateErr } = await db
        .from("fixtures")
        .update(updatePayload)
        .eq("id", dbFix.id);

      if (updateErr) {
        console.error(`[ingest:ERROR] update failed for fixture ${dbFix.id}:`, updateErr.message);
        continue;
      }

      updated++;
      const label = scoreChanged
        ? `SCORED ${homeScore}-${awayScore}`
        : `STATUS ${dbFix.status}→${newStatus}`;
      const changeMsg = `${dbFix.id.slice(0, 8)} | ${label}`;
      changes.push(changeMsg);
      console.log(`[ingest:UPDATE] ${changeMsg}`);
    }

    const duration = Date.now() - startedAt;

    console.log(
      `[ingest] complete: ${updated} updated, ${apiFixtures.length - skippedNoMatch} matched, ` +
      `${skippedNoMatch} outside window | ${duration}ms`,
    );

    return NextResponse.json({
      updated,
      checked:     apiFixtures.length,
      apiCalls:    apiCallsMade,
      quota,
      pollReason,
      changes,
      duration,
    });

  } catch (err) {

    // ── Typed error handling ──────────────────────────────────

    if (err instanceof RateLimitError) {
      // Rate limited: this is expected under heavy load — log a warning
      // but return 200 so GitHub doesn't mark the run as failed.
      // The next 5-minute run will succeed once the rate window resets.
      console.warn("[ingest] rate limited:", err.message, "quota:", err.quota);
      return NextResponse.json({
        warning:  "rate_limited",
        message:  err.message,
        apiCalls: apiCallsMade,
        quota:    err.quota ?? quota,
        duration: Date.now() - startedAt,
      });
    }

    if (err instanceof AuthError) {
      // Auth errors mean the API key is wrong or expired — 500 to alert
      console.error("[ingest] auth error:", err.message);
      return NextResponse.json(
        { error: "auth_error", message: err.message, apiCalls: apiCallsMade },
        { status: 500 },
      );
    }

    // Unexpected error — 500 so GitHub marks the run failed for alerting
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ingest] unexpected error:", message);
    return NextResponse.json(
      { error: "unexpected", message, apiCalls: apiCallsMade },
      { status: 500 },
    );
  }
}

export const GET  = handler;
export const POST = handler;
