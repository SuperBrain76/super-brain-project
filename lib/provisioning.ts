/**
 * lib/provisioning.ts — turn a Stripe payment into a live venue league.
 *
 * This is the whole of Workflow 1, and it lives HERE rather than in n8n on
 * purpose: every step writes to our own Supabase or creates a Supabase auth
 * user. Doing that over HTTP from n8n means auth keys in a second system, no
 * transaction-like grouping, and a silent failure mode where the venue has
 * paid and nothing exists. n8n gets called at the END, once the league is
 * real, to do the outward-facing work (WhatsApp, Zoho, social).
 *
 *   provisionVenue()
 *     1. venue row              — reuse the prospect row when we emailed them
 *     2. owner auth account     — invite, no password, magic-link sign-in
 *     3. branded league         — is_featured, sponsor_* = their branding
 *     4. owner joins own league
 *     5. QR + poster URLs       — rendered on demand, nothing to store
 *     6. welcome email          — in the venue's own language
 *     7. n8n event              — fire-and-forget, never blocks provisioning
 *
 * IDEMPOTENT. Stripe retries webhooks; a venue that already has a league gets
 * its existing league back rather than a second one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName } from "./leagueName";
import { logEvent, uniqueSlug } from "./venueDb";
import { SITE } from "./stripe";
import { sendVenueWelcome } from "./venueEmail";

export interface ProvisionInput {
  venueId?: string | null;       // set when the payer was already a prospect
  venueName: string;
  country: string;               // ISO-2
  city?: string | null;
  language: string;              // en de es fr it
  competitionSlug: string;       // premier-league | la-liga | ...
  ownerEmail: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  website?: string | null;
  stripeCustomerId: string;
}

export interface ProvisionResult {
  venueId: string;
  slug: string;
  leagueId: string;
  inviteCode: string;
  joinUrl: string;
  qrUrl: string;
  posterUrl: string;
  ownerUserId: string;
  created: boolean;              // false when this was a webhook retry
}

/** "The Offside" + Premier League → "The Offside Premier League Cup" */
export function brandedLeagueName(venueName: string, competitionName: string) {
  const full = `${venueName} ${competitionName} Cup`;
  return full.length <= 40 ? full : `${venueName} Cup`.slice(0, 40);
}

