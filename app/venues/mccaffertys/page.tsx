"use client";

/**
 * /venues/mccaffertys — a branded league mock-up for a real prospect
 * (McCafferty's Irish Bars, Dubai). Shows what their live members' league would
 * look like: their wordmark, Irish green + gold, a full leaderboard, prize,
 * fixtures, sponsors. Sample data — a proposal, marked as a SuperBrain demo.
 */

const G = {
  green: "#1C7A3E", green2: "#0E5A2A", gold: "#E6B94E", gold2: "#C9A54B",
  ink: "#0A0D0A", panel: "#12160F", panel2: "#181D13", line: "#2C3624",
  cream: "#F7EFDD", muted: "#A9B79A", crimson: "#C0392B",
};

const LEADERS = [
  { r: 1, n: "Big Sean",      pts: 221, s: 7, i: "BS", note: "Winner's round on the house" },
  { r: 2, n: "Aoife D.",      pts: 214, s: 5, i: "AD" },
  { r: 3, n: "The Gaffer",    pts: 205, s: 4, i: "TG" },
  { r: 4, n: "Rashid A.",     pts: 198, s: 3, i: "RA" },
  { r: 5, n: "Niamh",         pts: 193, s: 6, i: "NI" },
  { r: 6, n: "Paddy Two-Pints", pts: 187, s: 2, i: "PP" },
  { r: 7, n: "Grace O.",      pts: 181, s: 4, i: "GO" },
  { r: 8, n: "Jamal K.",      pts: 176, s: 1, i: "JK" },
];
const FIXTURES = [
  { h: "Arsenal", a: "Man City", d: "Sat", t: "18:30" },
  { h: "Liverpool", a: "Chelsea", d: "Sun", t: "16:30" },
  { h: "Man Utd", a: "Spurs", d: "Sun", t: "14:00" },
];
const SPONSORS = ["GUINNESS", "JAMESON", "MAGNERS", "KILKENNY"];

