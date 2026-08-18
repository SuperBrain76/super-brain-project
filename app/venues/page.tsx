"use client";

/**
 * /venues — the sales demo for venue-branded leagues.
 *
 * A spectacular, self-contained "dummy" to sell sports bars a dedicated,
 * white-labelled prediction league: their banner, their league name, their
 * prizes — plus an owner control room showing the stats behind it. All data
 * here is illustrative sample data (a fictional venue, "The Offside").
 */

import { useState } from "react";

// ── Fictional venue brand (this is what a bar would white-label) ──
const V = {
  name:    "THE OFFSIDE",
  sub:     "Sports Bar & Kitchen",
  league:  "The Offside Premier League Cup",
  amber:   "#F5B301",
  amber2:  "#FF8A00",
  crimson: "#E23B3B",
  ink:     "#12100E",
  panel:   "#1B1813",
  panel2:  "#241F18",
  line:    "#3A3226",
  cream:   "#FBF5E9",
  muted:   "#B7AC97",
};

const LEADERS = [
  { r: 1, name: "Big Dave",        pts: 214, mv: 0,  streak: 6, initials: "BD", note: "Drinks on the house 🍻" },
  { r: 2, name: "Sana K.",         pts: 208, mv: 2,  streak: 4, initials: "SK" },
  { r: 3, name: "The Gaffer",      pts: 199, mv: -1, streak: 3, initials: "TG" },
  { r: 4, name: "Marco P.",        pts: 191, mv: 1,  streak: 2, initials: "MP" },
  { r: 5, name: "Aisha R.",        pts: 187, mv: -1, streak: 5, initials: "AR" },
  { r: 6, name: "Tommy Two-Taps",  pts: 180, mv: 3,  streak: 1, initials: "TT" },
  { r: 7, name: "El Capitan",      pts: 176, mv: 0,  streak: 2, initials: "EC" },
  { r: 8, name: "Priya M.",        pts: 171, mv: 1,  streak: 4, initials: "PM" },
];

const FIXTURES = [
  { h: "Arsenal",   a: "Man City",   day: "Sat", time: "18:30" },
  { h: "Liverpool", a: "Chelsea",    day: "Sun", time: "16:30" },
  { h: "Newcastle", a: "Tottenham",  day: "Sun", time: "14:00" },
];

const SPONSORS = ["STELLA ON TAP", "REDBULL", "BEEP TAXIS", "GRILL CO."];

const KPIS = [
  { label: "League members",     value: "142", delta: "+18 this week" },
  { label: "Playing this week",  value: "89",  delta: "63% of members" },
  { label: "Predictions made",   value: "1,204", delta: "this matchweek" },
  { label: "Avg visits / member",value: "2.3", delta: "per week" },
  { label: "8-week retention",   value: "78%", delta: "+11 pts vs launch" },
  { label: "Sponsor slots sold", value: "4 / 4", delta: "fully booked" },
];

const WEEKS = [34, 41, 52, 63, 71, 78, 84, 89]; // weekly-active over 8 weeks

const MEMBERS = [
  { name: "Big Dave",       joined: "Wk 1", played: "8/8", pts: 214 },
  { name: "Sana K.",        joined: "Wk 1", played: "8/8", pts: 208 },
  { name: "Tommy Two-Taps", joined: "Wk 3", played: "6/6", pts: 180 },
  { name: "Priya M.",       joined: "Wk 2", played: "7/7", pts: 171 },
];

export default function VenuesDemo() {
  const [view, setView] = useState<"fan" | "owner">("fan");
  return (
    <div style={{ background: V.ink, color: V.cream, minHeight: "100vh" }}>
      {/* Demo ribbon */}
      <div className="text-center text-[11px] font-bold tracking-widest py-1.5" style={{ background: V.crimson, color: "#fff" }}>
        LIVE DEMO · SAMPLE VENUE · POWERED BY SUPERBRAIN
      </div>

      {/* View switch */}
      <div className="flex justify-center gap-2 py-4 px-4 sticky top-0 z-30" style={{ background: `${V.ink}f2`, backdropFilter: "blur(8px)" }}>
        <Toggle active={view === "fan"} onClick={() => setView("fan")} amber={V.amber}>👀 Fan view</Toggle>
        <Toggle active={view === "owner"} onClick={() => setView("owner")} amber={V.amber}>📊 Owner control room</Toggle>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-24">
        {view === "fan" ? <FanView /> : <OwnerView />}
      </div>
    </div>
  );
}

