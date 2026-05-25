import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

// Service-role client — never exposed to the browser, lives only in this server route
function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Supabase service role not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getCallerEmail(req: NextRequest): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const sb = adminSupabase();
  const { data } = await sb.auth.getUser(token);
  return data.user?.email ?? null;
}

// GET /api/admin/results?test=...&search=...&page=...
export async function GET(req: NextRequest) {
  const email = await getCallerEmail(req);
  if (!email || email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const test   = searchParams.get("test")   ?? "";
  const search = searchParams.get("search") ?? "";
  const page   = parseInt(searchParams.get("page") ?? "1");
  const limit  = 50;
  const from   = (page - 1) * limit;

  const sb = adminSupabase();
  let q = sb
    .from("test_results")
    .select("id, user_id, test_name, score, result_title, created_at, share_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (test)   q = q.eq("test_name", test);
  if (search) q = q.ilike("display_name", `%${search}%`);

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data ?? [], total: count ?? 0 });
}

// DELETE /api/admin/results  body: { ids: string[] }
export async function DELETE(req: NextRequest) {
  const email = await getCallerEmail(req);
  if (!email || email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }

  const sb = adminSupabase();
  const { error } = await sb.from("test_results").delete().in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: ids.length });
}
