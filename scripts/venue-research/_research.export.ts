import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
const conn = readFileSync(".supabase-db-url.local","utf8").trim().replace(/^[A-Z_]+=/,"");
const db = new pg.Client({ connectionString: conn, ssl:{ rejectUnauthorized:false } });
await db.connect();
const { rows } = await db.query(`
  select
    case when contact_email is not null then 'EMAIL READY'
         when contact_phone is not null then 'PHONE ONLY'
         else 'NEEDS LOOKUP' end as status,
    name, city, country, address,
    coalesce(contact_email,'') as email,
    coalesce(contact_phone,'') as phone,
    coalesce(website,'')       as website,
    coalesce(competition_slug,'') as league
  from venues where source='manual_research'
  order by (contact_email is null), (contact_phone is null), city, name`);
const cols = ["status","name","city","country","address","email","phone","website","league"];
const esc = (s:any)=>`"${String(s??"").replace(/"/g,'""')}"`;
writeFileSync("scripts/venue-research/SPORTS-BARS-100.csv",
  [cols.join(","), ...rows.map(r=>cols.map(c=>esc((r as any)[c])).join(","))].join("\n"));
console.log(`exported ${rows.length} rows`);
const { rows: byCity } = await db.query(`
  select city, count(*) total,
         count(*) filter (where contact_email is not null) email_ready,
         count(*) filter (where contact_email is null and contact_phone is not null) phone_only,
         count(*) filter (where contact_email is null and contact_phone is null) needs_lookup
  from venues where source='manual_research' group by city
  order by count(*) filter (where contact_email is not null) desc`);
console.table(byCity);
await db.end();
