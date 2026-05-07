"use client";

import { useState } from "react";
import { submitFeedback } from "@/lib/feedback";

const FELT_OPTIONS = [
  "Accurate",
  "Too high",
  "Too low",
  "Surprising",
  "Motivating",
  "Disappointing",
];

interface Props {
  testName:    string;
  score:       number;
  resultTitle: string;
  userId:      string | null;
  onClose:     () => void;
}

export default function FeedbackModal({ testName, score, resultTitle, userId, onClose }: Props) {
  const [feltOptions,    setFeltOptions]    = useState<string[]>([]);
  const [wouldShare,     setWouldShare]     = useState("");
  const [almostQuit,     setAlmostQuit]     = useState("");
  const [testSuggestion, setTestSuggestion] = useState("");
  const [submitted,      setSubmitted]      = useState(false);
  const [busy,           setBusy]           = useState(false);

  const toggleFelt = (opt: string) =>
    setFeltOptions((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt],
    );

  const handleSubmit = async () => {
    setBusy(true);
    await submitFeedback({
      testName, score, resultTitle, feltOptions, wouldShare,
      almostQuit, testSuggestion, userId,
    });
    setSubmitted(true);
    setBusy(false);
    setTimeout(onClose, 1400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)" }}
    >
      <div
        className="w-full max-w-md bg-cockpit-card border border-cockpit-border rounded-sm module-enter overflow-hidden"
        style={{ backdropFilter: "blur(8px)" }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cockpit-border">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cockpit-accent animate-pulse" />
            <p className="text-white text-sm font-semibold">Quick feedback</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-cockpit-muted hover:text-cockpit-dim transition-colors p-1"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        {submitted ? (
          <div className="px-5 py-12 text-center">
            <p className="text-cockpit-green font-semibold text-sm">Thanks — this genuinely helps 🎯</p>
          </div>
        ) : (
          <div className="px-5 py-5 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">

            {/* Q1: How did this feel? */}
            <div>
              <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-3 font-mono">
                How did this result feel?
              </p>
              <div className="flex flex-wrap gap-2">
                {FELT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => toggleFelt(opt)}
                    className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-all duration-150 ${
                      feltOptions.includes(opt)
                        ? "border-cockpit-accent text-cockpit-accent bg-cockpit-accent bg-opacity-10"
                        : "border-cockpit-border text-cockpit-muted hover:border-cockpit-dim hover:text-cockpit-dim"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Would you share? */}
            <div>
              <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-3 font-mono">
                Would you send this to a friend?
              </p>
              <div className="flex gap-2">
                {["Yes", "Maybe", "No"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setWouldShare(opt)}
                    className={`flex-1 py-2 rounded-sm text-xs font-semibold border transition-all duration-150 ${
                      wouldShare === opt
                        ? "border-cockpit-accent text-cockpit-accent bg-cockpit-accent bg-opacity-10"
                        : "border-cockpit-border text-cockpit-muted hover:border-cockpit-dim hover:text-cockpit-dim"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q3: What almost made you quit? */}
            <div>
              <label className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono block">
                What almost made you quit?{" "}
                <span className="text-cockpit-muted normal-case tracking-normal font-sans opacity-60">optional</span>
              </label>
              <input
                type="text"
                value={almostQuit}
                onChange={(e) => setAlmostQuit(e.target.value)}
                placeholder="e.g. too long, too hard, distracted…"
                className="w-full text-sm"
                maxLength={200}
              />
            </div>

            {/* Q4: What test should we build next? */}
            <div>
              <label className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono block">
                What test should we build next?{" "}
                <span className="text-cockpit-muted normal-case tracking-normal font-sans opacity-60">optional</span>
              </label>
              <input
                type="text"
                value={testSuggestion}
                onChange={(e) => setTestSuggestion(e.target.value)}
                placeholder="e.g. attention span, IQ, pattern recognition…"
                className="w-full text-sm"
                maxLength={200}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={busy}
              className="btn-primary w-full flex items-center justify-center"
            >
              {busy ? "Submitting…" : "Submit Feedback"}
            </button>

            <button
              onClick={onClose}
              className="text-cockpit-muted text-xs text-center hover:text-cockpit-dim transition-colors pb-1"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
