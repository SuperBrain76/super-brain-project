import Link from "next/link";
import { GrandPrizeFooterMention } from "@/components/GrandPrize";
import { BRAND } from "@/lib/brand";

export default function Footer() {
  return (
    <footer className="mt-auto" style={{ background: BRAND.black, borderTop: `0.5px solid ${BRAND.hairline}` }}>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Brand — monochrome; gold is reserved for value */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: BRAND.elevated, border: `0.5px solid ${BRAND.hairlineStrong}` }}>
                <span className="font-black text-[10px] tracking-tighter" style={{ color: BRAND.ink }}>SB</span>
              </div>
              <span className="font-semibold tracking-[0.18em] text-xs" style={{ color: BRAND.muted }}>SUPERBRAIN</span>
            </div>
            <p className="text-xs max-w-sm leading-relaxed" style={{ color: BRAND.dim }}>
              SuperBrain tests are designed for entertainment, training, and self-benchmarking.
              They are not official medical, psychological, aviation, military, or employment assessments.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs" style={{ color: BRAND.muted }}>
            <Link href="/privacy"    className="transition-colors hover:opacity-70">Privacy Policy</Link>
            <Link href="/terms"      className="transition-colors hover:opacity-70">Terms of Use</Link>
            <Link href="/contact"    className="transition-colors hover:opacity-70">Contact</Link>
            <Link href="/disclaimer" className="transition-colors hover:opacity-70">Disclaimer</Link>
          </div>
        </div>

        <div className="mt-8 pt-8" style={{ borderTop: `0.5px solid ${BRAND.hairline}` }}>
          <GrandPrizeFooterMention />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs" style={{ color: BRAND.dim }}>© 2026 SuperBrain. All rights reserved.</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BRAND.sports }} />
            <span className="text-xs" style={{ color: BRAND.dim }}>All tests run locally in your browser</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
