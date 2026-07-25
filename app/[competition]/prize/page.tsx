"use client";

import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { track } from "@/lib/analytics";
import CountdownTimer from "@/components/CountdownTimer";

// ── Design tokens ─────────────────────────────────────────────
const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";

// ── How to win steps ─────────────────────────────────────────

const HOW_TO_WIN = [
  {
    step: "01",
    title: "Create a Free Account",
    body: "Sign up in under 30 seconds. No entry fee, no catch.",
  },
  {
    step: "02",
    title: "Predict Every Match",
    body: "Submit your score predictions for all 104 World Cup matches before each kickoff.",
  },
  {
    step: "03",
    title: "Answer Bonus Questions",
    body: "Predict the Golden Boot, Golden Ball, tournament winner, and more for extra points.",
  },
  {
    step: "04",
    title: "Top the Global Leaderboard",
    body: "The player with the most points when the final whistle blows wins the Custom Champion Watch.",
  },
];

const WATCH_FACTS = [
  { label: "Construction",  value: "Custom-built luxury watch" },
  { label: "Assembled",     value: "Sweden" },
  { label: "Movement",      value: "Swiss mechanical movement" },
  { label: "Engraving",     value: "Winner's name + 2026 Champion title" },
  { label: "Awarded to",    value: "Overall global leaderboard winner" },
];

