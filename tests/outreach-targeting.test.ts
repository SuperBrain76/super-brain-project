/**
 * The ownership rule, pinned against the sixteen addresses that actually
 * bounced and a sample of those that did not. Real addresses, because the rule
 * was derived from them and a synthetic case would not prove it.
 */
import { describe, it, expect } from "vitest";
import { addressBelongsToVenue, domainOf, hostOf } from "@/lib/outreachTargeting";

describe("addressBelongsToVenue", () => {
  // Every one of these bounced in production. All are group aliases.
  const BOUNCED_GROUP_ALIASES: Array<[string, string]> = [
    ["temperance.putney@stonegategroup.co.uk", "https://socialpubandkitchen.co.uk"],
    ["baileyscourtinn.bristol@marstons.co.uk", "https://baileyscourtinnpub.co.uk"],
    ["jontyfarmer.derby@marstons.co.uk", "https://jontyfarmerpub.co.uk"],
    ["threecrowns.hull@marstons.co.uk", "https://threecrownspubhull.co.uk"],
    ["pennyfarthing.coventry@marstons.co.uk", "https://pennyfarthingpubcoventry.co.uk"],
    ["keeperslodge.leicester@marstons.co.uk", "https://keeperslodgepub.co.uk"],
    ["highway.hull@phoenixpub.co.uk", "https://highwayhull.co.uk"],
    ["burntoak.miltonkeynes@phoenixpub.co.uk", "https://burntoakpub.co.uk"],
    ["pavilionend.events@fullers.co.uk", "https://pavilionendpub.co.uk"],
    ["bunchofgrapes@youngs.co.uk", "https://bunchofgrapesborough.co.uk"],
    ["5751@greeneking.co.uk", "https://alexandraclapham.com"],
    ["info@redwoodsportspub.com", "https://sportlondon.com"],
    ["info@westwoodsportspub.com", "https://sportlondon.com"],
  ];

  it.each(BOUNCED_GROUP_ALIASES)("holds %s", (email, site) => {
    expect(addressBelongsToVenue(email, site).ok).toBe(false);
  });

  it("lets an address on the venue's own domain through", () => {
    expect(addressBelongsToVenue("info@longarmpub.co.uk", "https://longarmpub.co.uk").ok).toBe(true);
    expect(addressBelongsToVenue("hello@thesportingpage.co.uk", "http://www.thesportingpage.co.uk/").ok).toBe(true);
  });

  it("treats a subdomain as the same venue", () => {
    expect(addressBelongsToVenue("info@mail.thepub.co.uk", "https://thepub.co.uk").ok).toBe(true);
    expect(addressBelongsToVenue("info@thepub.co.uk", "https://bookings.thepub.co.uk").ok).toBe(true);
  });

  it("does NOT hold a venue with no website on record", () => {
    // A small pub on gmail is a normal prospect. Holding the unknowns would
    // discard good inventory on no evidence.
    for (const site of [null, undefined, "", "   ", "not a url"]) {
      expect(addressBelongsToVenue("redlionpub1936@gmail.com", site as string).ok).toBe(true);
    }
  });

  it("rejects an unparseable address", () => {
    for (const bad of [null, "", "nobody", "a@b", "two@@at.com"]) {
      expect(addressBelongsToVenue(bad as string, "https://x.co.uk").ok).toBe(false);
    }
  });

  it("parses hosts and domains the way the rule needs", () => {
    expect(hostOf("https://www.Example.co.uk/path?q=1")).toBe("example.co.uk");
    expect(hostOf("example.co.uk")).toBe("example.co.uk");
    expect(hostOf("localhost")).toBe(null);
    expect(domainOf("A.B@WWW.Example.com")).toBe("example.com");
    expect(domainOf("broken")).toBe(null);
  });
});

describe("the exceptions, both measured at 0 bounces", () => {
  // The blunt rule held all nine of these. They are small independents mailing
  // from their own account, they reach the owner rather than a generic inbox,
  // and not one has ever bounced.
  const FREEMAIL_WITH_OWN_SITE: Array<[string, string]> = [
    ["phoenixbarfr@gmail.com", "https://phoenixbar.fr"],
    ["creedencerockbar@gmail.com", "https://creedencerock.com"],
    ["barlespaul@gmail.com", "https://lespaulbar.com"],
    ["hermistonbrewingjanea@gmail.com", "https://hermistonbrewingcompany.com"],
    ["infos.templerock@gmail.com", "https://templerock-tavern.com"],
    ["theliverpoolpub@outlook.com", "https://theliverpool.co.uk"],
  ];
  it.each(FREEMAIL_WITH_OWN_SITE)("lets %s through", (email, site) => {
    expect(addressBelongsToVenue(email, site).ok).toBe(true);
  });

  it("treats a builder or linktree page as no website at all", () => {
    // Not a domain the venue controls, so it carries no ownership signal.
    expect(addressBelongsToVenue("info@meltingpottoulouse.com", "https://linktr.ee/meltingpot").ok).toBe(true);
    expect(addressBelongsToVenue("titocapa@gmail.com", "https://cervecerialadivina.eatbu.com").ok).toBe(true);
    expect(addressBelongsToVenue("byalongchalk@hotmail.co.uk", "https://x.foodanddrinksites.co.uk").ok).toBe(true);
  });

  it("still holds a group alias even when the venue has no usable site", () => {
    expect(addressBelongsToVenue("albion@youngs.co.uk", "https://thealbionlondon.com").ok).toBe(false);
    expect(addressBelongsToVenue("spreadeagle.wednesfield@marstons.co.uk",
      "https://spreadeaglepubwolverhampton.co.uk").ok).toBe(false);
  });

  it("rejects a scraped address with an encoded space in it", () => {
    // %20sales@foxdonkeygarden.com was sitting in the live queue.
    expect(addressBelongsToVenue("%20sales@foxdonkeygarden.com", "https://foxdonkeygarden.co.uk").ok).toBe(false);
  });
});
