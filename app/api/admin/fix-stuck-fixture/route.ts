/**
 * GET /api/admin/fix-stuck-fixture?date=YYYY-MM-DD[&force=true]
 *
 * Fetches WC2026 results for a given date from API-Football and updates
 * any fixtures that are stuck or have wrong scores.
 *
 * Matches DB fixtures to API fixtures by team name, not just kickoff time,
 * so simultaneous group-stage matches are never swapped.
 *
 * ?force=true  — also re-syncs completed fixtures (catches swapped scores)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchFixturesByDate, mapStatus, extractScore } from "@/lib/ingestion";

export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest) {
  const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY ?? "";
  const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!FOOTBALL_API_KEY || !SUPABASE_URL || !SUPABASE_SRK) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam ?? (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const force = req.nextUrl.searchParams.get("force") === "true";

  const db = createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { persistSession: false } });

  // Load DB fixtures with team IDs so we can match by name
  const cutoff = new Date(Date.now() - 90 * 60 * 1000).toISOString(); // kicked off 90min+ ago
  const statusFilter = force
    ? ["live", "scheduled", "completed"]
    : ["live", "scheduled"];

  const { data: dbRows, error: dbErr } = await db
    .from("fixtures")
    .select("id, kicks_off_at, home_score, away_score, status, home_team_id, away_team_id")
    .in("status", statusFilter)
    .lt("kicks_off_at", cutoff);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  if (!dbRows || dbRows.length === 0) {
    return NextResponse.json({ message: "No fixtures to fix", updated: 0 });
  }

  // Load team names for all referenced teams
  const teamIds = [...new Set([
    ...dbRows.map((f) => f.home_team_id as string),
    ...dbRows.map((f) => f.away_team_id as string),
  ])];
  const { data: teamsData } = await db.from("teams").select("id, name").in("id", teamIds);
  const teamName = new Map((teamsData ?? []).map((t) => [t.id as string, t.name as string]));

  // Fetch API-Football results for this date
  const { fixtures: apiFixtures, apiCallsMade, quota } = await fetchFixturesByDate(FOOTBALL_API_KEY, date);
  if (apiFixtures.length === 0) {
    return NextResponse.json({ message: `No API fixtures for ${date}`, apiCallsMade, quota });
  }

  let updated = 0;
  const changes: string[] = [];
  const claimedDbIds = new Set<string>();

  for (const apiFix of apiFixtures) {
    const apiMs       = new Date(apiFix.fixture.date).getTime();
    const apiHomeName = normalizeName(apiFix.teams.home.name);
    const apiAwayName = normalizeName(apiFix.teams.away.name);

    // Match by team name first (exact), fall back to time-only for unambiguous windows
    const available = dbRows.filter((f) => !claimedDbIds.has(f.id as string));

    let dbFix = available.find((f) => {
      const dbMs   = new Date(f.kicks_off_at as string).getTime();
      const inWindow = Math.abs(dbMs - apiMs) <= 90 * 60 * 1000;
      if (!inWindow) return false;
      const home = normalizeName(teamName.get(f.home_team_id as string) ?? "");
      const away = normalizeName(teamName.get(f.away_team_id as string) ?? "");
      return (home === apiHomeName || away === apiAwayName);
    });

    // Fallback: time-only match when team names aren't in our DB
    if (!dbFix) {
      dbFix = available.find((f) => {
        const dbMs = new Date(f.kicks_off_at as string).getTime();
        return Math.abs(dbMs - apiMs) <= 90 * 60 * 1000;
      });
    }

    if (!dbFix) continue;
    claimedDbIds.add(dbFix.id as string);

    const newStatus               = mapStatus(apiFix.fixture.status.short);
    const { homeScore, awayScore } = extractScore(apiFix);

    // In force mode update live scores too (fixes swapped live scores)
    if (!force && newStatus === "live") continue;

    const updatePayload: Record<string, unknown> = {
      status:       newStatus,
      kicks_off_at: new Date(apiFix.fixture.date).toISOString(),
      updated_at:   new Date().toISOString(),
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
      console.error(`[fix-stuck] failed ${dbFix.id}:`, updateErr.message);
      continue;
    }

    updated++;
    const label = `${(dbFix.id as string).slice(0, 8)} ${teamName.get(dbFix.home_team_id as string) ?? "?"} vs ${teamName.get(dbFix.away_team_id as string) ?? "?"} → ${newStatus} ${homeScore ?? "?"}-${awayScore ?? "?"}`;
    changes.push(label);
  }

  return NextResponse.json({ date, updated, changes, apiCallsMade });
}
