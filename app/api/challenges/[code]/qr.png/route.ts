/**
 * GET /api/challenges/<code>/qr.png — the QR a venue prints for a Matchday
 * Challenge. Encodes /c/<code> (the customer page). Rendered on demand.
 */

import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { SITE } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const size = Math.min(1200, Math.max(240, Number(req.nextUrl.searchParams.get("size")) || 512));
  const url  = `${SITE}/c/${encodeURIComponent(params.code.toUpperCase())}`;

  const png = await QRCode.toBuffer(url, {
    type: "png", width: size, margin: 1, errorCorrectionLevel: "M",
    color: { dark: "#0B0B0D", light: "#FFFFFF" },
  });

  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
