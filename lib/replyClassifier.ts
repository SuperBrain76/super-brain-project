/**
 * Rule-based venue reply classification.
 *
 * Design rule, from which everything else follows: **fail toward escalation.**
 * Misfiling a rejection as "needs review" costs Dylan ten seconds. Misfiling an
 * interested venue as a rejection costs a customer and is invisible — nobody ever
 * finds out. So every ambiguous case resolves to needs_review, and a reply that
 * carries BOTH rejection and interest signals is escalated, never suppressed.
 *
 * Pure and dependency-free so it can be tested without a database or network.
 */

export type ReplyClass =
  | "positive_interested"
  | "neutral"
  | "negative"
  | "negative_unsubscribe"
  | "needs_review";

export interface Classification {
  classification: ReplyClass;
  reason: string;
  rule_matched: string;
  confidence: "high" | "medium" | "low";
}

/** Unambiguous removal requests. Legally and commercially must always win. */
const UNSUBSCRIBE = [
  /\bunsubscribe\b/i,
  /\bremove me\b/i,
  /\btake me off\b/i,
  /\bopt[- ]?out\b/i,
  /\bstop (emailing|contacting|messaging)\b/i,
  /\bdo not (contact|email)\b/i,
  /\bdon'?t (contact|email) me\b/i,
  /\bno longer wish to receive\b/i,
];

