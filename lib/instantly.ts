/**
 * lib/instantly.ts — cold outreach through Instantly (API v2).
 *
 * Cold email does NOT go through Resend: their terms prohibit it, and that
 * account also sends the product's transactional mail — one complaint spike
 * would take matchday emails down with it. Instantly runs its own warmed
 * mailboxes on a separate sending domain, so the two reputations are
 * completely isolated.
 *
 * Auth:      Authorization: Bearer <INSTANTLY_API_KEY>   (v2 key)
 * Add lead:  POST https://api.instantly.ai/api/v2/leads
 *            { email, first_name, last_name, company_name, campaign,
 *              custom_variables: { …flat strings only… } }
 *
 * Custom variables must be flat scalars — Instantly rejects objects/arrays.
 *
 * ── GERMANY ───────────────────────────────────────────────────
 * DE is deliberately not mappable to a campaign. UWG §7 requires prior
 * consent for B2B cold email in Germany and there is an active abmahnung
 * industry around it. German venues stay in the CRM for phone/LinkedIn and
 * are never pushed to a send. This is enforced in code, not left to
 * discipline — see campaignFor().
 */

const BASE = "https://api.instantly.ai/api/v2";

export class InstantlyError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

function apiKey(): string {
  const k = process.env.INSTANTLY_API_KEY;
  if (!k) throw new InstantlyError("INSTANTLY_API_KEY missing");
  return k;
}

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new InstantlyError(`${path} → ${res.status} ${text.slice(0, 300)}`, res.status);
  return text ? JSON.parse(text) : {};
}

/** ISO-2 country → the campaign that country's venues belong in. */
export function campaignFor(country: string): string | null {
  const c = (country ?? "").toUpperCase();

  // Hard block. Not a config value — a legal boundary.
  if (c === "DE" || c === "AT") return null;

  return process.env[`INSTANTLY_CAMPAIGN_${c}`] || process.env.INSTANTLY_CAMPAIGN_DEFAULT || null;
}

/** Country → the language its outreach is written in. */
export function languageFor(country: string): string {
  return ({ GB: "en", IE: "en", ES: "es", FR: "fr", IT: "it", DE: "de", AT: "de" } as Record<string, string>)[
    (country ?? "").toUpperCase()
  ] ?? "en";
}

/** Country → the competition we pitch to that country's venues. */
export function competitionFor(country: string): string {
  return ({ GB: "premier-league", IE: "premier-league", ES: "la-liga", FR: "ligue-1", IT: "serie-a", DE: "bundesliga" } as Record<string, string>)[
    (country ?? "").toUpperCase()
  ] ?? "premier-league";
}

const COMPETITION_LABEL: Record<string, string> = {
  "premier-league": "Premier League",
  "la-liga":        "LaLiga",
  "serie-a":        "Serie A",
  "ligue-1":        "Ligue 1",
  "bundesliga":     "Bundesliga",
};

export interface LeadInput {
  venueId: string;
  email: string;
  venueName: string;
  contactName?: string | null;
  city?: string | null;
  country: string;
  website?: string | null;
  phone?: string | null;
  competitionSlug?: string | null;
  siteUrl: string;
}

/**
 * Push one prospect into its country's campaign.
 *
 * Every merge field the sequence can use is computed HERE rather than in the
 * template, so the same variables exist in all four languages and a missing
 * one can never render as a literal "{{city}}" in a stranger's inbox.
 */
export async function pushLead(input: LeadInput) {
  const campaign = campaignFor(input.country);
  if (!campaign) {
    throw new InstantlyError(`no campaign for country ${input.country} (DE/AT are intentionally blocked)`);
  }

  const comp  = input.competitionSlug || competitionFor(input.country);
  const label = COMPETITION_LABEL[comp] ?? "the league";
  const first = (input.contactName ?? "").trim().split(/\s+/)[0] || "";

  // Carries the CRM row id (the lead_id) into EVERY outbound link, so a venue
  // that converts keeps ONE row from cold prospect to paying customer and every
  // funnel event — landing view, click, signup, checkout — attributes back to it.
  const signupUrl = `${input.siteUrl}/venues/start?v=${input.venueId}`;
  const demoUrl   = `${input.siteUrl}/venues?v=${input.venueId}`;

  return call("/leads", {
    method: "POST",
    body: JSON.stringify({
      email:        input.email,
      first_name:   first,
      company_name: input.venueName,
      website:      input.website ?? undefined,
      phone:        input.phone ?? undefined,
      campaign,
      custom_variables: {
        venue_id:     input.venueId,
        venue_name:   input.venueName,
        city:         input.city ?? "",
        // Every template writes "your regulars" when city is unknown, so the
        // sentence still reads naturally with an empty city.
        city_phrase:  input.city ? `in ${input.city}` : "",
        competition:  label,
        league_name:  `${input.venueName} ${label} Cup`.slice(0, 60),
        signup_url:   signupUrl,
        demo_url:     demoUrl,
        country:      input.country.toUpperCase(),
      },
    }),
  });
}

