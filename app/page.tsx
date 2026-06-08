import Link from "next/link";
import Image from "next/image";
import CountdownTimer from "@/components/CountdownTimer";
import HomepageAnalytics from "@/components/HomepageAnalytics";
import HeroSection from "@/components/HeroSection";
import { WhatsAppHeroCard } from "@/components/WhatsAppChannelCard";

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
    <div className="min-h-screen">
      <HomepageAnalytics />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <HeroSection>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(0,212,255,0.12) 0%, transparent 65%)",
          }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-32 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, #080b0f)" }}
        />

        <div className="relative max-w-5xl mx-auto px-5 pt-16 pb-20 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 border border-cockpit-accent border-opacity-25 bg-cockpit-surface px-4 py-2 rounded-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-cockpit-green animate-pulse" />
            <span className="text-cockpit-green text-xs tracking-widest uppercase font-mono">
              Free to Play · FIFA World Cup 2026
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.04] mb-6">
            The World Cup<br />
            <span
              className="text-cockpit-accent"
              style={{ textShadow: "0 0 80px rgba(0,212,255,0.4)" }}
            >
              Predictor
            </span>
          </h1>

          <p className="text-cockpit-dim text-base sm:text-xl max-w-lg mx-auto leading-relaxed mb-10">
            Predict every match. Earn points. Beat your friends. Compete for the{" "}
            <span className="text-white font-semibold">SB Champion Watch</span>.
          </p>

          {/* Countdown */}
          <div className="mb-10">
            <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-4">
              First Kickoff · June 11, 2026
            </p>
            <div className="flex justify-center">
              <CountdownTimer />
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/predict" className="w-full sm:w-auto relative z-10">
              <button className="btn-primary text-sm sm:text-base px-10 py-4 w-full sm:w-auto">
                Join Free — Start Predicting →
              </button>
            </Link>
            <Link href="/predict/leaderboard" className="w-full sm:w-auto relative z-10">
              <button className="btn-ghost text-sm px-8 py-4 w-full sm:w-auto">
                View Leaderboard
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
              { v: "7",   l: "Bonus Questions" },
              { v: "Free", l: "Always" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold number-display text-cockpit-accent">{s.v}</div>
                <div className="text-cockpit-muted text-xs tracking-widest uppercase mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </HeroSection>

      {/* ── TWO-PATH SECTION ──────────────────────────────────────────────── */}
      <section className="border-b border-cockpit-border" style={{ background: "#0a0f16" }}>
        <div className="max-w-5xl mx-auto px-5 py-12">
          <p className="text-center text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-8">
            Choose your game
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* ── World Cup Predictor ── */}
            <Link
              href="/predict"
              className="group relative overflow-hidden rounded-sm border flex flex-col p-7 transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 100%)", borderColor: "#16a34a40" }}
            >
              <div
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,163,74,0.12), transparent)" }}
              />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">⚽</span>
                  <span
                    className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm"
                    style={{ background: "#16a34a20", color: "#4ade80", border: "1px solid #16a34a40" }}
                  >
                    Live Now
                  </span>
                </div>
                <h3 className="text-white text-xl font-extrabold mb-2 leading-tight">
                  World Cup Predictor
                </h3>
                <p className="text-green-300 text-sm leading-relaxed mb-6 opacity-90">
                  Predict every match · earn points · beat friends · win the Champion Watch
                </p>
                <span
                  className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-sm transition-all"
                  style={{ background: "#16a34a", color: "#fff" }}
                >
                  Play World Cup Predictor →
                </span>
              </div>
            </Link>

            {/* ── Brain Tests ── */}
            <Link
              href="/tests"
              className="group relative overflow-hidden rounded-sm border flex flex-col p-7 transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #0a1628 0%, #0f1f3a 100%)", borderColor: "#00d4ff25" }}
            >
              <div
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,212,255,0.08), transparent)" }}
              />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">🧠</span>
                  <span
                    className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm"
                    style={{ background: "#00d4ff10", color: "#00d4ff", border: "1px solid #00d4ff25" }}
                  >
                    6 Tests
                  </span>
                </div>
                <h3 className="text-white text-xl font-extrabold mb-2 leading-tight">
                  Brain Tests
                </h3>
                <p className="text-cockpit-dim text-sm leading-relaxed mb-6">
                  Reaction speed · memory · focus · decision-making. Find your real cognitive edge.
                </p>
                <span
                  className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-sm border transition-all"
                  style={{ borderColor: "#00d4ff40", color: "#00d4ff", background: "transparent" }}
                >
                  Take Brain Tests →
                </span>
              </div>
            </Link>

          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <div className="text-center mb-10">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-2">Why SuperBrain</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Everything you need to dominate</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="relative bg-cockpit-card border rounded-sm overflow-hidden transition-all duration-200"
              style={{ borderColor: `${f.color}20` }}
            >
              <div
                className="h-px w-full"
                style={{ background: `linear-gradient(90deg, ${f.color}, transparent)` }}
              />
              <div
                className="absolute top-0 inset-x-0 h-24 pointer-events-none"
                style={{ background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${f.color}08, transparent)` }}
              />
              <div className="relative px-6 py-7">
                <div className="mb-4" style={{ color: f.color }}>{f.icon}</div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-cockpit-dim text-sm leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BONUS QUESTIONS ───────────────────────────────────────────────── */}
      <section className="border-y border-cockpit-border bg-cockpit-surface">
        <div className="max-w-5xl mx-auto px-5 py-16">
          <div className="flex flex-col md:flex-row items-start gap-12">
            <div className="flex-1">
              <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-3">Bonus Predictions</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-4">
                Seven questions.<br />Massive points.
              </h2>
              <p className="text-cockpit-dim text-sm sm:text-base leading-relaxed mb-6">
                Beyond match scores, predict the tournament&apos;s biggest individual awards.
                Nail these and you can leap the leaderboard overnight.
              </p>
              <Link href="/predict">
                <button className="btn-primary text-sm px-8 py-3">
                  Make Your Picks →
                </button>
              </Link>
            </div>

            <div className="w-full md:w-80 shrink-0">
              <div className="bg-cockpit-card border rounded-sm overflow-hidden" style={{ borderColor: "#ffab0025" }}>
                <div className="h-px w-full" style={{ background: "linear-gradient(90deg, #ffab00, transparent)" }} />
                <div className="px-5 py-5">
                  <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-4">Bonus Questions</p>
                  <div className="space-y-2.5">
                    {BONUS_QUESTIONS.map((q) => (
                      <div key={q} className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-cockpit-amber shrink-0" />
                        <span className="text-cockpit-text text-sm">{q}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <div className="text-center mb-10">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-2">Get Started</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">How it works</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.step} className="relative">
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="hidden md:block absolute top-5 left-[calc(100%-0.5rem)] w-full h-px bg-cockpit-border z-0" />
              )}
              <div className="relative bg-cockpit-card border border-cockpit-border rounded-sm p-5 z-10">
                <div className="text-xs font-mono font-bold mb-3 tracking-widest text-cockpit-accent">
                  {step.step}
                </div>
                <h3 className="text-white font-semibold text-sm mb-2">{step.title}</h3>
                <p className="text-cockpit-muted text-xs leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GRAND PRIZE SECTION ───────────────────────────────────────────── */}
      <section className="border-y border-cockpit-border" style={{ background: "#ffffff" }}>
        <div className="max-w-5xl mx-auto px-5 py-14 sm:py-16">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">

            {/* Watch image */}
            <div className="w-full md:w-80 shrink-0 flex justify-center order-1 md:order-2">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80">
                <div
                  className="absolute inset-0 rounded-full blur-3xl opacity-25 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center, #b8972a, transparent 70%)" }}
                />
                <Image
                  src="/watch-prize.png"
                  alt="Grand Prize: Custom Champion Watch — assembled in Sweden, Swiss movement"
                  fill
                  className="relative object-contain drop-shadow-2xl"
                  priority
                />
              </div>
            </div>

            {/* Copy */}
            <div className="flex-1 order-2 md:order-1 text-center md:text-left flex flex-col gap-5">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b8972a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/>
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#b8972a" }}>
                  Grand Prize · SuperBrain World Cup 2026
                </span>
              </div>

              <div>
                <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight" style={{ color: "#0f1f17" }}>
                  Win the Custom<br />
                  <span style={{ color: "#b8972a" }}>Champion Watch</span>
                </h2>
                <p className="text-sm sm:text-base mt-3 leading-relaxed" style={{ color: "#2e4a37" }}>
                  Awarded to the overall SuperBrain World Cup Prediction 2026 Champion.
                  One winner. One watch. Your name engraved on it forever.
                </p>
              </div>

              <ul className="flex flex-col gap-2 items-center md:items-start">
                {[
                  "Custom-built luxury watch",
                  "Assembled in Sweden",
                  "Swiss movement",
                  "Personalized winner engraving",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(184,151,42,0.15)", border: "1px solid rgba(184,151,42,0.35)" }}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <polyline points="2,5 4.5,7.5 8,3" stroke="#b8972a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className="text-sm" style={{ color: "#2e4a37" }}>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row items-center md:items-start gap-3 pt-1">
                <Link href="/predict" className="w-full sm:w-auto">
                  <button
                    className="w-full sm:w-auto font-bold px-8 py-3.5 rounded-lg text-sm transition-all active:scale-[0.98]"
                    style={{ background: "#1a3a2a", color: "#ffffff" }}
                  >
                    Start Predicting →
                  </button>
                </Link>
                <Link href="/predict/prize" className="w-full sm:w-auto">
                  <button
                    className="w-full sm:w-auto font-semibold px-8 py-3.5 rounded-lg text-sm transition-all active:scale-[0.98]"
                    style={{ background: "rgba(184,151,42,0.1)", color: "#b8972a", border: "1px solid rgba(184,151,42,0.3)" }}
                  >
                    Prize Details →
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRIVATE LEAGUES ───────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <div className="text-center mb-10">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-2">Play with friends</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">Create a private league</h2>
          <Link href="/predict">
            <button className="btn-primary text-sm px-10 py-3">
              Create or Join a League →
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: "🔒",
              title: "Invite Only",
              body: "Share a code or link. Only people you invite can join your league.",
            },
            {
              icon: "🏆",
              title: "Your Own Leaderboard",
              body: "See exactly how you rank against your friends throughout the tournament.",
            },
            {
              icon: "📲",
              title: "Share via WhatsApp",
              body: "One tap to send your league invite directly to your group chat.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 text-center"
            >
              <div className="text-3xl mb-4">{item.icon}</div>
              <h3 className="text-white font-semibold text-sm mb-2">{item.title}</h3>
              <p className="text-cockpit-muted text-xs leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="border-t border-cockpit-border bg-cockpit-surface">
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 80% at 50% 120%, rgba(0,212,255,0.08) 0%, transparent 65%)",
            }}
          />
          <div className="relative max-w-5xl mx-auto px-5 py-16 sm:py-20 text-center">
            <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-4">
              Tournament starts June 11
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
              Your predictions.<br />
              <span
                className="text-cockpit-accent"
                style={{ textShadow: "0 0 60px rgba(0,212,255,0.35)" }}
              >
                Your glory.
              </span>
            </h2>
            <p className="text-cockpit-dim text-base sm:text-lg mb-10 max-w-md mx-auto">
              Free to play. Predictions lock at kickoff. The leaderboard never lies.
            </p>
            <Link href="/predict">
              <button className="btn-primary text-sm sm:text-base px-12 py-4 w-full sm:w-auto">
                Join Free Now →
              </button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
