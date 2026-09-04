/**
 * GET /j/<slug> — the target the venue's QR code points to.
 *
 * A physical QR is scanned in the real world, so this is the ONLY reliable
 * "someone scanned the poster" signal (the qr.png image is edge-cached and the
 * join page is shared by every competition). It logs the FIRST scan for the
 * venue, then 302-redirects to the real league join page — invisible to the
 * customer, one hop.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/venueDb";
import { emit, EVENT } from "@/lib/events";
import { SITE } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const db = admin();

  const { data: venue } = await db
    .from("venues").select("id").eq("slug", params.slug).maybeSingle();
  if (!venue) return NextResponse.redirect(`${SITE}/venues`, 302);

  const { data: league } = await db
    .from("prediction_leagues")
    .select("invite_code, competition:competitions(slug)")
    .eq("venue_id", venue.id).limit(1).maybeSingle();
  if (!league) return NextResponse.redirect(`${SITE}/venues`, 302);

  const compSlug = (league.competition as any)?.slug ?? "premier-league";
  // src=qr survives into the join page so venue_player_joined can record HOW the
  // player arrived. Without it a poster scan is indistinguishable from someone
  // pasting the same invite link, and the QR — the venue's main channel — cannot
  // be measured.
  const joinUrl  = `${SITE}/${compSlug}/leagues/join?code=${league.invite_code}&src=qr`;

  // Log only the FIRST scan for this venue (the funnel milestone).
  try {
    const { data: seen } = await db.from("venue_events")
      .select("id").eq("venue_id", venue.id).eq("kind", "qr_scanned").limit(1).maybeSingle();
    if (!seen) await emit(db, EVENT.QR_SCANNED, { venueId: venue.id, detail: { slug: params.slug } });
  } catch { /* never block the redirect */ }

  return NextResponse.redirect(joinUrl, 302);
}
