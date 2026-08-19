/**
 * POST /api/venues/portal — open the Stripe billing portal for a venue.
 *
 * Auth is the venue's OWNER, not possession of the venue id. The dunning email
 * links to /venues/billing?v=<id>, and a UUID in an email is not an
 * authentication token — anyone forwarded that mail would otherwise reach the
 * customer's card details and invoice history.
 *
 * So: the caller must present a valid Supabase access token whose user is the
 * venue's owner_user_id. The owner account is created during provisioning, and
 * they reach it through the magic link in their welcome email.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe, SITE } from "@/lib/stripe";
import { admin } from "@/lib/venueDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const venueId = String(body.venueId ?? "");
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  // Resolve the caller from their own access token.
  const asUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "invalid session" }, { status: 401 });

  const db = admin();
  const { data: venue } = await db.from("venues")
    .select("id, owner_user_id").eq("id", venueId).maybeSingle();

  // Same response for "no such venue" and "not your venue" — don't confirm
  // that an id exists to someone who doesn't own it.
  if (!venue || venue.owner_user_id !== auth.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data: sub } = await db.from("venue_subscriptions")
    .select("stripe_customer_id").eq("venue_id", venueId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "no subscription on file" }, { status: 404 });
  }

  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${SITE}/v/${venueId}`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e: any) {
    console.error("[venues/portal]", e?.message ?? e);
    return NextResponse.json({ error: "could not open billing portal" }, { status: 500 });
  }
}