export async function provisionVenue(
  db: SupabaseClient,
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const email = input.ownerEmail.toLowerCase().trim();

  // ── 1. Competition ────────────────────────────────────────
  const { data: comp, error: compErr } = await db
    .from("competitions")
    .select("id, name, slug")
    .eq("slug", input.competitionSlug)
    .single();
  if (compErr || !comp) {
    throw new Error(`Unknown competition "${input.competitionSlug}"`);
  }

  // ── 2. Venue row ──────────────────────────────────────────
  // Prefer the id Stripe carried in metadata (they were a prospect we
  // emailed), then the email, then create fresh. Never make a duplicate.
  let venue: { id: string; slug: string | null } | null = null;

  if (input.venueId) {
    const { data } = await db
      .from("venues").select("id, slug").eq("id", input.venueId).maybeSingle();
    venue = data;
  }
  if (!venue) {
    const { data } = await db
      .from("venues").select("id, slug")
      .ilike("contact_email", email).maybeSingle();
    venue = data;
  }

  const slug = venue?.slug ?? (await uniqueSlug(db, input.venueName));

  if (venue) {
    await db.from("venues").update({
      slug,
      name:             input.venueName,
      country:          input.country.toUpperCase(),
      city:             input.city ?? undefined,
      language:         input.language,
      website:          input.website ?? undefined,
      competition_slug: comp.slug,
      contact_email:    email,
      contact_name:     input.ownerName ?? undefined,
      contact_phone:    input.ownerPhone ?? undefined,
    }).eq("id", venue.id);
  } else {
    const { data, error } = await db.from("venues").insert({
      slug,
      name:             input.venueName,
      country:          input.country.toUpperCase(),
      city:             input.city,
      language:         input.language,
      website:          input.website,
      competition_slug: comp.slug,
      contact_email:    email,
      contact_email_status: "valid",     // they typed it and paid with it
      contact_name:     input.ownerName,
      contact_phone:    input.ownerPhone,
      source:           "inbound",
      status:           "signed_up",
    }).select("id, slug").single();
    if (error) throw new Error(`venue insert failed: ${error.message}`);
    venue = data;
  }
  const venueId = venue!.id;

  // ── 3. Owner auth account ─────────────────────────────────
  const ownerUserId = await ensureOwnerUser(db, email, input.venueName, venueId);
  await db.from("venues").update({ owner_user_id: ownerUserId }).eq("id", venueId);

  // ── 4. Branded league (idempotent) ────────────────────────
  const { data: existing } = await db
    .from("prediction_leagues")
    .select("id, invite_code")
    .eq("venue_id", venueId)
    .eq("competition_id", comp.id)
    .maybeSingle();

  let leagueId: string;
  let inviteCode: string;
  let created = false;

  if (existing) {
    leagueId   = existing.id;
    inviteCode = existing.invite_code;
    // A previously suspended league (failed payment) comes back to life.
    await db.from("prediction_leagues").update({ suspended: false }).eq("id", leagueId);
  } else {
    const name = brandedLeagueName(input.venueName, comp.name);
    const { data, error } = await db.from("prediction_leagues").insert({
      competition_id:      comp.id,
      name,
      normalized_name:     normalizeName(name),
      created_by:          ownerUserId,
      visibility:          "public",
      is_featured:         true,
      venue_id:            venueId,
      sponsor_name:        input.venueName,
      sponsor_url:         input.website,
      sponsor_description: input.city
        ? `${input.venueName} — ${input.city}`
        : input.venueName,
    }).select("id, invite_code").single();
    if (error) throw new Error(`league insert failed: ${error.message}`);
    leagueId   = data.id;
    inviteCode = data.invite_code;
    created    = true;
  }

  // ── 5. Owner joins their own league ───────────────────────
  await db.from("prediction_league_members")
    .upsert({ league_id: leagueId, user_id: ownerUserId },
            { onConflict: "league_id,user_id", ignoreDuplicates: true });

  // ── 6. URLs (QR + poster render on demand — nothing stored) ──
  // The real join route is /{competition}/leagues/join?code=… — this URL is
  // printed on physical table posters, so it has to be the live one.
  const joinUrl   = `${SITE}/${comp.slug}/leagues/join?code=${inviteCode}`;
  const qrUrl     = `${SITE}/api/venues/${slug}/qr.png`;
  const posterUrl = `${SITE}/venues/${slug}/poster`;

  // ── 7. Log + notify ───────────────────────────────────────
  await logEvent(db, venueId, created ? "provisioned" : "provision_retry", {
    league_id: leagueId, invite_code: inviteCode, competition: comp.slug,
  });

  if (created) {
    await sendVenueWelcome({
      to: email, venueName: input.venueName, ownerName: input.ownerName,
      language: input.language, leagueName: brandedLeagueName(input.venueName, comp.name),
      joinUrl, qrUrl, posterUrl, competitionName: comp.name,
    }).catch((e) => console.error("[provision] welcome email failed", e));

    await notifyN8n({
      event: "venue.provisioned",
      venue_id: venueId, venue: input.venueName, country: input.country,
      city: input.city, email, phone: input.ownerPhone,
      competition: comp.name, league_id: leagueId, invite_code: inviteCode,
      join_url: joinUrl, poster_url: posterUrl,
      stripe_customer_id: input.stripeCustomerId,
    }).catch((e) => console.error("[provision] n8n notify failed", e));
  }

  return { venueId, slug, leagueId, inviteCode, joinUrl, qrUrl, posterUrl, ownerUserId, created };
}

/**
 * Find or invite the venue owner's auth user.
 *
 * No password is ever set: they arrive through the magic link in the welcome
 * email. `listUsers` is paginated by email filter so this stays cheap.
 */
async function ensureOwnerUser(
  db: SupabaseClient, email: string, venueName: string, venueId: string,
): Promise<string> {
  // Already a SuperBrain user? (a bar owner may well already play).
  // Emails live in auth.users, which PostgREST cannot read — migration 058
  // exposes a service-role-only lookup for exactly this.
  const { data: existingId } = await db
    .rpc("find_auth_user_id_by_email", { p_email: email });
  if (existingId) return existingId as string;

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,                 // they proved the address by paying
    user_metadata: { venue_name: venueName, venue_id: venueId, role: "venue_owner" },
  });
  if (created?.user) return created.user.id;

  // Race or pre-existing auth user without a profile row — look it up.
  const { data: list } = await db.auth.admin.listUsers();
  const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
  if (found) return found.id;

  throw new Error(`could not create owner user: ${error?.message ?? "unknown"}`);
}

/**
 * Hand off to n8n for the outward-facing steps: WhatsApp to Dylan, Zoho
 * customer + invoice, social proof posts. Fire-and-forget by design — a
 * broken n8n workflow must never stop a paying venue going live.
 */
export async function notifyN8n(payload: Record<string, unknown>) {
  const url = process.env.N8N_VENUE_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.N8N_WEBHOOK_SECRET
        ? { "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET }
        : {}),
    },
    body: JSON.stringify(payload),
  });
}
