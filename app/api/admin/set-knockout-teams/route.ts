/**
 * GET /api/admin/set-knockout-teams
 *
 * Directly sets home/away team IDs on knockout fixtures by team code.
 * Used to apply the confirmed R32 pairings from the official FIFA bracket.
 *
 * No auth required — read-only unless ?apply=true.
 * ?apply=true  — writes to DB (no auth needed for one-time setup)
 * ?apply=true&reset=true — clears all knockout team_ids first, then applies
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

// ── CONFIRMED R32 PAIRINGS (from official FIFA bracket + real results) ─────
// fixture_number → [home_code, away_code | null for TBD]
// Source: official match schedule cross-referenced with confirmed group results
// Kickoff times verified against fixture seeds (UTC → UAE UTC+4)

const CONFIRMED_PAIRINGS: Record<number, [string | null, string | null]> = {
  73: ["RSA", "CAN"],   // South Africa vs Canada       — Jun 28 23:00 UAE
  74: ["GER", "PAR"],   // Germany vs Paraguay           — Jun 30 00:30 UAE
  75: ["NED", "MAR"],   // Netherlands vs Morocco        — Jun 30 05:00 UAE
  76: ["BRA", "JPN"],   // Brazil vs Japan               — Jun 29 21:00 UAE
  77: ["FRA", "SWE"],   // France vs Sweden              — Jul 01 01:00 UAE
  78: ["CIV", "NOR"],   // Côte d'Ivoire vs Norway       — Jun 30 21:00 UAE
  79: ["MEX", null],    // Mexico vs TBD                 — Jul 01 05:00 UAE
  // 80: TBD vs TBD     — Jul 01 20:00 UAE
  81: ["USA", "BIH"],   // USA vs Bosnia and Herzegovina — Jul 02 04:00 UAE
  82: ["BEL", null],    // Belgium vs TBD                — Jul 02 00:00 UAE
  // 83: TBD vs TBD     — Jul 03 03:00 UAE
  84: ["ESP", null],    // Spain vs TBD                  — Jul 02 23:00 UAE
  85: ["SUI", null],    // Switzerland vs TBD            — Jul 03 07:00 UAE
  86: ["ARG", "CPV"],   // Argentina vs Cabo Verde       — Jul 04 02:00 UAE
  87: [null, null],     // TBD vs TBD                    — Jul 04 05:30 UAE
  88: ["AUS", "EGY"],   // Australia vs Egypt            — Jul 03 22:00 UAE
};

export async function GET(req: NextRequest) {
  const supabase = db();
  const apply = req.nextUrl.searchParams.get("apply") === "true";
  const reset = req.nextUrl.searchParams.get("reset") === "true";
  const log: string[] = [];

  const { data: comp } = await supabase
    .from("competitions")
    .select("id")
    .eq("slug", "wc2026")
    .single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  // Build team code → id map
  const { data: teams } = await supabase
    .from("teams")
    .select("id, code, name")
    .eq("competition_id", comp.id);
  if (!teams) return NextResponse.json({ error: "teams not found" }, { status: 500 });

  const teamByCode = new Map((teams as { id: string; code: string; name: string }[])
    .map((t) => [t.code, t]));

  // Load current knockout fixtures
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, fixture_number, home_team_id, away_team_id")
    .eq("competition_id", comp.id)
    .neq("stage", "group")
    .order("fixture_number");
  if (!fixtures) return NextResponse.json({ error: "fixtures not found" }, { status: 500 });

  const fixtureById = new Map((fixtures as { id: string; fixture_number: number; home_team_id: string | null; away_team_id: string | null }[])
    .map((f) => [f.fixture_number, f]));

  if (apply && reset) {
    await supabase
      .from("fixtures")
      .update({ home_team_id: null, away_team_id: null })
      .eq("competition_id", comp.id)
      .neq("stage", "group");
    // Clear local cache too
    for (const f of fixtures as { id: string; fixture_number: number; home_team_id: string | null; away_team_id: string | null }[]) {
      f.home_team_id = null;
      f.away_team_id = null;
    }
    log.push("reset: cleared all knockout team_ids");
  }

  for (const [fixtureNum, [homeCode, awayCode]] of Object.entries(CONFIRMED_PAIRINGS).map(
    ([k, v]) => [Number(k), v] as [number, [string | null, string | null]]
  )) {
    const fixture = fixtureById.get(fixtureNum);
    if (!fixture) {
      log.push(`fixture ${fixtureNum}: NOT FOUND in DB`);
      continue;
    }

    const updates: Partial<{ home_team_id: string | null; away_team_id: string | null }> = {};

    if (homeCode) {
      const team = teamByCode.get(homeCode);
      if (!team) {
        log.push(`fixture ${fixtureNum} home: team code ${homeCode} not found`);
      } else if (!fixture.home_team_id || reset) {
        updates.home_team_id = team.id;
        log.push(`fixture ${fixtureNum} home → ${homeCode} (${team.name})`);
      } else {
        log.push(`fixture ${fixtureNum} home: already set (${homeCode})`);
      }
    }

    if (awayCode) {
      const team = teamByCode.get(awayCode);
      if (!team) {
        log.push(`fixture ${fixtureNum} away: team code ${awayCode} not found`);
      } else if (!fixture.away_team_id || reset) {
        updates.away_team_id = team.id;
        log.push(`fixture ${fixtureNum} away → ${awayCode} (${team.name})`);
      } else {
        log.push(`fixture ${fixtureNum} away: already set (${awayCode})`);
      }
    }

    if (apply && Object.keys(updates).length > 0) {
      await supabase.from("fixtures").update(updates).eq("id", fixture.id);
    }
  }

  return NextResponse.json({
    ok: true,
    applied: apply,
    changes: log,
    note: apply ? "DB updated" : "dry run — add ?apply=true to write",
  });
}
