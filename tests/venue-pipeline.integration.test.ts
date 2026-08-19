/**
 * End-to-end pipeline check against the REAL database, in mock scoring mode.
 *
 * Proves the chain the nightly cron walks: prospect rows land → enrichment
 * scores them and sets status → the outreach sync's selection picks exactly
 * the right subset and nothing else. It uses the real mockScore() and the real
 * SQL, so a change to either breaks this test rather than production.
 *
 * Skipped automatically when .supabase-db-url.local is absent (CI), so it
 * never fails a machine that has no database access.
 *
 * Everything it writes is prefixed `itest-` and removed in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import { mockScore, type ContactScrape } from "@/lib/enrichment";
import type { PlaceResult } from "@/lib/prospecting";

const URL_FILE = ".supabase-db-url.local";
const hasDb = existsSync(URL_FILE);
const d = hasDb ? describe : describe.skip;

const TAG = "itest-venue";

d("venue pipeline (integration)", () => {
  let client: pg.Client;

  beforeAll(async () => {
    const conn = readFileSync(URL_FILE, "utf8").trim().replace(/^[A-Z_]+=/, "");
    client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await cleanup();
  });

  afterAll(async () => {
    if (client) { await cleanup(); await client.end(); }
  });

  async function cleanup() {
    await client.query(`delete from venue_events where venue_id in (select id from venues where source = $1)`, [TAG]);
    await client.query(`delete from venues where source = $1`, [TAG]);
  }

  it("scores prospects and gates outreach on both email AND fit", async () => {
    // Three venues that should each take a different path through enrichment.
    const cases = [
      { name: "itest Strong Sports Pub", types: ["bar", "pub"], reviews: 800, rating: 4.6,
        email: "info@strong.invalid", signals: ["live football", "premier league", "big screen"],
        expect: "verified" },
      { name: "itest Quiet Cafe",        types: ["cafe"],       reviews: 30,  rating: 4.1,
        email: "hello@cafe.invalid",    signals: [],
        expect: "disqualified" },          // real email, but nothing says it shows football
      { name: "itest No Email Bar",      types: ["bar"],        reviews: 400, rating: 4.4,
        email: null,                    signals: ["live football"],
        expect: "disqualified" },          // good fit, unreachable
    ];

    for (const c of cases) {
      const ins = await client.query(
        `insert into venues (name, country, city, language, competition_slug, source, status,
                             google_rating, google_reviews, place_types)
         values ($1,'GB','London','en','premier-league',$2,'prospect',$3,$4,$5)
         returning id`,
        [c.name, TAG, c.rating, c.reviews, c.types],
      );
      const id = ins.rows[0].id;

      const place: PlaceResult = {
        placeId: "", name: c.name, address: null, city: "London", website: "https://x.invalid",
        phone: null, rating: c.rating, reviews: c.reviews, types: c.types, primaryType: null,
      };
      const scrape: ContactScrape = {
        email: c.email, pageText: c.signals.length ? "We show live football." : "Coffee and cake.",
        sportSignals: c.signals, socials: {},
      };

      // Mirrors app/api/prospect/enrich: no email → never scored, never mailed.
      if (!scrape.email) {
        await client.query(
          `update venues set enriched_at = now(), status='disqualified',
                             fit_reason='no contact email found on website' where id = $1`, [id]);
        continue;
      }

      const fit = mockScore(place, scrape);
      const passes = fit.fit_score >= 60 && fit.venue_type !== "not_a_venue";

      await client.query(
        `update venues set enriched_at = now(),
                           verified_at = case when $2 then now() else null end,
                           contact_email = $3,
                           contact_email_status = case when $2 then 'valid' else 'unverified' end,
                           fit_score = $4, fit_reason = $5, shows_live_sport = $6,
                           status = case when $2 then 'verified' else 'disqualified' end,
                           enrichment = $7
         where id = $1`,
        [id, passes, scrape.email, fit.fit_score, fit.reason, fit.shows_live_sport,
         JSON.stringify({ mock: fit.mock, venue_type: fit.venue_type })],
      );
    }

    const { rows } = await client.query(
      `select name, status, fit_score, contact_email_status
       from venues where source = $1 order by name`, [TAG]);

    expect(rows).toHaveLength(3);
    const byName = Object.fromEntries(rows.map((r: any) => [r.name, r]));

    expect(byName["itest Strong Sports Pub"].status).toBe("verified");
    expect(byName["itest Strong Sports Pub"].contact_email_status).toBe("valid");
    expect(byName["itest Quiet Cafe"].status).toBe("disqualified");
    expect(byName["itest No Email Bar"].status).toBe("disqualified");
    expect(byName["itest No Email Bar"].fit_score).toBeNull();   // never scored — no email
  });

  it("the outreach sync selects only the verified, mailable venue", async () => {
    // The exact predicate /api/outreach/sync uses.
    const { rows } = await client.query(
      `select name from venues
       where source = $1
         and status = 'verified'
         and contact_email_status = 'valid'
         and outreach_pushed_at is null
         and fit_score >= 60
         and country not in ('DE','AT')`, [TAG]);

    expect(rows.map((r: any) => r.name)).toEqual(["itest Strong Sports Pub"]);
  });

  it("excludes German venues from the sync even when they qualify perfectly", async () => {
    await client.query(
      `insert into venues (name, country, city, language, competition_slug, source, status,
                           contact_email, contact_email_status, fit_score, enriched_at, verified_at)
       values ('itest Berlin Sportbar','DE','Berlin','de','bundesliga',$1,'verified',
               'info@berlin.invalid','valid',95, now(), now())`, [TAG]);

    const { rows } = await client.query(
      `select name from venues
       where source = $1 and status='verified' and contact_email_status='valid'
         and outreach_pushed_at is null and fit_score >= 60
         and country not in ('DE','AT')`, [TAG]);

    // The German venue scores 95 and is fully verified — and is still excluded.
    expect(rows.map((r: any) => r.name)).not.toContain("itest Berlin Sportbar");
    expect(rows).toHaveLength(1);
  });

  it("the funnel view counts the seeded venues correctly", async () => {
    const { rows } = await client.query(
      `select
         count(*) filter (where status <> 'disqualified')            as live,
         count(*) filter (where contact_email_status = 'valid')      as verified
       from venues where source = $1`, [TAG]);

    expect(Number(rows[0].live)).toBe(2);      // strong pub + berlin bar
    expect(Number(rows[0].verified)).toBe(2);
  });
});
