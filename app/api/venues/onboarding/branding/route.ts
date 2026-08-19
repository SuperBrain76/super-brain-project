/**
 * POST /api/venues/onboarding/branding — save the venue's brand.
 *
 * Body: { session_id, primary, ink?, secondary?, website?, instagram?,
 *         facebook?, step? }. Colours are validated as #rrggbb. Only provided
 *         fields change. The logo is uploaded separately (./logo).
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveVenueBySession } from "@/lib/venueSession";
import { logEvent } from "@/lib/venueDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;
const clean = (s: unknown) => { const v = String(s ?? "").trim(); return v.length ? v.slice(0, 300) : null; };

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const r = await resolveVenueBySession(body.session_id);
  if (!r) return NextResponse.json({ error: "session not recognised" }, { status: 403 });

  const patch: Record<string, unknown> = {};

  if (body.primary !== undefined) {
    if (!HEX.test(body.primary)) return NextResponse.json({ error: "primary must be a #rrggbb colour" }, { status: 400 });
    patch.colour_primary = body.primary;
  }
  if (body.ink !== undefined) {
    if (!HEX.test(body.ink)) return NextResponse.json({ error: "ink must be a #rrggbb colour" }, { status: 400 });
    patch.colour_ink = body.ink;
  }
  if (body.secondary !== undefined) {
    if (body.secondary && !HEX.test(body.secondary)) return NextResponse.json({ error: "secondary must be a #rrggbb colour" }, { status: 400 });
    patch.colour_secondary = body.secondary || null;
  }
  if (body.website   !== undefined) patch.website   = clean(body.website);
  if (body.instagram !== undefined) patch.instagram = clean(body.instagram);
  if (body.facebook  !== undefined) patch.facebook  = clean(body.facebook);
  if (body.step)                    patch.onboarding_step = String(body.step).slice(0, 40);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { error } = await r.db.from("venues").update(patch).eq("id", r.venueId);
  if (error) {
    console.error("[onboarding/branding]", error.message);
    return NextResponse.json({ error: "could not save branding" }, { status: 500 });
  }
  await logEvent(r.db, r.venueId, "branding_saved", { fields: Object.keys(patch) });

  return NextResponse.json({ ok: true });
}
