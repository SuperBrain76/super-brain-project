import Link from "next/link";
import HomepageAnalytics from "@/components/HomepageAnalytics";

const TESTS = [
  {
    testId: "reaction",
    title: "Reaction Speed",
    tagline: "How fast are you, really?",
    duration: "~2 min",
    color: "#00e676",
    href: "/tests/reaction",
  },
  {
    testId: "pressure",
    title: "Pressure Decision",
    tagline: "Think clearly when it counts.",
    duration: "~3 min",
    color: "#ffab00",
    href: "/tests/pressure",
  },
  {
    testId: "memory",
    title: "Memory & Focus",
    tagline: "Train your working memory.",
    duration: "~5 min",
    color: "#00d4ff",
    href: "/tests/memory",
  },
  {
    testId: "fighter-pilot",
    title: "Fighter Pilot",
    tagline: "The full cognitive gauntlet.",
    duration: "~25 min",
    color: "#ff6d00",
    href: "/test",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <HomepageAnalytics />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden hud-grid">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -5%, rgba(0,212,255,0.10) 0%, transparent 65%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">

          {/* Live badge */}
          <div className="inline-flex items-center gap-2 border border-cockpit-green border-opacity-30 px-3.5 py-1.5 rounded-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-cockpit-green animate-pulse" />
            <span className="text-cockpit-green text-xs tracking-widest uppercase font-mono">
              Free · No signup required
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.04] mb-5">
            How sharp is<br />
            <span
              className="text-cockpit-accent"
              style={{ textShadow: "0 0 80px rgba(0,212,255,0.35)" }}
            >
              your mind?
            </span>
          </h1>

          {/* Sub */}
          <p className="text-cockpit-dim text-lg sm:text-xl max-w-xl mx-auto leading-relaxed mb-3">
            Precision cognitive tests. Instant results. Identity scores that tell you exactly where you stand.
          </p>
          <p className="text-cockpit-muted text-sm mb-10">
            Most people score below 70. Where do you land?
          </p>

          {/* Primary CTA */}
          <Link href="/tests">
            <button className="btn-primary text-base sm:text-lg px-10 py-4 w-full sm:w-auto">
              Start a Test — It&apos;s Free →
            </button>
          </Link>

          {/* Social proof strip */}
          <div className="mt-14 flex flex-wrap justify-center gap-8 sm:gap-14">
            {[
              { v: "4",   l: "Tests" },
              { v: "2m",  l: "Shortest" },
              { v: "100", l: "Max Score" },
              { v: "0",   l: "Logins Needed" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold number-display text-cockpit-accent">{s.v}</div>
                <div className="text-cockpit-muted text-xs tracking-widest uppercase mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tests ─────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <div className="mb-8">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-1">Choose your test</p>
          <h2 className="text-2xl font-bold text-white">Pick one. Start immediately.</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TESTS.map((t) => (
            <Link key={t.testId} href={t.href} className="group block">
              <div
                className="relative bg-cockpit-card border rounded-sm overflow-hidden transition-all duration-200 hover:border-opacity-70 active:scale-[0.99]"
                style={{ borderColor: `${t.color}25` }}
              >
                <div
                  className="h-0.5 w-full transition-all group-hover:opacity-100"
                  style={{ background: `linear-gradient(90deg, ${t.color}, transparent)` }}
                />
                <div className="px-5 py-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-bold text-base">{t.title}</p>
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded-sm border"
                        style={{ color: t.color, borderColor: `${t.color}30`, background: `${t.color}10` }}
                      >
                        {t.duration}
                      </span>
                    </div>
                    <p className="text-cockpit-dim text-sm truncate">{t.tagline}</p>
                  </div>
                  <div
                    className="shrink-0 w-9 h-9 rounded-sm border flex items-center justify-center transition-all group-hover:bg-opacity-20"
                    style={{ borderColor: `${t.color}40`, color: t.color, background: `${t.color}10` }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Identity result preview ────────────────────────────────────────── */}
      <section className="border-y border-cockpit-border bg-cockpit-surface">
        <div className="max-w-5xl mx-auto px-5 py-16 flex flex-col md:flex-row items-center gap-12">

          {/* Text */}
          <div className="flex-1">
            <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-3">Results that hit different</p>
            <h2 className="text-3xl font-extrabold text-white mb-4 leading-tight">
              Not a number.<br />An identity.
            </h2>
            <p className="text-cockpit-dim text-base leading-relaxed mb-4">
              You don&apos;t get a score — you get a verdict. <span className="text-white font-semibold">Tactical Thinker. Elite Reactor. Eidetic.</span>{" "}
              Each title is earned, not given.
            </p>
            <p className="text-cockpit-dim text-sm leading-relaxed mb-6">
              Share your result. Challenge your friends. See where you actually stand.
            </p>
            <Link href="/login">
              <button className="btn-primary">Create Free Account →</button>
            </Link>
          </div>

          {/* Mock identity card */}
          <div className="w-full md:w-80 shrink-0">
            <div
              className="relative bg-cockpit-card border rounded-sm overflow-hidden"
              style={{ borderColor: "#00e67640" }}
            >
              <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #00e676, transparent)" }} />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, #00e6760d 0%, transparent 70%)" }}
              />
              <div className="relative px-6 pt-8 pb-6 text-center">
                <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-5 font-mono">Reaction Speed Test</p>
                <div
                  className="text-4xl font-extrabold tracking-tight mb-3"
                  style={{ color: "#00e676", textShadow: "0 0 40px #00e67640" }}
                >
                  Elite Reactor
                </div>
                <span
                  className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-sm border mb-6"
                  style={{ borderColor: "#00e67640", color: "#00e676", background: "#00e67612" }}
                >
                  Top 12% of test-takers
                </span>
                <div className="flex items-end justify-center gap-2">
                  <span className="text-6xl font-extrabold number-display" style={{ color: "#00e676" }}>84</span>
                  <span className="text-cockpit-muted text-xl font-bold mb-1">/100</span>
                </div>
              </div>
              <div className="border-t border-cockpit-border px-5 py-3 text-center">
                <p className="text-cockpit-muted text-xs font-mono">superbrain.io/share/abc123</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats / proof ──────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              ),
              title: "Zero friction",
              body: "No account, no install, no tutorial. Pick a test and start. Results in under 3 minutes.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              ),
              title: "Scientifically designed",
              body: "Each test targets a specific cognitive trait: reflex speed, working memory, decision accuracy under pressure.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              ),
              title: "Built to share",
              body: "Your result card is public. Send it to a friend. Let them try to beat your score.",
            },
          ].map((s) => (
            <div
              key={s.title}
              className="bg-cockpit-card border border-cockpit-border rounded-sm p-6"
            >
              <div className="text-cockpit-accent mb-3">{s.icon}</div>
              <h3 className="text-white font-semibold mb-2">{s.title}</h3>
              <p className="text-cockpit-dim text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="border-t border-cockpit-border bg-cockpit-surface">
        <div className="max-w-5xl mx-auto px-5 py-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Ready to find out?
          </h2>
          <p className="text-cockpit-dim text-lg mb-8">
            Takes 2 minutes. No signup. Instant result.
          </p>
          <Link href="/tests">
            <button className="btn-primary text-base sm:text-lg px-10 py-4 w-full sm:w-auto">
              Start Testing Now →
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
