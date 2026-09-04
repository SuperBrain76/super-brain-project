/**
 * POST /api/venues/track — top-of-funnel web beacon.
 *
 * Body: { v: "<venue uuid = lead_id>", event: "landing_viewed" | ..., detail? }
 *
 * Fired from the marketing landing + signup pages (see lib/leadTrack.ts) so the
 * founder funnel can see the steps that happen BEFORE a Stripe/webhook event:
 * landing viewed → start clicked → signup started. The lead_id is the `?v=`
 * param an outreach link carries (= venues.id), so every web event attributes
 * back to the exact venue we emailed.
 *
 * Public + unauthenticated by necessity (a cold prospect fires it), so it is
 * deliberately narrow: only the three web kinds are accepted, only for a venue
 * row that already exists, and it never reflects anything back.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/venueDb";
import { emit, EVENT } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set<string>([
  EVENT.LANDING_VIEWED,
  EVENT.START_CLICKED,
  EVENT.SIGNUP_STARTED,
  EVENT.PLAYER_JOINED,
]);

/**
 * Kinds logged only the FIRST time per venue.
 *
 * This endpoint is necessarily public and unauthenticated — a cold prospect and
 * a bar's customer both fire it before they have any credential. For a funnel
 * milestone that is fine, but an unbounded per-join write would let anyone
 * inflate a venue's activity. First-only caps the blast radius at one bogus row
 * per venue, the same trade-off /j/[slug] already makes for qr_scanned.
 *
 * Consequence to remember: `player_joined` in venue_events answers "did anyone
 * ever join?", NOT "how many joined". Player COUNTS come from
 * prediction_league_members and from PostHog's venue_player_joined.
 */
const FIRST_ONLY = new Set<string>([EVENT.PLAYER_JOINED]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const venueId = String(body.v ?? "").trim();
  const event   = String(body.event ?? "").trim();

  // No lead id (someone reached the page without an outreach link) → silently
  // accept and drop; there is nothing to attribute.
  if (!venueId || !UUID.test(venueId)) return new NextResponse(null, { status: 204 });
  if (!ALLOWED.has(event))             return NextResponse.json({ error: "unknown event" }, { status: 400 });

  const db = admin();

  // The lead must be a real venue row (an outreach prospect or a signup).
  const { data: venue } = await db.from("venues").select("id").eq("id", venueId).maybeSingle();
  if (!venue) return new NextResponse(null, { status: 204 });

  const detail = (body.detail && typeof body.detail === "object")
    ? { ...body.detail, path: String(body.path ?? "").slice(0, 200) }
    : { path: String(body.path ?? "").slice(0, 200) };

  if (FIRST_ONLY.has(event)) {
    const { data: seen } = await db.from("venue_events")
      .select("id").eq("venue_id", venueId).eq("kind", event).limit(1).maybeSingle();
    if (seen) return new NextResponse(null, { status: 204 });
  }

  await emit(db, event as any, { venueId, source: "web", detail });

  return new NextResponse(null, { status: 204 });
}
