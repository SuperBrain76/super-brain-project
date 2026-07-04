/**
 * GET /api/admin/fix-fixture-96
 * Swaps home teams between fixtures 95 and 96.
 * Fixture 95 should be ARG vs EGY, fixture 96 should be SUI vs COL.
 * The PROPAGATION map had them swapped — this corrects the DB directly.
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
    .select("id, fixture_number, home_team_id")
    .eq("competition_id", comp.id)
    .in("fixture_number", [95, 96]);

  if (!fixtures || fixtures.length !== 2) {
    return NextResponse.json({ error: "could not find both fixtures 95 and 96" }, { status: 500 });
  }

  const f95 = fixtures.find((f: { fixture_number: number }) => f.fixture_number === 95);
  const f96 = fixtures.find((f: { fixture_number: number }) => f.fixture_number === 96);

  if (!f95 || !f96) return NextResponse.json({ error: "fixture lookup failed" }, { status: 500 });

  // Swap home teams
  const [err1, err2] = await Promise.all([
    db.from("fixtures").update({ home_team_id: f96.home_team_id, updated_at: new Date().toISOString() }).eq("id", f95.id),
    db.from("fixtures").update({ home_team_id: f95.home_team_id, updated_at: new Date().toISOString() }).eq("id", f96.id),
  ]).then(([r1, r2]) => [r1.error, r2.error]);

  if (err1 || err2) {
    return NextResponse.json({ error: err1?.message ?? err2?.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    fixture_95: { was: f95.home_team_id, now: f96.home_team_id },
    fixture_96: { was: f96.home_team_id, now: f95.home_team_id },
    result: "fixture 95 = ARG vs EGY, fixture 96 = SUI vs COL",
  });
}
