/**
 * POST /api/venues/onboarding/logo — upload the venue's logo (multipart).
 *
 * Fields: session_id, file. The service role writes to the public `venue-logos`
 * bucket (migration 065) under the venue's id, then stores the public URL on
 * the venue so every artboard picks it up. Logo upload is REQUIRED before the
 * wizard generates assets, which is why this is its own first-class step.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveVenueBySession } from "@/lib/venueSession";
import { logEvent } from "@/lib/venueDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg",
};

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: "expected multipart form-data" }, { status: 400 }); }

  const r = await resolveVenueBySession(String(form.get("session_id") ?? ""));
  if (!r) return NextResponse.json({ error: "session not recognised" }, { status: 403 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!OK_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Please upload a PNG, JPG, WEBP or SVG." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "That logo is too large (max 8 MB)." }, { status: 400 });
  }

  const path = `${r.venueId}/logo-${Date.now()}.${EXT[file.type]}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await r.db.storage
    .from("venue-logos")
    .upload(path, bytes, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (upErr) {
    console.error("[onboarding/logo]", upErr.message);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }

  const { data: pub } = r.db.storage.from("venue-logos").getPublicUrl(path);
  await r.db.from("venues").update({ logo_url: pub.publicUrl }).eq("id", r.venueId);
  await logEvent(r.db, r.venueId, "branding_logo_uploaded", { path });

  return NextResponse.json({ url: pub.publicUrl });
}
