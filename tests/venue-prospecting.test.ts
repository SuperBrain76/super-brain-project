/**
 * Prospecting + enrichment unit tests.
 *
 * These cover the pure decision logic that decides whether a stranger's
 * business gets a cold email: the Places prefilter, the offline fit scorer,
 * and the country routing that keeps Germany out of every campaign. All of it
 * runs without network or database.
 */

import { describe, it, expect } from "vitest";
import { prefilter, type PlaceResult } from "@/lib/prospecting";
import { mockScore, type ContactScrape , pickEmail } from "@/lib/enrichment";
import { campaignFor, languageFor, competitionFor } from "@/lib/instantly";
import { slugify, advances } from "@/lib/venueDb";

const place = (over: Partial<PlaceResult> = {}): PlaceResult => ({
  placeId: "p1", name: "The Offside", address: "1 High St", city: "Manchester",
  website: "https://example.com", phone: null, rating: 4.5, reviews: 300,
  types: ["bar", "point_of_interest"], primaryType: "bar", ...over,
});

const scrape = (over: Partial<ContactScrape> = {}): ContactScrape => ({
  email: "info@example.com", pageText: "We show live football every weekend.",
  sportSignals: ["live football", "premier league"], socials: {}, ...over,
});

describe("prefilter", () => {
  it("keeps a well-reviewed bar", () => {
    expect(prefilter(place()).keep).toBe(true);
  });

  it("rejects hotels even when they list a bar", () => {
    expect(prefilter(place({ types: ["lodging", "bar"] })).keep).toBe(false);
  });

  it("rejects places that are not hospitality at all", () => {
    expect(prefilter(place({ types: ["gym"] })).keep).toBe(false);
  });

  it("rejects venues with too few reviews to be real", () => {
    const r = prefilter(place({ reviews: 3 }));
    expect(r.keep).toBe(false);
    expect(r.reason).toMatch(/reviews/);
  });
});

describe("mockScore", () => {
  it("passes a sports pub with strong evidence", () => {
    const r = mockScore(place(), scrape());
    expect(r.mock).toBe(true);
    expect(r.fit_score).toBeGreaterThanOrEqual(60);
    expect(r.shows_live_sport).toBe(true);
  });

  it("fails a cafe with no sport signals", () => {
    const r = mockScore(
      place({ types: ["cafe"], reviews: 20 }),
      scrape({ sportSignals: [], pageText: "Speciality coffee and pastries." }),
    );
    expect(r.fit_score).toBeLessThan(60);
    expect(r.suggested_league_name).toBeNull();
  });

  it("is deterministic — the same input always scores the same", () => {
    const a = mockScore(place(), scrape());
    const b = mockScore(place(), scrape());
    expect(a.fit_score).toBe(b.fit_score);
  });

  it("never leaves the 0-100 range", () => {
    const worst = mockScore(
      place({ types: [], reviews: 0, rating: 0 }),
      scrape({ sportSignals: [], pageText: "" }),
    );
    const best = mockScore(
      place({ types: ["pub"], reviews: 5000, rating: 4.9 }),
      scrape({ sportSignals: ["live football", "premier league", "big screen", "sky sports"] }),
    );
    expect(worst.fit_score).toBeGreaterThanOrEqual(0);
    expect(best.fit_score).toBeLessThanOrEqual(100);
  });

  it("always flags itself as mock so live rows stay distinguishable", () => {
    expect(mockScore(place(), scrape()).mock).toBe(true);
  });
});

describe("country routing", () => {
  it("refuses to route Germany or Austria to any campaign", () => {
    process.env.INSTANTLY_CAMPAIGN_DE = "should-never-be-used";
    process.env.INSTANTLY_CAMPAIGN_DEFAULT = "fallback";
    expect(campaignFor("DE")).toBeNull();
    expect(campaignFor("AT")).toBeNull();
  });

  it("routes mailable countries to their configured campaign", () => {
    process.env.INSTANTLY_CAMPAIGN_GB = "camp_gb";
    expect(campaignFor("GB")).toBe("camp_gb");
  });

  it("maps countries to the right language and competition", () => {
    expect(languageFor("ES")).toBe("es");
    expect(languageFor("IT")).toBe("it");
    expect(competitionFor("FR")).toBe("ligue-1");
    expect(competitionFor("IT")).toBe("serie-a");
  });
});

