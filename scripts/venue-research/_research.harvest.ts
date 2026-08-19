/**
 * Contact harvest — runs the PRODUCTION scrapeContact() over a staged venue
 * list and writes a CSV. Not a test; it lives here only because vitest is the
 * repo's TypeScript runner. Invoked explicitly, never by `vitest run`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { scrapeContact, mockScore } from "../../lib/enrichment";

/**
 * Second pass. scrapeContact() follows a contact link when it finds one, but a
 * lot of pub sites bury the address behind a JS nav that the static HTML never
 * exposes. Trying the conventional paths directly, in the venue's own language,
 * recovers a meaningful share of those.
 */
const CONTACT_PATHS = [
  "/contact", "/contact-us", "/contactus", "/about", "/about-us", "/info",
  "/kontakt", "/contatti", "/contacto", "/nous-contacter", "/impressum",
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JUNK = /(sentry|wixpress|example|yourdomain|\.png|\.jpg|\.webp|godaddy|squarespace|wordpress|@2x|@sentry)/i;
const PREFERRED = ["info@", "hello@", "contact@", "manager@", "owner@", "office@", "mail@", "reservations@", "bookings@"];

async function grab(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(url, {
      signal: ctrl.signal, redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; SuperBrainBot/1.0; +https://www.superbrain.social)" },
    });
    clearTimeout(t);
    if (!r.ok) return "";
    return (await r.text()).slice(0, 200_000);
  } catch { return ""; }
}

function pickEmail(html: string): string | null {
  const found = [...new Set((html.match(EMAIL_RE) ?? []).map(e => e.toLowerCase()))].filter(e => !JUNK.test(e));
  if (!found.length) return null;
  for (const p of PREFERRED) { const hit = found.find(e => e.startsWith(p)); if (hit) return hit; }
  return found[0];
}

/** UK/ES/FR/IT phone shapes, taken from tel: links first (always unambiguous). */
function pickPhone(html: string): string | null {
  const tel = html.match(/href=["']tel:([^"']+)["']/i);
  if (tel) return tel[1].replace(/\s+/g, " ").trim();
  const m = html.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?){2,4}\d{2,4}/);
  const c = m?.[0]?.trim();
  return c && c.replace(/\D/g, "").length >= 9 ? c : null;
}

async function secondPass(website: string): Promise<{ email: string | null; phone: string | null }> {
  let email: string | null = null;
  let phone: string | null = null;
  let origin: string;
  try { origin = new URL(website).origin; } catch { return { email, phone }; }

  const home = await grab(origin);
  email = pickEmail(home);
  phone = pickPhone(home);

  for (const path of CONTACT_PATHS) {
    if (email && phone) break;
    const html = await grab(origin + path);
    if (!html) continue;
    email ??= pickEmail(html);
    phone ??= pickPhone(html);
  }
  return { email, phone };
}
import type { PlaceResult } from "../../lib/prospecting";

const IN  = "./venues.json";
const OUT = "./venues-with-contacts.csv";
const CONCURRENCY = 8;

type Row = {
  name: string; city: string; country: string; address: string; website: string;
};

const venues: Row[] = JSON.parse(readFileSync(IN, "utf8"));
const results: any[] = [];

const queue = [...venues];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const v = queue.shift();
    if (!v) return;
    let scrape;
    try {
      scrape = await scrapeContact(v.website);
    } catch {
      scrape = { email: null, pageText: "", sportSignals: [], socials: {} };
    }

    const place: PlaceResult = {
      placeId: "", name: v.name, address: v.address, city: v.city,
      website: v.website, phone: null, rating: null, reviews: null,
      // No Places data here, so give the scorer only what we actually know:
      // the listing described these as football-showing bars.
      types: ["bar"], primaryType: "bar",
    };
    // Only pay for the second pass when the first found nothing.
    const extra = scrape.email ? { email: scrape.email, phone: null as string | null }
                               : await secondPass(v.website);
    const email = scrape.email ?? extra.email ?? "";
    const phone = extra.phone ?? "";

    const fit = mockScore(place, { ...scrape, email: email || null } as any);

    results.push({
      name: v.name, city: v.city, country: v.country, address: v.address,
      website: v.website,
      email,
      phone,
      sport_signals: (scrape.sportSignals ?? []).join(" | "),
      instagram: (scrape.socials as any)?.instagram ?? "",
      facebook: (scrape.socials as any)?.facebook ?? "",
      fit_score: fit.fit_score,
      shows_live_sport: fit.shows_live_sport,
    });
    process.stdout.write(email ? "+" : (phone ? "p" : "."));
  }
}));

results.sort((a, b) => (b.email ? 1 : 0) - (a.email ? 1 : 0) || b.fit_score - a.fit_score);

const cols = ["name","city","country","address","email","phone","website","instagram","facebook","fit_score","shows_live_sport","sport_signals"];
const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
writeFileSync(OUT, [cols.join(","), ...results.map(r => cols.map(c => esc(r[c])).join(","))].join("\n"));

const withEmail = results.filter(r => r.email).length;
const withPhone = results.filter(r => r.phone).length;
const contactable = results.filter(r => r.email || r.phone).length;
console.log(`\n\nHARVEST COMPLETE`);
console.log(`  venues attempted : ${results.length}`);
console.log(`  emails found     : ${withEmail}`);
console.log(`  phones found     : ${withPhone}`);
console.log(`  contactable      : ${contactable} (${Math.round((contactable / results.length) * 100)}%)`);
console.log(`  email hit rate   : ${Math.round((withEmail / results.length) * 100)}%`);
console.log(`  written to       : ${OUT}`);
