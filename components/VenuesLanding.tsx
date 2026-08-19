"use client";

/**
 * VenuesLanding — the one-audience landing page for sports bars & pubs.
 * Rendered at /venues and /bar. Written to convert a bar owner who clicks
 * through from a cold email: headline → the flow → why bars buy → pricing →
 * live example → create your league → FAQ. The "Create your league" CTA goes
 * to WhatsApp for now; it swaps to the self-serve Stripe checkout once built.
 */

import Link from "next/link";

const C = {
  bg: "#05130C", panel: "#0C1A12", panel2: "#10231A", line: "#20342A",
  green: "#35C56F", green2: "#1F8F4E", gold: "#D8B44A", ink: "#F2F7F3", muted: "#9FB4A6",
};
// The signup/onboarding flow lives at /venues/start (the existing venue system).
const START = "/venues/start";

const STEPS = [
  { n: 1, t: "Sign up", d: "2 minutes online" },
  { n: 2, t: "Upload your logo", d: "your colours & name" },
  { n: 3, t: "League created", d: "branded, instantly" },
  { n: 4, t: "Print your QR", d: "table-talkers & poster" },
  { n: 5, t: "Customers join", d: "they scan & predict" },
  { n: 6, t: "Live leaderboard", d: "they come back weekly" },
];
const WHY = [
  { t: "Repeat footfall", d: "A weekly reason to come in — every matchweek, all season." },
  { t: "Longer dwell time", d: "Predictions + live results keep people at the bar, not at home." },
  { t: "A customer database", d: "Every player is a contact you can message about events & offers." },
  { t: "Sponsorship revenue", d: "Sell the banner & prize slots to a beer brand or supplier." },
];
const FAQ = [
  { q: "Is this gambling?", a: "No. It's a 100% free skill game — no stakes, no money in, no cash out. Just bragging rights and whatever prize you choose. Legal to run anywhere." },
  { q: "How long does setup take?", a: "About 5 minutes. Sign up, upload your logo, name your league, and print the QR. Your league is live the same day." },
  { q: "Do my customers need an app?", a: "No app, no download. They scan your QR and play in their phone's browser. Nothing for you to install either." },
  { q: "Can I cancel anytime?", a: "Yes. It's month-to-month, cancel whenever. And your first matchweek is free, so there's no risk to try it." },
  { q: "Can I run multiple venues?", a: "Yes — each venue gets its own branded league, plus an optional cross-venue league. Ask us about group pricing." },
];

