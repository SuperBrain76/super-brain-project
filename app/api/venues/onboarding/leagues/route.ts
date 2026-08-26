/**
 * POST /api/venues/onboarding/leagues — add more branded leagues, no charge.
 *
 * One venue subscription includes EVERY competition. This spins up an extra
 * branded league for each requested competition slug the venue doesn't already
 * run — same branding, same owner, its own invite code and QR. Idempotent: a
 * competition the venue already has is skipped, never duplicated.
 *
 * Body: { session_id, competitionSlugs: string[] }.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveVenueBySession } from "@/lib/venueSession";
import { logEvent, publicCompetitionIds } from "@/lib/venueDb";
import { brandedLeagueName } from "@/lib/provisioning";
import { normalizeName } from "@/lib/leagueName";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const r = await resolveVenueBySession(body.session_id);
  if (!r) return NextResponse.json({ error: "session not recognised" }, { status: 403 });

  const rawSlugs: string[] = (Array.isArray(body.competitionSlugs) ? body.competitionSlugs : [])
    .map((s: unknown) => String(s ?? "").trim())
    .filter((s: string) => s.length > 0);
  const slugs = Array.from(new Set(rawSlugs)).slice(0, 20);
  if (!slugs.length) return NextResponse.json({ error: "no competitions given" }, { status: 400 });

  const { data: venue } = await r.db.from("venues")
    .select("name, city, website, owner_user_id").eq("id", r.venueId).maybeSingle();
  if (!venue?.owner_user_id) {
    return NextResponse.json({ error: "venue not fully provisioned yet" }, { status: 409 });
  }

  // active   = leagues this venue now has for the requested competitions
  //            (whether we just created them or they already existed)
  // failed   = competitions we could NOT activate, with the reason — surfaced
  //            to the UI so a blocked venue never sees a silent reset.
  const active: { slug: string; inviteCode: string }[] = [];
  const failed: { slug: string; error: string }[] = [];

  for (const slug of slugs) {
    const { data: comp } = await r.db.from("competitions")
      .select("id, name, slug, status").eq("slug", slug).maybeSingle();
    if (!comp || comp.status !== "active") {
      failed.push({ slug, error: "competition is not currently available" });
      continue;
    }

    // LIFECYCLE gate, same rule as the wizard's list — enforced here too so
    // a crafted slug can't activate a draft/internal competition before it
    // launches. Deliberately not a sport filter: once F1 (or any other
    // sport) goes public it SHOULD be venue-selectable.
    const publicIds = await publicCompetitionIds(r.db, [comp]);
    if (!publicIds.has(comp.id)) {
      failed.push({ slug, error: "competition is not currently available" });
      continue;
    }

    // Already activated for this venue → success, not a skip.
    const { data: existing } = await r.db.from("prediction_leagues")
      .select("id, invite_code").eq("venue_id", r.venueId).eq("competition_id", comp.id).maybeSingle();
    if (existing) { active.push({ slug: comp.slug, inviteCode: existing.invite_code }); continue; }

    const name = brandedLeagueName(venue.name, comp.name);
    const { data: league, error } = await r.db.from("prediction_leagues").insert({
      competition_id:      comp.id,
      name,
      normalized_name:     normalizeName(name),
      created_by:          venue.owner_user_id,
      visibility:          "public",
      is_featured:         true,
      venue_id:            r.venueId,
      sponsor_name:        venue.name,
      sponsor_url:         venue.website,
      sponsor_description: venue.city ? `${venue.name} — ${venue.city}` : venue.name,
    }).select("id, invite_code").single();
    if (error || !league) {
      const msg = error?.message ?? "insert returned no row";
      console.error("[onboarding/leagues] insert failed", slug, msg);
      await logEvent(r.db, r.venueId, "league_activation_failed", { slug, error: msg });
      failed.push({ slug, error: msg });
      continue;
    }

    await r.db.from("prediction_league_members").upsert(
      { league_id: league.id, user_id: venue.owner_user_id },
      { onConflict: "league_id,user_id", ignoreDuplicates: true },
    );
    active.push({ slug: comp.slug, inviteCode: league.invite_code });
  }

  if (active.length) {
    await logEvent(r.db, r.venueId, "leagues_added", { slugs: active.map((c) => c.slug) });
  }

  // If nothing could be activated and we have a reason, tell the client so it
  // can show the error instead of silently disabling Continue forever.
  if (!active.length && failed.length) {
    return NextResponse.json(
      { ok: false, active, failed, error: failed[0].error },
      { status: 422 },
    );
  }
  return NextResponse.json({ ok: true, active, failed });
}
