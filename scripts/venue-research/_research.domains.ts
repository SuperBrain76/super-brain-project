/**
 * Domain discovery for venues with no known website.
 *
 * Guessing a domain and harvesting whatever email is on it is dangerous — you
 * end up emailing an unrelated business that happens to own the name. So every
 * candidate is CONFIRMED before use: the fetched page must actually contain
 * the venue's own name, and for a chain-prone name, the city too. Anything
 * that fails the check is discarded, not downgraded.
 */
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const TLDS: Record<string, string[]> = {
  GB: [".co.uk", ".com", ".london", ".pub"],
  ES: [".es", ".com"],
  IT: [".it", ".com"],
  FR: [".fr", ".com"],
};

const STOP = /^(the|le|la|les|el|los|las|il|bar|pub|cafe|caffe)$/i;

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function candidates(name: string, country: string): string[] {
  const clean = norm(name).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const words = clean.split(" ");
  const noStop = words.filter(w => !STOP.test(w));
  const forms = new Set<string>([
    words.join(""), noStop.join(""), words.join("-"), noStop.join("-"),
  ]);
  const out: string[] = [];
  for (const f of forms) {
    if (f.length < 5 || f.length > 40) continue;
    for (const tld of TLDS[country] ?? [".com"]) {
      out.push(`https://www.${f}${tld}`, `https://${f}${tld}`);
    }
  }
  return out.slice(0, 14);
}

async function grab(url: string): Promise<string> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    const r = await fetch(url, { signal: c.signal, redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; SuperBrainBot/1.0; +https://www.superbrain.social)" } });
    clearTimeout(t);
    if (!r.ok) return "";
    return (await r.text()).slice(0, 150_000);
  } catch { return ""; }
}

const strip = (h: string) => norm(h.replace(/<[^>]+>/g, " ")).replace(/[^a-z0-9]/g, "");

/** The confirmation gate. Distinctive name tokens must appear on the page. */
function confirms(html: string, name: string, city: string): boolean {
  if (!html) return false;
  const text = strip(html);
  const tokens = norm(name).replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter(w => w.length > 3 && !STOP.test(w));
  if (!tokens.length) return false;
  const hits = tokens.filter(t => text.includes(t)).length;
  // Every distinctive token must be present, and for single-token names we
  // additionally require the city — "Volley" alone would match anything.
  if (tokens.length === 1) return hits === 1 && text.includes(norm(city).replace(/[^a-z0-9]/g, ""));
  return hits === tokens.length;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JUNK = /(sentry|wixpress|example|yourdomain|\.png|\.jpg|\.webp|godaddy|squarespace|wordpress|@2x)/i;
const PREF = ["info@","hello@","contact@","manager@","owner@","office@","mail@","reservations@","prenotazioni@","reservas@"];

function pickEmail(html: string): string | null {
  const f = [...new Set((html.match(EMAIL_RE) ?? []).map(e => e.toLowerCase()))].filter(e => !JUNK.test(e));
  if (!f.length) return null;
  for (const p of PREF) { const h = f.find(e => e.startsWith(p)); if (h) return h; }
  return f[0];
}
function pickPhone(html: string): string | null {
  const t = html.match(/href=["']tel:([^"']+)["']/i);
  return t ? t[1].replace(/\s+/g," ").trim() : null;
}

const conn = readFileSync(".supabase-db-url.local","utf8").trim().replace(/^[A-Z_]+=/,"");
const db = new pg.Client({ connectionString: conn, ssl:{ rejectUnauthorized:false } });
await db.connect();

const { rows: targets } = await db.query(
  `select id, name, city, country from venues
   where source='manual_research' and website is null and contact_email is null
   order by city, name`);

console.log(`probing ${targets.length} venues with no known website…\n`);

const found: any[] = [];
const queue = [...targets];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const v = queue.shift(); if (!v) return;
    let hit: { url: string; email: string | null; phone: string | null } | null = null;

    for (const url of candidates(v.name, v.country)) {
      const html = await grab(url);
      if (!confirms(html, v.name, v.city)) continue;
      hit = { url, email: pickEmail(html), phone: pickPhone(html) };
      break;
    }

    if (hit) {
      // A chain can publish one inbox across several venues. The CRM enforces
      // one venue per email — so the FIRST venue keeps it and the rest keep
      // the site and phone only. Emailing one inbox twice is a spam report.
      if (hit.email) {
        const { rows: taken } = await db.query(
          `select 1 from venues where lower(contact_email) = lower($1) and id <> $2`,
          [hit.email, v.id]);
        if (taken.length) { hit.email = null; process.stdout.write("d"); }
      }
      found.push({ ...v, ...hit });
      await db.query(
        `update venues set website=$2,
            contact_email = coalesce(contact_email, nullif($3,'')),
            contact_phone = coalesce(contact_phone, nullif($4,'')),
            contact_email_status = case when $3 <> '' then 'valid' else contact_email_status end,
            status = case when $3 <> '' then 'verified' else status end,
            enriched_at = case when $3 <> '' then now() else enriched_at end,
            verified_at = case when $3 <> '' then now() else verified_at end,
            fit_score = case when $3 <> '' then 70 else fit_score end,
            fit_reason = case when $3 <> '' then 'Own website confirmed by name match; contact email read from that site.' else fit_reason end
         where id=$1`,
        [v.id, hit.url, hit.email ?? "", hit.phone ?? ""]);
      process.stdout.write(hit.email ? "+" : (hit.phone ? "p" : "w"));
    } else process.stdout.write(".");
  }
}));

writeFileSync("scripts/venue-research/domains-discovered.json", JSON.stringify(found, null, 1));
const { rows: tot } = await db.query(
  `select count(*) total, count(*) filter (where contact_email is not null) with_email,
          count(*) filter (where contact_phone is not null) with_phone,
          count(*) filter (where contact_email is not null or contact_phone is not null) contactable
   from venues where source='manual_research'`);
console.log(`\n\nsites confirmed: ${found.length}  (emails: ${found.filter(f=>f.email).length})`);
console.table(tot);
await db.end();
