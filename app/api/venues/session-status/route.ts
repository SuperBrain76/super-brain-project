/**
 * GET /api/venues/session-status?session_id=cs_...
 *
 * The post-checkout page polls this. Stripe redirects the browser back the
 * instant payment succeeds, but the webhook that actually builds the league is
 * a separate delivery — so for a second or two after landing, the venue exists
 * in Stripe and not yet in our database. This endpoint answers "is it built
 * yet?" without the page having to guess.
 *
 * Returns { ready: false } while provisioning is pending, and the venue's
 * slug, invite code and poster URL once the webhook has run.
 *
 * Reads only from the Stripe session the caller already holds the id for, and
 * returns nothing about the venue beyond what its own owner just bought.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripe, SITE } from "@/lib/stripe";
import { admin } from "@/lib/venueDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  let email: string | null = null;
  let venueIdFromMeta: string | null = null;

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "unpaid" && session.status !== "complete") {
      return NextResponse.json({ ready: false, stage: "awaiting_payment" });
    }
    email = session.customer_details?.email ?? session.customer_email ?? null;
    venueIdFromMeta = (session.metadata ?? {}).venue_id || null;
  } catch {
    return NextResponse.json({ error: "unknown session" }, { status: 404 });
  }

  const db = admin();

  let venue: any = null;
  if (venueIdFromMeta) {
    const { data } = await db.from("venues")
      .select("id, slug, name, status").eq("id", venueIdFromMeta).maybeSingle();
    venue = data;
  }
  if (!venue && email) {
    const { data } = await db.from("venues")
      .select("id, slug, name, status").ilike("contact_email", email).maybeSingle();
    venue = data;
  }
  if (!venue?.slug) {
    return NextResponse.json({ ready: false, stage: "provisioning" });
  }

  const { data: league } = await db.from("prediction_leagues")
    .select("invite_code, name, competition:competitions(slug)")
    .eq("venue_id", venue.id).limit(1).maybeSingle();

  if (!league) return NextResponse.json({ ready: false, stage: "provisioning" });

  const compSlug = (league.competition as any)?.slug ?? "premier-league";

  return NextResponse.json({
    ready: true,
    venue_name:  venue.name,
    venue_slug:  venue.slug,
    league_name: league.name,
    invite_code: league.invite_code,
    join_url:    `${SITE}/${compSlug}/leagues/join?code=${league.invite_code}`,
    poster_url:  `${SITE}/venues/${venue.slug}/poster`,
    dashboard_url: `${SITE}/v/${venue.slug}`,
    qr_url:      `${SITE}/api/venues/${venue.slug}/qr.png?size=400`,
  });
}
