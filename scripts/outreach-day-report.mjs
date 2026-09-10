#!/usr/bin/env node
/**
 * outreach-day-report.mjs — did the outreach pipeline have a normal day?
 *
 * Read-only. Touches nothing, sends nothing, changes nothing. Run it after the
 * sending window closes (11:00-13:00 Europe/Helsinki = 08:00-10:00 UTC).
 *
 *   node scripts/outreach-day-report.mjs            # today
 *   node scripts/outreach-day-report.mjs 2026-09-08 # a specific day
 *
 * Exists because "is it working?" was answered for eleven days by a CRM mirror
 * that had frozen, and the answer looked identical to a quiet weekend. Every
 * number here is read from the source of truth for that number: sends and
 * bounces from Instantly, supply from the database, job status from the GitHub
 * Actions API. Nothing is derived from our own mirror of someone else's state.
 *
 * COHORTS. The pre-verification cohort was pushed before any address was ever
 * checked for deliverability and bounced 6 of 21 leads (28.6%). The verifier-gated
 * cohort is everything pushed through the gate added 6 Sep 2026. They are
 * counted separately and permanently, because a blended rate would hide whether
 * the gate actually worked — membership is read from enrichment.verify on the
 * venue row, not from a date, so it stays correct as new leads are pushed.
 *
 * Key from ~/.instantly-api-key.local, DB from .supabase-db-url.local. Neither
 * is ever printed.
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
const REPO = "SuperBrain76/super-brain-project";
if (!KEY) { console.error("no Instantly API key"); process.exit(1) }
if (!DB)  { console.error("no database URL");     process.exit(1) }

const H = { authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const api = async (p, init) => {
  const r = await fetch("https://api.instantly.ai/api/v2" + p, { ...init, headers: H });
  if (!r.ok) throw new Error(`${p} -> ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
};
async function pageAll(p) {
  let out = [], after;
  for (;;) {
    const u = `${p}${p.includes("?") ? "&" : "?"}limit=100${after ? `&starting_after=${after}` : ""}`;
    const j = await api(u);
    out = out.concat(j.items ?? []);
    after = j.next_starting_after;
    if (!after) break;
  }
  return out;
}

const DAY = process.argv[2] || new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
const h = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 58 - t.length))}`);
const row = (k, v) => console.log(`  ${String(k).padEnd(34)} ${v}`);

console.log(`SuperBrain venue outreach — day report for ${DAY} (UTC)`);
console.log(`window 11:00-13:00 Europe/Helsinki = 08:00-10:00 UTC`);

// ── 1. did the scheduled jobs run? ──────────────────────────────────────────
h("1. scheduled jobs");
for (const [label, file] of [
  ["outreach-supply (push)", "outreach-supply.yml"],
  ["prospect-discovery",     "prospect-discovery.yml"],
  ["config-health",          "config-health.yml"],
]) {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${file}/runs?per_page=20`);
    const runs = (await r.json()).workflow_runs ?? [];
    const today = runs.filter((x) => String(x.created_at).slice(0, 10) === DAY);
    row(label, today.length
      ? today.map((x) => `${x.conclusion ?? x.status} @ ${x.created_at.slice(11, 16)}`).join(", ")
      : `no run on ${DAY} (last: ${runs[0]?.conclusion ?? "never"} ${runs[0]?.created_at?.slice(0,16) ?? ""})`);
  } catch (e) { row(label, `could not read: ${e.message}`) }
}

// ── 2-5. what Instantly actually did ────────────────────────────────────────
const camp = await api(`/campaigns/${encodeURIComponent(CAMPAIGN)}`);
const daily = await api(`/campaigns/analytics/daily?campaign_id=${encodeURIComponent(CAMPAIGN)}`);
const today = (Array.isArray(daily) ? daily : []).find((d) => d.date === DAY);
const sentEmails = await pageAll(`/emails?campaign_id=${encodeURIComponent(CAMPAIGN)}&email_type=sent`);
const received   = await pageAll(`/emails?campaign_id=${encodeURIComponent(CAMPAIGN)}&email_type=received`);
let leads = [], after;
do {
  const p = await api("/leads/list", { method: "POST",
    body: JSON.stringify({ campaign: CAMPAIGN, limit: 100, ...(after ? { starting_after: after } : {}) }) });
  leads = leads.concat(p.items ?? []); after = p.next_starting_after;
} while (after);

const onDay = (t) => t && String(new Date(t).toISOString()).slice(0, 10) === DAY;
const stepOf = (e) => { const p = String(e.step ?? "").split("_"); return p.length >= 2 ? Number(p[1]) + 1 : 1 };
const sentToday = sentEmails.filter((e) => onDay(e.timestamp_created ?? e.timestamp_email ?? e.created_at));

h("2. emails sent today");
row("campaign status", `${camp.status === 1 ? "ACTIVE" : camp.status} · cap ${camp.daily_limit}/day`);
row("Instantly analytics 'sent'", today?.sent ?? 0);
row("individual sent records", sentToday.length);

h("3. first sends vs follow-ups");
const first  = sentToday.filter((e) => stepOf(e) === 1);
const follow = sentToday.filter((e) => stepOf(e) > 1);
row("step 1 (first contact)", first.length);
row("step 2 (follow-up)", follow.length);
for (const e of sentToday) {
  const to = String(Array.isArray(e.to_address_email_list) ? e.to_address_email_list[0] : e.to_address_email_list ?? "");
  console.log(`     ${String(e.timestamp_created ?? "").slice(11,16)}  step ${stepOf(e)}  ${to}`);
}

// ── cohorts ─────────────────────────────────────────────────────────────────
const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows: vrows } = await c.query(
  `select lower(contact_email) email, name, outreach_pushed_at,
          enrichment->'verify'->>'verdict' verdict
     from venues where outreach_pushed_at is not null`);
const cohortOf = (email) => {
  const v = vrows.find((r) => r.email === String(email).toLowerCase());
  return v?.verdict ? "verifier-gated" : "pre-verification";
};

h("4. bounces, by cohort");
const bounced = leads.filter((l) => Number(l.status) === -1);
const contacted = leads.filter((l) => l.timestamp_last_contact);
for (const name of ["pre-verification", "verifier-gated"]) {
  const cB = bounced.filter((l) => cohortOf(l.email) === name);
  const cC = contacted.filter((l) => cohortOf(l.email) === name);
  const pct = cC.length ? ((cB.length / cC.length) * 100).toFixed(1) : "—";
  row(name, `${cB.length} bounced / ${cC.length} contacted = ${pct}%`);
  for (const l of cB) console.log(`     ${l.email}`);
}
// 21, not 26. Instantly's `contacted` analytics field counts contact EVENTS
// (31 of them); `new_leads_contacted` counts distinct leads, and totals 21 —
// which is what a bounce rate has to be measured against, and what the
// verifier-gated line above is measured against. The real pre-verification
// baseline is therefore 28.6%, not the 23% first reported from the wrong
// denominator.
row("baseline to beat", "pre-verification 6/21 leads = 28.6%");
const newToday = bounced.filter((l) => onDay(l.timestamp_last_contact));
row("bounced from today's sends", newToday.length ? newToday.map((l) => l.email).join(", ") : "none");

h("5. replies");
row("human replies (today)", today?.unique_replies ?? 0);
row("auto-replies (today)", today?.unique_replies_automatic ?? 0);
row("received records today", received.filter((e) => onDay(e.timestamp_created ?? e.created_at)).length);
row("human replies (lifetime)", leads.filter((l) => Number(l.email_reply_count ?? 0) > 0).length);
for (const e of received.filter((e) => onDay(e.timestamp_created ?? e.created_at))) {
  console.log(`     from ${e.from_address_email ?? "?"} — ${String(e.subject ?? "").slice(0, 70)}`);
}

h("6. leads remaining in Instantly");
const NAME = { 1: "ACTIVE", 2: "PAUSED", 3: "COMPLETED", "-1": "BOUNCED", "-2": "UNSUB", "-3": "SKIPPED" };
const by = {};
for (const l of leads) { const k = NAME[String(l.status)] ?? l.status; by[k] = (by[k] ?? 0) + 1 }
row("total leads", leads.length);
row("by status", JSON.stringify(by));
const queued = leads.filter((l) => Number(l.status) === 1 && !l.timestamp_last_contact);
row("queued (never contacted)", queued.length);
row("days of inventory", `${(queued.length / (camp.daily_limit || 12)).toFixed(1)} at ${camp.daily_limit}/day`);

// ── 7-8. supply outside Instantly ───────────────────────────────────────────
h("7-8. supply chain");
const q = async (sql, p = []) => (await c.query(sql, p)).rows[0];
const buf = await q(`select count(*)::int n from venues
  where status='verified' and contact_email_status='valid' and outreach_pushed_at is null
    and fit_score>=60 and enrichment->>'mock'='false' and country not in ('DE','AT')`);
const pros = await q(`select count(*)::int n from venues where status='prospect'`);
const risky = await q(`select count(*)::int n from venues where contact_email_status='risky'`);
const inval = await q(`select count(*)::int n from venues where contact_email_status='invalid'`);
const tot = await q(`select count(*)::int n from venues`);
const sw = (await c.query(`select country, city, imported, swept_at from prospect_sweeps
  order by swept_at desc limit 4`)).rows;
row("clean eligible buffer", `${buf.n}  (floor 100, target 150)`);
row("progress to floor", `${Math.round((buf.n / 100) * 100)}%`);
row("unenriched prospects waiting", pros.n);
row("held risky / suppressed invalid", `${risky.n} / ${inval.n}`);
row("venues in CRM", tot.n);
for (const s of sw) console.log(`     swept ${s.country}/${s.city}: ${s.imported} imported @ ${String(s.swept_at.toISOString()).slice(0,16)}`);
await c.end();

// ── 9. verdict ──────────────────────────────────────────────────────────────
h("9. verdict");
// Silence before the window opens is the schedule working, not a fault. The
// health endpoint has always known this; this script did not, and cried wolf
// every morning — which is exactly how a check earns the right to be ignored.
const sch = camp.campaign_schedule?.schedules?.[0];
const tz = sch?.timezone ?? "UTC";
const nowParts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
  timeZone: tz, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit",
}).formatToParts(new Date()).map((x) => [x.type, x.value]));
const DAYNUM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const sendingDay = Boolean(sch?.days?.[DAYNUM[String(nowParts.weekday)]]);
const localHHMM = `${nowParts.hour}:${nowParts.minute}`;
const windowOpened = sendingDay && sch?.timing?.from && localHHMM >= sch.timing.from;
const expectedToSend = DAY === new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date())
  ? windowOpened : true;   // a past day is always judged on its full window

const problems = [];
if (camp.status !== 1) problems.push("campaign is not ACTIVE");
if ((today?.sent ?? 0) === 0) {
  if (expectedToSend) problems.push(`no emails sent on ${DAY}`);
  else console.log(`  (window not open yet — ${localHHMM} ${tz}, opens ${sch?.timing?.from}` +
                   `${sendingDay ? "" : ", and today is not a sending day"}. Zero sends is correct.)`);
}
if (newToday.length) problems.push(`${newToday.length} bounce(s) from today's sends`);
if (queued.length < (camp.daily_limit || 12)) problems.push(`queue below one day (${queued.length})`);
if (buf.n < 100) problems.push(`buffer ${buf.n} below the floor of 100`);
console.log(problems.length ? problems.map((p) => `  ! ${p}`).join("\n") : "  no problems detected");
