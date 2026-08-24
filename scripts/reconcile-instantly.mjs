#!/usr/bin/env node
/**
 * reconcile-instantly.mjs — compare what Instantly knows against what our CRM
 * stored, and backfill anything the webhook did not deliver.
 *
 * Why this exists: Instantly's UI gates webhook creation behind Hyper Growth,
 * but the v2 API accepts webhook creation on Growth. The records exist; whether
 * Instantly actually DELIVERS them on this plan is unproven until real traffic
 * flows. This closes that gap without an upgrade and without a second system —
 * it writes to the same venue_replies table, through the same classifier.
 *
 * Read-only against Instantly. Idempotent: the (venue_id, from_email,
 * received_at) unique index means re-running never duplicates a reply.
 *
 *   node scripts/reconcile-instantly.mjs            # report only
 *   node scripts/reconcile-instantly.mjs --apply    # also backfill the CRM
 *
 * Key is read from ~/.instantly-api-key.local and never printed.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve(import.meta.dirname, "..");
const readLocal = (p) => { try { return fs.readFileSync(p, "utf8").trim() } catch { return "" } };

const KEY = process.env.INSTANTLY_API_KEY || readLocal(`${process.env.HOME}/.instantly-api-key.local`);
const CAMPAIGN = process.env.INSTANTLY_CAMPAIGN_DEFAULT || readLocal(`${ROOT}/.instantly-campaign-id.local`);
const DB = process.env.SUPABASE_DB_URL || readLocal(`${ROOT}/.supabase-db-url.local`);
if (!KEY) { console.error("no Instantly API key available"); process.exit(1) }
if (!DB)  { console.error("no database URL available"); process.exit(1) }

const api = async (p) => {
  const r = await fetch("https://api.instantly.ai/api/v2" + p,
    { headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" } });
  if (!r.ok) throw new Error(`${p} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

// Pull every received email for the campaign, following pagination.
async function fetchReplies() {
  const out = [];
  let cursor = "";
  for (let page = 0; page < 20; page++) {
    const q = `/emails?campaign_id=${encodeURIComponent(CAMPAIGN)}&email_type=received&limit=100${cursor ? `&starting_after=${cursor}` : ""}`;
    const r = await api(q);
    const items = r.items ?? [];
    out.push(...items);
    if (!r.next_starting_after || items.length === 0) break;
    cursor = r.next_starting_after;
  }
  return out;
}

const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const replies = await fetchReplies();
  console.log(`Instantly reports ${replies.length} received email(s) on this campaign`);

  const { rows: stored } = await client.query(
    `select from_email, received_at from public.venue_replies`);
  const seen = new Set(stored.map(r => `${String(r.from_email).toLowerCase()}|${new Date(r.received_at).toISOString()}`));
  console.log(`CRM currently holds ${stored.length} classified reply/replies`);

  const missing = [];
  for (const e of replies) {
    const from = String(e.from_address_email ?? e.lead ?? e.from_address ?? "").toLowerCase().trim();
    const atRaw = e.timestamp_created ?? e.timestamp_email ?? e.created_at;
    if (!from || !atRaw) { console.log(`  ! skipping an email with no sender/timestamp (id ${e.id})`); continue }
    const at = new Date(atRaw).toISOString();
    if (!seen.has(`${from}|${at}`)) missing.push({ from, at, text: e.body?.text ?? e.body_text ?? "", subject: e.subject ?? null });
  }

  if (!missing.length) {
    console.log("\nNothing missing — every Instantly reply is present and classified in the CRM.");
    console.log(replies.length ? "Webhook delivery is working on this plan." : "(No replies yet, so delivery remains unproven.)");
  } else {
    console.log(`\n${missing.length} reply/replies present in Instantly but MISSING from the CRM:`);
    for (const m of missing) console.log(`  ${m.from}  ${m.at}  "${String(m.text).replace(/\s+/g, " ").slice(0, 70)}"`);
    console.log(missing.length ? "\n=> Webhooks are NOT delivering on this plan. Backfill with --apply and schedule this script." : "");
  }

  if (APPLY && missing.length) {
    // Reuse the deployed classifier rather than reimplementing the rules.
    const { classifyReply } = await import(`${ROOT}/lib/replyClassifier.ts`).catch(() => ({}));
    let inserted = 0, unmatched = 0;
    for (const m of missing) {
      const { rows: v } = await client.query(
        `select id from public.venues where lower(contact_email)=$1 limit 1`, [m.from]);
      if (!v.length) { unmatched++; console.log(`  no venue for ${m.from} — left alone`); continue }
      const verdict = classifyReply ? classifyReply(m.text)
        : { classification: "needs_review", reason: "backfilled without classifier", rule_matched: "backfill", confidence: "low" };
      await client.query(
        `insert into public.venue_replies
           (venue_id, from_email, reply_subject, reply_text, received_at,
            classification, reason, rule_matched, confidence, classified_at, classifier)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), 'rules-v1-backfill')
         on conflict (venue_id, from_email, received_at) do nothing`,
        [v[0].id, m.from, m.subject, m.text, m.at,
         verdict.classification, verdict.reason, verdict.rule_matched, verdict.confidence]);
      // Only ever move a venue forward, same rule the webhook path follows.
      await client.query(
        `update public.venues set status='replied'
          where id=$1 and status in ('verified','contacted','opened')`, [v[0].id]);
      inserted++;
    }
    console.log(`\nbackfilled ${inserted}, unmatched ${unmatched}`);
  }
} finally {
  await client.end();
}
