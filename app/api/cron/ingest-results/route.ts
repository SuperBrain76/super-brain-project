/**
 * GET|POST /api/cron/ingest-results — Competition Engine V2
 *
 * Triggered every 5 minutes by GitHub Actions.
 * Authentication: Authorization: Bearer <CRON_SECRET>
 *
 * ────────────────────────────────────────────────────────────
 * WHAT CHANGED FROM THE WORLD CUP VERSION
 * ────────────────────────────────────────────────────────────
 *   1. Loops over EVERY competition with ingest_enabled, instead of a
 *      hardcoded `.eq("slug", "wc2026")`.
 *   2. Provider league/season come from competition_settings, not from the
 *      `WC2026 = "league=1&season=2026"` constant.
 *   3. The window is DERIVED FROM FIXTURES. `isTournamentWindow()` had the
 *      WC calendar baked in, so ingestion became a permanent no-op on
 *      20 July 2026 and would never have restarted for any competition.
 *   4. 🔴 Results are routed by PROVIDER FIXTURE ID ONLY.
 *      Removed: the ±90-minute kickoff fallback, the either-team name
 *      match, and `useSingleMatchFallback`. Each of those could silently
 *      route a result to the wrong fixture once matches share a kickoff
 *      time — which is every Saturday in the Premier League.
 *      An unroutable result is now logged and skipped. It is never guessed.
 *
 * Pre-flight gates (unchanged in spirit — they were well built):
 *   CHECK 1  competition enabled for ingestion
 *   CHECK 2  fixtures in our own DB within ±3h  → else no API call
 *   CHECK 3  any of them live / in progress / imminent → else no API call
 *
 * Scoring safety: writing both scores fires auto_score_predictions, which
 * awards points and mints IQ. Live scores ARE written (points move during
 * a match); economy_award_fixture reconciles deltas so this cannot
 * double-mint. See lib/ingestion.ts extractScore for the full note.
 */

import { NextRequest, NextResponse }    from "next/server";
import { createClient }                  from "@supabase/supabase-js";
import type { SupabaseClient }           from "@supabase/supabase-js";
import {
  getPollReason,
  fetchLiveFixtures,
  fetchFixturesByDate,
  mapStatus,
  extractScore,
  matchProviderFixture,
  isReversed,
  RateLimitError,
  AuthError,
  type DbFixture,
  type QuotaMeta,
  type CompetitionIngestConfig,
  type ApiFootballFixture,
} from "@/lib/ingestion";
import { fetchTsdbResults } from "@/lib/thesportsdb";
import {
  parseF1ProviderId,
  fetchJolpicaQualifying,
  fetchJolpicaRaceResults,
  fetchJolpicaDriverStandings,
  fetchJolpicaConstructorStandings,
  isCompleteClassification,
  type JolpicaClassifiedRow,
} from "@/lib/jolpica";
import { F1_JOLPICA_TO_CODE } from "@/lib/f1/drivers2026";

// ── Per-competition result ────────────────────────────────────

interface CompetitionOutcome {
  slug:        string;
  skipped?:    boolean;
  reason?:     string;
  updated?:    number;
  checked?:    number;
  unroutable?: number;
  apiCalls?:   number;
  changes?:    string[];
  error?:      string;
}

// ── Competition discovery ─────────────────────────────────────

async function loadIngestConfigs(db: SupabaseClient): Promise<CompetitionIngestConfig[]> {
  const { data: comps, error } = await db
    .from("competitions")
    .select("id, slug")
    .neq("status", "completed");

  if (error || !comps) {
    console.error("[ingest] could not list competitions:", error?.message);
    return [];
  }

  const configs: CompetitionIngestConfig[] = [];

  for (const c of comps as { id: string; slug: string }[]) {
    const { data: settings } = await db.rpc("get_competition_settings", {
      p_competition_id: c.id,
    });

    const s = (settings ?? {}) as Record<string, unknown>;

    // Fail CLOSED. A competition with no provider configuration is not
    // ingested — it is never assumed to be the WC. Season may be a year
    // (API-Football) or a string like "2026-2027" (TheSportsDB).
    const leagueId = typeof s.provider_league_id === "number" ? s.provider_league_id : null;
    const season   = (typeof s.provider_season === "number" || typeof s.provider_season === "string")
      ? s.provider_season : null;
    const enabled  = s.ingest_enabled === true;

    if (!enabled || leagueId === null || season === null) continue;

    configs.push({
      competitionId:    c.id,
      slug:             c.slug,
      provider:         typeof s.provider === "string" ? s.provider : "api-football",
      providerLeagueId: leagueId,
      providerSeason:   season,
      ingestEnabled:    true,
      hasKnockout:      s.has_knockout === true,
    });
  }

  return configs;
}

