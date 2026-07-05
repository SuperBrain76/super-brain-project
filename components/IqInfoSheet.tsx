"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BRAND, MATERIAL } from "@/lib/brand";

// ============================================================================
// IQ info — a small ⓘ trigger beside any IQ score, opening a premium bottom
// sheet that explains what IQ is (and is not). "Learn more" → /economy.
// Gold is used here because IQ *is* value; everything else stays restrained.
// ============================================================================

const EARN = [
  { icon: "🧠", label: "Play brain tests" },
  { icon: "⚽", label: "Predict matches" },
  { icon: "⚔️", label: "Win battles" },
  { icon: "🔥", label: "Daily streaks & missions" },
  { icon: "🤝", label: "Invite friends" },
  { icon: "🎖️", label: "Unlock achievements" },
];

const COMING = [
  { icon: "🎁", label: "Partner Rewards" },
  { icon: "💎", label: "Premium Features" },
  { icon: "🎟️", label: "Prize Entries" },
  { icon: "🔑", label: "Exclusive Events" },
  { icon: "🛍️", label: "Marketplace" },
];

export function IqInfoButton({ size = 16, className = "" }: { size?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="What is IQ?"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center justify-center rounded-full shrink-0 transition-colors hover:opacity-80 active:scale-90 ${className}`}
        style={{
          width: size, height: size,
          border: `0.5px solid ${BRAND.hairlineStrong}`,
          color: BRAND.muted,
          fontSize: Math.round(size * 0.62),
          fontStyle: "italic",
          fontFamily: "Georgia, 'Times New Roman', serif",
          lineHeight: 1,
        }}
      >
        i
      </button>
      <IqInfoSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function IqInfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [render, setRender] = useState(open);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      const r = requestAnimationFrame(() => setShow(true));
      document.body.style.overflow = "hidden";
      return () => cancelAnimationFrame(r);
    }
    setShow(false);
    document.body.style.overflow = "";
    const t = setTimeout(() => setRender(false), 280);
    return () => clearTimeout(t);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="About IQ">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", opacity: show ? 1 : 0 }}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md px-5 pb-8 pt-3 text-left"
        style={{
          background: MATERIAL.raise,
          borderTop: `0.5px solid ${BRAND.hairlineStrong}`,
          borderRadius: "26px 26px 0 0",
          boxShadow: MATERIAL.shadowSoft,
          transform: show ? "translateY(0)" : "translateY(100%)",
          transition: "transform .3s cubic-bezier(.22,1,.36,1)",
          maxHeight: "88vh",
          overflowY: "auto",
          textAlign: "left",
        }}
      >
        {/* Grab handle */}
        <div className="mx-auto mb-5 rounded-full" style={{ width: 40, height: 4, background: BRAND.hairlineStrong }} />

        {/* Soft gold light — value */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none" style={{ width: 260, height: 130, background: MATERIAL.goldGlow }} />

        <div className="relative">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full tracking-[0.14em]"
              style={{ background: "rgba(232,193,90,0.12)", color: BRAND.gold, border: `0.5px solid ${MATERIAL.ringFaint}` }}
            >
              IQ
            </span>
          </div>
          <h2 className="text-2xl font-black mb-2" style={{ color: BRAND.ink }}>What is IQ?</h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: BRAND.muted }}>
            IQ is SuperBrain&apos;s reward currency. You earn it every time you play, predict, test and
            contribute — it&apos;s how you build your SuperBrain.
          </p>

          {/* How you earn it */}
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: BRAND.dim }}>How you earn it</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-6">
            {EARN.map((e) => (
              <div key={e.label} className="flex items-center gap-2.5">
                <span className="text-base shrink-0">{e.icon}</span>
                <span className="text-sm" style={{ color: BRAND.ink }}>{e.label}</span>
              </div>
            ))}
          </div>

          {/* What it does */}
          <div className="space-y-3 mb-6">
            <Line title="What it does now" body="Builds your level and status, ranks you on the leaderboards, and tracks everything you contribute." />
            <Line title="What it may unlock later" body="Future rewards, perks and recognition as the SuperBrain community grows." />
          </div>

          {/* Coming soon */}
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.dim }}>Coming soon</p>
            <div className="flex-1 h-px" style={{ background: BRAND.hairline }} />
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {COMING.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs"
                style={{ background: "rgba(255,255,255,0.03)", border: `0.5px solid ${BRAND.hairline}`, color: BRAND.muted }}>
                <span className="text-sm leading-none">{c.icon}</span>{c.label}
              </span>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="rounded-2xl p-4 mb-6" style={{ background: "rgba(255,255,255,0.03)", border: `0.5px solid ${BRAND.hairline}` }}>
            <p className="text-xs leading-relaxed" style={{ color: BRAND.muted }}>
              IQ is a points system inside SuperBrain. It is <span style={{ color: BRAND.ink, fontWeight: 600 }}>not cash, shares,
              crypto, or a guaranteed financial reward</span>, and has no monetary value.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/economy"
              onClick={onClose}
              className="flex-1 text-center py-3 rounded-full text-sm font-bold transition-transform active:scale-[0.98]"
              style={{ background: BRAND.gold, color: BRAND.goldInk, boxShadow: MATERIAL.shadowGold }}
            >
              Learn more
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-full text-sm font-semibold transition-transform active:scale-[0.98]"
              style={{ color: BRAND.muted, border: `0.5px solid ${BRAND.hairline}` }}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: BRAND.gold }} />
      <div>
        <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>{title}</p>
        <p className="text-xs leading-relaxed mt-0.5" style={{ color: BRAND.muted }}>{body}</p>
      </div>
    </div>
  );
}