export default function McCaffertysLeague() {
  return (
    <div style={{ background: G.ink, color: G.cream, minHeight: "100vh" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,900&display=swap" />
      <style>{`
        @keyframes mcBg{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes mcSweep{from{left:-25%}to{left:125%}}
        @keyframes mcHalo{0%,100%{opacity:.3;transform:scale(.92)}50%{opacity:.8;transform:scale(1.1)}}
        @keyframes mcCta{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes mcLive{0%,100%{opacity:1}50%{opacity:.35}}
        .mc-beam{position:absolute;top:-40%;width:90px;height:180%;background:linear-gradient(90deg,transparent,#ffffff22,transparent);filter:blur(6px);transform:skewX(-18deg);animation:mcSweep 6s linear infinite}
        .mc-beam.b2{animation-delay:3s;opacity:.6}
        .mc-word{font-family:'Playfair Display',Georgia,serif;font-weight:900;color:#fff;letter-spacing:.01em;
          text-shadow:0 2px 0 ${G.gold2}, 0 3px 0 ${G.gold2}, 0 6px 14px #000, 0 0 34px ${G.gold}55;
          -webkit-text-stroke:1px ${G.gold2};}
      `}</style>

      <div className="text-center text-[10px] font-bold tracking-widest py-1.5" style={{ background: G.panel2, color: G.muted, borderBottom: `1px solid ${G.line}` }}>
        SUPERBRAIN DEMO FOR McCAFFERTY&apos;S · SAMPLE DATA
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-24">
        {/* ── HERO BANNER ── */}
        <div className="relative rounded-3xl overflow-hidden mt-6" style={{ border: `1px solid ${G.line}`, boxShadow: "0 30px 80px -30px #000" }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(80% 120% at 50% -10%, ${G.gold}1f 0%, transparent 50%), linear-gradient(135deg, ${G.green} 0%, ${G.green2} 45%, ${G.ink} 100%)`, backgroundSize: "200% 200%", animation: "mcBg 16s ease-in-out infinite" }} />
          <div className="mc-beam" /><div className="mc-beam b2" />
          <div className="relative px-6 sm:px-10 py-12 text-center">
            <div className="inline-flex items-center gap-2 mb-5 px-3 py-1 rounded-full" style={{ background: "#00000040", border: `1px solid ${G.gold}44` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "#4ade80", animation: "mcLive 1.6s ease-in-out infinite" }} />
              <span className="text-[10px] font-black tracking-[0.25em]" style={{ color: G.gold }}>LEAGUE LIVE · MEMBERS ONLY</span>
            </div>
            <div className="mc-word" style={{ fontSize: "clamp(46px,10vw,104px)", lineHeight: .9 }}>McCafferty&apos;s</div>
            <div className="text-xs sm:text-sm tracking-[0.45em] uppercase mt-3 mb-8" style={{ color: G.gold }}>A Traditional Irish Bar</div>
            <p className="text-[11px] font-black tracking-[0.3em] uppercase mb-2" style={{ color: G.cream }}>Official Members&apos; Prediction League</p>
            <h1 className="text-3xl sm:text-5xl font-black mb-6" style={{ color: G.cream, fontFamily: "'Playfair Display',serif" }}>The McCafferty&apos;s Cup</h1>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-base font-black px-7 py-3.5 rounded-full" style={{ background: `linear-gradient(90deg,${G.gold},${G.gold2})`, color: G.ink, animation: "mcCta 2.2s ease-in-out infinite" }}>Join the craic →</span>
              <span className="text-xs px-3 py-2 rounded-full" style={{ background: "#00000040", color: G.cream, border: `1px solid ${G.line}` }}>178 regulars playing</span>
            </div>
          </div>
        </div>

        {/* Prize */}
        <div className="rounded-2xl px-6 py-5 mt-6 flex items-center gap-4" style={{ background: `linear-gradient(90deg, ${G.gold}1f, transparent)`, border: `1px solid ${G.gold}55` }}>
          <span className="text-3xl">🍺</span>
          <div>
            <div className="text-[10px] font-black tracking-widest uppercase" style={{ color: G.gold }}>This week at McCafferty&apos;s</div>
            <div className="text-lg font-black" style={{ color: G.cream }}>Top of the table — the winner&apos;s round is on the house</div>
            <div className="text-xs" style={{ color: G.muted }}>Monthly champion takes a AED 500 bar tab · any prize you like</div>
          </div>
        </div>

        {/* Leaderboard */}
        <SecTitle>The Table</SecTitle>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${G.line}` }}>
          {LEADERS.map((p, i) => (
            <div key={p.r} className="flex items-center gap-3 px-4 py-3" style={{ background: i === 0 ? `${G.gold}12` : i % 2 ? G.panel : G.panel2, borderBottom: i < LEADERS.length - 1 ? `1px solid ${G.line}` : "none" }}>
              <span className="w-6 text-center font-black" style={{ color: i === 0 ? G.gold : G.muted }}>{p.r === 1 ? "👑" : p.r}</span>
              <span className="w-9 h-9 rounded-full grid place-items-center text-xs font-black shrink-0" style={{ background: i === 0 ? G.gold : "#ffffff12", color: i === 0 ? G.ink : G.cream }}>{p.i}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: G.cream }}>{p.n}{p.note && <span className="ml-2 text-[10px]" style={{ color: G.gold }}>{p.note}</span>}</div>
                <div className="text-[11px]" style={{ color: G.muted }}>{p.s}-week streak</div>
              </div>
              <span className="text-base font-black w-12 text-right" style={{ color: G.gold }}>{p.pts}</span>
            </div>
          ))}
        </div>

        {/* Fixtures */}
        <SecTitle>Predict this weekend</SecTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          {FIXTURES.map((f, i) => (
            <div key={i} className="rounded-xl p-4 text-center" style={{ background: G.panel, border: `1px solid ${G.line}` }}>
              <div className="text-[10px] font-bold" style={{ color: G.muted }}>{f.d} · {f.t}</div>
              <div className="text-sm font-black mt-2" style={{ color: G.cream }}>{f.h}</div>
              <div className="text-[10px] my-1" style={{ color: G.gold }}>vs</div>
              <div className="text-sm font-black" style={{ color: G.cream }}>{f.a}</div>
            </div>
          ))}
        </div>

        {/* Sponsors */}
        <p className="text-[10px] font-bold tracking-widest uppercase text-center mt-10 mb-3" style={{ color: G.muted }}>Backed by the bar</p>
        <div className="flex flex-wrap justify-center gap-3">
          {SPONSORS.map((s) => <span key={s} className="text-xs font-black tracking-wider px-4 py-2 rounded-lg" style={{ background: G.panel2, color: G.cream, border: `1px solid ${G.line}` }}>{s}</span>)}
        </div>

        {/* Join CTA */}
        <div className="rounded-3xl px-6 py-8 mt-10 flex flex-col sm:flex-row items-center gap-6" style={{ background: `linear-gradient(135deg, ${G.gold} 0%, ${G.gold2} 100%)`, color: G.ink }}>
          <Qr ink={G.ink} />
          <div className="text-center sm:text-left">
            <div className="text-2xl font-black" style={{ fontFamily: "'Playfair Display',serif" }}>Scan at the bar to join</div>
            <div className="text-sm font-semibold opacity-80 mt-1">Free to play. Predict the weekend, climb McCafferty&apos;s table, win at the bar. At any McCafferty&apos;s, Dubai.</div>
          </div>
        </div>

        <p className="text-center text-[11px] mt-8" style={{ color: G.muted }}>A branded league by SuperBrain · your logo, your colours, your prizes, your stats.</p>
      </div>
    </div>
  );
}

function SecTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-10 mb-3">
      <span className="w-1.5 h-5 rounded-full" style={{ background: G.gold }} />
      <h2 className="text-lg font-black" style={{ color: G.cream, fontFamily: "'Playfair Display',serif" }}>{children}</h2>
    </div>
  );
}
function Qr({ ink }: { ink: string }) {
  return (
    <div className="w-24 h-24 rounded-xl grid grid-cols-5 grid-rows-5 gap-0.5 p-2 shrink-0" style={{ background: "#fff" }}>
      {Array.from({ length: 25 }).map((_, i) => (
        <span key={i} style={{ background: [0,1,2,4,5,9,10,12,14,15,19,20,22,23,24,6,8,16,18].includes(i) ? ink : "transparent", borderRadius: 1 }} />
      ))}
    </div>
  );
}
