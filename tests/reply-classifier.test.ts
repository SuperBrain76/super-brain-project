import { describe, it, expect } from "vitest";
import { classifyReply, needsAttention, briefPriority } from "@/lib/replyClassifier";

const cls = (s: string | null | undefined) => classifyReply(s).classification;

describe("reply classification — removal requests", () => {
  it("catches explicit unsubscribes", () => {
    for (const s of [
      "Please unsubscribe me",
      "Remove me from your list",
      "take me off this list please",
      "Please opt out my address",
      "stop emailing me",
      "Do not contact us again",
      "I no longer wish to receive these",
    ]) {
      expect(cls(s)).toBe("negative_unsubscribe");
    }
  });

  it("treats removal as overriding even when a question is attached", () => {
    // A removal request is legally binding regardless of what else is in the mail.
    expect(cls("What's the pricing? Actually no, unsubscribe me.")).toBe("negative_unsubscribe");
  });
});

describe("reply classification — clear rejections", () => {
  it("classifies unambiguous rejections", () => {
    for (const s of [
      "Not interested, thanks",
      "No thanks",
      "This isn't for us",
      "We already have a supplier for this",
      "Not a good fit for our venue",
      "Not at this time",
    ]) {
      expect(cls(s)).toBe("negative");
    }
  });

  it("treats a bare no as a rejection", () => {
    for (const s of ["No", "no.", "Nope", "not interested"]) {
      expect(cls(s)).toBe("negative");
    }
  });
});

describe("reply classification — commercial interest", () => {
  it("catches pricing, demo, trial, setup and availability questions", () => {
    for (const s of [
      "How much does this cost per month?",
      "What's your pricing for a single venue?",
      "Can we get a free trial?",
      "Could you send over a demo?",
      "How long does setup take?",
      "What features are included?",
      "Are you available for a call next week?",
      "Which competitions do you cover?",
      "Do you do annual contracts?",
      "Sounds interesting, tell me more",
      "Send me the details",
    ]) {
      expect(cls(s)).toBe("positive_interested");
    }
  });

  it("marks interest HIGH for the brief", () => {
    expect(briefPriority("positive_interested")).toBe("HIGH");
  });
});

describe("reply classification — fails toward escalation", () => {
  it("escalates when rejection and interest both appear", () => {
    // The costly failure mode: a live lead buried inside a soft no.
    const both = [
      "I'm not the right person, but our manager may want pricing",
      "Not interested personally — though what does it cost?",
      "We already have something, but send me the details anyway",
    ];
    for (const s of both) expect(cls(s)).toBe("needs_review");
  });

  it("escalates an unrecognised human reply rather than assuming rejection", () => {
    for (const s of [
      "Who is this?",
      "Where did you get my address",
      "I'll speak to the owner and come back to you",
      "Hmm.",
    ]) {
      expect(cls(s)).toBe("needs_review");
    }
  });

  it("never classifies an empty or missing body as negative", () => {
    for (const s of ["", "   ", null, undefined]) {
      expect(cls(s as any)).toBe("needs_review");
    }
  });

  it("gives every escalated reply a reason and a matched rule", () => {
    const r = classifyReply("I'll speak to the owner and come back to you");
    expect(r.reason.length).toBeGreaterThan(10);
    expect(r.rule_matched).toBeTruthy();
    expect(r.confidence).toBe("low");
  });
});

describe("reply classification — automated replies", () => {
  it("treats out-of-office as neutral, not rejection", () => {
    for (const s of [
      "I am currently out of the office until Monday",
      "Automatic reply: on annual leave",
      "This is an auto-reply",
      "John no longer works here",
    ]) {
      expect(cls(s)).toBe("neutral");
    }
  });

  it("prefers a real signal inside an auto-reply over the auto-reply itself", () => {
    // An OOO that names a colleague and a pricing question is a live lead.
    expect(cls("Out of the office — please contact Maria about pricing")).toBe(
      "positive_interested",
    );
  });
});

