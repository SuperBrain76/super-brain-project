# Working rules for this repository

Earned rules only. Each one exists because its absence cost something real, and
the cost is named so the rule is arguable rather than obeyed on faith.

## Run the suite before a production constant ships

When a constant or configuration value that production reads changes —
`SAFETY_CEILING`, `PROSPECT_BUFFER_MIN`, `OUTREACH_MIN_FIT_SCORE`, a cron
expression, a severity classification — run `npm test` **before** deploying, not
after.

`SAFETY_CEILING` went from 10 to 12 on 7 Sep 2026 and shipped unverified. Four
capacity tests broke. They were stale expectations hard-coded to the old
ceiling, which was luck: the same silence would have hidden a real regression
and nothing would have distinguished the two. `.github/workflows/ci.yml` now
typechecks and tests every push, so this is enforced rather than remembered.

Write test expectations against the constant (`SAFETY_CEILING - 6`), never
against the number it currently holds (`4`). The arithmetic is the invariant.

## A pure test suite cannot see the database

`automated` was added to `ReplyClass` on 8 Sep 2026 with 264 passing tests, and
every automated reply would have failed to insert: `venue_replies` has a CHECK
constraint that still listed the original five classes. The poller catches such
violations into an errors array and carries on, so the loss would have been
silent.

Any TypeScript union written into a column needs a migration in the same change,
and `tests/schema-contract.integration.test.ts` pins the two together in both
directions.

## Accept either secret — never `A || B`

`const secret = process.env.A || process.env.B` reads as a fallback and is not
one: the day A is set, B stops working, and every caller using B gets a silent
401. This took `/api/cron/instantly-poll` down for eleven days (24 Aug – 6 Sep
2026) while Instantly kept sending and the CRM mirror froze.

Build a list and test membership. Fail closed when the list is empty. Make any
scheduled caller treat 401 as a loud failure, never a no-op.

## Never put a business-critical job on a once-daily GitHub cron

On this repository they are best-effort. `outreach-supply` was scheduled at
06:00 UTC, then 20:00 UTC, and executed on neither — zero runs across two slots.
`config-health` at 06:00 UTC lands anywhere between 10:25 and 13:26. A
four-hourly schedule fires about five slots in six, within two hours.

Use `0 */4 * * *` and make the job decide for itself whether there is work to
do, so any single dropped slot costs nothing. Vercel Cron is the alternative and
does run, roughly fifty minutes late.

## Do not report an inference as a measurement

Instantly publishes no delivery event, so `sent - bounced` is **non-bounced
sends**, not delivered. `text_only` strips the tracking pixel, so zero opens is
an artefact of the send format and not a measurement. `contact_email_status =
'valid'` once meant an AI fit score, not a reachable mailbox, and 6 of 21 leads
bounced on the strength of that word.

Name what the number actually is. A monitoring system that overstates its own
certainty is worse than one that admits a blind spot, because nobody checks it.

## Silence is not a status

A report that omits a section when its data is missing teaches the reader that
absence means "fine". The daily brief said "No emails sent" on a Sunday, said
nothing at all when the weekly analytics job failed, and reported a frozen
mirror as a dead campaign. Every generator here now states what it does not
know, and separates "monitoring unavailable" from "nothing happened".
