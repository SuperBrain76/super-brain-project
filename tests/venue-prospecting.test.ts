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
import { mockScore, type ContactScrape } from "@/lib/enrichment";
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
