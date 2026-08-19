/**
 * POST /api/venues/onboarding/complete — the owner finished the setup wizard.
 * Body: { session_id }. Stamps onboarded_at so we know the venue reached "live".
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveVenueBySession } from "@/lib/venueSession";
import { logEvent } from "@/lib/venueDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const r = await resolveVenueBySession(body.session_id);
  if (!r) return NextResponse.json({ error: "session not recognised" }, { status: 403 });

  await r.db.from("venues")
    .update({ onboarding_step: "launch", onboarded_at: new Date().toISOString() })
    .eq("id", r.venueId);
  await logEvent(r.db, r.venueId, "onboarding_completed", {});

  return NextResponse.json({ ok: true });
}