/** Campaigns in the workspace — used by the sync script to sanity-check ids. */
export async function listCampaigns(): Promise<Array<{ id: string; name: string }>> {
  const r = await call("/campaigns?limit=100");
  return (r.items ?? r.data ?? []).map((c: any) => ({ id: c.id, name: c.name }));
}

// ── Webhook event mapping ─────────────────────────────────────
/**
 * Instantly's event_type strings → our own taxonomy.
 * Unknown types are ignored rather than guessed at.
 */
export const INSTANTLY_EVENTS = {
  email_sent:         "email_sent",
  email_opened:       "email_opened",
  email_link_clicked: "link_clicked",
  reply_received:     "reply_received",
  email_bounced:      "email_bounced",
  lead_unsubscribed:  "unsubscribed",
} as const;

export type InstantlyEventType = keyof typeof INSTANTLY_EVENTS;

// ── Capacity ──────────────────────────────────────────────────
/**
 * The sending mailbox's own daily limit. Throws when it cannot be read, so a
 * caller planning a send fails closed rather than assuming a number.
 */
export async function mailboxDailyLimit(): Promise<number> {
  const r = await call("/accounts?limit=100");
  const items: any[] = r.items ?? r.data ?? [];
  const wanted = (process.env.VENUE_REPLY_TO || "alex@superbrain.bar").toLowerCase();
  const acct = items.find(a => String(a.email).toLowerCase() === wanted) ?? items[0];
  const n = Number(acct?.daily_limit);
  if (!acct) throw new InstantlyError("no sending account found in the workspace");
  if (!Number.isInteger(n) || n <= 0) {
    throw new InstantlyError(`mailbox ${acct.email} reports an unusable daily_limit: ${acct?.daily_limit}`);
  }
  return n;
}

/**
 * Set the campaign's daily email cap for today's tranche. Capacity is planned in
 * VENUES; this converts the plan into the number Instantly actually enforces.
 */
export async function setCampaignDailyLimit(dailyLimit: number): Promise<void> {
  const campaign = process.env.INSTANTLY_CAMPAIGN_DEFAULT;
  if (!campaign) throw new InstantlyError("INSTANTLY_CAMPAIGN_DEFAULT missing");
  if (!Number.isInteger(dailyLimit) || dailyLimit < 0) {
    throw new InstantlyError(`refusing to set a nonsensical daily limit: ${dailyLimit}`);
  }
  await call(`/campaigns/${encodeURIComponent(campaign)}`, {
    method: "PATCH",
    body: JSON.stringify({ daily_limit: dailyLimit }),
  });
}

/** Campaign status, cap and schedule — for the Operations Dashboard. */
export async function campaignState() {
  const id = process.env.INSTANTLY_CAMPAIGN_DEFAULT;
  if (!id) return { error: "INSTANTLY_CAMPAIGN_DEFAULT missing" };
  const c = await call(`/campaigns/${encodeURIComponent(id)}`);
  const sch = c.campaign_schedule?.schedules?.[0];
  const STATUS: Record<number, string> = { 0: "draft", 1: "active", 2: "paused", 3: "completed", 4: "running_subsequences" };
  return {
    id, name: c.name, status: STATUS[c.status] ?? String(c.status),
    daily_limit: c.daily_limit, stop_on_reply: c.stop_on_reply,
    steps: (c.sequences?.[0]?.steps ?? []).length,
    step_delays: (c.sequences?.[0]?.steps ?? []).map((s: any) => s.delay),
    window: sch ? `${sch.timing?.from}-${sch.timing?.to} ${sch.timezone}` : null,
    days: sch ? Object.keys(sch.days ?? {}).length : null,
    senders: c.email_list ?? [],
  };
}

/** Warm-up state of the sending mailbox. */
export async function senderHealth() {
  const r = await call("/accounts?limit=100");
  const items: any[] = r.items ?? r.data ?? [];
  const wanted = (process.env.VENUE_REPLY_TO || "alex@superbrain.bar").toLowerCase();
  const a = items.find(x => String(x.email).toLowerCase() === wanted) ?? items[0];
  if (!a) return { error: "no sending account found" };
  return {
    email: a.email, active: a.status === 1, setup_pending: a.setup_pending,
    warmup_active: a.warmup_status === 1, warmup_score: a.stat_warmup_score,
    daily_limit: a.daily_limit, created: a.timestamp_created,
  };
}
