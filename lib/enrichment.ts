/**
 * lib/enrichment.ts — turn a raw Places row into a scored, contactable prospect.
 *
 * Two steps, cheapest first:
 *   1. scrapeContact()  — fetch the venue's own site and pull an email + signals.
 *                          Free, and it is what actually makes a row mailable.
 *   2. scoreVenue()     — Claude reads the site text + Places metadata and
 *                          decides "would this venue run a prediction league?",
 *                          returning a 0-100 fit score through a JSON schema.
 *
 * Order matters: a venue with no findable email can never be emailed, so it is
 * dropped before the AI call rather than after. lib/prospecting.ts's prefilter
 * runs before both.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { PlaceResult } from "./prospecting";

/**
 * Venue scoring runs on Haiku: it is a bounded classification over a short
 * evidence block, executed tens of thousands of times, so unit cost dominates
 * ($1/$5 per MTok vs $5/$25 on Opus — roughly 5x cheaper per venue).
 *
 * Haiku 4.5 also draws on its OWN rate-limit pool, separate from the Opus
 * tiers, so a large enrichment run no longer competes with anything else in
 * the app for quota.
 *
 * If fit scores start looking wrong, change this one constant and re-run a
 * batch against the same venues to compare.
 */
export const ENRICHMENT_MODEL = "claude-haiku-4-5";

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();   // reads ANTHROPIC_API_KEY
  return _anthropic;
}

// ── 1. Contact scraping ───────────────────────────────────────
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Addresses that are never a venue's real inbox. */
const JUNK_EMAIL = /(sentry|wixpress|example|yourdomain|domain\.com|\.png|\.jpg|\.webp|godaddy|squarespace|wordpress|@2x)/i;

/** Generic mailboxes are fine — a pub's info@ is usually the owner's inbox. */
const PREFERRED = ["info@", "hello@", "contact@", "manager@", "owner@", "office@", "mail@"];

export interface ContactScrape {
  email: string | null;
  pageText: string;
  sportSignals: string[];
  socials: { instagram?: string; facebook?: string };
}

/**
 * Fetch the venue site (home page, then a contact page if the home page had no
 * address). Deliberately forgiving: any failure returns empty rather than
 * throwing, because one bad site must not stop a 500-venue batch.
 */
export async function scrapeContact(website: string | null): Promise<ContactScrape> {
  const empty: ContactScrape = { email: null, pageText: "", sportSignals: [], socials: {} };
  if (!website) return empty;

  const html = await fetchText(website);
  if (!html) return empty;

  let combined = html;
  if (!EMAIL_RE.test(html)) {
    EMAIL_RE.lastIndex = 0;
    const contactUrl = findContactUrl(html, website);
    if (contactUrl) combined += "\n" + (await fetchText(contactUrl));
  }
  EMAIL_RE.lastIndex = 0;

  const text = stripHtml(combined);

  return {
    email:        pickEmail(combined),
    pageText:     text.slice(0, 6000),
    sportSignals: detectSportSignals(text),
    socials: {
      instagram: firstMatch(combined, /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+/),
      facebook:  firstMatch(combined, /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._-]+/),
    },
  };
}

async function fetchText(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; SuperBrainBot/1.0; +https://www.superbrain.social)" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return "";
    return (await res.text()).slice(0, 200_000);
  } catch {
    return "";
  }
}

function findContactUrl(html: string, base: string): string | null {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const hit = hrefs.find((h) => /contact|kontakt|contatti|contacto|about|impressum/i.test(h));
  if (!hit) return null;
  try { return new URL(hit, base).toString(); } catch { return null; }
}

