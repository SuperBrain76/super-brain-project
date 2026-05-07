import Link from "next/link";

const LAST_UPDATED = "May 2026";

export const metadata = {
  title: "Terms of Use — SuperBrain",
  description: "The rules for using SuperBrain cognitive tests.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 flex flex-col gap-3">
      <h2 className="text-white font-bold text-base">{title}</h2>
      <div className="text-cockpit-dim text-sm leading-relaxed flex flex-col gap-2">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-3xl mx-auto px-5 py-14">

        {/* Header */}
        <div className="mb-10">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono">Legal</p>
          <h1 className="text-3xl font-extrabold text-white mb-2">Terms of Use</h1>
          <p className="text-cockpit-muted text-xs">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="flex flex-col gap-4">

          <Section title="Acceptance">
            <p>
              By using SuperBrain you agree to these terms. If you do not agree, please do not use the service.
            </p>
          </Section>

          <Section title="What SuperBrain is">
            <p>
              SuperBrain provides browser-based cognitive tests designed for entertainment, personal training, and self-benchmarking. Tests measure traits such as reaction speed, working memory, and decision-making under pressure.
            </p>
            <p>
              SuperBrain is <span className="text-cockpit-text font-medium">not</span> a medical, psychological, IQ certification, aviation screening, military, or employment assessment tool. Results are indicative only. See our <Link href="/disclaimer" className="text-cockpit-accent hover:underline">Disclaimer</Link> for full detail.
            </p>
          </Section>

          <Section title="Fair use">
            <p>You agree to use SuperBrain honestly and in good faith. Specifically, you must not:</p>
            <ul className="list-disc list-inside flex flex-col gap-1">
              <li>Use bots, scripts, automation tools, or browser extensions that interfere with test delivery or artificially improve your scores.</li>
              <li>Submit scores through any means other than completing the test naturally in your browser.</li>
              <li>Manipulate, intercept, or replay API requests to submit false results.</li>
              <li>Share accounts or allow others to take a test on your behalf to boost your leaderboard standing.</li>
              <li>Exploit bugs or unintended behaviour to gain an advantage.</li>
            </ul>
          </Section>

          <Section title="Leaderboard integrity">
            <p>
              We reserve the right to investigate and remove any score that appears statistically implausible, is flagged by our automated checks, or is reported by other users as suspicious.
            </p>
            <p>
              Accounts found to be systematically abusing the leaderboard may be suspended without notice.
            </p>
          </Section>

          <Section title="Your account">
            <p>
              You are responsible for maintaining the security of your account credentials. You must not share your account with others.
            </p>
            <p>
              We may suspend or terminate accounts that violate these terms, post harmful content, or disrupt the experience of other users.
            </p>
          </Section>

          <Section title="Intellectual property">
            <p>
              All test content, scoring methodology, design, copy, and software on SuperBrain is our property or used under licence. You may not reproduce, distribute, or create derivative works without written permission.
            </p>
          </Section>

          <Section title="No warranties">
            <p>
              SuperBrain is provided &quot;as is&quot; without any warranty of uninterrupted availability, accuracy of scores, or fitness for any particular purpose. We make no guarantees that results will be consistent across devices, sessions, or browsers.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the maximum extent permitted by law, SuperBrain and its operators are not liable for any direct, indirect, incidental, or consequential damages arising from your use of, or inability to use, the service — including any decisions made based on test results.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms from time to time. Continued use of SuperBrain after an update means you accept the revised terms. Significant changes will be communicated via a notice on the site.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These terms are governed by the laws of the jurisdiction in which SuperBrain operates. Any disputes will be resolved in the courts of that jurisdiction.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email us at{" "}
              <a href="mailto:hello@superbrain.social" className="text-cockpit-accent hover:underline">
                hello@superbrain.social
              </a>.
            </p>
          </Section>

        </div>

        <div className="mt-8 flex gap-4 text-xs text-cockpit-muted">
          <Link href="/privacy"    className="hover:text-cockpit-accent transition-colors">Privacy Policy</Link>
          <Link href="/disclaimer" className="hover:text-cockpit-accent transition-colors">Disclaimer</Link>
          <Link href="/contact"    className="hover:text-cockpit-accent transition-colors">Contact</Link>
        </div>

      </div>
    </div>
  );
}