// ══════════════════════════ FAN VIEW ══════════════════════════
function FanView() {
  return (
    <div className="flex flex-col gap-8 pt-4">
      {/* Hero banner — the venue's big branding */}
      <div className="relative rounded-3xl overflow-hidden" style={{ border: `1px solid ${V.line}` }}>
        <div className="absolute inset-0" style={{ background: `radial-gradient(120% 120% at 15% 0%, ${V.amber}22 0%, transparent 55%), linear-gradient(135deg, ${V.panel} 0%, ${V.ink} 70%)` }} />
        <div className="relative px-6 sm:px-10 py-10 sm:py-14">
          <div className="flex items-center gap-4 mb-6">
            <Crest amber={V.amber} amber2={V.amber2} ink={V.ink} initials="OS" />
            <div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: V.cream }}>{V.name}</div>
              <div className="text-xs tracking-[0.25em] uppercase" style={{ color: V.amber }}>{V.sub}</div>
            </div>
          </div>
          <p className="text-[11px] font-bold tracking-[0.3em] uppercase mb-2" style={{ color: V.muted }}>Official Prediction League</p>
          <h1 className="text-4xl sm:text-6xl font-black leading-[0.95] mb-5" style={{ color: V.cream }}>
            {V.league}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-black px-5 py-3 rounded-full" style={{ background: `linear-gradient(90deg, ${V.amber}, ${V.amber2})`, color: V.ink }}>
              Join the league →
            </span>
            <span className="text-xs px-3 py-2 rounded-full" style={{ background: "#ffffff10", color: V.muted, border: `1px solid ${V.line}` }}>
              142 regulars playing
            </span>
          </div>
        </div>
      </div>

      {/* This week's prize — venue-set */}
      <div className="rounded-2xl px-6 py-5 flex items-center gap-4" style={{ background: `linear-gradient(90deg, ${V.crimson}22, transparent)`, border: `1px solid ${V.crimson}55` }}>
        <span className="text-3xl">🏆</span>
        <div>
          <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: V.crimson }}>This week&apos;s prize</div>
          <div className="text-lg font-black" style={{ color: V.cream }}>Top of the table drinks free on Sunday</div>
          <div className="text-xs" style={{ color: V.muted }}>Runner-up: a £50 tab · set by the venue, any prize you like</div>
        </div>
      </div>

      {/* Leaderboard */}
      <Section title="The Table" accent={V.amber}>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${V.line}` }}>
          {LEADERS.map((p, i) => (
            <div key={p.r} className="flex items-center gap-3 px-4 py-3"
                 style={{ background: i === 0 ? `${V.amber}12` : i % 2 ? V.panel : V.panel2, borderBottom: i < LEADERS.length - 1 ? `1px solid ${V.line}` : "none" }}>
              <span className="w-6 text-center font-black" style={{ color: i === 0 ? V.amber : V.muted }}>{p.r === 1 ? "👑" : p.r}</span>
              <span className="w-9 h-9 rounded-full grid place-items-center text-xs font-black shrink-0" style={{ background: i === 0 ? V.amber : "#ffffff12", color: i === 0 ? V.ink : V.cream }}>{p.initials}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: V.cream }}>{p.name}{p.note && <span className="ml-2 text-[10px]" style={{ color: V.amber }}>{p.note}</span>}</div>
                <div className="text-[11px]" style={{ color: V.muted }}>{p.streak}-week streak {"🔥".repeat(Math.min(3, Math.ceil(p.streak / 2)))}</div>
              </div>
              <span className="text-[11px] font-bold" style={{ color: p.mv > 0 ? "#5fd08a" : p.mv < 0 ? V.crimson : V.muted }}>
                {p.mv > 0 ? `▲${p.mv}` : p.mv < 0 ? `▼${-p.mv}` : "–"}
              </span>
              <span className="text-base font-black w-12 text-right" style={{ color: V.amber }}>{p.pts}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* This matchweek */}
      <Section title="Predict this weekend" accent={V.amber}>
        <div className="grid gap-2 sm:grid-cols-3">
          {FIXTURES.map((f, i) => (
            <div key={i} className="rounded-xl p-4 text-center" style={{ background: V.panel, border: `1px solid ${V.line}` }}>
              <div className="text-[10px] font-bold" style={{ color: V.muted }}>{f.day} · {f.time}</div>
              <div className="text-sm font-black mt-2" style={{ color: V.cream }}>{f.h}</div>
              <div className="text-[10px] my-1" style={{ color: V.amber }}>vs</div>
              <div className="text-sm font-black" style={{ color: V.cream }}>{f.a}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Sponsor strip — the venue can sell these slots */}
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase text-center mb-3" style={{ color: V.muted }}>This league is backed by</p>
        <div className="flex flex-wrap justify-center gap-3">
          {SPONSORS.map((s) => (
            <span key={s} className="text-xs font-black tracking-wider px-4 py-2 rounded-lg" style={{ background: V.panel2, color: V.cream, border: `1px solid ${V.line}` }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Join CTA + QR mock */}
      <div className="rounded-3xl px-6 py-8 flex flex-col sm:flex-row items-center gap-6" style={{ background: `linear-gradient(135deg, ${V.amber} 0%, ${V.amber2} 100%)`, color: V.ink }}>
        <QrMock ink={V.ink} />
        <div className="text-center sm:text-left">
          <div className="text-2xl font-black">Scan at the bar to join</div>
          <div className="text-sm font-semibold opacity-80 mt-1">Free to play. Predict the weekend, climb {V.name}&apos;s table, win at the bar.</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════ OWNER VIEW ══════════════════════════
function OwnerView() {
  const max = Math.max(...WEEKS);
  return (
    <div className="flex flex-col gap-8 pt-4">
      <div>
        <p className="text-[11px] font-bold tracking-[0.3em] uppercase" style={{ color: V.amber }}>{V.name} · Control Room</p>
        <h1 className="text-3xl sm:text-4xl font-black" style={{ color: V.cream }}>Everything you run, all in one place</h1>
        <p className="text-sm mt-1" style={{ color: V.muted }}>The stats behind your league — footfall you can measure, sponsors you can sell.</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: V.panel, border: `1px solid ${V.line}` }}>
            <div className="text-3xl font-black" style={{ color: V.amber }}>{k.value}</div>
            <div className="text-xs font-bold mt-1" style={{ color: V.cream }}>{k.label}</div>
            <div className="text-[11px]" style={{ color: V.muted }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Engagement chart */}
      <Section title="Weekly active members" accent={V.amber}>
        <div className="rounded-2xl p-5" style={{ background: V.panel, border: `1px solid ${V.line}` }}>
          <div className="flex items-end gap-2" style={{ height: 140 }}>
            {WEEKS.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div className="w-full rounded-t" style={{ height: `${(w / max) * 100}%`, background: `linear-gradient(180deg, ${V.amber}, ${V.amber2})` }} />
                <span className="text-[9px]" style={{ color: V.muted }}>W{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] mt-3" style={{ color: V.muted }}>Members keep coming back — and each visit is time at your bar.</div>
        </div>
      </Section>

      {/* Branding controls — "you control it" */}
      <Section title="Your branding — you control it all" accent={V.amber}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Control label="League name">
            <div className="text-sm font-bold px-3 py-2 rounded-lg" style={{ background: V.panel2, color: V.cream, border: `1px solid ${V.line}` }}>{V.league}</div>
          </Control>
          <Control label="Prize this week">
            <div className="text-sm font-bold px-3 py-2 rounded-lg" style={{ background: V.panel2, color: V.cream, border: `1px solid ${V.line}` }}>Winner drinks free Sunday</div>
          </Control>
          <Control label="Your banner">
            <div className="h-14 rounded-lg grid place-items-center text-xs font-bold" style={{ background: `linear-gradient(90deg, ${V.amber}, ${V.amber2})`, color: V.ink }}>THE OFFSIDE — uploaded ✓</div>
          </Control>
          <Control label="Brand colours">
            <div className="flex gap-2 items-center h-14">
              {[V.amber, V.crimson, V.ink, V.cream].map((c) => <span key={c} className="w-8 h-8 rounded-full" style={{ background: c, border: `1px solid ${V.line}` }} />)}
              <span className="text-[11px] ml-1" style={{ color: V.muted }}>tap to change</span>
            </div>
          </Control>
          <Control label="Sponsor slots">
            <div className="text-sm font-bold px-3 py-2 rounded-lg" style={{ background: V.panel2, color: V.cream, border: `1px solid ${V.line}` }}>4 sold · your inventory to price</div>
          </Control>
          <Control label="Members">
            <div className="text-sm font-bold px-3 py-2 rounded-lg" style={{ background: V.panel2, color: V.cream, border: `1px solid ${V.line}` }}>142 · export / message all</div>
          </Control>
        </div>
      </Section>

      {/* Members preview */}
      <Section title="Members" accent={V.amber}>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${V.line}` }}>
          <div className="grid grid-cols-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ background: V.panel2, color: V.muted }}>
            <span>Member</span><span>Joined</span><span>Played</span><span className="text-right">Points</span>
          </div>
          {MEMBERS.map((m, i) => (
            <div key={m.name} className="grid grid-cols-4 px-4 py-3 text-sm" style={{ background: i % 2 ? V.panel : V.panel2, borderTop: `1px solid ${V.line}`, color: V.cream }}>
              <span className="font-bold">{m.name}</span><span style={{ color: V.muted }}>{m.joined}</span><span style={{ color: V.muted }}>{m.played}</span><span className="text-right font-black" style={{ color: V.amber }}>{m.pts}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Why it works + packages */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { t: "Repeat footfall", d: "A weekly reason to come back — every matchweek." },
          { t: "Longer dwell time", d: "Predictions + live results keep people at the bar." },
          { t: "Sponsor revenue", d: "Sell banner + prize slots to your suppliers." },
        ].map((b) => (
          <div key={b.t} className="rounded-2xl p-5" style={{ background: V.panel, border: `1px solid ${V.line}` }}>
            <div className="text-sm font-black" style={{ color: V.amber }}>{b.t}</div>
            <div className="text-xs mt-1" style={{ color: V.muted }}>{b.d}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-5 text-center" style={{ background: V.panel2, border: `1px dashed ${V.line}` }}>
        <div className="text-xs font-bold tracking-widest uppercase" style={{ color: V.muted }}>Packages — placeholder, set your own pricing</div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          {[
            { n: "Starter", p: "AED —", f: "Branded league + leaderboard" },
            { n: "Pro", p: "AED —", f: "+ sponsor slots + owner stats", hot: true },
            { n: "Sponsor", p: "AED —", f: "+ multi-venue + priority support" },
          ].map((t) => (
            <div key={t.n} className="rounded-xl p-4" style={{ background: t.hot ? `${V.amber}14` : V.panel, border: `1px solid ${t.hot ? V.amber : V.line}` }}>
              <div className="text-sm font-black" style={{ color: t.hot ? V.amber : V.cream }}>{t.n}</div>
              <div className="text-2xl font-black my-1" style={{ color: V.cream }}>{t.p}</div>
              <div className="text-[11px]" style={{ color: V.muted }}>{t.f}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Small pieces ──
function Toggle({ active, onClick, children, amber }: { active: boolean; onClick: () => void; children: React.ReactNode; amber: string }) {
  return (
    <button onClick={onClick} className="text-sm font-bold px-4 py-2 rounded-full transition-all"
            style={active ? { background: amber, color: V.ink } : { background: "#ffffff10", color: V.muted, border: `1px solid ${V.line}` }}>
      {children}
    </button>
  );
}
function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-5 rounded-full" style={{ background: accent }} />
        <h2 className="text-lg font-black" style={{ color: V.cream }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}
function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: V.panel, border: `1px solid ${V.line}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: V.muted }}>{label}</div>
      {children}
    </div>
  );
}
function Crest({ amber, amber2, ink, initials }: { amber: string; amber2: string; ink: string; initials: string }) {
  return (
    <div className="w-14 h-14 rounded-2xl grid place-items-center text-xl font-black shrink-0"
         style={{ background: `linear-gradient(135deg, ${amber}, ${amber2})`, color: ink, boxShadow: `0 8px 24px -6px ${amber}88` }}>
      {initials}
    </div>
  );
}
function QrMock({ ink }: { ink: string }) {
  return (
    <div className="w-24 h-24 rounded-xl grid grid-cols-5 grid-rows-5 gap-0.5 p-2 shrink-0" style={{ background: "#fff" }}>
      {Array.from({ length: 25 }).map((_, i) => (
        <span key={i} style={{ background: [0,1,2,4,5,9,10,12,14,15,19,20,22,23,24,6,8,16,18].includes(i) ? ink : "transparent", borderRadius: 1 }} />
      ))}
    </div>
  );
}
