/**
 * Load the harvested venues into the CRM as prospects.
 *
 * Rows with a verified email land as `verified` (the outreach sync will pick
 * them up the moment Instantly is configured). Rows without land as `prospect`
 * with enriched_at NULL, so the nightly enrich job retries them automatically
 * once the Places key exists and can supply a website + phone.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const conn = readFileSync(".supabase-db-url.local", "utf8").trim().replace(/^[A-Z_]+=/, "");
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

const LANG: Record<string, string> = { GB: "en", ES: "es", IT: "it", FR: "fr" };
const COMP: Record<string, string> = { GB: "premier-league", ES: "la-liga", IT: "serie-a", FR: "ligue-1" };

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift()!;
  return rows.filter(r => r.length === head.length)
             .map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

await client.connect();
const rows = parseCsv(readFileSync("scripts/venue-research/venues-with-contacts.csv", "utf8"));

let verified = 0, prospects = 0, skipped = 0;

for (const r of rows) {
  if (!r.name) continue;
  const country = r.country;
  const hasEmail = !!r.email;
  const status = hasEmail ? "verified" : "prospect";

  const res = await client.query(
    `insert into venues
       (name, country, city, address, website, language, competition_slug,
        contact_email, contact_email_status, contact_phone,
        fit_score, fit_reason, shows_live_sport, enrichment,
        source, status, enriched_at, verified_at)
     values ($1,$2,$3,$4,nullif($5,''),$6,$7,
             nullif($8,''), $9, nullif($10,''),
             $11, $12, $13, $14,
             'manual_research', $15,
             case when $9 = 'valid' then now() end,
             case when $9 = 'valid' then now() end)
     on conflict (lower(contact_email)) where contact_email is not null
       do nothing
     returning id`,
    [r.name, country, r.city, r.address, r.website, LANG[country] ?? "en", COMP[country] ?? "premier-league",
     r.email, hasEmail ? "valid" : "unverified", r.phone,
     hasEmail ? Number(r.fit_score) : null,
     hasEmail ? "Listed in a published local guide as a venue showing live football; contact email verified by fetching the venue's own website." : null,
     r.shows_live_sport === "true",
     JSON.stringify({ mock: true, source_note: "manual research pass, pre-Places-API", sport_signals: r.sport_signals }),
     status],
  );

  if (!res.rows.length) { skipped++; continue; }
  if (hasEmail) verified++; else prospects++;

  await client.query(
    `insert into venue_events (venue_id, kind, detail, source)
     values ($1, 'prospect_imported', $2, 'scraper')`,
    [res.rows[0].id, JSON.stringify({ city: r.city, country, via: "manual_research" })],
  );
}

const { rows: summary } = await client.query(`
  select country, city, count(*) total,
         count(*) filter (where contact_email is not null) with_email,
         count(*) filter (where contact_phone is not null) with_phone
  from venues where source = 'manual_research'
  group by country, city order by with_email desc`);

console.log(`\nLOADED  verified(with email): ${verified}   prospects: ${prospects}   duplicates skipped: ${skipped}\n`);
console.table(summary);

const { rows: tot } = await client.query(`
  select count(*) total,
         count(*) filter (where status='verified') ready_to_email,
         count(*) filter (where contact_phone is not null) with_phone
  from venues where source='manual_research'`);
console.table(tot);
await client.end();