export default function VenuesLanding() {
  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100vh" }}>
      <style>{`
        @keyframes vlPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes vlLive{0%,100%{opacity:1}50%{opacity:.4}}
        .vl-btn{transition:transform .15s ease, box-shadow .15s ease}
        .vl-btn:hover{transform:translateY(-2px)}
      `}</style>

      {/* ── 1. HERO ── */}
      <section className="px-5 pt-16 pb-14" style={{ background: `radial-gradient(90% 90% at 50% -10%, ${C.green}1f 0%, transparent 55%)` }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-4" style={{ color: C.green }}>SuperBrain for Venues</p>
          <h1 className="text-4xl sm:text-6xl font-black leading-[0.98] mb-5" style={{ color: C.ink }}>
            Give your regulars a reason to<br className="hidden sm:block" /> come back <span style={{ color: C.gold }}>every matchweek.</span>
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mx-auto mb-8" style={{ color: C.muted, lineHeight: 1.6 }}>
            Your bar's own free prediction league — <b style={{ color: C.ink }}>your name, your logo, your prizes.</b> Customers predict the weekend's football on their phones and climb your table. Set it up online in minutes. No app, no hardware, no staff effort.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a href={START} className="vl-btn text-base font-black px-8 py-4 rounded-full" style={{ background: C.gold, color: "#1a1405", boxShadow: `0 14px 34px -12px ${C.gold}` }}>Create your league →</a>
            <Link href="/venues/mccaffertys" className="vl-btn text-base font-bold px-7 py-4 rounded-full" style={{ color: C.ink, background: "#ffffff10", border: `1px solid ${C.line}` }}>See a live venue</Link>
          </div>
          <p className="text-xs mt-5" style={{ color: C.muted }}>From £89 / €99 a month · <b style={{ color: C.green }}>first matchweek free</b> · cancel anytime</p>
        </div>
      </section>

      {/* ── 2. THE FLOW — leads to the live demo venue (no dead video button) ── */}
      <Section title="See it live">
        <Link href="/venues/mccaffertys" className="vl-btn block rounded-2xl overflow-hidden mb-6" style={{ border: `1px solid ${C.line}`, aspectRatio: "16/7", background: `linear-gradient(120deg, ${C.panel2}, ${C.bg})`, display: "grid", placeItems: "center" }}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full mx-auto grid place-items-center" style={{ background: C.gold, color: "#1a1405", animation: "vlPulse 2.2s ease-in-out infinite" }}>
              <span style={{ fontSize: 26, marginLeft: 4 }}>▶</span>
            </div>
            <p className="text-sm mt-3 font-black" style={{ color: C.ink }}>See a real venue's live league →</p>
            <p className="text-[11px] mt-1" style={{ color: C.muted }}>McCafferty's, Dubai — exactly what yours would look like</p>
          </div>
        </Link>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl p-4 text-center" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="w-8 h-8 rounded-full mx-auto grid place-items-center text-sm font-black mb-2" style={{ background: C.green, color: "#04130a" }}>{s.n}</div>
              <div className="text-[13px] font-black" style={{ color: C.ink }}>{s.t}</div>
              <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{s.d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 3. WHY BARS BUY ── */}
      <Section title="Why bars run it">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {WHY.map((w) => (
            <div key={w.t} className="rounded-2xl p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-base font-black" style={{ color: C.green }}>{w.t}</div>
              <p className="text-[13px] mt-1.5" style={{ color: C.muted, lineHeight: 1.5 }}>{w.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 4. PRICING ── */}
      <Section title="Pricing">
        <div className="rounded-3xl p-8 sm:p-10 text-center" style={{ background: `linear-gradient(120deg, ${C.panel2}, ${C.panel})`, border: `2px solid ${C.gold}` }}>
          <div className="text-5xl sm:text-6xl font-black" style={{ color: C.ink }}>£89 <span style={{ color: C.muted, fontSize: 22, fontWeight: 700 }}>/ €99</span></div>
          <div className="text-sm mt-1" style={{ color: C.muted }}>per venue, per month · ex. VAT · cancel anytime</div>
          <div className="inline-block mt-4 text-xs font-black px-4 py-2 rounded-full" style={{ background: `${C.green}22`, color: C.green, border: `1px solid ${C.green}55` }}>First matchweek free</div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 max-w-lg mx-auto mt-7 text-left">
            {["Your branding — logo, colours, league name", "Live leaderboard & all major leagues", "Unlimited members", "Set your own prizes", "QR sign-up kit (posters & table-talkers)", "Owner stats — who's playing, how often"].map((f) => (
              <div key={f} className="flex items-start gap-2 text-[13px]" style={{ color: C.ink }}>
                <span style={{ color: C.green, fontWeight: 900 }}>✓</span><span>{f}</span>
              </div>
            ))}
          </div>
          <a href={START} className="vl-btn inline-block mt-8 text-base font-black px-8 py-4 rounded-full" style={{ background: C.gold, color: "#1a1405" }}>Start free →</a>
        </div>
      </Section>

      {/* ── 5. LIVE EXAMPLE ── */}
      <Section title="See it for real">
        <Link href="/venues/mccaffertys" className="vl-btn block rounded-2xl p-6 sm:p-7 flex items-center gap-5" style={{ background: `linear-gradient(120deg, #334155, ${C.bg})`, border: `1px solid ${C.line}` }}>
          <div className="flex-1">
            <div className="text-[10px] font-black tracking-widest uppercase" style={{ color: C.gold }}>Live example</div>
            <div className="text-xl sm:text-2xl font-black mt-1" style={{ color: "#fff" }}>See a real venue's league →</div>
            <div className="text-[13px] mt-1" style={{ color: "#cbd5e1" }}>A full branded league, table and prizes — exactly what yours would look like.</div>
          </div>
          <span className="text-3xl shrink-0">🍺</span>
        </Link>
      </Section>

      {/* ── 6. CREATE YOUR LEAGUE ── */}
      <section className="px-5 py-14">
        <div className="max-w-3xl mx-auto rounded-3xl p-9 text-center" style={{ background: `linear-gradient(135deg, ${C.green} 0%, ${C.green2} 100%)`, color: "#04130a" }}>
          <h2 className="text-3xl sm:text-4xl font-black">Start your bar's league today.</h2>
          <p className="text-sm font-semibold opacity-80 mt-2">First matchweek's on us. Live the same day. Cancel anytime.</p>
          <a href={START} className="vl-btn inline-block mt-6 text-lg font-black px-10 py-4 rounded-full" style={{ background: C.gold, color: "#1a1405", boxShadow: "0 16px 40px -14px #000" }}>Create your league →</a>
        </div>
      </section>

      {/* ── 7. FAQ ── */}
      <Section title="Questions bar owners ask">
        <div className="flex flex-col gap-2 max-w-2xl mx-auto">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <summary className="text-[15px] font-bold cursor-pointer list-none flex justify-between items-center" style={{ color: C.ink }}>
                {f.q}<span style={{ color: C.gold }}>+</span>
              </summary>
              <p className="text-[13px] mt-2.5" style={{ color: C.muted, lineHeight: 1.6 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <footer className="px-5 py-10 text-center" style={{ borderTop: `1px solid ${C.line}` }}>
        <p className="text-sm font-black" style={{ color: C.ink }}>SuperBrain</p>
        <p className="text-xs mt-1" style={{ color: C.muted }}>superbrain.social · Dylan · +971 50 698 0217</p>
        <p className="text-[11px] mt-3" style={{ color: C.muted }}>A free skill game. No stakes, no gambling.</p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-1.5 h-6 rounded-full" style={{ background: C.gold }} />
          <h2 className="text-xl sm:text-2xl font-black" style={{ color: C.ink }}>{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}
