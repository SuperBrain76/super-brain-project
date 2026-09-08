#!/usr/bin/env node
/**
 * The daily outreach line. Six numbers, nothing else.
 *
 *   node scripts/outreach-daily.mjs          # today (UTC)
 *   node scripts/outreach-daily.mjs 2026-09-07
 *
 * Operating mode from 8 Sep 2026: 12/day is a SAFETY CEILING, not a target.
 * The objective is non-zero sending every day while clean contacts accumulate.
 * This reports; it does not judge. Only five things justify touching the
 * pipeline: bounces in the verifier-gated cohort, sending stopped, supply dry,
 * auth/API failure, or a deliverability risk.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const day = process.argv[2] || new Date().toISOString().slice(0, 10);
const c = new pg.Client({ connectionString: readFileSync(".supabase-db-url.local", "utf8").trim() });
await c.connect();
const one = async (sql, p = []) => (await c.query(sql, p)).rows[0];

const sends = await one(
  `select
     count(*) filter (where step <= 1)::int as first_sends,
     count(*) filter (where step  > 1)::int as follow_ups,
     count(*)::int                          as total
   from outreach_messages
   where status = 'sent' and sent_at::date = $1::date`, [day]);

// Bounces only matter in the cohort the verifier passed - that is the gate we
// are trusting. A bounce among addresses it never blessed proves nothing.
const bounces = await one(
  `select
     count(*) filter (where m.bounced_at::date = $1::date)::int as today,
     count(*)::int                                              as cumulative
   from outreach_messages m join venues v on v.id = m.venue_id
   where m.bounced_at is not null and v.contact_email_status = 'valid'`, [day]);

const replies = await one(
  `select
     count(*) filter (where received_at::date = $1::date)::int as today,
     count(*)::int                                             as cumulative
   from venue_replies
   where coalesce(classification,'') not in ('automated','bounce')`, [day]);

const inv = await one(
  `select
     count(*) filter (where outreach_pushed_at is null and contact_email_status = 'valid'
                        and coalesce(country,'') not in ('DE','AT'))::int as ready_unpushed,
     count(*) filter (where contact_email_status = 'valid')::int          as verified_total,
     count(*) filter (where first_emailed_at is not null)::int            as ever_contacted
   from venues`);

const gated = await one(
  `select count(*)::int as n from outreach_messages m join venues v on v.id = m.venue_id
    where m.status='sent' and v.contact_email_status='valid'`);
const rate = gated.n ? ((bounces.cumulative / gated.n) * 100).toFixed(1) : "0.0";

console.log(`
OUTREACH — ${day} (UTC)
  first sends ................ ${sends.first_sends}
  follow-ups ................. ${sends.follow_ups}
  total sent ................. ${sends.total}
  gated bounces .............. ${bounces.today}   (cumulative ${bounces.cumulative} of ${gated.n} gated sends = ${rate}%)
  human replies .............. ${replies.today}   (cumulative ${replies.cumulative})
  verified inventory left .... ${inv.ready_unpushed} unpushed  (~${(inv.ready_unpushed / 12).toFixed(1)} days at the 12/day ceiling)

  contacts banked: ${inv.ever_contacted}   — evaluate response rate at 25-50 clean contacts
`);
await c.end();
