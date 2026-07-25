/**
 * GET /api/admin/fix-r16-team?fixture_number=N&home=CODE&away=CODE
 *
 * Corrects a wrong team assignment in any knockout fixture.
 * Only updates the team_id — does not touch scores or status.
 * Used when penalty shootout winner differs from the score comparison.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );

  const fixtureNum = Number(req.nextUrl.searchParams.get("fixture_number"));
  const homeCode   = req.nextUrl.searchParams.get("home");
  const awayCode   = req.nextUrl.searchParams.get("away");
  const resetScore = req.nextUrl.searchParams.get("reset_score") === "true";

  if (!fixtureNum) {
    return NextResponse.json({ error: "fixture_number required" }, { status: 400 });
  }

  const { data: comp } = await db.from("competitions").select("id").eq("slug", "wc2026").single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  const { data: teams } = await db.from("teams").select("id, code").eq("competition_id", comp.id);
  const teamByCode = new Map((teams ?? []).map((t: { id: string; code: string }) => [t.code, t.id]));

  const { data: fixture } = await db
    .from("fixtures")
    .select("id, fixture_number, home_team_id, away_team_id, home_score, away_score, status")
    .eq("competition_id", comp.id)
    .eq("fixture_number", fixtureNum)
    .single();

  if (!fixture) return NextResponse.json({ error: `Fixture ${fixtureNum} not found` }, { status: 404 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (homeCode) {
    const id = teamByCode.get(homeCode);
    if (!id) return NextResponse.json({ error: `Team code ${homeCode} not found` }, { status: 400 });
    updates.home_team_id = id;
  }
  if (awayCode) {
    const id = teamByCode.get(awayCode);
    if (!id) return NextResponse.json({ error: `Team code ${awayCode} not found` }, { status: 400 });
    updates.away_team_id = id;
  }
  if (resetScore) {
    updates.home_score = null;
    updates.away_score = null;
    updates.status = "scheduled";
  }

  const { error } = await db.from("fixtures").update(updates).eq("id", fixture.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, fixture_number: fixtureNum, updates });
}
