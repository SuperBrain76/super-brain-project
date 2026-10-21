/**
 * Recover the venues held by the ownership rule, by finding the address they
 * publish on their OWN website.
 *
 *   npx vite-node scripts/recover-held-contacts.ts            # dry run
 *   npx vite-node scripts/recover-held-contacts.ts --apply    # writes recover.sql
 *
 * 134 venues are held because the address we hold belongs to a pub group, an
 * agency or a parent club rather than to them — the bucket that bounced at
 * 35.9%. They are not junk: the reason we can TELL the address is wrong is that
 * the venue has a website of its own, and a venue with its own website usually
 * publishes its own address on it.
 *
 * So this re-scrapes each held venue's own site, preferring an address on the
 * venue's own domain, checks the candidate against the same ownership rule the
 * push uses, and verifies deliverability before proposing it. Everything that
 * decides anything is the production implementation — scrapeContact(),
 * addressBelongsToVenue(), verifyEmail() — so a venue recovered here is a venue
 * the live pipeline would also accept.
 *
 * Read-only against the database. Emits SQL for review rather than writing, and
 * sends nothing: a recovered venue re-enters the buffer and waits for the push
 * like any other.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import pg from "pg";
import { scrapeContact } from "../lib/enrichment";
import { addressBelongsToVenue, hostOf, domainOf } from "../lib/outreachTargeting";

const APPLY = process.argv.includes("--apply");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 500);
const OUT = "recover.sql";
const rd = (p: string) => (existsSync(p) ? readFileSync(p, "utf8").trim() : "");
const DB = process.env.SUPABASE_DB_URL || rd(".supabase-db-url.local");
const KEY = process.env.INSTANTLY_API_KEY || rd(`${process.env.HOME}/.instantly-api-key.local`);
if (!DB) { console.error("no database URL"); process.exit(1); }
if (!KEY) { console.error("no Instantly key — cannot verify a candidate"); process.exit(1); }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const q = (s: string) => "'" + String(s).replace(/'/g, "''") + "'";

/** Instantly's verifier, called directly so this script needs no server env. */
async function verify(email: string): Promise<{ verdict: string; catchAll: boolean | null }> {
  const H = { authorization: `Bearer ${KEY}`, "content-type": "application/json" };
  const base = "https://api.instantly.ai/api/v2/email-verification";
  try {
    let r: any = await (await fetch(base, { method: "POST", headers: H, body: JSON.stringify({ email }) })).json();
    for (let i = 0; i < 14 && String(r?.verification_status) === "pending"; i++) {
      await sleep(2500);
      const g = await fetch(`${base}/${encodeURIComponent(email)}`, { headers: H });
      if (g.ok) r = await g.json();
    }
    const raw = String(r?.verification_status ?? "unknown").toLowerCase();
    const catchAll = r?.catch_all === true ? true : r?.catch_all === false ? false : null;
    if (raw === "invalid" || raw === "undeliverable") return { verdict: "invalid", catchAll };
    if (raw === "verified" || raw === "valid") return { verdict: catchAll === true ? "risky" : "valid", catchAll };
    return { verdict: "unknown", catchAll };
  } catch { return { verdict: "unknown", catchAll: null }; }
}

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(
  `select id, name, country, contact_email, website, fit_score
     from venues
    where contact_email_status = 'risky'
      and enrichment->'targeting'->>'verdict' = 'wrong_owner'
      and coalesce(website,'') <> ''
      and outreach_pushed_at is null
    order by fit_score desc nulls last
    limit $1`, [LIMIT]);
await c.end();

console.log(`held venues with a website of their own: ${rows.length}`);
console.log(`${APPLY ? "APPLY — will write " + OUT : "DRY RUN — nothing will be written"}\n`);

type Outcome = "recovered" | "same_owner" | "none_published" | "invalid" | "risky" | "unknown" | "unreachable";
const results: Array<{ v: any; outcome: Outcome; email?: string; note: string }> = [];

const CONCURRENCY = 3;
let cursor = 0;
async function worker(n: number) {
  while (cursor < rows.length) {
    const v = rows[cursor++];
    const host = hostOf(v.website);
    try {
      const scrape = await scrapeContact(v.website, host);
      const found = scrape.email;
      if (!found) { results.push({ v, outcome: "unreachable", note: "no address found on the site" }); continue; }
      if (found.toLowerCase() === String(v.contact_email).toLowerCase()) {
        results.push({ v, outcome: "same_owner", note: "site publishes only the address we already hold" });
        continue;
      }
      const owner = addressBelongsToVenue(found, v.website);
      if (!owner.ok) {
        results.push({ v, outcome: "none_published", email: found, note: owner.reason });
        continue;
      }
      const ver = await verify(found);
      if (ver.verdict === "valid") {
        results.push({ v, outcome: "recovered", email: found, note: `verified, catch_all=${ver.catchAll}` });
      } else {
        results.push({ v, outcome: ver.verdict as Outcome, email: found, note: `verifier said ${ver.verdict}` });
      }
    } catch (e: any) {
      results.push({ v, outcome: "unreachable", note: String(e?.message ?? e).slice(0, 80) });
    }
    await sleep(400);     // be a polite guest on small pub websites
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

const by = (o: Outcome) => results.filter((r) => r.outcome === o);
console.log("── outcome ─────────────────────────────────────────────");
for (const o of ["recovered", "same_owner", "none_published", "risky", "invalid", "unknown", "unreachable"] as Outcome[]) {
  if (by(o).length) console.log(`  ${o.padEnd(16)} ${String(by(o).length).padStart(4)}`);
}
console.log("\n── recovered ───────────────────────────────────────────");
for (const r of by("recovered")) {
  console.log(`  ${String(r.v.name).slice(0, 30).padEnd(31)} ${String(r.v.contact_email).padEnd(42)} -> ${r.email}`);
}

if (APPLY && by("recovered").length) {
  const sql = [
    `-- Contact recovery, ${new Date().toISOString().slice(0, 10)}.`,
    `-- Each venue below was held because the address we had belonged to a group,`,
    `-- an agency or a parent company. The replacement was read from the venue's`,
    `-- OWN website, passes the same ownership rule the push applies, and was`,
    `-- verified deliverable. Nothing is sent by this: they re-enter the buffer.`,
    "",
    ...by("recovered").map((r) =>
      `update venues set contact_email = ${q(r.email!)}, contact_email_status = 'valid',\n` +
      `       enrichment = coalesce(enrichment,'{}'::jsonb) || jsonb_build_object(\n` +
      `         'targeting', jsonb_build_object('verdict','recovered',\n` +
      `           'reason', ${q(`own-domain address read from ${r.v.website}; was ${r.v.contact_email}`)},\n` +
      `           'at', now()),\n` +
      `         'verify', jsonb_build_object('verdict','valid','raw_status','verified','at', now()))\n` +
      ` where id = ${q(r.v.id)};`),
    "",
    `select count(*) as sendable_buffer from venues`,
    ` where status='verified' and contact_email_status='valid' and outreach_pushed_at is null`,
    `   and fit_score>=60 and enrichment->>'mock'='false' and country not in ('DE','AT');`,
  ].join("\n");
  writeFileSync(OUT, sql + "\n");
  console.log(`\nwrote ${OUT} — ${by("recovered").length} venue(s). Apply with:`);
  console.log(`  node scripts/run-sql.mjs --file ${OUT}`);
}
