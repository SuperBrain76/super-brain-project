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
 * It costs inventory — 65 of the 100 leads buffered on 21 Oct are held by it —
 * and that cost is the point rather than a side effect: those 65 are precisely
 * the venues we were about to mail at the wrong address. Most of them publish a
 * perfectly good one on their own website, which is the enrichment job this
 * rule makes worth doing.
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
  const site = hostOf(website);
  if (!dom) return { ok: false, reason: "unparseable email address" };
  if (!site) return { ok: true, reason: "no website on record — nothing to compare against" };
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
