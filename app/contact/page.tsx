import Link from "next/link";

export const metadata = {
  title: "Contact — SuperBrain",
  description: "Get in touch with the SuperBrain team.",
};

const TOPICS = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    label: "Bugs & issues",
    body: "Something broken or behaving unexpectedly? Tell us the test, your device, and what happened.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    label: "Feedback & ideas",
    body: "Thoughts on the scoring, UX, or something that felt off? We read every message.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
    label: "Partnerships & press",
    body: "Interested in collaborating, licensing, or covering SuperBrain? Reach out.",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    label: "Test suggestions",
    body: "Have an idea for a new cognitive test we should build? We genuinely want to hear it.",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-2xl mx-auto px-5 py-14">

        {/* Header */}
        <div className="mb-10">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono">Get in touch</p>
          <h1 className="text-3xl font-extrabold text-white mb-3">Contact</h1>
          <p className="text-cockpit-dim text-base leading-relaxed max-w-md">
            We&apos;re a small team. We read everything and reply when we can.
          </p>
        </div>

        {/* Email CTA */}
        <div
          className="relative bg-cockpit-card border rounded-sm overflow-hidden mb-8"
          style={{ borderColor: "#00d4ff30" }}
        >
          <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #00d4ff, transparent)" }} />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 70% 60% at 50% 0%, #00d4ff08 0%, transparent 70%)" }}
          />
          <div className="relative px-8 py-8 text-center">
            <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-3 font-mono">Email us</p>
            <a
              href="mailto:hello@superbrain.social"
              className="text-2xl sm:text-3xl font-extrabold text-cockpit-accent hover:underline tracking-tight"
              style={{ textShadow: "0 0 40px rgba(0,212,255,0.3)" }}
            >
              hello@superbrain.social
            </a>
            <p className="text-cockpit-dim text-sm mt-3">
              For feedback, bugs, partnerships, or test suggestions.
            </p>
          </div>
        </div>

        {/* Topic cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {TOPICS.map((t) => (
            <a
              key={t.label}
              href={`mailto:hello@superbrain.social?subject=${encodeURIComponent(t.label)}`}
              className="group bg-cockpit-card border border-cockpit-border rounded-sm p-5 hover:border-cockpit-accent transition-all duration-150 block"
            >
              <div className="text-cockpit-accent mb-3 group-hover:scale-110 transition-transform duration-150 w-fit">
                {t.icon}
              </div>
              <p className="text-white font-semibold text-sm mb-1.5">{t.label}</p>
              <p className="text-cockpit-muted text-xs leading-relaxed">{t.body}</p>
            </a>
          ))}
        </div>

        {/* Response time note */}
        <div className="flex items-start gap-3 px-5 py-4 border border-cockpit-border rounded-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-cockpit-green animate-pulse shrink-0 mt-1.5" />
          <p className="text-cockpit-muted text-sm leading-relaxed">
            We aim to respond within a few days. For urgent issues (e.g. a data request or account problem), please include &quot;urgent&quot; in your subject line.
          </p>
        </div>

        <div className="mt-8 flex gap-4 text-xs text-cockpit-muted">
          <Link href="/privacy"    className="hover:text-cockpit-accent transition-colors">Privacy Policy</Link>
          <Link href="/terms"      className="hover:text-cockpit-accent transition-colors">Terms of Use</Link>
          <Link href="/disclaimer" className="hover:text-cockpit-accent transition-colors">Disclaimer</Link>
        </div>

      </div>
    </div>
  );
}
