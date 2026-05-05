import Link from "next/link";

const MOCK_TESTS = [
  { testId: "fighter-pilot", name: "Fighter Pilot Cognitive Test", href: "/test" },
  { testId: "reaction",      name: "Reaction Speed Test",          href: "/tests/reaction" },
  { testId: "pressure",      name: "Pressure Decision Test",       href: "/tests/pressure" },
  { testId: "memory",        name: "Memory & Focus Test",          href: "/tests/memory" },
];

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 border border-cockpit-amber border-opacity-30 px-4 py-1.5 rounded-sm mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-cockpit-amber" />
            <span className="text-cockpit-amber text-xs tracking-widest uppercase font-mono">Coming Soon</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-4">Global Rankings</h1>
          <p className="text-cockpit-dim text-lg max-w-xl mx-auto leading-relaxed">
            A live leaderboard showing top performers across all tests. Rankings go live as more users
            complete assessments and save their results.
          </p>
        </div>

        {/* Preview shells — one per test */}
        <div className="space-y-4 mb-12">
          {MOCK_TESTS.map((t) => (
            <div key={t.testId} className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-cockpit-border">
                <h3 className="text-white font-semibold text-sm">{t.name}</h3>
                <span className="text-cockpit-muted text-xs font-mono">Awaiting entries</span>
              </div>
              {/* Placeholder rows */}
              {[1, 2, 3].map((rank) => (
                <div key={rank} className="flex items-center gap-4 px-6 py-3 border-b border-cockpit-border last:border-0 opacity-30">
                  <div className="w-6 h-6 rounded-sm bg-cockpit-border flex items-center justify-center">
                    <span className="text-cockpit-muted text-xs font-mono">{rank}</span>
                  </div>
                  <div className="flex-1 h-3 bg-cockpit-border rounded-sm" />
                  <div className="w-10 h-3 bg-cockpit-border rounded-sm" />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-8 text-center">
          <h2 className="text-white font-bold text-lg mb-2">Be the first on the board</h2>
          <p className="text-cockpit-dim text-sm mb-6 max-w-md mx-auto">
            Complete any test and save your result to claim a spot when rankings launch.
            Create a free account now so you&apos;re ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/tests">
              <button className="btn-primary">Take a Test</button>
            </Link>
            <Link href="/login">
              <button className="btn-ghost">Create Account</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