describe("slugify", () => {
  it("folds accents and punctuation", () => {
    expect(slugify("Café Olé Bar & Grill")).toBe("cafe-ole-bar-grill");
  });
  it("avoids colliding with app routes", () => {
    expect(slugify("admin")).toBe("admin-venue");
  });
});

describe("funnel status only moves forward", () => {
  it("allows progress", () => {
    expect(advances("contacted", "replied")).toBe(true);
  });
  it("blocks a late open event from demoting a paying customer", () => {
    expect(advances("active", "opened")).toBe(false);
  });
});

describe("pickEmail prefers the venue's own domain", () => {
  // The recovery case. A Marston's pub prints the group alias all over its own
  // site, so without a host preference we re-select the address that bounced.
  const html = `
    <p>Bookings: keeperslodge.leicester@marstons.co.uk</p>
    <p>General enquiries: info@keeperslodgepub.co.uk</p>
    <p>Head office: bookings.enquiries@marstons.co.uk</p>`;

  it("picks the own-domain address when a host is given", () => {
    expect(pickEmail(html, "keeperslodgepub.co.uk")).toBe("info@keeperslodgepub.co.uk");
    expect(pickEmail(html, "www.keeperslodgepub.co.uk")).toBe("info@keeperslodgepub.co.uk");
  });

  it("behaves exactly as before when no host is given", () => {
    // Generic-mailbox preference, unchanged for live enrichment.
    expect(pickEmail(html)).toBe("info@keeperslodgepub.co.uk");
    expect(pickEmail("<p>sales@group.co.uk</p><p>hello@pub.co.uk</p>")).toBe("hello@pub.co.uk");
  });

  it("falls back to the generic preference when the venue publishes nothing of its own", () => {
    const groupOnly = "<p>keeperslodge.leicester@marstons.co.uk</p>";
    expect(pickEmail(groupOnly, "keeperslodgepub.co.uk")).toBe("keeperslodge.leicester@marstons.co.uk");
  });

  it("accepts a subdomain of the venue's own host", () => {
    expect(pickEmail("<p>info@mail.pub.co.uk</p><p>x@group.com</p>", "pub.co.uk"))
      .toBe("info@mail.pub.co.uk");
  });
});

describe("a filename is not an email domain", () => {
  it("rejects the stylesheet that reached fourteen venue records", () => {
    // url(data:font;base64,…@1-awesome-menu-147f5c7c74fb.css) matched EMAIL_RE,
    // and the junk list only excluded .png, .jpg and .webp.
    expect(pickEmail("<p>x@1-awesome-menu-147f5c7c74fb.css</p>")).toBe(null);
  });

  it.each([
    "a@styles.css", "a@app.js", "a@logo.svg", "a@photo.jpeg", "a@font.woff2",
    "a@bundle.map", "a@index.php", "a@page.html", "a@menu.pdf", "a@clip.mp4",
  ])("rejects %s", (e) => {
    expect(pickEmail(`<p>${e}</p>`)).toBe(null);
  });

  it("rejects a numeric or malformed TLD", () => {
    expect(pickEmail("<p>a@1.2.3.4</p>")).toBe(null);
    expect(pickEmail("<p>a@host.c0m</p>")).toBe(null);
  });

  it("still accepts every TLD the campaign actually mails", () => {
    for (const e of ["info@pub.co.uk", "info@bar.com", "info@bar.es", "info@bar.fr",
                     "info@bar.it", "hello@thelongshot.bar", "a@venue.london", "a@x.pub"]) {
      expect(pickEmail(`<p>${e}</p>`)).toBe(e);
    }
  });
});
