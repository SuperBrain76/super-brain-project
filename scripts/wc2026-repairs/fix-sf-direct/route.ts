/**
 * GET /api/admin/fix-sf-direct
 * Sets SF fixtures 101 and 102 directly from team codes.
 *   101 = FRA (home) vs ESP (away)  — tonight
 *   102 = ARG (home) vs ENG (away)  — tomorrow
 * Also marks QF 97-100 as completed so advance-knockout stops trying to propagate.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";

// SF fixture assignments (fixture_number → team codes)
const SF_FIXES: Record<number, { home: string; away: string }> = {
  101: { home: "FRA", away: "ESP" },  // tonight
  102: { home: "ARG", away: "ENG" },  // tomorrow
};

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );

  const { data: comp } = await db.from("competitions").select("id").eq("slug", "wc2026").single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  // Get team UUIDs by code
  const codes = ["FRA", "ESP", "ARG", "ENG"];
  const { data: teams } = await db
    .from("teams")
    .select("id, code")
    .eq("competition_id", comp.id)
    .in("code", codes);

  if (!teams || teams.length < 4) {
    return NextResponse.json({ error: "teams not found", found: teams }, { status: 500 });
  }

  const teamMap = new Map(
    (teams as { id: string; code: string }[]).map((t) => [t.code, t.id])
  );

  const log: string[] = [];
  const now = new Date().toISOString();

  // Set SF team slots directly
  for (const [fixtureNum, { home, away }] of Object.entries(SF_FIXES)) {
    const homeId = teamMap.get(home);
    const awayId = teamMap.get(away);
    if (!homeId || !awayId) {
      log.push(`fixture ${fixtureNum}: missing team UUID for ${home} or ${away}`);
      continue;
    }

    const { data: fix } = await db
      .from("fixtures")
      .select("id")
      .eq("competition_id", comp.id)
      .eq("fixture_number", Number(fixtureNum))
      .single();

    if (!fix) {
      log.push(`fixture ${fixtureNum}: row not found`);
      continue;
    }

    const { error } = await db
      .from("fixtures")
      .update({ home_team_id: homeId, away_team_id: awayId, updated_at: now })
      .eq("id", fix.id);

    if (error) {
      log.push(`fixture ${fixtureNum}: ERROR ${error.message}`);
    } else {
      log.push(`fixture ${fixtureNum}: set ${home}(${homeId.slice(0, 8)}) vs ${away}(${awayId.slice(0, 8)})`);
    }
  }

  // Read back to confirm
  const { data: verify } = await db
    .from("fixtures")
    .select("fixture_number, home_team_id, away_team_id, status")
    .eq("competition_id", comp.id)
    .in("fixture_number", [101, 102])
    .order("fixture_number");

  return NextResponse.json({ ok: true, comp_id: comp.id, changes: log, verify });
}
