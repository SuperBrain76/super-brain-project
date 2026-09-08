#!/usr/bin/env node
/**
 * outreach-funnel.mjs — the response funnel, by cohort. Read-only.
 *
 *   node scripts/outreach-funnel.mjs            # aggregates + venue drill-down
 *   node scripts/outreach-funnel.mjs --summary  # aggregates only
 *
 * TWO COHORTS, NEVER BLENDED.
 *
 *   pre-verification  everything pushed before 6 Sep 2026. Never AI-scored
 *                     (enrichment.mock = true), never deliverability-checked,
 *                     and a quarter of the addresses were dead. Historical
 *                     context only — it cannot be used to judge targeting,
 *                     copy or deliverability.
 *   verifier-gated    everything pushed through the verification gate. This is
 *                     the only cohort any commercial conclusion may rest on.
 *
 * Membership is read from `enrichment.verify` on the venue row, not from a
 * date, so new leads classify themselves.
 *
 * WHAT "DELIVERED" IS NOT.
 *
 * Instantly publishes no delivery event and no delivery field: its event map is
 * sent / opened / clicked / replied / bounced / unsubscribed, and a sent-email
 * record carries no status of any kind. So this report never claims delivery.
 * It reports NON-BOUNCED SENDS — sends we did not hear a bounce for — which is
 * a weaker statement, and the only one the data supports. A silent drop, a spam
 * folder and a read inbox are indistinguishable to us.
 *
 * Opens are not reported at all. `text_only` strips the tracking pixel, so the
 * zero in that column is an artefact of the send format and not a measurement.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const rd = (p) => { try { return fs.readFileSync(p, "utf8").trim() } catch { return "" } };
const KEY = process.env.INSTANTLY_API_KEY || rd(`${process.env.HOME}/.instantly-api-key.local`);
const DB  = process.env.SUPABASE_DB_URL   || rd(`${ROOT}/.supabase-db-url.local`);
const CAMPAIGN = process.env.INSTANTLY_CAMPAIGN_DEFAULT
  || rd(`${ROOT}/.instantly-campaign-id.local`) || "ef3e05e7-6f31-4183-a29a-95df74d64441";
if (!KEY || !DB) { console.error("need the Instantly key and the database URL"); process.exit(1) }
const SUMMARY_ONLY = process.argv.includes("--summary");

const H = { authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const api = async (p, init) => {
  const r = await fetch("https://api.instantly.ai/api/v2" + p, { ...init, headers: H });
  if (!r.ok) throw new Error(`${p} -> ${r.status}`);
  return r.json();
};
async function pageAll(p) {
  let out = [], after;
  for (;;) {
    const j = await api(`${p}${p.includes("?") ? "&" : "?"}limit=100${after ? `&starting_after=${after}` : ""}`);
    out = out.concat(j.items ?? []); after = j.next_starting_after; if (!after) break;
  }
  return out;
}

// ── source data ─────────────────────────────────────────────────────────────
const sent = await pageAll(`/emails?campaign_id=${encodeURIComponent(CAMPAIGN)}&email_type=sent`);
let leads = [], after;
do {
  const p = await api("/leads/list", { method: "POST",
    body: JSON.stringify({ campaign: CAMPAIGN, limit: 100, ...(after ? { starting_after: after } : {}) }) });
  leads = leads.concat(p.items ?? []); after = p.next_starting_after;
} while (after);

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows: vrows } = await c.query(`
  select id, lower(contact_email) email, name, country, fit_score,
         enrichment->'verify'->>'verdict' verdict,
         enrichment->>'venue_type' vtype,
         status, first_emailed_at, emails_sent,
         signed_up_at, trial_started_at, onboarded_at, paid_at
    from venues where outreach_pushed_at is not null`);
const { rows: rrows } = await c.query(
  `select venue_id, lower(from_email) email, classification, received_at from venue_replies`);
await c.end();

// ── join ────────────────────────────────────────────────────────────────────
const byEmail = new Map(vrows.map((v) => [v.email, v]));
const stepOf = (e) => { const p = String(e.step ?? "").split("_"); return p.length >= 2 ? Number(p[1]) + 1 : 1 };
const toOf = (e) => String(Array.isArray(e.to_address_email_list)
  ? e.to_address_email_list[0] : e.to_address_email_list ?? "").toLowerCase().split(",")[0].trim();

const rec = new Map();   // email -> per-venue record
for (const l of leads) {
  const email = String(l.email).toLowerCase();
  const v = byEmail.get(email) ?? {};
  rec.set(email, {
    email, name: v.name ?? "(not in CRM)", country: v.country ?? "?", fit: v.fit_score ?? null,
    vtype: v.vtype ?? null,
    cohort: v.verdict ? "verifier-gated" : "pre-verification",
    contacted: Boolean(l.timestamp_last_contact),
    bounced: Number(l.status) === -1,
    completed: Number(l.status) === 3,
    active: Number(l.status) === 1,
    sends: 0, step1: 0, step2plus: 0,
    auto: 0, human: 0, positive: 0, negative: 0, needs_review: 0, unsub: 0,
    signed_up: Boolean(v.signed_up_at), launched: Boolean(v.onboarded_at), paid: Boolean(v.paid_at),
  });
}
for (const e of sent) {
  const r = rec.get(toOf(e)); if (!r) continue;
  r.sends++; if (stepOf(e) === 1) r.step1++; else r.step2plus++;
}
for (const rp of rrows) {
  const r = rec.get(rp.email); if (!r) continue;
  const k = rp.classification;
  if (k === "automated") { r.auto++; continue; }          // never a human reply
  r.human++;
  if (k === "positive_interested") r.positive++;
  else if (k === "negative" || k === "negative_unsubscribe") r.negative++;
  else r.needs_review++;
  if (k === "negative_unsubscribe") r.unsub++;
}

// ── aggregate ───────────────────────────────────────────────────────────────
const sum = (rows, f) => rows.reduce((a, r) => a + f(r), 0);
const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");
const line = (label, n, denLabel, d) =>
  console.log(`  ${label.padEnd(26)} ${String(n).padStart(5)}   ${pct(n, d).padStart(7)}  of ${d} ${denLabel}`);

function report(title, rows, note) {
  const contacted   = rows.filter((r) => r.contacted);
  const bounced     = contacted.filter((r) => r.bounced);
  const reachable   = contacted.filter((r) => !r.bounced);   // never bounced on us
  const sends       = sum(contacted, (r) => r.sends);
  const bouncedSend = sum(bounced,   (r) => r.sends);

  console.log(`\n${"═".repeat(72)}\n${title}   —   ${contacted.length} venues contacted`);
  if (note) console.log(`  ${note}`);
  console.log("─".repeat(72));
  console.log(`  emails sent                ${String(sends).padStart(5)}`);
  line("non-bounced sends", sends - bouncedSend, "sends", sends);
  console.log(`     ^ NOT confirmed delivery. Instantly publishes no delivery event;`);
  console.log(`       this is only "we heard no bounce". Spam folders are invisible.`);
  line("hard bounced (venues)", bounced.length, "contacted", contacted.length);
  line("automatic replies", sum(contacted, (r) => r.auto), "contacted", contacted.length);
  line("HUMAN replies", sum(reachable, (r) => r.human), "reachable", reachable.length);
  const human = sum(reachable, (r) => r.human);
  line("  positive", sum(reachable, (r) => r.positive), "human replies", human);
  line("  negative", sum(reachable, (r) => r.negative), "human replies", human);
  line("  needs review", sum(reachable, (r) => r.needs_review), "human replies", human);
  line("signups", sum(reachable, (r) => (r.signed_up ? 1 : 0)), "reachable", reachable.length);
  line("venues launched", sum(reachable, (r) => (r.launched ? 1 : 0)), "reachable", reachable.length);
  return { contacted, reachable, bounced, sends };
}

const all = [...rec.values()];
const gated = all.filter((r) => r.cohort === "verifier-gated");
const hist  = all.filter((r) => r.cohort === "pre-verification");

console.log(`SuperBrain venue outreach — response funnel`);
console.log(`${new Date().toISOString().slice(0, 16)}Z · opens are not reported: text_only strips the pixel`);

const g = report("VERIFIER-GATED COHORT  (the only cohort conclusions may rest on)", gated);
report("PRE-VERIFICATION COHORT  (historical context only — do not judge copy or targeting on it)", hist,
  "Never AI-scored (enrichment.mock = true), never deliverability-checked.");
report("COMBINED LIFETIME  (secondary context only)", all,
  "Blends two different populations. Shown so totals reconcile, not to be reasoned from.");

// ── sequence progress, verifier-gated only ──────────────────────────────────
console.log(`\n${"═".repeat(72)}\nVERIFIER-GATED — sequence progress`);
console.log("─".repeat(72));
const gc = g.contacted;
console.log(`  distinct venues contacted  ${String(gc.length).padStart(5)}`);
console.log(`  first emails sent          ${String(sum(gc, (r) => r.step1)).padStart(5)}`);
console.log(`  follow-ups sent            ${String(sum(gc, (r) => r.step2plus)).padStart(5)}`);
console.log(`  awaiting follow-up         ${String(gc.filter((r) => r.active && r.step1 > 0 && r.step2plus === 0).length).padStart(5)}`);
console.log(`  sequence completed         ${String(gc.filter((r) => r.completed).length).padStart(5)}`);
console.log(`  pushed, not yet contacted  ${String(gated.filter((r) => !r.contacted).length).padStart(5)}`);

// ── drill-down ──────────────────────────────────────────────────────────────
if (!SUMMARY_ONLY) {
  console.log(`\n${"═".repeat(72)}\nVENUE DRILL-DOWN — every aggregate above re-adds from these rows`);
  console.log("─".repeat(72));
  const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);
  for (const cohort of ["verifier-gated", "pre-verification"]) {
    console.log(`\n[${cohort}]`);
    console.log("  " + pad("venue", 30) + pad("cc", 3) + pad("fit", 4) + pad("snd", 4) + pad("s1", 3) + pad("s2", 3) +
                pad("bounce", 7) + pad("auto", 5) + pad("human", 6) + pad("signup", 7) + "state");
    for (const r of all.filter((x) => x.cohort === cohort && x.contacted)
                       .sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0))) {
      console.log("  " + pad(r.name, 30) + pad(r.country, 3) + pad(r.fit, 4) + pad(r.sends, 4) +
        pad(r.step1, 3) + pad(r.step2plus, 3) + pad(r.bounced ? "YES" : "-", 7) +
        pad(r.auto || "-", 5) + pad(r.human || "-", 6) + pad(r.signed_up ? "YES" : "-", 7) +
        (r.bounced ? "bounced" : r.completed ? "completed" : r.active ? "active" : "other"));
    }
    const queued = all.filter((x) => x.cohort === cohort && !x.contacted);
    if (queued.length) console.log(`  … plus ${queued.length} pushed but not yet contacted: ${queued.map((r) => r.name).join(", ")}`);
  }
}
