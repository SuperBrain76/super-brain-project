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
import { sendVenueWelcome, sendVenueSetup } from "./venueEmail";

export interface ProvisionInput {
  venueId?: string | null;       // set when the payer was already a prospect
  venueName: string;
  country: string;               // ISO-2
  city?: string | null;
  language: string;              // en de es fr it
  competitionSlug?: string | null; // OPTIONAL — leagues are now activated in
                                   // the onboarding wizard, not bought up front
  ownerEmail: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  website?: string | null;
  stripeCustomerId: string;
  checkoutSessionId?: string | null; // powers the "finish setup" resume link
}

export interface ProvisionResult {
  venueId: string;
  slug: string;
  leagueId: string | null;       // null until the owner activates a competition
  inviteCode: string | null;
  joinUrl: string | null;
  qrUrl: string | null;
  posterUrl: string | null;
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

  // ── 1. Competition (optional) ─────────────────────────────
  // Leagues are activated in the onboarding wizard now, so a checkout carries
  // no competition. Only look one up when a slug was explicitly passed.
  let comp: { id: string; name: string; slug: string } | null = null;
  if (input.competitionSlug) {
    const { data } = await db
      .from("competitions").select("id, name, slug")
      .eq("slug", input.competitionSlug).maybeSingle();
    comp = data;
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
      competition_slug: input.competitionSlug ?? undefined,
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
      competition_slug: input.competitionSlug ?? null,
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

  // ── 4. Branded league — ONLY when a competition was passed ────
  // The default path now provisions no league: the owner activates their
  // competitions in the wizard (/api/venues/onboarding/leagues). A slug here
  // is the legacy/explicit path and still works.
  let leagueId: string | null = null;
  let inviteCode: string | null = null;
  let joinUrl: string | null = null;

  if (comp) {
    const { data: existing } = await db
      .from("prediction_leagues")
      .select("id, invite_code")
      .eq("venue_id", venueId)
      .eq("competition_id", comp.id)
      .maybeSingle();

    if (existing) {
      leagueId   = existing.id;
      inviteCode = existing.invite_code;
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
        sponsor_description: input.city ? `${input.venueName} — ${input.city}` : input.venueName,
      }).select("id, invite_code").single();
      if (error) throw new Error(`league insert failed: ${error.message}`);
      leagueId   = data.id;
      inviteCode = data.invite_code;
    }

    await db.from("prediction_league_members")
      .upsert({ league_id: leagueId, user_id: ownerUserId },
              { onConflict: "league_id,user_id", ignoreDuplicates: true });

    joinUrl = `${SITE}/${comp.slug}/leagues/join?code=${inviteCode}`;
  }

  const qrUrl     = leagueId ? `${SITE}/api/venues/${slug}/qr.png` : null;
  const posterUrl = leagueId ? `${SITE}/venues/${slug}/poster` : null;

  // ── 5. Log + notify (once — webhook retries must not re-email) ──
  const { data: priorEvt } = await db.from("venue_events")
    .select("id").eq("venue_id", venueId).eq("kind", "provisioned").limit(1).maybeSingle();
  const created = !priorEvt;

  if (created) {
    await logEvent(db, venueId, "provisioned", {
      league_id: leagueId, invite_code: inviteCode, competition: comp?.slug ?? null,
    });

    if (leagueId && comp && joinUrl && qrUrl && posterUrl) {
      await sendVenueWelcome({
        to: email, venueName: input.venueName, ownerName: input.ownerName,
        language: input.language, leagueName: brandedLeagueName(input.venueName, comp.name),
        joinUrl, qrUrl, posterUrl, competitionName: comp.name,
      }).catch((e) => console.error("[provision] welcome email failed", e));
    } else {
      // No league yet — send the "finish your setup" email whose CTA resumes
      // the exact wizard via the checkout session id.
      await sendVenueSetup({
        to: email, venueName: input.venueName, ownerName: input.ownerName,
        language: input.language,
        setupUrl: input.checkoutSessionId
          ? `${SITE}/venues/welcome?session_id=${input.checkoutSessionId}`
          : `${SITE}/venues`,
      }).catch((e) => console.error("[provision] setup email failed", e));
    }

    await notifyN8n({
      event: "venue.provisioned",
      venue_id: venueId, venue: input.venueName, country: input.country,
      city: input.city, email, phone: input.ownerPhone,
      competition: comp?.name ?? null, league_id: leagueId, invite_code: inviteCode,
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