describe("attention routing", () => {
  it("surfaces interest, neutral and ambiguous; suppresses rejections", () => {
    expect(needsAttention("positive_interested")).toBe(true);
    expect(needsAttention("neutral")).toBe(true);
    expect(needsAttention("needs_review")).toBe(true);
    expect(needsAttention("negative")).toBe(false);
    expect(needsAttention("negative_unsubscribe")).toBe(false);
  });

  it("keeps routine rejections out of the daily brief", () => {
    expect(briefPriority("negative")).toBeNull();
    expect(briefPriority("negative_unsubscribe")).toBeNull();
  });
});

/**
 * Regression: the Brigadiers reply, verbatim, from 2026-08-25.
 *
 * This was the very first reply the venue engine ever received and it was
 * misclassified as positive_interested. It is a restaurant reception
 * autoresponder about table bookings; it matched the commercial rule on
 * "questions" because the classifier checked positive keywords before it
 * checked whether a machine had written the message.
 */
const BRIGADIERS_AUTOREPLY = `Thank you very much for getting in touch. While we endeavour to respond to all emails, due to a high volume of enquiries we are not able to respond to all questions.

With that in mind, please refer to our guide of frequent questions & answers on our FAQ page<https://brigadierslondon.com/wp-content/uploads/2025/05/Brigadiers-FAQ.pdf>.

Reservations

To make a reservation, please refer to our website<https://brigadierslondon.com/> where you will find real time availability via 7Rooms. Please note all reservations must be made online, as card details are required to secure the booking.

For parties larger than 6 and up to 25, please see our private dining page<https://brigadierslondon.com/private-dining/> and for larger events including full restaurant hire, please reach out to our events team via events@brigadierslondon.com

Regarding existing reservations

We are only able to hold tables for up to 15 minutes. If you are running late, please reply to your SMS or confirmation email to let the team know your arrival time.

To cancel or amend an existing booking, please refer to your original confirmation email. Cancellations must be made at least 24 hours before your booking.

Best wishes,
Reception Team
Brigadiers
1-5 Bloomberg Arcade
London EC4N 8AR`;

describe("autoresponders are not interest (Brigadiers, 2026-08-25)", () => {
  it("classifies the real Brigadiers reply as neutral, not positive", () => {
    const v = classifyReply(BRIGADIERS_AUTOREPLY);
    expect(v.classification).toBe("neutral");
    expect(v.classification).not.toBe("positive_interested");
    expect(v.rule_matched).toMatch(/^strong_auto:/);
    expect(v.confidence).toBe("high");
  });

  it("does not suppress or disqualify a venue for an autoresponder", () => {
    // negative_unsubscribe is the only class that suppresses. An autoresponder
    // must never reach it — the venue has said nothing.
    expect(classifyReply(BRIGADIERS_AUTOREPLY).classification).not.toBe("negative_unsubscribe");
    expect(classifyReply(BRIGADIERS_AUTOREPLY).classification).not.toBe("negative");
  });

  it("catches the other common machine replies", () => {
    for (const t of [
      "Thank you, your enquiry has been received. This is an automated response.",
      "I am currently out of the office and will reply on Monday.",
      "Please do not reply to this email. Refer to our FAQ page for common questions.",
      "Due to a high volume of enquiries we are unable to respond to every message.",
      "A ticket number has been created for your request.",
    ]) {
      expect(classifyReply(t).classification).toBe("neutral");
    }
  });

  it("still escalates a genuine human reply that is ambiguous", () => {
    const human = "I'm not the right person for this, but our GM might want the pricing.";
    expect(classifyReply(human).classification).toBe("needs_review");
  });

  it("still reads a genuine human question as interest", () => {
    const human = "Sounds good — how much is it for a pub our size?";
    expect(classifyReply(human).classification).toBe("positive_interested");
  });

  it("a removal request inside an autoresponder still wins", () => {
    const t = "This is an automated reply. Please unsubscribe us from your list.";
    expect(classifyReply(t).classification).toBe("negative_unsubscribe");
  });
});
