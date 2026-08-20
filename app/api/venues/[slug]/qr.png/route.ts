/**
 * GET /api/venues/<slug>/qr.png — the QR code a customer scans on the table.
 *
 * Rendered on demand rather than stored: the invite code lives on the league
 * row, so the image is always correct even if the league is rebuilt, and
 * there is no storage bucket to keep in sync. Cached hard at the edge because
 * a venue's invite code does not change.
 *
 * ?size=  240–1200 px (default 512). Posters use a large size, email uses 320.
 */

import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { admin } from "@/lib/venueDb";
import { SITE } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const size = Math.min(1200, Math.max(240, Number(req.nextUrl.searchParams.get("size")) || 512));

  const db = admin();
  const { data: venue } = await db
    .from("venues").select("id, colour_ink").eq("slug", params.slug).maybeSingle();
  if (!venue) return new Response("Not found", { status: 404 });

  const { data: league } = await db
    .from("prediction_leagues")
    .select("invite_code, competition:competitions(slug)")
    .eq("venue_id", venue.id)
    .limit(1)
    .maybeSingle();
  if (!league) return new Response("No league", { status: 404 });

  // Encode the scan-tracking hop (/j/<slug>) rather than the join URL directly,
  // so a physical scan is observable (see app/j/[slug]/route.ts). It 302s to the
  // real join page, so the customer experience is unchanged.
  const scanUrl = `${SITE}/j/${params.slug}`;

  const png = await QRCode.toBuffer(scanUrl, {
    type: "png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",   // survives a beer ring on a table card
    color: { dark: venue.colour_ink || "#12100E", light: "#FFFFFF" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
