#!/usr/bin/env node
/**
 * The daily outreach operating report. Numbers and one status. No analysis.
 *
 *   node scripts/outreach-daily.mjs            # today (UTC)
 *   node scripts/outreach-daily.mjs 2026-09-07
 *
 * Operating mode from 8 Sep 2026: 12/day is a SAFETY CEILING, not a target.
 * The objective is non-zero sending every weekday while verifier-gated contacts
 * accumulate. If this prints HEALTHY, change nothing.
 *
 * Definitions are deliberate, because conflating them corrupts the commercial
 * read later:
 *   - bounce denominator is DISTINCT VERIFIER-GATED VENUES ACTUALLY CONTACTED,
 *     never messages sent (a venue emailed twice is one venue, not two);
 *   - human reply = anything the classifier did not call `automated`, matching
 *     isHumanReply() in lib/replyClassifier.ts. A robot is not a reply;
 *   - positive reply = `positive_interested`, the class briefPriority() ranks HIGH.
 *
 * Instantly queue depth is intentionally NOT fetched. It lives behind
 * /api/admin/outreach-health, which needs CRON_SECRET; standing instruction is
 * to report it unreadable rather than build another integration for one number.
 * Upstream CRM inventory already tells us whether supply is healthy.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const day = process.argv[2] || new Date().toISOString().slice(0, 10);
const c = new pg.Client({ connectionString: readFileSync(".supabase-db-url.local", "utf8").trim() });
await c.connect();
const one = async (sql, p = []) => (await c.query(sql, p)).rows[0];

const sends = await one(
  `select count(*) filter (where step <= 1)::int as first_sends,
          count(*) filter (where step  > 1)::int as follow_ups,
          count(*)::int                          as total
     from outreach_messages
    where status = 'sent' and sent_at::date = $1::date`, [day]);

// Denominator: distinct verifier-gated venues actually contacted (all time).
const cohort = await one(
  `select count(distinct m.venue_id)::int as venues_contacted
     from outreach_messages m join venues v on v.id = m.venue_id
    where m.status = 'sent' and v.contact_email_status = 'valid'`);

const bounces = await one(
  `select count(distinct m.venue_id) filter (where m.bounced_at::date = $1::date)::int as today,
          count(distinct m.venue_id)::int                                              as cumulative
     from outreach_messages m join venues v on v.id = m.venue_id
    where m.bounced_at is not null and v.contact_email_status = 'valid'`, [day]);

const replies = await one(
  `select count(*) filter (where received_at::date = $1::date and coalesce(classification,'') <> 'automated')::int as human_today,
          count(*) filter (where coalesce(classification,'') <> 'automated')::int                                  as human_total,
          count(*) filter (where received_at::date = $1::date and classification = 'positive_interested')::int      as pos_today,
          count(*) filter (where classification = 'positive_interested')::int                                       as pos_total
     from venue_replies`, [day]);

const inv = await one(
  `select count(*) filter (where outreach_pushed_at is null and contact_email_status = 'valid'
                             and coalesce(country,'') not in ('DE','AT'))::int as unpushed
     from venues`);

const pct = cohort.venues_contacted ? (bounces.cumulative / cohort.venues_contacted) * 100 : 0;
const now = new Date();
const isToday = day === now.toISOString().slice(0, 10);
const windowClosed = !isToday || now.getUTCHours() >= 10;   // Instantly: 08:00-10:00 UTC
const weekday = ![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());

let status, note;
if (windowClosed && weekday && sends.total === 0) { status = "FAILED"; note = "no emails sent on a scheduled sending day"; }
else if (inv.unpushed === 0)                      { status = "FAILED"; note = "verified supply is dry"; }
else if (pct >= 5)                                { status = "ATTENTION"; note = `gated bounce rate ${pct.toFixed(1)}%`; }
else if (inv.unpushed < 12)                       { status = "ATTENTION"; note = "under one day of verified inventory"; }
else if (!windowClosed)                           { status = "HEALTHY"; note = "sending window still open"; }
else                                              { status = "HEALTHY"; note = "emails sending, no material problem"; }

console.log(`
SUPERBRAIN OUTREACH — ${day} (UTC)

  1. first sends ....................... ${sends.first_sends}
  2. follow-ups ........................ ${sends.follow_ups}
  3. total emails sent ................. ${sends.total}
  4. gated hard bounces / venues ....... ${bounces.cumulative} / ${cohort.venues_contacted}  (${pct.toFixed(1)}%)${bounces.today ? `   [${bounces.today} today]` : ""}
  5. human replies ..................... ${replies.human_today} today, ${replies.human_total} total
  6. positive replies .................. ${replies.pos_today} today, ${replies.pos_total} total
  7. verified Instantly queue .......... not readable from this environment
  8. verified/mailable unpushed CRM .... ${inv.unpushed}  (~${(inv.unpushed / 12).toFixed(1)} days at the 12/day ceiling)

  STATUS: ${status} — ${note}
  cohort: ${cohort.venues_contacted} verifier-gated venues contacted
`);
await c.end();