/** Clear rejection. Deliberately narrow — vague coldness is not rejection. */
const NEGATIVE = [
  /\bnot interested\b/i,
  /\bno[,.]? thank(s| you)\b/i,
  // Contractions matter: "this isn't for us" is the commonest polite decline and
  // was falling through to needs_review because only "not for us" was covered.
  /\b(not|isn'?t|is not|won'?t be|doesn'?t work) (for|right for) (us|our)\b/i,
  /\b(isn'?t|is not|not) something we\b/i,
  /\bwe('| a)?re not (interested|looking)\b/i,
  /\bwe already (have|use|work with)\b/i,
  /\bno need\b/i,
  /\bnot at this time\b/i,
  /\bnot a (good )?fit\b/i,
  /\bpass\b(?!word)/i,
  /\bdecline\b/i,
  // Deflections and referrals. Not rejections in themselves, but they mean the
  // sender is not the decision-maker — combined with an interest signal that
  // must escalate to a human, never auto-classify as straightforward interest.
  /\bnot the right person\b/i,
  /\bwrong person\b/i,
  /\bi'?m not the\b/i,
  /\bno longer (with|at) (us|the company)\b/i,
  /\byou'?ll need to (speak|talk|contact)\b/i,
];

/** Commercial engagement — pricing, demo, trial, setup, features, availability. */
const POSITIVE = [
  /\b(price|pricing|cost|costs|rate|rates|fee|fees|how much|quote)\b/i,
  /\b(demo|trial|free trial|pilot|test it)\b/i,
  /\b(set ?up|onboard(ing)?|get started|install|implement)\b/i,
  /\b(features?|how does it work|what does it do|more info|tell me more|details)\b/i,
  /\b(available|availability|when can|timeline|lead time)\b/i,
  // "interested" must not fire inside "not interested" — that inversion was
  // classifying plain rejections as ambiguous.
  /(?<!\bnot\s)(?<!\bnot really\s)\b(interested|keen|sounds good|sounds interesting|love to|happy to)\b/i,
  /\b(call|meeting|chat|catch up|schedule|book a)\b/i,
  /\b(competitions?|leagues?|fixtures?|matches|tournaments?|quiz(zes)?)\b/i,
  // "annual" alone matched "annual leave" in out-of-office replies.
  /\b(contracts?|terms|invoices?|subscriptions?|monthly)\b/i,
  /\bannual (contract|plan|pricing|price|subscription|fee|billing)\b/i,
  /\bsend (me|us|over)\b/i,
];

/**
 * Unambiguous machine replies — a reception desk, a ticketing system, a mailbox
 * that answers everyone identically. These are checked BEFORE commercial
 * keywords, because the autoresponder's own text is often full of them.
 *
 * Brigadiers' reception auto-reply was stored as positive_interested on
 * 2026-08-25: it says "we are not able to respond to all questions... refer to
 * our guide of frequent questions & answers", which matched the POSITIVE rule on
 * "questions". It is a restaurant booking autoresponder and expresses no view on
 * us at all.
 *
 * Deliberately narrow: every phrase here is something only an automated system
 * says. A human writing back never says "due to a high volume of enquiries".
 */
const STRONG_AUTO = [
  // NOTE: "out of office" is deliberately NOT here. An absence reply naming a
  // colleague and a price ("contact Maria about pricing") is a real lead, so it
  // stays with the weaker AUTO_REPLY check further down, after the commercial
  // signals have had their say. A reception/FAQ desk answers everyone
  // identically and carries no such signal.
  /\bhigh volume of (enquiries|inquiries|emails|requests|messages)\b/i,
  /\b(not|un)able to (respond|reply) to (all|every|each)\b/i,
  /\bdo not reply to this (email|message)\b/i,
  /\bthis (is|was) an automated\b/i,
  /\bauto(matic|mated)?[- ]?(reply|response|responder)\b/i,
  /\brefer to (our|the) (guide|faq|frequently asked)\b/i,
  /\bfrequently asked questions\b|\bFAQ page\b/i,
  /\bno[- ]?reply@/i,
  /\byour (enquiry|inquiry|request) has been received\b/i,
  /\bticket (number|#|has been created)\b/i,
];

/** Weaker absence signals. Still checked last, after real human signals. */
const AUTO_REPLY = [
  /\bout of (the )?office\b/i,
  /\bautomatic(ally)? (reply|response)\b/i,
  /\bauto[- ]?reply\b/i,
  /\bon (annual )?leave\b/i,
  /\bmaternity|paternity leave\b/i,
  /\bi am currently away\b/i,
  /\bno longer (works?|with) (here|the company)\b/i,
];

/** Bare rejections that carry no other content. */
const BARE_NO = /^\s*(no|nope|nah|not interested|no thanks?|unsubscribe)\s*[.!]?\s*$/i;

const hit = (text: string, list: RegExp[]) => list.find((r) => r.test(text)) ?? null;

export function classifyReply(raw: string | null | undefined): Classification {
  const text = String(raw ?? "").trim();

  // Nothing to judge. Never guess from an empty body.
  if (!text) {
    return {
      classification: "needs_review",
      reason: "Reply body was empty or not captured — cannot classify.",
      rule_matched: "empty",
      confidence: "low",
    };
  }

  // 1. Removal requests always win, even if the message also asks a question.
  const unsub = hit(text, UNSUBSCRIBE);
  if (unsub) {
    return {
      classification: "negative_unsubscribe",
      reason: "Explicit removal request. Suppress permanently and never contact again.",
      rule_matched: `unsubscribe:${unsub.source}`,
      confidence: "high",
    };
  }

  // 2. Unambiguous machine replies. Before commercial keywords, because an
  //    autoresponder's own boilerplate frequently contains them. Classified
  //    neutral, never negative: the venue has expressed nothing, so it must NOT
  //    be suppressed or disqualified on the strength of a robot.
  const strongAuto = hit(text, STRONG_AUTO);
  if (strongAuto) {
    return {
      classification: "neutral",
      reason:
        "Automated reply (reception desk, FAQ redirect, out-of-office or ticketing). " +
        "The venue itself has not responded, so this is not interest and not a rejection.",
      rule_matched: `strong_auto:${strongAuto.source}`,
      confidence: "high",
    };
  }

  // 3. A bare "no" with nothing else is a clear rejection.
  if (BARE_NO.test(text)) {
    return {
      classification: "negative",
      reason: "Short, unambiguous rejection with no other content.",
      rule_matched: "bare_no",
      confidence: "high",
    };
  }

  const neg = hit(text, NEGATIVE);
  const pos = hit(text, POSITIVE);

  // 4. Both signals present → escalate. This is the case that must never be
  //    suppressed: "not the right person, but our manager may want pricing".
  if (neg && pos) {
    return {
      classification: "needs_review",
      reason:
        "Contains both rejection and commercial-interest language — too ambiguous to " +
        "classify safely, so escalated rather than suppressed.",
      rule_matched: `conflict:${neg.source}|${pos.source}`,
      confidence: "low",
    };
  }

  if (pos) {
    return {
      classification: "positive_interested",
      reason: "Asks about pricing, demo, trial, setup, features, availability or a meeting.",
      rule_matched: `positive:${pos.source}`,
      confidence: "medium",
    };
  }

  if (neg) {
    return {
      classification: "negative",
      reason: "Clear statement of no interest with no commercial question attached.",
      rule_matched: `negative:${neg.source}`,
      confidence: "medium",
    };
  }

  // 5. Weaker absence signals — only after checking for real human signals.
  const auto = hit(text, AUTO_REPLY);
  if (auto) {
    return {
      classification: "neutral",
      reason: "Automated or absence reply. No human decision expressed.",
      rule_matched: `auto_reply:${auto.source}`,
      confidence: "medium",
    };
  }

  // 6. A real human wrote something we do not recognise. That is exactly the
  //    case worth a human glance — never a silent negative.
  return {
    classification: "needs_review",
    reason: "Human reply with no recognised rejection or interest signal.",
    rule_matched: "no_signal",
    confidence: "low",
  };
}

/** Replies that must reach Dylan. Rejections and unsubscribes are handled silently. */
export function needsAttention(c: ReplyClass): boolean {
  return c === "positive_interested" || c === "neutral" || c === "needs_review";
}

/** Brief priority. Interest is HIGH; everything escalated is worth seeing. */
export function briefPriority(c: ReplyClass): "HIGH" | "MEDIUM" | null {
  if (c === "positive_interested") return "HIGH";
  if (c === "needs_review" || c === "neutral") return "MEDIUM";
  return null;
}
