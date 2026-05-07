import Link from "next/link";

const LAST_UPDATED = "May 2026";

export const metadata = {
  title: "Privacy Policy — SuperBrain",
  description: "How SuperBrain collects, uses, and protects your data.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 flex flex-col gap-3">
      <h2 className="text-white font-bold text-base">{title}</h2>
      <div className="text-cockpit-dim text-sm leading-relaxed flex flex-col gap-2">{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-3xl mx-auto px-5 py-14">

        {/* Header */}
        <div className="mb-10">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono">Legal</p>
          <h1 className="text-3xl font-extrabold text-white mb-2">Privacy Policy</h1>
          <p className="text-cockpit-muted text-xs">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="flex flex-col gap-4">

          <Section title="What we collect">
            <p>
              Depending on how you use SuperBrain, we may collect the following:
            </p>
            <ul className="list-disc list-inside flex flex-col gap-1 text-cockpit-dim">
              <li><span className="text-cockpit-text font-medium">Account data</span> — email address and password (via Supabase Auth) when you create an account.</li>
              <li><span className="text-cockpit-text font-medium">Profile data</span> — your chosen display name and country. Fields such as birth year, gender, and industry are entirely optional.</li>
              <li><span className="text-cockpit-text font-medium">Test results</span> — your scores, percentile estimates, result titles, and the date each test was completed.</li>
              <li><span className="text-cockpit-text font-medium">Feedback</span> — optional survey responses you submit after completing a test.</li>
              <li><span className="text-cockpit-text font-medium">Analytics events</span> — actions such as page views, test starts, and share clicks (see PostHog section below).</li>
              <li><span className="text-cockpit-text font-medium">Technical data</span> — browser type, device type, and general location derived from your IP address.</li>
            </ul>
            <p>
              You can take any test without creating an account. No data is stored unless you choose to save your result.
            </p>
          </Section>

          <Section title="How we use your data">
            <p>We use your data to:</p>
            <ul className="list-disc list-inside flex flex-col gap-1">
              <li>Operate your account and display your results.</li>
              <li>Power the global leaderboard with your best score for each test.</li>
              <li>Generate personalised share links and challenge flows.</li>
              <li>Improve our tests and scoring algorithms using aggregated, anonymised insights.</li>
              <li>Understand how people use SuperBrain so we can build better features.</li>
            </ul>
            <p>
              We do not sell your personal data to third parties. We do not use your data for advertising targeting.
            </p>
          </Section>

          <Section title="Public leaderboard">
            <p>
              If you save a result and appear on the leaderboard, the following information is publicly visible:
            </p>
            <ul className="list-disc list-inside flex flex-col gap-1">
              <li>Display name</li>
              <li>Country (if set)</li>
              <li>Score and percentile rank</li>
              <li>Result title (e.g. "Elite Reactor")</li>
              <li>Test name</li>
            </ul>
            <p>
              Your email address is never shown publicly. Optional profile fields (birth year, gender, industry) are used only for internal analysis and are never displayed on the leaderboard.
            </p>
          </Section>

          <Section title="Analytics — PostHog">
            <p>
              We use <span className="text-cockpit-text font-medium">PostHog</span> to collect anonymised product analytics. PostHog records events such as which tests are taken, how often results are shared, and where users drop off. This data is used exclusively to improve SuperBrain.
            </p>
            <p>
              PostHog does not receive your email address or raw test scores linked to your identity. Data is stored on PostHog&apos;s servers. You can learn more at{" "}
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cockpit-accent hover:underline"
              >
                posthog.com/privacy
              </a>.
            </p>
          </Section>

          <Section title="Infrastructure — Supabase">
            <p>
              We use <span className="text-cockpit-text font-medium">Supabase</span> for authentication and our database. Your account credentials are stored securely using industry-standard practices. Supabase is SOC 2 Type II certified. Learn more at{" "}
              <a
                href="https://supabase.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cockpit-accent hover:underline"
              >
                supabase.com/security
              </a>.
            </p>
          </Section>

          <Section title="Data retention and deletion">
            <p>
              You can request deletion of your account and all associated data at any time by emailing{" "}
              <a href="mailto:hello@superbrain.social" className="text-cockpit-accent hover:underline">
                hello@superbrain.social
              </a>
              . We will process deletion requests within 30 days.
            </p>
            <p>
              Anonymous test results (taken without an account) are not linked to any identity and cannot be attributed or deleted.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              We use minimal cookies required for authentication session management. We do not use third-party advertising cookies.
            </p>
          </Section>

          <Section title="Children">
            <p>
              SuperBrain is not directed at children under 13. We do not knowingly collect personal data from children. If you believe a child has submitted personal data, contact us and we will delete it.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy as the product evolves. Significant changes will be communicated via a notice on the site. Continued use after an update constitutes acceptance.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy? Email us at{" "}
              <a href="mailto:hello@superbrain.social" className="text-cockpit-accent hover:underline">
                hello@superbrain.social
              </a>.
            </p>
          </Section>

        </div>

        <div className="mt-8 flex gap-4 text-xs text-cockpit-muted">
          <Link href="/terms"      className="hover:text-cockpit-accent transition-colors">Terms of Use</Link>
          <Link href="/disclaimer" className="hover:text-cockpit-accent transition-colors">Disclaimer</Link>
          <Link href="/contact"    className="hover:text-cockpit-accent transition-colors">Contact</Link>
        </div>

      </div>
    </div>
  );
}