function pickEmail(html: string): string | null {
  const found = [...new Set((html.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))]
    .filter((e) => !JUNK_EMAIL.test(e));
  if (!found.length) return null;
  for (const p of PREFERRED) {
    const hit = found.find((e) => e.startsWith(p));
    if (hit) return hit;
  }
  return found[0];
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(s: string, re: RegExp): string | undefined {
  return s.match(re)?.[0];
}

/** Keyword hits that suggest the venue actually shows live sport. */
const SPORT_WORDS = [
  "live sport", "live football", "premier league", "laliga", "la liga", "serie a",
  "ligue 1", "bundesliga", "champions league", "big screen", "match day", "matchday",
  "sky sports", "tnt sports", "dazn", "movistar", "fútbol en directo", "ver el fútbol",
  "calcio in diretta", "diretta sportiva", "foot en direct", "retransmission",
  "screens", "pantallas", "maxi schermo", "écran géant", "quiz night", "pub quiz",
];

function detectSportSignals(text: string): string[] {
  const lower = text.toLowerCase();
  return SPORT_WORDS.filter((w) => lower.includes(w));
}

// ── 2. AI scoring ─────────────────────────────────────────────

export interface FitAssessment {
  /** true when produced by the offline heuristic, not by Claude. */
  mock: boolean;
  fit_score: number;
  shows_live_sport: boolean;
  venue_type: string;
  reason: string;
  suggested_league_name: string | null;
  contact_name: string | null;
}

/**
 * JSON schema is enforced by the API (structured outputs), so the response is
 * always shaped correctly — no defensive parsing, no retry-on-bad-JSON loop.
 */
const FIT_SCHEMA = {
  type: "object",
  properties: {
    fit_score: {
      type: "integer",
      description: "0-100. How likely this venue would run a football prediction league for its regulars.",
    },
    shows_live_sport: {
      type: "boolean",
      description: "Does the evidence show this venue screens live football?",
    },
    venue_type: {
      type: "string",
      enum: ["sports_bar", "pub", "restaurant", "cafe", "night_club", "hotel_bar", "other", "not_a_venue"],
    },
    reason: { type: "string", description: "One sentence justifying the score, citing the evidence." },
    suggested_league_name: {
      type: ["string", "null"],
      description: "A natural league name for this venue, or null if it is a poor fit.",
    },
    contact_name: {
      type: ["string", "null"],
      description: "Owner or manager name if the page states one, else null.",
    },
  },
  required: ["fit_score", "shows_live_sport", "venue_type", "reason", "suggested_league_name", "contact_name"],
  additionalProperties: false,
} as const;

const SYSTEM = `You qualify hospitality venues for SuperBrain, which sells sports bars and pubs a branded football prediction league their regulars play on their phones.

A strong fit is an independent bar, pub or sports bar that screens live football and has a regular crowd. Score it high.

A weak fit is somewhere football is incidental or absent: a fine-dining restaurant, a coffee shop, a hotel lobby bar, a night club, a chain outlet with no local autonomy. Score it low.

Score 0 if the evidence shows it is not a hospitality venue at all, or has permanently closed.

Judge only on the evidence given. Absence of evidence that a venue shows football is weak evidence against it, not proof — a pub with a thin website is still probably a pub. Say so in your reason rather than inventing detail.`;

/**
 * True when scoring runs offline. Either no key is configured, or mock mode is
 * forced — which is how the full prospect → enrich → outreach pipeline can be
 * exercised end to end before the Anthropic key exists. Going live is one env
 * var; no code path changes.
 */
export function isMockMode(): boolean {
  return process.env.ENRICHMENT_MOCK === "1" || !process.env.ANTHROPIC_API_KEY;
}

/**
 * Offline scorer. Deterministic, and deliberately conservative: it can only
 * reach the default pass mark of 60 on real evidence (explicit sport keywords,
 * or a bar/pub place type with a real review count). It exists to prove the
 * plumbing, not to qualify a live send — every row it writes is flagged
 * mock:true so a later pass can find and re-score them.
 */
export function mockScore(place: PlaceResult, scrape: ContactScrape): FitAssessment {
  let score = 25;
  const why: string[] = [];

  const sport = scrape.sportSignals.length;
  if (sport >= 3)      { score += 35; why.push(`${sport} sport keywords on site`); }
  else if (sport >= 1) { score += 20; why.push(`${sport} sport keyword(s) on site`); }

  const types = new Set(place.types);
  let venueType = "other";
  if (types.has("bar") || types.has("pub")) { score += 20; venueType = types.has("pub") ? "pub" : "sports_bar"; why.push("listed as a bar/pub"); }
  else if (types.has("night_club"))         { score -= 10; venueType = "night_club"; }
  else if (types.has("cafe"))               { score -= 10; venueType = "cafe"; }
  else if (types.has("restaurant"))         { score += 5;  venueType = "restaurant"; why.push("listed as a restaurant"); }

  const reviews = place.reviews ?? 0;
  if (reviews >= 500)      { score += 15; why.push(`${reviews} reviews`); }
  else if (reviews >= 100) { score += 10; why.push(`${reviews} reviews`); }
  else if (reviews < 25)   { score -= 10; why.push("few reviews"); }

  if ((place.rating ?? 0) >= 4.3) { score += 5; why.push(`rated ${place.rating}`); }
  if (!scrape.pageText)           { score -= 10; why.push("no readable website text"); }

  score = Math.max(0, Math.min(100, score));

  return {
    mock: true,
    fit_score: score,
    shows_live_sport: sport > 0,
    venue_type: venueType,
    reason: `Offline heuristic (no AI scoring): ${why.join(", ") || "no strong signals"}.`,
    suggested_league_name: score >= 60 ? `${place.name} Cup`.slice(0, 60) : null,
    contact_name: null,
  };
}

/** Score one venue. Throws on API failure so the caller can count it. */
export async function scoreVenue(
  place: PlaceResult, scrape: ContactScrape, country: string,
): Promise<FitAssessment> {
  if (isMockMode()) return mockScore(place, scrape);

  const evidence = [
    `Name: ${place.name}`,
    `Country: ${country}`,
    place.city ? `City: ${place.city}` : null,
    place.address ? `Address: ${place.address}` : null,
    `Google place types: ${place.types.join(", ") || "none"}`,
    place.rating != null ? `Google rating: ${place.rating} from ${place.reviews ?? 0} reviews` : null,
    place.website ? `Website: ${place.website}` : "Website: none found",
    scrape.sportSignals.length
      ? `Sport keywords found on site: ${scrape.sportSignals.join(", ")}`
      : "Sport keywords found on site: none",
    scrape.socials.instagram ? `Instagram: ${scrape.socials.instagram}` : null,
    scrape.pageText ? `\nWebsite text:\n${scrape.pageText}` : "\nWebsite text: unavailable",
  ].filter(Boolean).join("\n");

  const res = await anthropic().messages.create({
    model: ENRICHMENT_MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    // NOTE: no `effort` here. Haiku 4.5 does not accept output_config.effort
    // and returns a 400 if you send it — depth is not tunable on this model.
    // Structured outputs (format) ARE supported, which is the part that
    // matters: the schema is enforced server-side, so the response never
    // needs defensive parsing or a retry-on-bad-JSON loop.
    output_config: {
      format: { type: "json_schema", schema: FIT_SCHEMA },
    },
    messages: [{ role: "user", content: `Assess this venue.\n\n${evidence}` }],
  });

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error(`no text block (stop_reason: ${res.stop_reason})`);
  }
  return { ...(JSON.parse(block.text) as Omit<FitAssessment, "mock">), mock: false };
}
