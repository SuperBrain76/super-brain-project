import Link from "next/link";
import Image from "next/image";
import CountdownTimer from "@/components/CountdownTimer";
import HomepageAnalytics from "@/components/HomepageAnalytics";
import HeroSection from "@/components/HeroSection";
import HomeCompetitions, { HideWhenActiveCompetition } from "@/components/home/HomeCompetitions";
import { WhatsAppHeroCard } from "@/components/WhatsAppChannelCard";
import { BRAND, MATERIAL } from "@/lib/brand";

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    color: "#00d4ff",
    title: "Free to Play",
    body: "No entry fee. No catch. Create an account, make your predictions before kickoff, and compete from the first whistle.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: "#00e676",
    title: "Private Leagues",
    body: "Create a private league and invite your friends, family, or office crew. Share a code or link — they're in instantly.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    color: "#ffab00",
    title: "Bonus Questions",
    body: "Go beyond match scores. Predict the Golden Boot, Golden Ball, Winner, Runner Up, Surprise Team — earn massive bonus points.",
  },
];

const BONUS_QUESTIONS = [
  "Tournament Winner",
  "Runner Up",
  "Golden Boot",
  "Golden Ball",
  "Golden Glove",
  "Surprise Team",
  "Top Assists",
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Sign Up Free",
    body: "Create your account in under 30 seconds.",
  },
  {
    step: "02",
    title: "Make Predictions",
    body: "Predict every match result before kickoff — scores lock automatically.",
  },
  {
    step: "03",
    title: "Earn Points",
    body: "Correct result = 1 pt. Exact score = 3 pts. Bonus questions stack on top.",
  },
  {
    step: "04",
    title: "Climb the Board",
    body: "Track your rank on the global leaderboard or in your private leagues.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: BRAND.black }}>
      <HomepageAnalytics />

      {/* ── Active competition band — always promotes what's live now ─────── */}
      <HomeCompetitions />

      {/* ── HERO ── legacy World-Cup billboard. Hidden once a competition is
           public, so an archived one never competes with the active one. ──── */}
      <HideWhenActiveCompetition>
      <HeroSection>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(232,193,90,0.10) 0%, transparent 62%)" }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-32 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, ${BRAND.black})` }}
        />

        <div className="relative max-w-5xl mx-auto px-5 pt-16 pb-20 text-center">

          {/* Badge — Sports module accent (emerald), inside the black shell */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8"
            style={{ background: BRAND.surface, border: `0.5px solid ${BRAND.hairline}` }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BRAND.sports }} />
            <span className="text-xs tracking-[0.2em] uppercase" style={{ color: BRAND.sports }}>
              Free to play · World Cup 2026
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.04] mb-6" style={{ color: BRAND.ink }}>
            The World Cup<br />
            <span style={{ color: BRAND.sports, textShadow: "0 0 90px rgba(53,197,111,0.35)" }}>
              Predictor
            </span>
          </h1>

          <p className="text-base sm:text-xl max-w-lg mx-auto leading-relaxed mb-10" style={{ color: BRAND.muted }}>
            Predict every match. Earn points. Beat your friends. Compete for the{" "}
            <span style={{ color: BRAND.gold, fontWeight: 600 }}>SB Champion Watch</span>.
          </p>

          {/* Countdown */}
          <div className="mb-10">
            <p className="text-xs tracking-[0.2em] uppercase mb-4" style={{ color: BRAND.dim }}>
              First kickoff · June 11, 2026
            </p>
            <div className="flex justify-center">
              <CountdownTimer />
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/predict" className="w-full sm:w-auto relative z-10">
              <button className="text-sm sm:text-base font-bold px-10 py-4 w-full sm:w-auto rounded-full transition-transform active:scale-95"
                style={{ background: BRAND.sports, color: "#04140B" }}>
                Join free — start predicting →
              </button>
            </Link>
            <Link href="/predict/leaderboard" className="w-full sm:w-auto relative z-10">
              <button className="text-sm px-8 py-4 w-full sm:w-auto rounded-full transition-colors"
                style={{ background: "transparent", color: BRAND.muted, border: `0.5px solid ${BRAND.hairline}` }}>
                View leaderboard
              </button>
            </Link>
          </div>

          {/* WhatsApp Channel */}
          <div className="mt-4 max-w-xs mx-auto w-full">
            <WhatsAppHeroCard />
          </div>

          {/* Stats strip */}
          <div className="mt-10 flex flex-wrap justify-center gap-8 sm:gap-12">
            {[
              { v: "104", l: "Matches" },
              { v: "48",  l: "Teams" },
              { v: "7",   l: "Bonus questions" },
              { v: "Free", l: "Always" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-2xl sm:text-3xl font-semibold" style={{ color: BRAND.ink, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
                <div className="text-xs tracking-[0.14em] uppercase mt-1" style={{ color: BRAND.dim }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </HeroSection>
      </HideWhenActiveCompetition>

      {/* ── TWO-PATH SECTION — sculpted glass panels ─────────────────────── */}
      <section style={{ background: BRAND.black, borderBottom: `0.5px solid ${BRAND.hairline}` }}>
        <div className="max-w-5xl mx-auto px-5 py-14">
          <p className="text-center text-xs tracking-[0.28em] uppercase mb-8" style={{ color: BRAND.dim }}>
            Choose your game
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* ── World Cup Predictor — Sports (emerald) ── */}
            <Link href="/predict"
              className="group relative overflow-hidden rounded-3xl flex flex-col p-8 transition-transform duration-300 hover:-translate-y-1"
              style={{ background: MATERIAL.raise, border: `0.5px solid ${BRAND.hairline}` }}>
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                style={{ width: 260, height: 200, background: "radial-gradient(closest-side, rgba(53,197,111,0.18), transparent 72%)" }} />
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl">⚽</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(53,197,111,0.12)", color: BRAND.sports }}>Live now</span>
                </div>
                <h3 className="text-2xl font-extrabold mb-2 leading-tight" style={{ color: BRAND.ink }}>World Cup Predictor</h3>
                <p className="text-sm leading-relaxed mb-7" style={{ color: BRAND.muted }}>
                  Predict every match, earn points, beat friends — win the <span style={{ color: BRAND.gold, fontWeight: 600 }}>Champion Watch</span>.
                </p>
                <span className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: BRAND.sports }}>
                  Play now
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </span>
              </div>
            </Link>

            {/* ── Brain Tests — restrained cyan accent ── */}
            <Link href="/tests"
              className="group relative overflow-hidden rounded-3xl flex flex-col p-8 transition-transform duration-300 hover:-translate-y-1"
              style={{ background: MATERIAL.raise, border: `0.5px solid ${BRAND.hairline}` }}>
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                style={{ width: 260, height: 200, background: "radial-gradient(closest-side, rgba(51,214,214,0.14), transparent 72%)" }} />
              <div className="relative">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl">🧠</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(51,214,214,0.1)", color: BRAND.tests }}>6 tests</span>
                </div>
                <h3 className="text-2xl font-extrabold mb-2 leading-tight" style={{ color: BRAND.ink }}>Brain Tests</h3>
                <p className="text-sm leading-relaxed mb-7" style={{ color: BRAND.muted }}>
                  Reaction, memory, focus, decision-making. Find your real cognitive edge.
                </p>
                <span className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: BRAND.tests }}>
                  Take the tests
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </span>
              </div>
            </Link>

          </div>
        </div>
      </section>

      {/* ── FEATURES — boxless, divided by light ──────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.28em] uppercase mb-3" style={{ color: BRAND.dim }}>Why SuperBrain</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: BRAND.ink }}>Everything you need to dominate</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="px-6 py-6 sm:py-2"
              style={{ borderTop: `0.5px solid ${BRAND.hairline}`, borderLeft: i === 0 ? "none" : undefined }}>
              <div className="mb-4" style={{ color: BRAND.muted }}>{f.icon}</div>
              <h3 className="font-semibold text-base mb-2" style={{ color: BRAND.ink }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: BRAND.muted }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BONUS QUESTIONS — value moment, gold earns its place ──────────── */}
      <section style={{ borderTop: `0.5px solid ${BRAND.hairline}`, borderBottom: `0.5px solid ${BRAND.hairline}` }}>
        <div className="max-w-5xl mx-auto px-5 py-20">
          <div className="flex flex-col md:flex-row items-start gap-14">
            <div className="flex-1">
              <p className="text-xs tracking-[0.28em] uppercase mb-3" style={{ color: BRAND.dim }}>Bonus Predictions</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-4" style={{ color: BRAND.ink }}>
                Seven questions.<br />
                <span style={{ background: MATERIAL.goldFill, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Massive points.</span>
              </h2>
              <p className="text-sm sm:text-base leading-relaxed mb-7" style={{ color: BRAND.muted }}>
                Beyond match scores, predict the tournament&apos;s biggest individual awards.
                Nail these and you can leap the leaderboard overnight.
              </p>
              <Link href="/predict" className="group inline-flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND.sports }}>
                Make your picks
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>

            <div className="w-full md:w-80 shrink-0 relative">
              <div className="absolute -top-10 -right-8 pointer-events-none" style={{ width: 200, height: 200, background: MATERIAL.goldGlow }} />
              <div className="relative rounded-3xl p-6" style={{ background: MATERIAL.raise, border: `0.5px solid ${BRAND.hairline}` }}>
                <p className="text-xs tracking-[0.28em] uppercase mb-5" style={{ color: BRAND.dim }}>Bonus Questions</p>
                <div className="space-y-3.5">
                  {BONUS_QUESTIONS.map((q) => (
                    <div key={q} className="flex items-center gap-3">
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: BRAND.gold }} />
                      <span className="text-sm" style={{ color: BRAND.ink }}>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — boxless, a line of light through the steps ──────── */}
      <section className="max-w-5xl mx-auto px-5 py-20">
        <div className="text-center mb-14">
          <p className="text-xs tracking-[0.28em] uppercase mb-3" style={{ color: BRAND.dim }}>Get Started</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: BRAND.ink }}>How it works</h2>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6">
          <div className="hidden md:block absolute top-4 left-0 right-0 h-px pointer-events-none"
            style={{ background: `linear-gradient(90deg, transparent, ${BRAND.hairlineStrong} 12%, ${BRAND.hairlineStrong} 88%, transparent)` }} />
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.step} className="relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: BRAND.black, border: `0.5px solid ${BRAND.hairlineStrong}`, color: BRAND.ink }}>
                  {i + 1}
                </span>
              </div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: BRAND.ink }}>{step.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: BRAND.muted }}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── GRAND PRIZE — the gold moment. Luminous black, the watch glows. ── */}
      <section className="relative overflow-hidden" style={{ borderTop: `0.5px solid ${BRAND.hairline}`, borderBottom: `0.5px solid ${BRAND.hairline}`, background: MATERIAL.vignette }}>
        <div
          className="absolute pointer-events-none"
          style={{ top: "50%", right: "8%", width: 520, height: 520, transform: "translateY(-50%)", background: MATERIAL.goldGlow, opacity: 0.9 }}
        />
        <div className="relative max-w-5xl mx-auto px-5 py-20 sm:py-24">
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">

            {/* Watch image — framed as a gallery print so the asset reads sculpted */}
            <div className="w-full md:w-80 shrink-0 flex justify-center order-1 md:order-2">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80">
                <div
                  className="absolute -inset-6 rounded-full blur-3xl opacity-50 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center, rgba(232,193,90,0.55), transparent 70%)" }}
                />
                <div
                  className="relative w-full h-full rounded-[28px] overflow-hidden"
                  style={{ border: `0.5px solid ${MATERIAL.ringFaint}`, boxShadow: `${MATERIAL.shadowSoft}, ${MATERIAL.shadowGold}` }}
                >
                  <Image
                    src="/watch-prize.png"
                    alt="Grand Prize: Custom Champion Watch — assembled in Sweden, Swiss movement"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              </div>
            </div>

            {/* Copy */}
            <div className="flex-1 order-2 md:order-1 text-center md:text-left flex flex-col gap-5">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BRAND.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/>
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: BRAND.gold }}>
                  Grand Prize · SuperBrain World Cup 2026
                </span>
              </div>

              <div>
                <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight" style={{ color: BRAND.ink }}>
                  Win the Custom<br />
                  <span style={{ background: MATERIAL.goldFill, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Champion Watch</span>
                </h2>
                <p className="text-sm sm:text-base mt-3 leading-relaxed" style={{ color: BRAND.muted }}>
                  Awarded to the overall SuperBrain World Cup Prediction 2026 Champion.
                  One winner. One watch. Your name engraved on it forever.
                </p>
              </div>

              <ul className="flex flex-col gap-2.5 items-center md:items-start">
                {[
                  "Custom-built luxury watch",
                  "Assembled in Sweden",
                  "Swiss movement",
                  "Personalized winner engraving",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(232,193,90,0.12)", border: `0.5px solid ${MATERIAL.ringFaint}` }}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <polyline points="2,5 4.5,7.5 8,3" stroke={BRAND.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className="text-sm" style={{ color: BRAND.ink }}>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row items-center md:items-start gap-3 pt-2">
                <Link href="/predict" className="w-full sm:w-auto">
                  <button
                    className="w-full sm:w-auto font-bold px-8 py-3.5 rounded-full text-sm transition-transform active:scale-[0.98]"
                    style={{ background: BRAND.gold, color: BRAND.goldInk, boxShadow: MATERIAL.shadowGold }}
                  >
                    Start Predicting →
                  </button>
                </Link>
                <Link href="/predict/prize" className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 font-semibold px-6 py-3.5 text-sm" style={{ color: BRAND.muted }}>
                  Prize details
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRIVATE LEAGUES — boxless, divided by light ───────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-20">
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.28em] uppercase mb-3" style={{ color: BRAND.dim }}>Play with friends</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-6" style={{ color: BRAND.ink }}>Create a private league</h2>
          <Link href="/predict" className="group inline-flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND.sports }}>
            Create or join a league
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3">
          {[
            { icon: "🔒", title: "Invite Only", body: "Share a code or link. Only people you invite can join your league." },
            { icon: "🏆", title: "Your Own Leaderboard", body: "See exactly how you rank against your friends throughout the tournament." },
            { icon: "📲", title: "Share via WhatsApp", body: "One tap to send your league invite directly to your group chat." },
          ].map((item, i) => (
            <div key={item.title} className="px-6 py-6 sm:py-2 text-center sm:text-left"
              style={{ borderTop: `0.5px solid ${BRAND.hairline}` }}>
              <div className="text-2xl mb-4">{item.icon}</div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: BRAND.ink }}>{item.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: BRAND.muted }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA — quiet, confident, one light source ────────────────── */}
      <section className="relative overflow-hidden" style={{ borderTop: `0.5px solid ${BRAND.hairline}`, background: MATERIAL.vignette }}>
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ height: 320, background: "radial-gradient(ellipse 70% 100% at 50% 120%, rgba(53,197,111,0.10), transparent 65%)" }}
        />
        <div className="relative max-w-5xl mx-auto px-5 py-20 sm:py-24 text-center">
          <p className="text-xs tracking-[0.28em] uppercase mb-4" style={{ color: BRAND.dim }}>
            Tournament starts June 11
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-5 leading-tight" style={{ color: BRAND.ink }}>
            Your predictions.<br />
            <span style={{ color: BRAND.ink }}>Your glory.</span>
          </h2>
          <p className="text-base sm:text-lg mb-10 max-w-md mx-auto" style={{ color: BRAND.muted }}>
            Free to play. Predictions lock at kickoff. The leaderboard never lies.
          </p>
          <Link href="/predict">
            <button
              className="text-sm sm:text-base font-bold px-12 py-4 rounded-full w-full sm:w-auto transition-transform active:scale-[0.98]"
              style={{ background: BRAND.ink, color: BRAND.black }}
            >
              Join Free Now →
            </button>
          </Link>
        </div>
      </section>

    </div>
  );
}
