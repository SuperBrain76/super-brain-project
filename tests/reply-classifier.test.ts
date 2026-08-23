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
