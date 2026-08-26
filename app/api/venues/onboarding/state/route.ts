/**
 * GET /api/venues/onboarding/state?session_id=cs_... — drive the setup wizard.
 *
 * Returns the venue's current brand, its live leagues, the full competition
 * list (all included in one subscription) and where the wizard left off, so
 * the client can render the right step without holding an auth session.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveVenueBySession } from "@/lib/venueSession";
import { publicCompetitionIds } from "@/lib/venueDb";
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

  // Fetch competitions once and resolve league → competition locally.
  // NOTE: an embedded `competition:competitions(...)` select on prediction_leagues
  // returned ZERO league rows in production (the wizard then couldn't see an
  // activated league and Continue stayed disabled). The plain query below —
  // the same shape the /leagues endpoint uses successfully — does see them.
  const { data: comps } = await r.db
    .from("competitions").select("id, slug, name, sport_code, status").order("name");
  const compById = new Map((comps ?? []).map((c: any) => [c.id, c]));

  // Offer only competitions whose LIFECYCLE is 'public' — a draft/internal
  // competition (how every new one lands) must not appear in the wizard
  // before launch. Deliberately not a sport filter: once F1 (or any other
  // sport) goes public it SHOULD be venue-selectable.
  const activeComps = (comps ?? []).filter((c: any) => c.status === "active");
  const publicIds = await publicCompetitionIds(r.db, activeComps);

  const { data: leagueRows, error: leaguesErr } = await r.db
    .from("prediction_leagues")
    .select("invite_code, name, competition_id")
    .eq("venue_id", r.venueId);
  if (leaguesErr) console.error("[onboarding/state] leagues query failed", leaguesErr.message);

  const leagues = (leagueRows ?? []).map((l: any) => {
    const c = compById.get(l.competition_id);
    return { slug: c?.slug ?? null, competition: c?.name ?? null, name: l.name, inviteCode: l.invite_code };
  });
  const haveSlugs = new Set(leagues.map((l) => l.slug).filter(Boolean));

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
    leagues,
    competitions: activeComps
      .filter((c: any) => publicIds.has(c.id))
      .map((c: any) => ({
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
