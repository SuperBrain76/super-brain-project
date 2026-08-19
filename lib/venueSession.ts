/**
 * lib/venueSession.ts — resolve the post-checkout onboarding caller.
 *
 * The setup wizard runs before the owner has an auth session (they arrive via
 * the magic link later), so the Stripe checkout session id IS the credential:
 * it is a long unguessable secret that only the paying browser holds, and it
 * maps to exactly one venue. Every onboarding write authenticates this way,
 * the same trust the /venues/welcome poll already relies on.
 */

import { getStripe } from "./stripe";
import { admin } from "./venueDb";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedVenue {
  db: SupabaseClient;
  venueId: string;
  slug: string;
  leagueId: string | null;
}

/** Map a Stripe checkout session id to its venue, or null if unknown/unpaid. */
export async function resolveVenueBySession(sessionId: string | null): Promise<ResolvedVenue | null> {
  if (!sessionId || !sessionId.startsWith("cs_")) return null;

  let email: string | null = null;
  let venueIdFromMeta: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "unpaid" && session.status !== "complete") return null;
    email = session.customer_details?.email ?? session.customer_email ?? null;
    venueIdFromMeta = (session.metadata ?? {}).venue_id || null;
  } catch {
    return null;
  }

  const db = admin();
  let venue: { id: string; slug: string | null } | null = null;
  if (venueIdFromMeta) {
    const { data } = await db.from("venues").select("id, slug").eq("id", venueIdFromMeta).maybeSingle();
    venue = data;
  }
  if (!venue && email) {
    const { data } = await db.from("venues").select("id, slug").ilike("contact_email", email).maybeSingle();
    venue = data;
  }
  if (!venue?.slug) return null;

  const { data: league } = await db
    .from("prediction_leagues").select("id").eq("venue_id", venue.id).limit(1).maybeSingle();

  return { db, venueId: venue.id, slug: venue.slug, leagueId: league?.id ?? null };
}
