/**
 * GET /api/admin/set-fixture-result?fixture_number=N&home=X&away=Y&status=completed
 *
 * Manually sets the score and status for a fixture by fixture_number.
 * Use when API-Football matching fails and result is known.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPABASE_URL || !SUPABASE_SRK) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const fixtureNum = Number(req.nextUrl.searchParams.get("fixture_number"));
  const homeScore  = Number(req.nextUrl.searchParams.get("home"));
  const awayScore  = Number(req.nextUrl.searchParams.get("away"));
  const status     = req.nextUrl.searchParams.get("status") ?? "completed";

  if (!fixtureNum || isNaN(homeScore) || isNaN(awayScore)) {
    return NextResponse.json(
      { error: "Required: fixture_number, home, away" },
      { status: 400 },
    );
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SRK, { auth: { persistSession: false } });

  const { data: comp } = await db
    .from("competitions")
    .select("id")
    .eq("slug", "wc2026")
    .single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  const { data: fixture, error: fetchErr } = await db
    .from("fixtures")
    .select("id, fixture_number, home_team_id, away_team_id, home_score, away_score, status")
    .eq("competition_id", comp.id)
    .eq("fixture_number", fixtureNum)
    .single();

  if (fetchErr || !fixture) {
    return NextResponse.json({ error: `Fixture ${fixtureNum} not found` }, { status: 404 });
  }

  const { error: updateErr } = await db
    .from("fixtures")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fixture.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    fixture_number: fixtureNum,
    home_score: homeScore,
    away_score: awayScore,
    status,
    previous: {
      home_score: fixture.home_score,
      away_score: fixture.away_score,
      status: fixture.status,
    },
  });
}
