/**
 * GET /api/admin/fix-fixture-96
 * Swaps home+away teams between two fixtures whose teams were propagated
 * in the wrong slots. Currently fixes fixtures 98 and 99 (QF swap).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );

  const { data: comp } = await db.from("competitions").select("id").eq("slug", "wc2026").single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  const { data: fixtures } = await db
    .from("fixtures")
    .select("id, fixture_number, home_team_id, away_team_id")
    .eq("competition_id", comp.id)
    .in("fixture_number", [98, 99]);

  if (!fixtures || fixtures.length !== 2) {
    return NextResponse.json({ error: "could not find fixtures 98 and 99" }, { status: 500 });
  }

  const f98 = fixtures.find((f: { fixture_number: number }) => f.fixture_number === 98);
  const f99 = fixtures.find((f: { fixture_number: number }) => f.fixture_number === 99);
  if (!f98 || !f99) return NextResponse.json({ error: "fixture lookup failed" }, { status: 500 });

  // Swap both home and away teams between fixtures 98 and 99
  const now = new Date().toISOString();
  const [r1, r2] = await Promise.all([
    db.from("fixtures").update({ home_team_id: f99.home_team_id, away_team_id: f99.away_team_id, updated_at: now }).eq("id", f98.id),
    db.from("fixtures").update({ home_team_id: f98.home_team_id, away_team_id: f98.away_team_id, updated_at: now }).eq("id", f99.id),
  ]);

  if (r1.error || r2.error) {
    return NextResponse.json({ error: r1.error?.message ?? r2.error?.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    fixture_98: { was: `${f98.home_team_id}/${f98.away_team_id}`, now: `${f99.home_team_id}/${f99.away_team_id}` },
    fixture_99: { was: `${f99.home_team_id}/${f99.away_team_id}`, now: `${f98.home_team_id}/${f98.away_team_id}` },
    result: "fixture 98 = ESP vs BEL, fixture 99 = NOR vs ENG",
  });
}
