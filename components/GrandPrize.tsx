"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";

// ── Prize facts ───────────────────────────────────────────────
const PRIZE_DETAILS = [
  "Custom-built luxury watch",
  "Assembled in Sweden",
  "Swiss movement",
  "Personalized winner engraving",
];

// ── Small watch icon ──────────────────────────────────────────
function WatchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="4" rx="2"/>
      <rect x="7" y="18" width="10" height="4" rx="2"/>
      <circle cx="12" cy="12" r="7"/>
      <polyline points="12 9 12 12 14 14"/>
    </svg>
  );
}

// ── Trophy icon ───────────────────────────────────────────────
function TrophyIcon({ size = 16, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. HOMEPAGE SECTION
//    Full-width, white bg, watch image right, copy left.
//    Inserted directly below the hero section.
// ─────────────────────────────────────────────────────────────

export function GrandPrizeHomepageSection() {
  useEffect(() => {
    track.grandPrizeViewed("homepage_section");
  }, []);

  return (
    <section className="border-b" style={{ background: "#fff", borderColor: BORDER }}>
      <div className="max-w-5xl mx-auto px-5 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">

          {/* ── Left: copy ── */}
          <div className="flex flex-col gap-5 order-2 md:order-1">
            {/* Eyebrow */}
            <div className="flex items-center gap-2">
              <TrophyIcon size={15} />
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: GOLD }}
              >
                Grand Prize · SuperBrain World Cup 2026
              </span>
            </div>

            {/* Headline */}
            <div>
              <h2
                className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight"
                style={{ color: TEXT1 }}
              >
                Win the Custom<br />
                <span style={{ color: GOLD }}>Champion Watch</span>
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT2 }}>
                Awarded to the overall winner of the SuperBrain World Cup Prediction 2026.
                The ultimate symbol of prediction mastery.
              </p>
            </div>

            {/* Bullet points */}
            <ul className="flex flex-col gap-2">
              {PRIZE_DETAILS.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}40` }}
                  >
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <polyline points="2,5 4.5,7.5 8,3" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="text-sm" style={{ color: TEXT2 }}>{item}</span>
                </li>
              ))}
            </ul>

            {/* Engraving callout */}
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}30` }}
            >
              <WatchIcon size={18} />
              <div>
                <p className="text-xs font-bold" style={{ color: TEXT1 }}>Personalized Engraving</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: TEXT2 }}>
                  Your name will be engraved on the back as the official 2026 Champion.
                </p>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/predict"
                onClick={() => track.grandPrizeCTAClicked("homepage_section")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-all active:scale-[0.98]"
                style={{ background: GREEN, color: "#fff" }}
              >
                Start Predicting →
              </Link>
              <Link
                href="/predict/prize"
                onClick={() => track.grandPrizeDetailsViewed("homepage_section")}
                className="text-sm font-semibold hover:underline"
                style={{ color: GOLD }}
              >
                Prize details
              </Link>
            </div>
          </div>

          {/* ── Right: watch image ── */}
          <div className="order-1 md:order-2 flex items-center justify-center">
            <div className="relative w-full max-w-sm mx-auto">
              {/* Soft gold glow behind the watch */}
              <div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-30"
                style={{ background: `radial-gradient(ellipse at center, ${GOLD}, transparent 70%)` }}
              />
              <Image
                src="/watch-prize.png"
                alt="Grand Prize: Custom Champion Watch — assembled in Sweden with Swiss movement"
                width={480}
                height={480}
                className="relative w-full h-auto object-contain drop-shadow-xl"
                priority
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. LEAGUE JOIN COMPACT CARD
//    Motivational card shown above the Join button.
// ─────────────────────────────────────────────────────────────

export function GrandPrizeJoinCard() {
  useEffect(() => {
    track.grandPrizeViewed("join_card");
  }, []);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#fff", border: `1px solid ${GOLD}40` }}
    >
      {/* Gold top accent bar */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />

      <div className="flex items-center gap-3 px-4 py-3">
        {/* Mini watch image */}
        <div className="relative w-14 h-14 shrink-0">
          <Image
            src="/watch-prize.png"
            alt="Grand Prize Watch"
            fill
            className="object-contain"
          />
        </div>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <TrophyIcon size={12} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
              Grand Prize
            </span>
          </div>
          <p className="text-sm font-bold leading-tight" style={{ color: TEXT1 }}>
            Custom Champion Watch
          </p>
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: TEXT2 }}>
            The overall champion receives a personalized luxury watch, assembled in Sweden and engraved with their name.
          </p>
        </div>
      </div>

      <div className="px-4 pb-3">
        <Link
          href="/predict/prize"
          onClick={() => track.grandPrizeDetailsViewed("join_card")}
          className="text-[11px] font-semibold hover:underline"
          style={{ color: GOLD }}
        >
          Prize details →
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. FIXTURES PAGE — slim persistent banner
//    Non-intrusive one-line strip above the fixture list.
// ─────────────────────────────────────────────────────────────

export function GrandPrizeBanner() {
  useEffect(() => {
    track.grandPrizeViewed("fixtures_banner");
  }, []);

  return (
    <Link
      href="/predict/prize"
      onClick={() => track.grandPrizeClicked("fixtures_banner")}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.99]"
      style={{
        background:  `${GOLD}0c`,
        border:      `1px solid ${GOLD}35`,
      }}
    >
      {/* Mini watch */}
      <div className="relative w-7 h-7 shrink-0">
        <Image src="/watch-prize.png" alt="" fill className="object-contain" />
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold" style={{ color: TEXT1 }}>
          🏆 Grand Prize:
        </span>
        {" "}
        <span className="text-xs" style={{ color: TEXT2 }}>
          Custom Champion Watch
        </span>
        <span className="text-xs hidden sm:inline" style={{ color: MUTED }}>
          {" "}· Complete your predictions to compete for the championship
        </span>
      </div>

      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. LEADERBOARD BANNER
//    Slightly richer than the fixtures banner — shown above the
//    rankings table where users are already in competitive mode.
// ─────────────────────────────────────────────────────────────

export function GrandPrizeLeaderboardBanner({ participantCount }: { participantCount?: number }) {
  useEffect(() => {
    track.grandPrizeViewed("leaderboard_banner");
  }, []);

  return (
    <Link
      href="/predict/prize"
      onClick={() => track.grandPrizeClicked("leaderboard_banner")}
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:opacity-90 active:scale-[0.99]"
      style={{
        background:  "#fff",
        border:      `1px solid ${GOLD}40`,
        borderLeft:  `3px solid ${GOLD}`,
      }}
    >
      {/* Watch thumbnail */}
      <div className="relative w-10 h-10 shrink-0">
        <Image src="/watch-prize.png" alt="Grand Prize Watch" fill className="object-contain" />
      </div>

      {/* Copy */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold leading-tight" style={{ color: TEXT1 }}>
          Overall Winner Receives the Custom Champion Watch
        </p>
        {participantCount !== undefined && participantCount > 0 && (
          <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>
            {participantCount} predictor{participantCount === 1 ? "" : "s"} competing · top the global leaderboard to win
          </p>
        )}
        {(!participantCount || participantCount === 0) && (
          <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>
            Top the global leaderboard when the final whistle blows
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] font-semibold hidden sm:inline" style={{ color: GOLD }}>Prize details</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. RULES PAGE — full prize section
// ─────────────────────────────────────────────────────────────

export function GrandPrizeRulesSection() {
  useEffect(() => {
    track.grandPrizeViewed("rules_section");
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Watch image + headline */}
      <div
        className="rounded-xl overflow-hidden flex flex-col sm:flex-row items-center gap-5 p-5"
        style={{ background: "#fff", border: `1px solid ${GOLD}40` }}
      >
        {/* Gold top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
          style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }}
        />

        {/* Watch image */}
        <div className="relative w-36 h-36 shrink-0">
          <Image
            src="/watch-prize.png"
            alt="Grand Prize: Custom Champion Watch"
            fill
            className="object-contain drop-shadow-md"
          />
        </div>

        {/* Details */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-2">
            <TrophyIcon size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
              Grand Prize
            </span>
          </div>

          <div>
            <h3 className="text-lg font-extrabold leading-tight" style={{ color: TEXT1 }}>
              Custom Champion Watch
            </h3>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: TEXT2 }}>
              The overall winner of SuperBrain World Cup Prediction 2026 receives a custom-built luxury timepiece.
            </p>
          </div>

          <ul className="flex flex-col gap-1.5">
            {PRIZE_DETAILS.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
                <span className="text-xs" style={{ color: TEXT2 }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Engraving detail */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: `${GOLD}06`, border: `1px solid ${GOLD}30` }}
      >
        <WatchIcon size={20} />
        <div>
          <p className="text-sm font-bold" style={{ color: TEXT1 }}>Personalized Engraving</p>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: TEXT2 }}>
            The winner&apos;s name and the title &ldquo;SuperBrain World Cup Champion 2026&rdquo; will be engraved on
            the case back — making this a genuinely one-of-a-kind piece.
          </p>
        </div>
      </div>

      {/* How to win */}
      <div
        className="rounded-xl p-4"
        style={{ background: "#fff", border: `1px solid ${BORDER}` }}
      >
        <p className="text-sm font-bold mb-2" style={{ color: TEXT1 }}>How to Win</p>
        <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>
          The prize is awarded to the player with the highest total points on the global leaderboard
          at the conclusion of the tournament. Points are earned from correct match predictions and
          bonus questions. In the event of a tie, standard tie-break rules apply (see Leagues &amp; Tie-Breakers above).
        </p>
      </div>

      <Link
        href="/predict/prize"
        onClick={() => track.grandPrizeDetailsViewed("rules_section")}
        className="text-sm font-semibold hover:underline self-start"
        style={{ color: GOLD }}
      >
        Full prize details →
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. FOOTER MENTION — one subtle line
// ─────────────────────────────────────────────────────────────

export function GrandPrizeFooterMention() {
  return (
    <Link
      href="/predict/prize"
      onClick={() => track.grandPrizeClicked("footer")}
      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
    >
      <WatchIcon size={13} />
      <span className="text-xs" style={{ color: "#7a8f82" }}>
        Grand Prize: <span style={{ color: "#9a7a30" }}>Custom Champion Watch</span>
      </span>
    </Link>
  );
}
