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
import { logEvent } from "@/lib/venueDb";
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

  const created: { slug: string; inviteCode: string }[] = [];
  const skipped: string[] = [];

  for (const slug of slugs) {
    const { data: comp } = await r.db.from("competitions")
      .select("id, name, slug, status").eq("slug", slug).maybeSingle();
    if (!comp || comp.status !== "active") { skipped.push(slug); continue; }

    const { data: existing } = await r.db.from("prediction_leagues")
      .select("id, invite_code").eq("venue_id", r.venueId).eq("competition_id", comp.id).maybeSingle();
    if (existing) { skipped.push(slug); continue; }

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
    if (error) { console.error("[onboarding/leagues]", slug, error.message); skipped.push(slug); continue; }

    await r.db.from("prediction_league_members").upsert(
      { league_id: league.id, user_id: venue.owner_user_id },
      { onConflict: "league_id,user_id", ignoreDuplicates: true },
    );
    created.push({ slug: comp.slug, inviteCode: league.invite_code });
  }

  if (created.length) {
    await logEvent(r.db, r.venueId, "leagues_added", { slugs: created.map((c) => c.slug) });
  }
  return NextResponse.json({ ok: true, created, skipped });
}
