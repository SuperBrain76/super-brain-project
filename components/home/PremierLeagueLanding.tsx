"use client";

/**
 * PremierLeagueLanding — the front door.
 *
 * The logged-out landing, rebuilt around the live product: the Premier League.
 * Dark premium brand shell (BRAND tokens) with real football energy — club
 * colours, a scrolling crest wall, an interactive "try it" prediction card,
 * and the IQ ladder. No World Cup. No dependency on a DB query that can fail
 * for an anonymous visitor: everything here is evergreen and always renders.
 *
 * Motion is pure CSS (no framer-motion dependency): entrance keyframes on the
 * hero, an IntersectionObserver reveal for the sections below the fold, and a
 * marquee for the crest wall. Respects prefers-reduced-motion.
 */

import { useState } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { ALL_CLUBS, club, textOn } from "@/lib/premierLeague/clubs";
import { IQ_LEVELS } from "@/lib/iqLevel";
import LeagueChooser from "@/components/LeagueChooser";

const PL = "premier-league";

// A gentle CSS entrance. Pure CSS (no observer/timer), so content is never
// left invisible by a frozen/background tab — the animation always resolves to
// its visible end state. Respects prefers-reduced-motion (see LandingStyles).
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <div className={`pl-in ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function PremierLeagueLanding() {
  return (
    <div className="min-h-screen" style={{ background: BRAND.black, color: BRAND.ink }}>
      <LandingStyles />
      <Hero />
      <LeaguePicker />
      <TryItSection />
      <SuperBrainSection />
      <HowItWorks />
      <PrivateLeagues />
      <TestsCard />
      <FinalCta />
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden hud-grid">
      {/* Ambient light */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(53,197,111,0.16) 0%, transparent 60%)" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 85% 8%, rgba(232,193,90,0.10) 0%, transparent 55%)" }} />
      <div className="absolute bottom-0 inset-x-0 h-32 pointer-events-none" style={{ background: `linear-gradient(to bottom, transparent, ${BRAND.black})` }} />

      <div className="relative max-w-5xl mx-auto px-5 pt-14 pb-10 text-center">
        <div className="pl-in" style={{ animationDelay: "0ms" }}>
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-7"
            style={{ background: BRAND.surface, border: `0.5px solid ${BRAND.hairline}` }}>
            <span className="w-1.5 h-1.5 rounded-full pl-pulse" style={{ background: BRAND.sports }} />
            <span className="text-[11px] tracking-[0.2em] uppercase font-semibold" style={{ color: BRAND.sports }}>
              6 leagues · 2 sports · Free to play
            </span>
          </div>
        </div>

        <h1 className="pl-in text-[2.9rem] leading-[0.98] sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-5" style={{ color: BRAND.ink, animationDelay: "80ms" }}>
          Predict Europe&apos;s<br />
          <span style={{ color: BRAND.sports, textShadow: "0 0 90px rgba(53,197,111,0.45)" }}>biggest leagues</span>
        </h1>

        <p className="pl-in text-base sm:text-xl max-w-xl mx-auto leading-relaxed mb-8" style={{ color: BRAND.muted, animationDelay: "160ms" }}>
          Europe&apos;s top five football leagues — and Sweden&apos;s SHL ice hockey. Every match, one tap — build a private league, climb the table, and grow your{" "}
          <span style={{ color: BRAND.gold, fontWeight: 600 }}>SuperBrain</span>, free.
        </p>

        <div className="pl-in flex flex-col sm:flex-row items-center justify-center gap-3 mb-4" style={{ animationDelay: "240ms" }}>
          <a href="#leagues" className="w-full sm:w-auto">
            <button className="pl-cta text-sm sm:text-base font-bold px-9 py-4 w-full sm:w-auto rounded-full"
              style={{ background: BRAND.sports, color: "#04140B" }}>
              Choose your league ↓
            </button>
          </a>
          <a href="#try" className="w-full sm:w-auto">
            <button className="text-sm px-7 py-4 w-full sm:w-auto rounded-full transition-colors"
              style={{ background: "transparent", color: BRAND.muted, border: `0.5px solid ${BRAND.hairline}` }}>
              See how it works
            </button>
          </a>
        </div>

        <p className="pl-in text-xs mb-9" style={{ color: BRAND.dim, animationDelay: "300ms" }}>
          No entry fee · Predictions lock at kickoff · The table never lies
        </p>
      </div>

      {/* Crest wall — the whole league, scrolling. Instantly reads as football. */}
      <div className="pl-in relative pb-12" style={{ animationDelay: "360ms" }}>
        <CrestWall />
      </div>

      {/* Stat strip */}
      <div className="relative max-w-5xl mx-auto px-5 pb-14">
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-5 sm:gap-x-16">
          {[
            { v: "6", l: "Leagues" },
            { v: "110", l: "Clubs" },
            { v: "2,100+", l: "Matches" },
            { v: "Free", l: "Always" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-2xl sm:text-3xl font-semibold" style={{ color: BRAND.ink, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
              <div className="text-[11px] tracking-[0.14em] uppercase mt-1" style={{ color: BRAND.dim }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Crest wall — two marquee rows in opposite directions ──────
function CrestWall() {
  const half = Math.ceil(ALL_CLUBS.length / 2);
  const rowA = ALL_CLUBS.slice(0, half);
  const rowB = ALL_CLUBS.slice(half);
  const Row = ({ clubs, dir }: { clubs: typeof ALL_CLUBS; dir: "l" | "r" }) => (
    <div className="flex overflow-hidden select-none" style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
      <div className={dir === "l" ? "pl-marquee-l" : "pl-marquee-r"} style={{ display: "flex", gap: 12, paddingRight: 12 }}>
        {[...clubs, ...clubs, ...clubs].map((c, i) => (
          <div key={c.code + i} className="flex items-center gap-2 px-3 py-2 rounded-xl shrink-0"
            style={{ background: BRAND.surface, border: `0.5px solid ${BRAND.hairline}` }}>
            <span aria-hidden style={{ width: 26, height: 26, borderRadius: 7, background: c.primary, color: textOn(c.primary), display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800 }}>{c.code}</span>
            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: BRAND.muted }}>{c.short}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <Row clubs={rowA} dir="l" />
      <Row clubs={rowB} dir="r" />
    </div>
  );
}

// ── League picker — the front door, grouped by sport ──────────
function LeaguePicker() {
  return (
    <section id="leagues" className="max-w-5xl mx-auto px-5 py-12" style={{ scrollMarginTop: 20 }}>
      <Reveal className="text-center mb-8">
        <p className="text-xs tracking-[0.28em] uppercase mb-3" style={{ color: BRAND.dim }}>Choose your competition</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: BRAND.ink }}>Two sports. One tap each.</h2>
      </Reveal>
      <Reveal delay={60}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">⚽</span>
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: BRAND.muted }}>Football</h3>
        </div>
        <LeagueChooser sport="football" />
      </Reveal>
      <Reveal delay={100}>
        <div className="flex items-center gap-2 mb-3 mt-8">
          <span className="text-lg">🏒</span>
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: BRAND.muted }}>Ice Hockey</h3>
        </div>
        <LeagueChooser sport="ice_hockey" />
      </Reveal>
    </section>
  );
}

// ── Try it — interactive demo prediction ──────────────────────
function TryItSection() {
  return (
    <section id="try" className="max-w-5xl mx-auto px-5 py-16" style={{ scrollMarginTop: 20 }}>
      <Reveal className="text-center mb-8">
        <p className="text-xs tracking-[0.28em] uppercase mb-3" style={{ color: BRAND.dim }}>Try it — no sign-up</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: BRAND.ink }}>Tap who you think wins</h2>
      </Reveal>
      <Reveal delay={80}>
        <DemoCard />
      </Reveal>
    </section>
  );
}

function DemoCard() {
  const home = club("NEW")!, away = club("LIV")!;
  const [pick, setPick] = useState<"home" | "draw" | "away" | null>(null);
  const score = pick === "home" ? "1 – 0" : pick === "away" ? "0 – 1" : pick === "draw" ? "1 – 1" : "– : –";

  const Btn = ({ id, label, color }: { id: "home" | "draw" | "away"; label: string; color: string }) => {
    const active = pick === id;
    return (
      <button onClick={() => setPick(id)}
        className="py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.97]"
        style={{ background: active ? color : "rgba(255,255,255,0.04)", color: active ? textOn(color) : BRAND.muted, border: `1px solid ${active ? color : BRAND.hairline}` }}>
        {label}
      </button>
    );
  };

  return (
    <div className="max-w-md mx-auto rounded-3xl p-5" style={{ background: BRAND.surface, border: `0.5px solid ${BRAND.hairline}`, boxShadow: "0 24px 60px -24px rgba(0,0,0,0.85)" }}>
      <div className="flex items-center justify-between text-[11px] mb-4" style={{ color: BRAND.dim }}>
        <span>Matchweek 1 · Sun 23 Aug</span><span>🏟 St James&apos; Park</span>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <span aria-hidden style={{ width: 44, height: 44, borderRadius: 11, background: home.primary, color: textOn(home.primary), display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{home.code}</span>
          <span className="text-xs font-bold" style={{ color: BRAND.ink }}>{home.short}</span>
        </div>
        <div className="text-2xl font-extrabold tabular-nums px-3" style={{ color: pick ? BRAND.ink : BRAND.dim }}>{score}</div>
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <span aria-hidden style={{ width: 44, height: 44, borderRadius: 11, background: away.primary, color: textOn(away.primary), display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{away.code}</span>
          <span className="text-xs font-bold" style={{ color: BRAND.ink }}>{away.short}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Btn id="home" label={home.short} color={home.primary} />
        <Btn id="draw" label="Draw" color={BRAND.sports} />
        <Btn id="away" label={away.short} color={away.primary} />
      </div>
      <div className="mt-4 text-center" style={{ minHeight: 40 }}>
        {pick ? (
          <>
            <p className="text-sm font-semibold" style={{ color: BRAND.sports }}>✓ That&apos;s a prediction. Now do it for all 10.</p>
            <Link href={`/${PL}`}>
              <span className="inline-block mt-2 text-sm font-bold" style={{ color: BRAND.gold }}>Play the full matchweek →</span>
            </Link>
          </>
        ) : (
          <p className="text-xs" style={{ color: BRAND.dim }}>One tap. That&apos;s the whole game.</p>
        )}
      </div>
    </div>
  );
}

// ── SuperBrain / IQ ladder ────────────────────────────────────
function SuperBrainSection() {
  return (
    <section className="relative overflow-hidden" style={{ borderTop: `0.5px solid ${BRAND.hairline}`, borderBottom: `0.5px solid ${BRAND.hairline}` }}>
      <div className="absolute pointer-events-none" style={{ top: "40%", left: "50%", width: 620, height: 380, transform: "translate(-50%,-50%)", background: "radial-gradient(closest-side, rgba(232,193,90,0.10), transparent 70%)" }} />
      <div className="relative max-w-5xl mx-auto px-5 py-20 text-center">
        <Reveal>
          <p className="text-xs tracking-[0.28em] uppercase mb-3" style={{ color: BRAND.dim }}>🧠 Build your SuperBrain</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3" style={{ color: BRAND.ink }}>You&apos;re not just predicting football</h2>
          <p className="text-sm sm:text-base max-w-lg mx-auto mb-12" style={{ color: BRAND.muted }}>
            Every prediction earns IQ — win or lose. IQ never resets. It carries you up five levels, from Bronze to Legend. A reason to come back even when your team doesn&apos;t.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <div className="flex items-end justify-center gap-1.5 sm:gap-4">
            {IQ_LEVELS.map((lv, i) => {
              const h = 54 + i * 20;
              return (
                <div key={lv.id} className="flex flex-col items-center gap-2 w-[60px] sm:w-[72px]">
                  <div className="rounded-t-xl w-full flex items-end justify-center pb-2" style={{ height: h, background: `linear-gradient(180deg, ${lv.color}44, ${lv.color}14)`, border: `1px solid ${lv.color}55`, borderBottom: "none" }}>
                    <span className="text-xl">{lv.icon}</span>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-bold" style={{ color: lv.color }}>{lv.name}</div>
                    <div className="text-[9px]" style={{ color: BRAND.dim }}>{lv.min.toLocaleString()} IQ</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────
const STEPS = [
  { t: "Sign up free", b: "30 seconds. No card, no catch." },
  { t: "Tap your winners", b: "One tap per match, fine-tune the score. All 10 in under two minutes." },
  { t: "Earn points + IQ", b: "Exact score 5 · goal difference 3 · right result 2. IQ on every pick." },
  { t: "Climb the table", b: "Global leaderboard and your private leagues, live as the goals go in." },
];
function HowItWorks() {
  return (
    <section className="max-w-5xl mx-auto px-5 py-20">
      <Reveal className="text-center mb-14">
        <p className="text-xs tracking-[0.28em] uppercase mb-3" style={{ color: BRAND.dim }}>Get started</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: BRAND.ink }}>How it works</h2>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6">
        {STEPS.map((s, i) => (
          <Reveal key={s.t} delay={i * 70}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: BRAND.black, border: `0.5px solid ${BRAND.hairlineStrong}`, color: BRAND.sports }}>{i + 1}</span>
            </div>
            <h3 className="font-semibold text-sm mb-2" style={{ color: BRAND.ink }}>{s.t}</h3>
            <p className="text-xs leading-relaxed" style={{ color: BRAND.muted }}>{s.b}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── Private leagues ───────────────────────────────────────────
function PrivateLeagues() {
  return (
    <section style={{ borderTop: `0.5px solid ${BRAND.hairline}` }}>
      <div className="max-w-5xl mx-auto px-5 py-20">
        <Reveal className="text-center mb-12">
          <p className="text-xs tracking-[0.28em] uppercase mb-3" style={{ color: BRAND.dim }}>Play with friends</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-4" style={{ color: BRAND.ink }}>It&apos;s better with a group chat</h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: BRAND.muted }}>Create a private league, share a link, and settle it every weekend. The bragging rights write themselves.</p>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {[
            { icon: "🔒", title: "Invite only", body: "Share a code or link. Only people you invite can join." },
            { icon: "🏆", title: "Your own table", body: "See exactly where you rank against your mates all season." },
            { icon: "📲", title: "One-tap share", body: "Send your invite straight to the WhatsApp group." },
          ].map((item) => (
            <Reveal key={item.title}>
              <div className="px-6 py-6 sm:py-2 text-center sm:text-left" style={{ borderTop: `0.5px solid ${BRAND.hairline}` }}>
                <div className="text-2xl mb-4">{item.icon}</div>
                <h3 className="font-semibold text-sm mb-2" style={{ color: BRAND.ink }}>{item.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: BRAND.muted }}>{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Secondary product — brain tests ───────────────────────────
function TestsCard() {
  return (
    <section className="max-w-5xl mx-auto px-5 pb-4">
      <Reveal>
        <Link href="/tests" className="group block rounded-3xl p-6 sm:p-7 transition-transform hover:-translate-y-0.5"
          style={{ background: BRAND.surface, border: `0.5px solid ${BRAND.hairline}` }}>
          <div className="flex items-center gap-4">
            <span className="text-3xl">🧠</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-extrabold" style={{ color: BRAND.ink }}>Also: 6 brain tests</h3>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "rgba(51,214,214,0.1)", color: BRAND.tests }}>Free</span>
              </div>
              <p className="text-sm" style={{ color: BRAND.muted }}>Reaction, memory, focus — measure your real cognitive edge and earn IQ.</p>
            </div>
            <span className="text-sm font-bold transition-transform group-hover:translate-x-1" style={{ color: BRAND.tests }}>→</span>
          </div>
        </Link>
      </Reveal>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────
function FinalCta() {
  return (
    <section className="relative overflow-hidden" style={{ borderTop: `0.5px solid ${BRAND.hairline}` }}>
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: 340, background: "radial-gradient(ellipse 70% 100% at 50% 120%, rgba(53,197,111,0.14), transparent 65%)" }} />
      <div className="relative max-w-5xl mx-auto px-5 py-24 text-center">
        <Reveal>
          <p className="text-xs tracking-[0.28em] uppercase mb-4" style={{ color: BRAND.dim }}>Kick-off is coming</p>
          <h2 className="text-3xl sm:text-5xl font-extrabold mb-5 leading-tight" style={{ color: BRAND.ink }}>
            This weekend&apos;s matches<br />are waiting.
          </h2>
          <p className="text-base sm:text-lg mb-10 max-w-md mx-auto" style={{ color: BRAND.muted }}>
            Free to play. Predictions lock at kickoff. Your first pick is one tap away.
          </p>
          <Link href={`/${PL}`}>
            <button className="pl-cta text-sm sm:text-base font-bold px-12 py-4 rounded-full w-full sm:w-auto" style={{ background: BRAND.sports, color: "#04140B" }}>
              Start predicting — free →
            </button>
          </Link>
          <p className="mt-10 text-xs max-w-md mx-auto leading-relaxed" style={{ color: BRAND.dim }}>
            SuperBrain is an independent fan prediction platform. It is not affiliated with, endorsed, or sponsored by the Premier League or any club.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ── CSS (keyframes + reduced-motion) ──────────────────────────
function LandingStyles() {
  return (
    <style>{`
      @keyframes plIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
      .pl-in { opacity: 0; animation: plIn .7s cubic-bezier(0.22,1,0.36,1) forwards; }
      @keyframes plPulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
      .pl-pulse { animation: plPulse 1.8s ease-in-out infinite; }
      .pl-cta { transition: transform .18s ease, box-shadow .18s ease; box-shadow: 0 10px 30px -10px rgba(53,197,111,0.5); }
      .pl-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 40px -12px rgba(53,197,111,0.65); }
      .pl-cta:active { transform: scale(0.98); }
      @keyframes plMarqueeL { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }
      @keyframes plMarqueeR { from { transform: translateX(-33.333%); } to { transform: translateX(0); } }
      .pl-marquee-l { animation: plMarqueeL 90s linear infinite; }
      .pl-marquee-r { animation: plMarqueeR 90s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        .pl-in { animation: none; opacity: 1; }
        .pl-pulse, .pl-marquee-l, .pl-marquee-r { animation: none; }
      }
    `}</style>
  );
}
