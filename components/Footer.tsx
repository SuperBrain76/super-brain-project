export default function Footer() {
  return (
    <footer className="border-t border-cockpit-border mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-sm bg-cockpit-accent flex items-center justify-center">
                <span className="text-cockpit-bg font-black text-xs">SB</span>
              </div>
              <span className="font-bold tracking-widest text-xs text-cockpit-dim">SUPERBRAIN</span>
            </div>
            <p className="text-cockpit-muted text-xs max-w-sm leading-relaxed">
              SuperBrain tests are designed for entertainment, training, and self-benchmarking.
              They are not official medical, psychological, aviation, military, or employment assessments.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-cockpit-muted">
            {[
              { label: "Privacy Policy",  href: "#" },
              { label: "Terms of Use",    href: "#" },
              { label: "Contact",         href: "mailto:hello@superbrain.app" },
              { label: "Disclaimer",      href: "#" },
            ].map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="hover:text-cockpit-dim transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-cockpit-border flex items-center justify-between">
          <p className="text-cockpit-muted text-xs">© 2026 SuperBrain. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cockpit-green animate-pulse" />
            <span className="text-cockpit-muted text-xs">All tests run locally in your browser</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
