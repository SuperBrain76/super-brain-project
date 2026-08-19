/**
 * GET /api/venues/onboarding/state?session_id=cs_... — drive the setup wizard.
 *
 * Returns the venue's current brand, its live leagues, the full competition
 * list (all included in one subscription) and where the wizard left off, so
 * the client can render the right step without holding an auth session.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveVenueBySession } from "@/lib/venueSession";
import { SITE } from "@/lib/stripe";
import { ASSET_KINDS } from "@/lib/venueAssets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const r = await resolveVenueBySession(req.nextUrl.searchParams.get("session_id"));
  if (!r) return NextResponse.json({ ready: false }, { status: 202 });

  const { data: v } = await r.db
    .from("venues")
    .select("slug, name, city, language, logo_url, colour_primary, colour_ink, colour_secondary, website, instagram, facebook, staff_emails, onboarding_step, onboarded_at")
    .eq("id", r.venueId).maybeSingle();
  if (!v) return NextResponse.json({ ready: false }, { status: 202 });

  const { data: leagues } = await r.db
    .from("prediction_leagues")
    .select("invite_code, name, competition:competitions(slug, name)")
    .eq("venue_id", r.venueId);

  const haveSlugs = new Set((leagues ?? []).map((l: any) => l.competition?.slug));

  const { data: comps } = await r.db
    .from("competitions").select("slug, name, sport_code").eq("status", "active").order("name");

  return NextResponse.json({
    ready: true,
    venue: {
      slug: v.slug, name: v.name, city: v.city, language: v.language,
      logoUrl: v.logo_url, primary: v.colour_primary, ink: v.colour_ink,
      secondary: v.colour_secondary, website: v.website,
      instagram: v.instagram, facebook: v.facebook,
      staffEmails: v.staff_emails ?? [], onboardingStep: v.onboarding_step,
      onboardedAt: v.onboarded_at,
    },
    leagues: (leagues ?? []).map((l: any) => ({
      slug: l.competition?.slug, competition: l.competition?.name,
      name: l.name, inviteCode: l.invite_code,
    })),
    competitions: (comps ?? []).map((c: any) => ({
      slug: c.slug, name: c.name, sport: c.sport_code, hasLeague: haveSlugs.has(c.slug),
    })),
    assetKinds: ASSET_KINDS.map((a) => ({ kind: a.kind, label: a.label, hint: a.hint, printable: a.printable })),
    urls: {
      launchPack: `${SITE}/venues/${v.slug}/launch-pack`,
      dashboard:  `${SITE}/v/${v.slug}`,
      assetBase:  `${SITE}/venues/${v.slug}/assets`,  // + `/${kind}`
      poster:     `${SITE}/venues/${v.slug}/poster`,
    },
  });
}
