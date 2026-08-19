/**
 * Scrub placeholder contacts out of the researched set.
 *
 * Form templates ship with dummy addresses (user@domain.com, nom@domain.com,
 * your@email.com) and my phone regex was loose enough to swallow tracking IDs.
 * Both look like real data in a spreadsheet, which is exactly why they have to
 * go before anyone sends anything.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
const conn = readFileSync(".supabase-db-url.local","utf8").trim().replace(/^[A-Z_]+=/,"");
const db = new pg.Client({ connectionString: conn, ssl:{ rejectUnauthorized:false } });
await db.connect();

const PLACEHOLDER = [
  "user@domain.com","nom@domain.com","name@domain.com","email@domain.com",
  "your@email.com","youremail@domain.com","email@example.com","test@test.com",
  "nombre@dominio.com","info@domain.com","mail@domain.com","abc@domain.com",
];

const { rows: badEmail } = await db.query(
  `select id, name, contact_email from venues
   where source='manual_research' and lower(contact_email) = any($1)`, [PLACEHOLDER]);

for (const v of badEmail) {
  await db.query(
    `update venues set contact_email=null, contact_email_status='unverified',
        status = case when contact_phone is not null then 'prospect' else 'prospect' end,
        verified_at=null, fit_score=null,
        fit_reason='placeholder email found on site — needs a real lookup'
     where id=$1`, [v.id]);
  console.log(`  dropped placeholder email: ${v.name} <${v.contact_email}>`);
}

// A phone is plausible at 7-15 digits (ITU E.164 caps at 15). Anything longer
// is an analytics id that happened to match the pattern.
const { rows: badPhone } = await db.query(
  `select id, name, contact_phone from venues
   where source='manual_research' and contact_phone is not null
     and (length(regexp_replace(contact_phone,'\\D','','g')) > 15
       or length(regexp_replace(contact_phone,'\\D','','g')) < 7)`);

for (const v of badPhone) {
  await db.query(`update venues set contact_phone=null where id=$1`, [v.id]);
  console.log(`  dropped implausible phone: ${v.name} (${v.contact_phone})`);
}

const { rows: tot } = await db.query(`
  select count(*) total,
         count(*) filter (where contact_email is not null) email_ready,
         count(*) filter (where contact_email is null and contact_phone is not null) phone_only,
         count(*) filter (where contact_email is not null or contact_phone is not null) contactable
  from venues where source='manual_research'`);
console.log("\nafter cleaning:");
console.table(tot);
await db.end();