export default function PrizePage() {
  // Competition Engine V2: competition comes from the first path segment.
  const { competition: competitionSlug } = useParams<{ competition: string }>();

  const { user } = useAuth();

  useEffect(() => {
    track.grandPrizeDetailsViewed("direct");
    track.prizePageViewed();
  }, []);

  return (
    <div className="flex-1 flex flex-col" style={{ background: "#f0f3ef" }}>
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-16 w-full flex flex-col gap-8">

        {/* ── Breadcrumb ─────────────────────────────────── */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
          <Link href={`/${competitionSlug}`} className="hover:underline" style={{ color: MUTED }}>Predictor</Link>
          <span>/</span>
          <span style={{ color: TEXT2, fontWeight: 600 }}>Grand Prize</span>
        </div>

        {/* ── Hero: watch image + headline ───────────────── */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{ background: GREEN }}
        >
          {/* Subtle gold radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 70% 100% at 80% 50%, rgba(184,151,42,0.15), transparent)" }}
          />

          <div className="relative flex flex-col sm:flex-row items-center gap-0">
            {/* Copy */}
            <div className="flex-1 px-6 py-7 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/>
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
                  Grand Prize
                </span>
              </div>

              <div>
                <h1 className="text-2xl font-extrabold text-white leading-tight">
                  Custom Champion Watch
                </h1>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Awarded to the overall winner of the SuperBrain World Cup Prediction 2026
                </p>
              </div>

              {/* Key facts strip */}
              <div className="flex flex-wrap gap-2">
                {["Assembled in Sweden", "Swiss movement", "Personalized engraving"].map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(184,151,42,0.15)", color: GOLD, border: "1px solid rgba(184,151,42,0.3)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* CTA */}
              {!user ? (
                <Link
                  href="/login"
                  onClick={() => track.grandPrizeCTAClicked("prize_page")}
                  className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all active:scale-[0.98]"
                  style={{ background: GOLD, color: GREEN }}
                >
                  Start Predicting — Free →
                </Link>
              ) : (
                <Link
                  href={`/${competitionSlug}`}
                  onClick={() => track.grandPrizeCTAClicked("prize_page")}
                  className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all active:scale-[0.98]"
                  style={{ background: GOLD, color: GREEN }}
                >
                  Make Predictions →
                </Link>
              )}
            </div>

            {/* Watch image */}
            <div className="relative w-full sm:w-56 h-56 sm:h-64 shrink-0">
              <div
                className="absolute inset-0 blur-2xl opacity-20 rounded-full"
                style={{ background: GOLD }}
              />
              <Image
                src="/watch-prize.png"
                alt="Custom Champion Watch — Grand Prize"
                fill
                className="relative object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>

        {/* ── Countdown ──────────────────────────────────── */}
        <div
          className="rounded-xl px-5 py-5 flex flex-col gap-3"
          style={{ background: GREEN, border: `1px solid ${GREEN}` }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: "rgba(255,255,255,0.55)" }}>
            Tournament starts in
          </p>
          <div className="flex justify-center">
            <CountdownTimer />
          </div>
          <p className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
            Predictions lock at kickoff for each match — start predicting now
          </p>
        </div>

        {/* ── Watch facts ─────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "#fff", border: `1px solid ${BORDER}` }}
        >
          {/* Gold accent bar */}
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
          <div className="px-5 py-4">
            <h2 className="text-sm font-extrabold mb-4" style={{ color: TEXT1 }}>About the Watch</h2>
            <div className="flex flex-col gap-0 divide-y divide-[#dde5d8]">
              {WATCH_FACTS.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5 gap-3">
                  <span className="text-xs" style={{ color: MUTED }}>{label}</span>
                  <span className="text-xs font-semibold text-right" style={{ color: TEXT1 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Engraving callout ───────────────────────────── */}
        <div
          className="rounded-xl p-5 flex gap-4 items-start"
          style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}35` }}
        >
          <div className="relative w-16 h-16 shrink-0">
            <Image src="/watch-prize.png" alt="" fill className="object-contain opacity-90" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold mb-1" style={{ color: TEXT1 }}>
              Personalized Engraving
            </p>
            <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
              This is not just a trophy — it&apos;s a permanent record. Your name and the title{" "}
              <span className="font-semibold">&ldquo;SuperBrain World Cup Champion 2026&rdquo;</span>{" "}
              will be engraved on the case back, making this a genuinely one-of-a-kind timepiece.
            </p>
          </div>
        </div>

        {/* ── How to win ──────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-extrabold" style={{ color: TEXT1 }}>How to Win</h2>
          <div className="flex flex-col gap-2">
            {HOW_TO_WIN.map(({ step, title, body }) => (
              <div
                key={step}
                className="flex items-start gap-4 px-4 py-3 rounded-xl"
                style={{ background: "#fff", border: `1px solid ${BORDER}` }}
              >
                <span
                  className="text-xs font-black tabular-nums shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${GREEN}12`, color: GREEN }}
                >
                  {step}
                </span>
                <div>
                  <p className="text-sm font-bold" style={{ color: TEXT1 }}>{title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: TEXT2 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scoring summary ─────────────────────────────── */}
        <div
          className="rounded-xl p-4"
          style={{ background: "#fff", border: `1px solid ${BORDER}` }}
        >
          <h2 className="text-sm font-extrabold mb-3" style={{ color: TEXT1 }}>Points System</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { pts: "5", label: "Exact score", color: GREEN },
              { pts: "3", label: "Correct GD", color: GREEN },
              { pts: "2", label: "Correct result", color: TEXT2 },
              { pts: "+75", label: "Max bonus pts", color: GOLD },
            ].map(({ pts, label, color }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
                style={{ background: "#f0f3ef" }}
              >
                <span className="text-base font-black tabular-nums" style={{ color }}>{pts}</span>
                <span className="text-xs" style={{ color: TEXT2 }}>{label}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-3" style={{ color: MUTED }}>
            Tie-break: most exact scores → most correct GD → most correct results → bonus points → predictions made
          </p>
        </div>

        {/* ── Final CTA ───────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden text-center px-6 py-8 flex flex-col items-center gap-4"
          style={{ background: GREEN }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 60% 120% at 50% 0%, rgba(184,151,42,0.12), transparent)" }}
          />
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
            The championship starts now
          </p>
          <h2 className="text-xl font-extrabold text-white leading-tight">
            Your predictions could win you<br />the Champion Watch
          </h2>
          <Link
            href={user ? `/${competitionSlug}` : "/login"}
            onClick={() => track.grandPrizeCTAClicked("prize_page")}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
            style={{ background: GOLD, color: GREEN }}
          >
            {user ? "Make Predictions →" : "Start Free — Start Predicting →"}
          </Link>
          <Link href={`/${competitionSlug}/rules`} className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            View scoring rules &amp; FAQ
          </Link>
        </div>

      </div>
    </div>
  );
}