// ── One competition ───────────────────────────────────────────

async function ingestCompetition(
  db:     SupabaseClient,
  cfg:    CompetitionIngestConfig,
  keys:   { apiFootball: string; thesportsdb: string },
  now:    number,
): Promise<{ outcome: CompetitionOutcome; quota: QuotaMeta | null }> {

  if (cfg.provider === "thesportsdb") {
    return { outcome: await ingestThesportsdb(db, cfg, keys.thesportsdb, now), quota: null };
  }
  if (cfg.provider === "jolpica") {
    return { outcome: await ingestJolpica(db, cfg, now), quota: null };
  }
  if (cfg.provider !== "api-football") {
    return {
      outcome: { slug: cfg.slug, skipped: true, reason: `unsupported_provider:${cfg.provider}` },
      quota: null,
    };
  }

  const apiKey = keys.apiFootball;
  const windowStart = new Date(now - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd   = new Date(now + 3 * 60 * 60 * 1000).toISOString();

  const SELECT =
    "id, kicks_off_at, home_score, away_score, status, provider_fixture_id, home_team_id, away_team_id";

  // ── CHECK 2: our own fixtures in the window ─────────────────
  const { data: windowFixtures, error: dbErr } = await db
    .from("fixtures").select(SELECT)
    .eq("competition_id", cfg.competitionId)
    .gte("kicks_off_at", windowStart)
    .lte("kicks_off_at", windowEnd)
    .order("kicks_off_at", { ascending: true });

  if (dbErr) {
    return { outcome: { slug: cfg.slug, error: `DB error: ${dbErr.message}` }, quota: null };
  }

  // Stuck fixtures outside the window: a match that completed after our
  // window closed would otherwise stay 'live' forever, and getPollReason
  // would keep reporting live_match from that same stale status — a bug
  // that never self-corrects.
  const { data: stuckLive } = await db
    .from("fixtures").select(SELECT)
    .eq("competition_id", cfg.competitionId)
    .in("status", ["live", "postponed"])
    .lt("kicks_off_at", windowStart)
    .order("kicks_off_at", { ascending: true });

  const seen = new Set<string>();
  const dbFixtures = [...(windowFixtures ?? []), ...(stuckLive ?? [])]
    .filter((f) => (seen.has(f.id as string) ? false : (seen.add(f.id as string), true))) as DbFixture[];

  if (dbFixtures.length === 0) {
    return { outcome: { slug: cfg.slug, skipped: true, reason: "no_fixtures_in_window", apiCalls: 0 }, quota: null };
  }

  // ── CHECK 3: is anything actually happening? ────────────────
  const pollReason = getPollReason(dbFixtures, now);
  if (!pollReason) {
    const next = dbFixtures
      .filter((f) => f.status === "scheduled")
      .sort((a, b) => new Date(a.kicks_off_at).getTime() - new Date(b.kicks_off_at).getTime())[0];
    const mins = next ? Math.round((new Date(next.kicks_off_at).getTime() - now) / 60_000) : null;
    return {
      outcome: {
        slug: cfg.slug, skipped: true, reason: "no_active_match_window",
        apiCalls: 0, ...(mins !== null ? { changes: [`next kickoff in ${mins}m`] } : {}),
      },
      quota: null,
    };
  }

  // ── Guard: refuse to ingest an unmapped competition ─────────
  // Without provider ids there is no safe way to route a result. Rather
  // than fall back to kickoff guessing — the exact defect this rewrite
  // removes — do nothing and say why.
  const mapped = dbFixtures.filter((f) => f.provider_fixture_id).length;
  if (mapped === 0) {
    console.error(
      `[ingest:${cfg.slug}] ABORT — no fixture in this window has a provider_fixture_id. ` +
      `Run the provider-id backfill (migration 039) before enabling ingestion.`,
    );
    return {
      outcome: { slug: cfg.slug, skipped: true, reason: "no_provider_ids_backfill_required", apiCalls: 0 },
      quota: null,
    };
  }
  if (mapped < dbFixtures.length) {
    console.warn(
      `[ingest:${cfg.slug}] ${dbFixtures.length - mapped} of ${dbFixtures.length} fixtures in ` +
      `window lack a provider id — their results CANNOT be ingested and will be reported unroutable.`,
    );
  }

  // ── Team names, for reversal detection only ─────────────────
  const teamIds = [...new Set(
    dbFixtures.flatMap((f) => [f.home_team_id, f.away_team_id]).filter(Boolean) as string[],
  )];
  const { data: teamsData } = teamIds.length
    ? await db.from("teams").select("id, name").in("id", teamIds)
    : { data: [] as { id: string; name: string }[] };
  const teamName = new Map((teamsData ?? []).map((t) => [t.id as string, t.name as string]));

  // ── Call the provider ───────────────────────────────────────
  let apiCallsMade = 0;
  let quota: QuotaMeta = { requestsLimit: null, requestsRemaining: null, requestsUsed: null };

  console.log(`[ingest:${cfg.slug}] polling — reason: ${pollReason}`);
  const live = await fetchLiveFixtures(apiKey, cfg);
  apiCallsMade += live.apiCallsMade;
  quota = live.quota;

  let apiFixtures: ApiFootballFixture[] = live.fixtures;

  // Nothing live: fetch by the date(s) the in-progress fixtures kicked off
  // on — NOT wall-clock today. A 22:00 UTC kickoff finishes after midnight,
  // by which time a today-only query silently misses it.
  if (apiFixtures.length === 0) {
    const dates = new Set<string>([
      new Date(now).toISOString().slice(0, 10),
      ...dbFixtures
        .filter((f) => f.status !== "completed" && f.status !== "postponed")
        .map((f) => f.kicks_off_at.slice(0, 10)),
    ]);
    for (const d of dates) {
      const byDate = await fetchFixturesByDate(apiKey, cfg, d);
      apiCallsMade += byDate.apiCallsMade;
      quota = byDate.quota;
      apiFixtures = apiFixtures.concat(byDate.fixtures);
    }
  }

  if (apiFixtures.length === 0) {
    return {
      outcome: { slug: cfg.slug, updated: 0, checked: 0, apiCalls: apiCallsMade, reason: "provider_returned_nothing" },
      quota,
    };
  }

  // ── Route and write ─────────────────────────────────────────
  let updated    = 0;
  let unroutable = 0;
  const changes: string[] = [];

  for (const apiFix of apiFixtures) {
    // 🔴 THE RULE: provider id, or nothing. No fallback exists by design.
    const outcome = matchProviderFixture(apiFix.fixture.id, dbFixtures);

    if (outcome.kind !== "matched") {
      unroutable++;
      console.log(
        `[ingest:${cfg.slug}:UNROUTABLE] provider_id=${apiFix.fixture.id} ` +
        `${apiFix.teams.home.name} v ${apiFix.teams.away.name} @ ${apiFix.fixture.date} — ${outcome.reason}`,
      );
      continue;
    }

    const dbFix     = outcome.fixture;
    const newStatus = mapStatus(apiFix.fixture.status.short);
    let { homeScore, awayScore } = extractScore(apiFix);

    // Provider occasionally lists a fixture with home/away reversed
    // relative to our seed. Now that identity is certain, a name mismatch
    // means orientation — not a mis-route.
    if (homeScore !== null && awayScore !== null) {
      if (isReversed(apiFix.teams.home.name, teamName.get(dbFix.home_team_id ?? ""))) {
        [homeScore, awayScore] = [awayScore, homeScore];
        console.log(`[ingest:${cfg.slug}:SWAP] fixture ${dbFix.id.slice(0, 8)} — orientation reversed`);
      }
    }

    const newKicksOffAt  = new Date(apiFix.fixture.date).toISOString();
    const statusChanged  = newStatus !== dbFix.status;
    const kickoffChanged = newKicksOffAt !== dbFix.kicks_off_at;
    const scoreChanged =
      (newStatus === "live" || newStatus === "completed") &&
      homeScore !== null && awayScore !== null &&
      (homeScore !== dbFix.home_score || awayScore !== dbFix.away_score);

    if (!statusChanged && !scoreChanged && !kickoffChanged) continue;

    const payload: Record<string, unknown> = {
      status:       newStatus,
      kicks_off_at: newKicksOffAt,
      updated_at:   new Date().toISOString(),
    };

    if (scoreChanged) {
      payload.home_score = homeScore;
      payload.away_score = awayScore;
      console.log(
        `[ingest:${cfg.slug}:SCORE] fixture ${dbFix.id.slice(0, 8)} | ` +
        `provider_id=${apiFix.fixture.id} | api_status=${apiFix.fixture.status.short} | ` +
        `score=${homeScore}-${awayScore} | ${newStatus === "completed" ? "FINAL" : "LIVE"} ` +
        `→ auto_score_predictions will fire`,
      );
    }

    const { error: updErr } = await db.from("fixtures").update(payload).eq("id", dbFix.id);
    if (updErr) {
      console.error(`[ingest:${cfg.slug}:ERROR] update failed for ${dbFix.id}:`, updErr.message);
      continue;
    }

    updated++;
    changes.push(
      `${dbFix.id.slice(0, 8)} | ` +
      (scoreChanged ? `SCORED ${homeScore}-${awayScore}` : `STATUS ${dbFix.status}→${newStatus}`),
    );
  }

  return {
    outcome: {
      slug: cfg.slug, updated, checked: apiFixtures.length,
      unroutable, apiCalls: apiCallsMade, changes,
    },
    quota,
  };
}

// ── One competition — TheSportsDB ─────────────────────────────
// Same gates and routing as the API-Football path, but reading TheSportsDB's
// finished results (free tier). Routes by provider_fixture_id (= idEvent) only.
// No reversal handling: we imported home/away from TheSportsDB, so results
// arrive in the same orientation.

async function ingestThesportsdb(
  db:     SupabaseClient,
  cfg:    CompetitionIngestConfig,
  apiKey: string,
  now:    number,
): Promise<CompetitionOutcome> {
  const key = apiKey || "123";   // public free key
  const windowStart = new Date(now - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd   = new Date(now + 3 * 60 * 60 * 1000).toISOString();
  const SELECT =
    "id, kicks_off_at, home_score, away_score, status, provider_fixture_id, home_team_id, away_team_id";

  const { data: windowFixtures, error: dbErr } = await db
    .from("fixtures").select(SELECT)
    .eq("competition_id", cfg.competitionId)
    .gte("kicks_off_at", windowStart).lte("kicks_off_at", windowEnd)
    .order("kicks_off_at", { ascending: true });
  if (dbErr) return { slug: cfg.slug, error: `DB error: ${dbErr.message}` };

  const { data: stuckLive } = await db
    .from("fixtures").select(SELECT)
    .eq("competition_id", cfg.competitionId)
    .in("status", ["live", "postponed"]).lt("kicks_off_at", windowStart);

  const seen = new Set<string>();
  const dbFixtures = [...(windowFixtures ?? []), ...(stuckLive ?? [])]
    .filter((f) => (seen.has(f.id as string) ? false : (seen.add(f.id as string), true))) as DbFixture[];

  if (dbFixtures.length === 0) {
    return { slug: cfg.slug, skipped: true, reason: "no_fixtures_in_window", apiCalls: 0 };
  }

  const pollReason = getPollReason(dbFixtures, now);
  if (!pollReason) {
    const next = dbFixtures
      .filter((f) => f.status === "scheduled")
      .sort((a, b) => new Date(a.kicks_off_at).getTime() - new Date(b.kicks_off_at).getTime())[0];
    const mins = next ? Math.round((new Date(next.kicks_off_at).getTime() - now) / 60_000) : null;
    return {
      slug: cfg.slug, skipped: true, reason: "no_active_match_window", apiCalls: 0,
      ...(mins !== null ? { changes: [`next kickoff in ${mins}m`] } : {}),
    };
  }

  if (dbFixtures.filter((f) => f.provider_fixture_id).length === 0) {
    return { slug: cfg.slug, skipped: true, reason: "no_provider_ids_backfill_required", apiCalls: 0 };
  }

  // A provider outage (TheSportsDB 503s, network blips) must NOT fail the run —
  // just skip and try again next cron. It's transient, not our bug.
  let results;
  try {
    results = await fetchTsdbResults(key, cfg.providerLeagueId);
  } catch (e) {
    console.warn(`[ingest:${cfg.slug}] provider unavailable: ${e instanceof Error ? e.message : e}`);
    return { slug: cfg.slug, skipped: true, reason: "provider_unavailable", apiCalls: 1 };
  }
  let updated = 0, unroutable = 0;
  const changes: string[] = [];

  for (const r of results) {
    const outcome = matchProviderFixture(r.providerId, dbFixtures);
    if (outcome.kind !== "matched") { unroutable++; continue; }
    const dbFix = outcome.fixture;

    const scoreChanged =
      (r.status === "live" || r.status === "completed") &&
      r.homeScore !== null && r.awayScore !== null &&
      (r.homeScore !== dbFix.home_score || r.awayScore !== dbFix.away_score);
    const statusChanged = r.status !== dbFix.status;
    if (!scoreChanged && !statusChanged) continue;

    const payload: Record<string, unknown> = { status: r.status, updated_at: new Date().toISOString() };
    if (scoreChanged) {
      payload.home_score = r.homeScore;
      payload.away_score = r.awayScore;
      console.log(
        `[ingest:${cfg.slug}:SCORE] ${dbFix.id.slice(0, 8)} | id=${r.providerId} | ` +
        `${r.homeName} ${r.homeScore}-${r.awayScore} ${r.awayName} | ` +
        `${r.status === "completed" ? "FINAL → auto_score_predictions fires" : "LIVE"}`,
      );
    }

    const { error: updErr } = await db.from("fixtures").update(payload).eq("id", dbFix.id);
    if (updErr) { console.error(`[ingest:${cfg.slug}:ERROR] ${dbFix.id}: ${updErr.message}`); continue; }
    updated++;
    changes.push(`${dbFix.id.slice(0, 8)} | ${scoreChanged ? `SCORED ${r.homeScore}-${r.awayScore}` : `STATUS ${dbFix.status}→${r.status}`}`);
  }

  return { slug: cfg.slug, updated, checked: results.length, unroutable, apiCalls: 1, changes };
}

// ── One competition — Jolpica (Formula 1, ordering fixtures) ──
// Jolpica is NOT a live feed: a session's classification appears some time
// after it ends, so the poll gate here differs from the score providers —
// we poll any session that has STARTED but not settled, for up to 48 hours
// after its start, instead of only during a live window. (getPollReason's
// 3-hour horizon would stop polling before a slow classification lands, and
// nothing else would ever restart it — the session never goes 'live'.)
//
// Settlement is atomic in the DB: settle_ordering_fixture(fixture, results)
// writes the classification, flips status and scores predictions in one
// transaction (migration 073). Routing is by constructed provider id
// ("f1-<season>-<round>-<q|r>") only — same no-guessing rule as everywhere.

const JOLPICA_SETTLE_WINDOW_MS = 48 * 60 * 60 * 1000;

async function ingestJolpica(
  db:  SupabaseClient,
  cfg: CompetitionIngestConfig,
  now: number,
): Promise<CompetitionOutcome> {
  const windowStart = new Date(now - JOLPICA_SETTLE_WINDOW_MS).toISOString();
  const nowIso      = new Date(now).toISOString();

  // Sessions that have started and are not settled. Nothing to fetch before
  // a session starts — there is no live data, so no imminent-kickoff poll.
  const { data: pendingData, error: dbErr } = await db
    .from("fixtures")
    .select("id, kicks_off_at, status, provider_fixture_id")
    .eq("competition_id", cfg.competitionId)
    .not("status", "in", "(completed,postponed)")
    .gte("kicks_off_at", windowStart)
    .lte("kicks_off_at", nowIso)
    .order("kicks_off_at", { ascending: true });

  if (dbErr) return { slug: cfg.slug, error: `DB error: ${dbErr.message}` };
  const pending = pendingData ?? [];

  // SETTLED sessions still inside the window stay under correction watch
  // (see below) — so "nothing pending" alone doesn't end the run.
  const { data: settledData, error: settledErr } = await db
    .from("fixtures")
    .select("id, kicks_off_at, status, provider_fixture_id")
    .eq("competition_id", cfg.competitionId)
    .eq("status", "completed")
    .gte("kicks_off_at", windowStart)
    .lte("kicks_off_at", nowIso)
    .order("kicks_off_at", { ascending: true });
  if (settledErr) return { slug: cfg.slug, error: `DB error: ${settledErr.message}` };
  const settledFx = settledData ?? [];

  if (pending.length === 0 && settledFx.length === 0) {
    return { slug: cfg.slug, skipped: true, reason: "no_sessions_in_window", apiCalls: 0 };
  }

  // Driver code → team id, once per run. The registry maps feed driverIds to
  // codes; the DB maps codes to team rows.
  const { data: teamRows, error: teamErr } = await db
    .from("teams")
    .select("id, code")
    .eq("competition_id", cfg.competitionId);
  if (teamErr) return { slug: cfg.slug, error: `DB error: ${teamErr.message}` };
  const teamByCode = new Map((teamRows ?? []).map((t) => [t.code as string, t.id as string]));

  let apiCalls = 0, updated = 0, unroutable = 0, raceSettled = false;
  let season = "";
  const changes: string[] = [];

  for (const f of pending as { id: string; provider_fixture_id: string | null; status: string }[]) {
    const pid = parseF1ProviderId(f.provider_fixture_id);
    if (!pid) {
      unroutable++;
      console.log(`[ingest:${cfg.slug}:UNROUTABLE] fixture ${f.id.slice(0, 8)} has no f1-* provider id`);
      continue;
    }
    season = pid.season;

    let rows: JolpicaClassifiedRow[];
    try {
      rows = pid.session === "q"
        ? await fetchJolpicaQualifying(pid.season, pid.round)
        : await fetchJolpicaRaceResults(pid.season, pid.round);
      apiCalls++;
    } catch (e) {
      // Provider outage is transient — skip, retry next cron (TheSportsDB precedent).
      console.warn(`[ingest:${cfg.slug}] provider unavailable: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    if (!isCompleteClassification(rows)) {
      changes.push(`${f.id.slice(0, 8)} | awaiting classification (${pid.season} r${pid.round} ${pid.session})`);
      continue;
    }

    // Map every classified entrant, or settle nothing: an entrant the
    // registry cannot name means a registry gap (driver swap / substitute)
    // and a wrong board must never settle. Fix lib/f1/drivers2026.ts + add
    // the team row, then this settles on the next cron.
    const results: { team_id: string; position: number; status: string | null }[] = [];
    let unmapped: string | null = null;
    for (const r of rows) {
      const code = F1_JOLPICA_TO_CODE[r.driverId];
      const teamId = code ? teamByCode.get(code) : undefined;
      if (!teamId) { unmapped = r.driverId; break; }
      results.push({ team_id: teamId, position: r.position, status: r.status });
    }
    if (unmapped) {
      console.error(
        `[ingest:${cfg.slug}:ERROR] unmapped entrant "${unmapped}" in ${pid.season} r${pid.round} ` +
        `${pid.session} — add to lib/f1/drivers2026.ts and the teams seed, then re-run. NOT settled.`,
      );
      continue;
    }

    const { data: scored, error: rpcErr } = await db.rpc("settle_ordering_fixture", {
      p_fixture_id: f.id,
      p_results:    results,
    });
    if (rpcErr) {
      console.error(`[ingest:${cfg.slug}:ERROR] settle failed for ${f.id}: ${rpcErr.message}`);
      continue;
    }

    updated++;
    if (pid.session === "r") raceSettled = true;
    changes.push(`${f.id.slice(0, 8)} | SETTLED ${pid.season} r${pid.round} ${pid.session} | ${scored ?? 0} predictions scored`);
    console.log(
      `[ingest:${cfg.slug}:SETTLE] ${f.id.slice(0, 8)} | ${f.provider_fixture_id} | ` +
      `${results.length} classified | ${scored ?? 0} predictions scored`,
    );
  }

  // ── Correction watch ──────────────────────────────────────
  // Stewards can change a classification AFTER we settle (post-race DSQ,
  // a time penalty applied late). For 48h after each session's start,
  // re-fetch the official board for SETTLED sessions and compare it to what
  // we stored; if it moved, re-run the idempotent settlement — results are
  // replaced, predictions rescore, and the IQ ledger reconciles per-
  // prediction deltas (migration 021: a 5pt→0pt correction claws back).
  // Beyond 48h corrections stay manual (docs/F1_LAUNCH_RUNBOOK.md).
  for (const f of settledFx as { id: string; provider_fixture_id: string | null }[]) {
    const pid = parseF1ProviderId(f.provider_fixture_id);
    if (!pid) continue;
    season = season || pid.season;

    let rows: JolpicaClassifiedRow[];
    try {
      rows = pid.session === "q"
        ? await fetchJolpicaQualifying(pid.season, pid.round)
        : await fetchJolpicaRaceResults(pid.season, pid.round);
      apiCalls++;
    } catch (e) {
      console.warn(`[ingest:${cfg.slug}] recheck provider unavailable: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    // A shrunken/incomplete feed response must never "correct" a settled
    // board — same completeness gate as first settlement.
    if (!isCompleteClassification(rows)) continue;

    const results: { team_id: string; position: number; status: string | null }[] = [];
    let unmapped: string | null = null;
    for (const r of rows) {
      const code = F1_JOLPICA_TO_CODE[r.driverId];
      const teamId = code ? teamByCode.get(code) : undefined;
      if (!teamId) { unmapped = r.driverId; break; }
      results.push({ team_id: teamId, position: r.position, status: r.status });
    }
    if (unmapped) {
      console.error(`[ingest:${cfg.slug}:ERROR] recheck unmapped entrant "${unmapped}" — NOT re-settled.`);
      continue;
    }

    const { data: stored, error: storedErr } = await db
      .from("fixture_entrant_results")
      .select("team_id, position")
      .eq("fixture_id", f.id);
    if (storedErr) { console.error(`[ingest:${cfg.slug}:ERROR] recheck read: ${storedErr.message}`); continue; }

    const storedByTeam = new Map((stored ?? []).map((s) => [s.team_id as string, s.position as number]));
    const changed = results.length !== storedByTeam.size
      || results.some((r) => storedByTeam.get(r.team_id) !== r.position);
    if (!changed) continue;

    const { data: rescored, error: rpcErr } = await db.rpc("settle_ordering_fixture", {
      p_fixture_id: f.id,
      p_results:    results,
    });
    if (rpcErr) {
      console.error(`[ingest:${cfg.slug}:ERROR] correction re-settle failed for ${f.id}: ${rpcErr.message}`);
      continue;
    }
    updated++;
    if (pid.session === "r") raceSettled = true;   // standings moved too
    changes.push(`${f.id.slice(0, 8)} | CORRECTED ${pid.season} r${pid.round} ${pid.session} | ${rescored ?? 0} predictions rescored`);
    console.log(
      `[ingest:${cfg.slug}:CORRECTION] ${f.id.slice(0, 8)} | ${f.provider_fixture_id} | ` +
      `official classification changed — re-settled, ${rescored ?? 0} predictions rescored, IQ reconciled`,
    );
  }

  // Championship tables refresh after a race settles (quali doesn't move them).
  if (raceSettled && season) {
    try {
      const [drivers, constructors] = await Promise.all([
        fetchJolpicaDriverStandings(season),
        fetchJolpicaConstructorStandings(season),
      ]);
      apiCalls += 2;
      for (const [scope, table] of [["driver", drivers], ["constructor", constructors]] as const) {
        if (table.rows.length === 0) continue;
        const del = await db.from("competition_standings")
          .delete().eq("competition_id", cfg.competitionId).eq("scope", scope);
        if (del.error) { console.error(`[ingest:${cfg.slug}:ERROR] standings clear: ${del.error.message}`); continue; }
        const ins = await db.from("competition_standings").insert(table.rows.map((r) => ({
          competition_id: cfg.competitionId,
          scope,
          position:      r.position,
          name:          r.name,
          code:          r.code,
          team_id:       r.code ? teamByCode.get(r.code) ?? null : null,
          points:        r.points,
          wins:          r.wins,
          through_round: table.round,
        })));
        if (ins.error) console.error(`[ingest:${cfg.slug}:ERROR] standings insert: ${ins.error.message}`);
        else changes.push(`standings ${scope} refreshed through r${table.round}`);
      }
    } catch (e) {
      console.warn(`[ingest:${cfg.slug}] standings refresh failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  return { slug: cfg.slug, updated, checked: pending.length + settledFx.length, unroutable, apiCalls, changes };
}

// ── Handler ───────────────────────────────────────────────────

async function handler(req: NextRequest): Promise<NextResponse> {
  const CRON_SECRET         = process.env.CRON_SECRET               ?? "";
  const FOOTBALL_API_KEY    = process.env.FOOTBALL_API_KEY          ?? "";
  const THESPORTSDB_API_KEY = process.env.THESPORTSDB_API_KEY       ?? "123"; // free public key
  const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const SUPABASE_SRK        = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  if (auth !== `Bearer ${CRON_SECRET}` && querySecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Supabase is always required; a provider key is only needed by that
  // provider (TheSportsDB defaults to the free public key), so FOOTBALL_API_KEY
  // is not required unless an API-Football competition is active.
  if (!SUPABASE_URL || !SUPABASE_SRK) {
    const missing = [
      !SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !SUPABASE_SRK ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter(Boolean).join(", ");
    return NextResponse.json({ error: `Missing env vars: ${missing}` }, { status: 500 });
  }

  const keys = { apiFootball: FOOTBALL_API_KEY, thesportsdb: THESPORTSDB_API_KEY };

  const startedAt = Date.now();
  const db = createClient(SUPABASE_URL, SUPABASE_SRK);

  // ── CHECK 1: which competitions want ingesting? ─────────────
  const configs = await loadIngestConfigs(db);

  if (configs.length === 0) {
    return NextResponse.json({
      skipped:  true,
      reason:   "no_competitions_with_ingestion_enabled",
      apiCalls: 0,
      duration: Date.now() - startedAt,
    });
  }

  const results: CompetitionOutcome[] = [];
  let totalApiCalls = 0;
  let quota: QuotaMeta = { requestsLimit: null, requestsRemaining: null, requestsUsed: null };

  for (const cfg of configs) {
    try {
      const { outcome, quota: q } = await ingestCompetition(db, cfg, keys, Date.now());
      results.push(outcome);
      totalApiCalls += outcome.apiCalls ?? 0;
      if (q) quota = q;
    } catch (err) {
      // One competition's failure must not stop the others. A rate limit
      // hit on the Premier League should not prevent the Champions League
      // from ingesting its results.
      if (err instanceof RateLimitError) {
        console.warn(`[ingest:${cfg.slug}] rate limited:`, err.message);
        results.push({ slug: cfg.slug, error: "rate_limited" });
        if (err.quota) quota = err.quota;
        break; // shared quota — stop hitting the provider entirely
      }
      if (err instanceof AuthError) {
        console.error(`[ingest:${cfg.slug}] auth error:`, err.message);
        results.push({ slug: cfg.slug, error: `auth_error: ${err.message}` });
        break; // the key is wrong for every competition
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ingest:${cfg.slug}] unexpected error:`, message);
      results.push({ slug: cfg.slug, error: message });
    }
  }

  const totalUpdated    = results.reduce((n, r) => n + (r.updated ?? 0), 0);
  const totalUnroutable = results.reduce((n, r) => n + (r.unroutable ?? 0), 0);
  const failed          = results.filter((r) => r.error);

  console.log(
    `[ingest] complete: ${totalUpdated} updated across ${configs.length} competition(s), ` +
    `${totalUnroutable} unroutable, ${totalApiCalls} API calls | ${Date.now() - startedAt}ms`,
  );

  return NextResponse.json(
    {
      competitions: results,
      totalUpdated,
      totalUnroutable,
      apiCalls: totalApiCalls,
      quota,
      duration: Date.now() - startedAt,
    },
    // 500 only when something genuinely failed, so GitHub Actions marks the
    // run red. A rate limit is expected under load and is not a failure.
    { status: failed.some((r) => r.error !== "rate_limited") ? 500 : 200 },
  );
}

export const GET  = handler;
export const POST = handler;
