/**
 * Which countries this campaign may cold-email. The test exists because the
 * rule used to be a deny-list: everything except DE and AT fell through to the
 * default campaign, so a Canadian venue would have been mailable the moment
 * discovery found one, with nobody deciding that.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { campaignFor, marketStatus } from "@/lib/instantly";

const ENV = { ...process.env };
beforeEach(() => { process.env.INSTANTLY_CAMPAIGN_DEFAULT = "camp_default"; });
afterEach(() => { process.env = { ...ENV }; });

describe("campaignFor", () => {
  it("mails the five approved European markets", () => {
    for (const c of ["GB", "IE", "ES", "FR", "IT"]) expect(campaignFor(c)).toBe("camp_default");
  });

  it("refuses Canada — CASL needs consent BEFORE sending, not opt-out after", () => {
    expect(campaignFor("CA")).toBe(null);
    expect(marketStatus("CA").reason).toMatch(/CASL/);
    expect(marketStatus("CA").reason).toMatch(/[Ss]tricter than Germany/);
  });

  it("keeps refusing the German-speaking prior-consent markets", () => {
    for (const c of ["DE", "AT", "CH"]) {
      expect(campaignFor(c)).toBe(null);
      expect(marketStatus(c).mailable).toBe(false);
    }
  });

  it("refuses China and Japan with a stated reason", () => {
    for (const c of ["CN", "JP"]) {
      expect(campaignFor(c)).toBe(null);
      expect(marketStatus(c).reason.length).toBeGreaterThan(20);
    }
  });

  it("refuses anything not explicitly approved, rather than defaulting to mailable", () => {
    // The old deny-list would have returned a campaign for every one of these.
    for (const c of ["BR", "TH", "AU", "NZ", "MX", "IN", "ZA", "AE", "PK", "XX"]) {
      expect(campaignFor(c)).toBe(null);
    }
  });

  it("refuses an empty or junk country", () => {
    for (const c of ["", "   ", null as unknown as string, undefined as unknown as string]) {
      expect(campaignFor(c)).toBe(null);
    }
  });

  it("holds the USA shut until a postal address is configured", () => {
    // CAN-SPAM requires a valid physical postal address in the message. The
    // template has none, so US must not open just because someone adds a city
    // list.
    delete process.env.OUTREACH_POSTAL_ADDRESS;
    expect(campaignFor("US")).toBe(null);
    expect(marketStatus("US").mailable).toBe(false);
    expect(marketStatus("US").reason).toMatch(/OUTREACH_POSTAL_ADDRESS/);

    process.env.OUTREACH_POSTAL_ADDRESS = "SuperBrain, 1 Example St, London";
    expect(campaignFor("US")).toBe("camp_default");
    expect(marketStatus("US").mailable).toBe(true);
  });

  it("uses a country-specific campaign when one exists", () => {
    process.env.INSTANTLY_CAMPAIGN_GB = "camp_gb";
    expect(campaignFor("GB")).toBe("camp_gb");
    expect(campaignFor("ES")).toBe("camp_default");
  });

  it("returns null when no campaign is configured at all", () => {
    delete process.env.INSTANTLY_CAMPAIGN_DEFAULT;
    expect(campaignFor("GB")).toBe(null);
  });
});
