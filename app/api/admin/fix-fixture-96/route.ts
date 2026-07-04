/**
 * GET /api/admin/fix-fixture-96
 * One-shot fix: sets fixture 96 home team to Argentina (UUID known from bracket-status).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";

// Argentina's UUID confirmed from /api/admin/bracket-status (fixture 86 home)
const ARGENTINA_ID = "3ff65f4e-e893-4f23-b001-06bf3bcba5ab";

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );

  const { data: comp } = await db.from("competitions").select("id").eq("slug", "wc2026").single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  const { data: before } = await db
    .from("fixtures")
    .select("id, fixture_number, home_team_id")
    .eq("competition_id", comp.id)
    .eq("fixture_number", 96)
    .single();

  if (!before) return NextResponse.json({ error: "fixture 96 not found" }, { status: 404 });

  const { error } = await db
    .from("fixtures")
    .update({ home_team_id: ARGENTINA_ID, updated_at: new Date().toISOString() })
    .eq("id", before.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: after } = await db
    .from("fixtures")
    .select("home_team_id")
    .eq("id", before.id)
    .single();

  return NextResponse.json({
    ok: true,
    fixture_id: before.id,
    before: before.home_team_id,
    after: after?.home_team_id,
    set_to_argentina: after?.home_team_id === ARGENTINA_ID,
  });
}
