import Link from "next/link";

export const metadata = {
  title: "Disclaimer — SuperBrain",
  description: "Important information about the nature and limitations of SuperBrain test results.",
};

function Block({ color, label, body }: { color: string; label: string; body: string }) {
  return (
    <div
      className="bg-cockpit-card border rounded-sm p-5 flex gap-4 items-start"
      style={{ borderColor: `${color}30` }}
    >
      <div
        className="shrink-0 w-1 self-stretch rounded-full"
        style={{ background: color }}
      />
      <div>
        <p className="text-white font-semibold text-sm mb-1">{label}</p>
        <p className="text-cockpit-dim text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-3xl mx-auto px-5 py-14">

        {/* Header */}
        <div className="mb-10">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono">Legal</p>
          <h1 className="text-3xl font-extrabold text-white mb-3">Disclaimer</h1>
          <p className="text-cockpit-dim text-base max-w-xl leading-relaxed">
            Please read this before sharing your results or using them to inform any real-world decision.
          </p>
        </div>

        {/* Primary notice */}
        <div
          className="bg-cockpit-card border rounded-sm p-6 mb-6"
          style={{ borderColor: "#ffab0040" }}
        >
          <div className="flex items-start gap-3 mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffab00" strokeWidth="2" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-cockpit-amber font-semibold text-sm">Important notice</p>
          </div>
          <p className="text-cockpit-dim text-sm leading-relaxed">
            SuperBrain tests are designed for <span className="text-white font-medium">entertainment, personal training, and self-benchmarking</span> only. They are not validated scientific instruments. Scores are indicative, not definitive, and should not be used as the primary basis for any consequential decision.
          </p>
        </div>

        {/* Specific disclaimers */}
        <div className="flex flex-col gap-3 mb-8">
          <Block
            color="#ff4040"
            label="Not a medical or psychological assessment"
            body="SuperBrain tests do not diagnose, screen for, or measure any medical or mental health condition. Results should not be interpreted as evidence of cognitive impairment, cognitive superiority, ADHD, neurological disorders, or any other clinical condition. If you have concerns about your cognitive health, consult a qualified medical professional."
          />
          <Block
            color="#ff4040"
            label="Not an IQ test or certified intelligence measure"
            body="SuperBrain scores are not IQ scores and do not constitute any form of certified or standardised intelligence measurement. The scoring methodology is proprietary and has not been independently validated against established psychometric instruments."
          />
          <Block
            color="#ff6d00"
            label="Not an aviation or military screening tool"
            body="SuperBrain is not affiliated with, endorsed by, or a substitute for any official aviation authority, military branch, or defence agency cognitive screening programme. A high score on SuperBrain does not imply suitability for pilot training, military service, or any safety-critical role."
          />
          <Block
            color="#ff6d00"
            label="Not an employment assessment"
            body="SuperBrain scores should not be used by employers or recruiters as a basis for hiring, promotion, or any employment-related decision. We do not endorse or support the use of SuperBrain in any employment context."
          />
          <Block
            color="#ffab00"
            label="Score variability"
            body="Your score can vary significantly based on your device, internet connection, screen size, browser, time of day, fatigue, distraction, and many other factors. A single test session is not a reliable measure of stable cognitive ability. Treat results as a point-in-time snapshot, not a fixed ceiling or floor."
          />
          <Block
            color="#00d4ff"
            label="No guarantee of accuracy"
            body="We make no warranty that test scores accurately or reliably measure the cognitive traits they describe. The labels, titles, and percentile estimates are intended to be engaging and directionally useful — not clinically precise."
          />
        </div>

        {/* Footer note */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 text-cockpit-dim text-sm leading-relaxed">
          By using SuperBrain you acknowledge that you have read and understood this disclaimer. If you have questions, contact us at{" "}
          <a href="mailto:hello@superbrain.social" className="text-cockpit-accent hover:underline">
            hello@superbrain.social
          </a>.
        </div>

        <div className="mt-8 flex gap-4 text-xs text-cockpit-muted">
          <Link href="/privacy" className="hover:text-cockpit-accent transition-colors">Privacy Policy</Link>
          <Link href="/terms"   className="hover:text-cockpit-accent transition-colors">Terms of Use</Link>
          <Link href="/contact" className="hover:text-cockpit-accent transition-colors">Contact</Link>
        </div>

      </div>
    </div>
  );
}
