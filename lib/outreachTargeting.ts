/**
 * Does this address actually belong to this venue?
 *
 * The verifier answers "is this mailbox reachable". It has no opinion on whose
 * mailbox it is, and that gap is where every remaining bounce came from.
 *
 * Measured over the 132 venues contacted up to 21 Oct 2026:
 *
 *   email domain == the venue's own website host   73 sent,  2 bounced =  2.7%
 *   email domain != the venue's own website host   59 sent, 14 bounced = 23.7%
 *
 * Fourteen of the sixteen bounces sat on the wrong side of that one line, and
 * they are all the same thing: a pub-group alias. `keeperslodge.leicester@
 * marstons.co.uk` for a venue whose own site is keeperslodgepub.co.uk;
 * `temperance.putney@stonegategroup.co.uk` for socialpubandkitchen.co.uk. The
 * group publishes a per-venue address, the group's mail server accepts it at the
 * SMTP handshake, and nothing is routed behind it.
 *
 * At 12.1% overall the campaign was suspended by Instantly's bounce protection
 * on 28 Sep 2026. Applying this rule alone takes the measured rate to 2.7%.
 *
 * TWO EXCEPTIONS, both found by reading the live queue before shipping the rule
 * and both measured:
 *
 *   free-mail (gmail, outlook, …)      19 sent, 0 bounced =  0.0%
 *   website is a builder / linktree     1 sent, 0 bounced =  0.0%
 *   address on the venue's own domain  73 sent, 2 bounced =  2.7%
 *   everything else — WRONG OWNER      39 sent, 14 bounced = 35.9%
 *
 * A gmail address is never a group alias. It is a small independent's own
 * mailbox, it reaches the owner rather than a generic inbox, and not one has
 * ever bounced — the blunt version of this rule held nine of them and they were
 * the most valuable leads in the queue. Likewise a linktr.ee or eatbu.com
 * "website" is not a domain the venue controls, so it carries no signal either
 * way and is treated as no website rather than as a mismatch.
 *
 * Keeping the first three buckets gives 93 sent at 2 bounced = 2.2%, inside the
 * ceiling with margin, while holding 39 instead of 59.
 *
 * What is held is not waste: those 39 are the venues we were about to mail at
 * somebody else's address, and most publish a good one on their own site. That
 * is the enrichment job this rule makes worth doing.
 */

/** Hostname of a URL, lowercased, without `www.`. Null when unusable. */
export function hostOf(url: string | null | undefined): string | null {
  const raw = String(url ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h.includes(".") ? h : null;
  } catch { return null; }
}

/** Domain part of an email address, lowercased. Null when unusable. */
export function domainOf(email: string | null | undefined): string | null {
  const m = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/.exec(String(email ?? "").trim());
  return m ? m[1].toLowerCase().replace(/^www\./, "") : null;
}

/**
 * Consumer mail providers. An address here belongs to a person, not to a group's
 * switchboard, so the ownership comparison does not apply.
 */
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.co.uk", "hotmail.com", "hotmail.co.uk",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com",
  "live.com", "live.co.uk", "msn.com", "protonmail.com", "proton.me", "gmx.com", "gmx.de",
  "gmx.net", "web.de", "t-online.de", "free.fr", "orange.fr", "wanadoo.fr", "sfr.fr",
  "laposte.net", "libero.it", "virgilio.it", "alice.it", "tiscali.it", "tin.it",
  "telefonica.net", "terra.es", "hotmail.es", "yahoo.es", "yahoo.fr", "yahoo.it",
]);

/**
 * Hosts that publish somebody else's page, not a domain the venue controls. A
 * venue whose "website" is a linktree has, for our purposes, no website — the
 * host says nothing about which addresses are theirs.
 */
const NOT_OWN_SITE = [
  /(^|\.)linktr\.ee$/, /(^|\.)eatbu\.com$/, /(^|\.)blogspot\./, /(^|\.)wixsite\.com$/,
  /(^|\.)wix\.com$/, /(^|\.)squarespace\.com$/, /(^|\.)weebly\.com$/, /(^|\.)business\.site$/,
  /(^|\.)godaddysites\.com$/, /(^|\.)foodanddrinksites\.co\.uk$/, /(^|\.)sumupstore\.com$/,
  /(^|\.)facebook\.com$/, /(^|\.)instagram\.com$/, /(^|\.)tripadvisor\./, /(^|\.)google\.com$/,
];

export type TargetVerdict =
  /** The address is on the venue's own domain, or we cannot tell. Proceed. */
  | { ok: true; reason: string }
  /** The address belongs to somebody else — a group, an agency, a parent club. */
  | { ok: false; reason: string };

/**
 * `null`/unknown website is NOT a rejection. A small pub with no website and a
 * gmail address is a normal, deliverable prospect — in the measured data the
 * mismatch rule only fires where a website is actually known, and holding the
 * unknowns would discard good inventory for no evidence.
 */
export function addressBelongsToVenue(
  email: string | null | undefined,
  website: string | null | undefined,
): TargetVerdict {
  const dom = domainOf(email);
  let site = hostOf(website);
  if (!dom) return { ok: false, reason: "unparseable email address" };

  // A person's own mailbox, not a group's switchboard. 0 of 19 bounced.
  if (FREE_MAIL.has(dom)) {
    return { ok: true, reason: `${dom} is a consumer mail provider — a personal mailbox, not a group alias` };
  }
  // A page on somebody else's platform tells us nothing about address ownership.
  if (site && NOT_OWN_SITE.some((r) => r.test(site!))) site = null;

  if (!site) return { ok: true, reason: "no website of the venue's own to compare against" };
  if (dom === site) return { ok: true, reason: `address is on the venue's own domain (${dom})` };

  // A subdomain of the venue's own site, or vice versa, is still the venue.
  if (dom.endsWith(`.${site}`) || site.endsWith(`.${dom}`)) {
    return { ok: true, reason: `address is on a subdomain of ${site}` };
  }
  return {
    ok: false,
    reason:
      `address domain (${dom}) is not the venue's own site (${site}) — ` +
      `a group, agency or parent-company mailbox. 23.7% of these bounced.`,
  };
}
