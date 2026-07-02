import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Supabase service role not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = adminSupabase();

  // Verify the token and get user
  const { data: { user }, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete user data from all tables, then delete auth user
  await sb.from("predictions").delete().eq("user_id", user.id);
  await sb.from("league_members").delete().eq("user_id", user.id);
  await sb.from("test_results").delete().eq("user_id", user.id);
  await sb.from("profiles").delete().eq("id", user.id);

  const { error: deleteErr } = await sb.auth.admin.deleteUser(user.id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
