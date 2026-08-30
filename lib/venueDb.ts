/**
 * lib/venueDb.ts — service-role access to the venue CRM (migration 057).
 *
 * Everything in the venue business is back office: `venues`, `venue_events`,
 * `outreach_*`, `venue_subscriptions` and `stripe_events` all have RLS on with
 * no anon/authenticated policies. Only the service role reaches them, so all
 * of it lives here, server-side, and is never imported into a client bundle.
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Service-role client. Throws loudly rather than silently reading nothing. */
export function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Supabase service-role env missing");
  return createClient(url, key, {
    auth: { persistSession: false },
    // Next patches global fetch with its Data Cache, and a plain GET to
    // PostgREST is cacheable. /api/admin/prospect-audit was caught serving a
    // 90-minute-old snapshot — 128 prospects and 0 real scores while the
    // database held 251 and 56. A safety gate that reports a stale world is
    // worse than no gate, because it reports it confidently.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

// ── Funnel status ─────────────────────────────────────────────
export type VenueStatus =
  | "prospect" | "verified" | "contacted" | "opened" | "replied"
  | "signed_up" | "trialing" | "active" | "past_due"
  | "suspended" | "churned" | "disqualified";

/**
 * Funnel rank. Status only ever moves FORWARD from outreach signals — an
 * "opened" webhook arriving after the venue already paid must not drag a
 * paying customer back down the funnel. Billing statuses (past_due, churned)
 * are applied directly by the Stripe webhook and bypass this ladder.
 */
const RANK: Record<string, number> = {
  prospect: 0, verified: 1, contacted: 2, opened: 3, replied: 4,
  signed_up: 5, trialing: 6, active: 7,
};

export function advances(from: string, to: string): boolean {
  const a = RANK[from], b = RANK[to];
  if (a === undefined || b === undefined) return true;
  return b > a;
}

// ── Event log ─────────────────────────────────────────────────
export async function logEvent(
  db: SupabaseClient,
  venueId: string,
  kind: string,
  detail: Record<string, unknown> = {},
) {
  await db.from("venue_events").insert({ venue_id: venueId, kind, detail });
}

/** Move a venue forward in the funnel and log it. Never moves backward. */
export async function advanceStatus(
  db: SupabaseClient,
  venueId: string,
  to: VenueStatus,
  patch: Record<string, unknown> = {},
) {
  const { data: v } = await db
    .from("venues").select("status").eq("id", venueId).single();
  const next = v && advances(v.status, to) ? { ...patch, status: to } : patch;
  if (Object.keys(next).length) {
    await db.from("venues").update(next).eq("id", venueId);
  }
}

// ── Slugs ─────────────────────────────────────────────────────
const RESERVED = new Set([
  "admin", "api", "app", "login", "signup", "venues", "v", "new", "about",
]);

/** URL-safe, accent-folded slug: "Café Olé Bar" → "cafe-ole-bar". */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "venue";
  return RESERVED.has(base) ? `${base}-venue` : base;
}

/** Slug that is free in `venues`, suffixing -2, -3 … on collision. */
export async function uniqueSlug(db: SupabaseClient, name: string): Promise<string> {
  const base = slugify(name);
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const { data } = await db
      .from("venues").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ── Suppression ───────────────────────────────────────────────
/** True when this address must never be emailed again. */
export async function isSuppressed(db: SupabaseClient, email: string) {
  const { data } = await db
    .from("email_suppressions")
    .select("email").eq("email", email.toLowerCase()).maybeSingle();
  return !!data;
}

export async function suppress(
  db: SupabaseClient, email: string, reason: string, detail?: string,
) {
  await db.from("email_suppressions")
    .upsert({ email: email.toLowerCase(), reason, detail }, { onConflict: "email" });
}

// ── Competition lifecycle gate ────────────────────────────────
/**
 * Of the given competitions, the ids whose lifecycle is 'public' — the only
 * ones venue onboarding may offer or activate. The gate is LIFECYCLE, not
 * sport: a competition seeded as draft (how every new one lands, F1
 * included) must stay invisible until launch, but once it goes public ANY
 * sport is venue-selectable.
 *
 * One query, mirroring competition_lifecycle() (migration 051) and
 * parseLifecycle in lib/competitionEngine.ts: a stored lifecycle setting
 * wins; with no row the legacy flags decide — status 'completed' →
 * archived, visible → public, else draft. An absent row is therefore NOT
 * treated as public (DEFAULT_SETTINGS.lifecycle is 'draft'), so an
 * unconfigured competition never leaks.
 */
export async function publicCompetitionIds(
  db: SupabaseClient,
  comps: { id: string; status?: string | null }[],
): Promise<Set<string>> {
  const pub = new Set<string>();
  if (!comps.length) return pub;

  const { data, error } = await db
    .from("competition_settings")
    .select("competition_id, key, value")
    .in("competition_id", comps.map((c) => c.id))
    .in("key", ["lifecycle", "visible"]);
  if (error) {
    // Fail closed: offering a draft competition is worse than offering none.
    console.error("[publicCompetitionIds] settings query failed", error.message);
    return pub;
  }

  const lifecycle = new Map<string, unknown>();
  const visible   = new Map<string, unknown>();
  for (const r of (data ?? []) as { competition_id: string; key: string; value: unknown }[]) {
    (r.key === "lifecycle" ? lifecycle : visible).set(r.competition_id, r.value);
  }

  for (const c of comps) {
    const l = lifecycle.get(c.id);
    if (l === "public") { pub.add(c.id); continue; }
    if (l === "draft" || l === "internal" || l === "archived") continue;
    // No (valid) lifecycle row — legacy derivation, as in migration 051.
    if (c.status === "completed") continue;          // → archived
    if (visible.get(c.id) === true) pub.add(c.id);   // → public
  }
  return pub;
}
