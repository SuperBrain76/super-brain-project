"use client";

import { useEffect, useState } from "react";
import { BRAND, MATERIAL } from "@/lib/brand";
import { describeEvent, type CelebrationEvent } from "@/lib/celebrate";

// A full-screen "moment" for level-ups, new status tiers and achievements.
// One card per event (queued). Every moment offers a Share that carries the
// user's invite link — turning peak pride into natural referral growth.
export function CelebrationModal({
  events, referralCode, onClose,
}: {
  events: CelebrationEvent[];
  referralCode?: string | null;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const r = requestAnimationFrame(() => setShow(true));
    document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(r); document.body.style.overflow = ""; };
  }, []);

  if (events.length === 0) return null;
  const ev = events[Math.min(i, events.length - 1)];
  const d = describeEvent(ev);
  const multiple = events.length > 1;

  const share = async () => {
    const url = referralCode ? `${window.location.origin}/?ref=${encodeURIComponent(referralCode)}` : window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: "SuperBrain", text: d.shareText, url });
      else { await navigator.clipboard.writeText(`${d.shareText} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    } catch { /* cancelled */ }
  };

  const next = () => {
    setCopied(false);
    if (i < events.length - 1) setI(i + 1);
    else { setShow(false); setTimeout(onClose, 200); }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-6">
      {/* Backdrop */}
      <div className="absolute inset-0 transition-opacity duration-300"
        style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", opacity: show ? 1 : 0 }} />

      {/* Confetti burst */}
      <Confetti show={show} />

      {/* Card */}
      <div
        className="relative w-full max-w-sm rounded-3xl px-6 pt-9 pb-6 text-center"
        style={{
          background: MATERIAL.raise, border: `0.5px solid ${BRAND.hairlineStrong}`,
          boxShadow: `${MATERIAL.shadowSoft}, ${MATERIAL.shadowGold}`,
          transform: show ? "scale(1) translateY(0)" : "scale(0.9) translateY(12px)",
          opacity: show ? 1 : 0,
          transition: "transform .32s cubic-bezier(.22,1.2,.36,1), opacity .3s ease",
        }}
      >
        {/* Emblem with glowing halo */}
        <div className="relative mx-auto mb-5" style={{ width: 108, height: 108 }}>
          <div className="absolute inset-0 animate-pulse" style={{ background: MATERIAL.goldGlow, borderRadius: "50%" }} />
          <div className="absolute inset-0 rounded-full" style={{ inset: 6, border: `1px solid ${MATERIAL.ring}` }} />
          <div className="relative w-full h-full flex items-center justify-center rounded-full"
            style={{ background: "radial-gradient(circle at 50% 35%, rgba(232,193,90,0.16), transparent 70%)" }}>
            <span style={{ fontSize: 52, filter: "drop-shadow(0 4px 12px rgba(232,193,90,0.45))" }}>{d.emblem}</span>
          </div>
        </div>

        <p className="text-[11px] font-bold tracking-[0.28em] mb-2" style={{ color: BRAND.gold }}>{d.badge}</p>
        <h2 className="text-3xl font-black mb-1.5" style={{ color: BRAND.ink }}>{d.title}</h2>
        <p className="text-sm mb-7" style={{ color: BRAND.muted }}>{d.sub}</p>

        <div className="flex flex-col gap-2.5">
          <button onClick={share}
            className="w-full py-3.5 rounded-full font-black text-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: BRAND.gold, color: BRAND.goldInk, boxShadow: MATERIAL.shadowGold }}>
            {copied ? "Copied ✓" : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
                </svg>
                Share this win
              </>
            )}
          </button>
          <button onClick={next}
            className="w-full py-3 rounded-full font-semibold text-sm transition-transform active:scale-[0.98]"
            style={{ color: BRAND.muted, border: `0.5px solid ${BRAND.hairline}` }}>
            {multiple && i < events.length - 1 ? `Next (${i + 1}/${events.length})` : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  const colors = [BRAND.gold, BRAND.goldSoft, BRAND.sports, "#FFFFFF", BRAND.tests];
  const bits = Array.from({ length: 22 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 7) * 0.12}s`,
    dur: `${1.9 + (i % 5) * 0.35}s`,
    color: colors[i % colors.length],
    size: 5 + (i % 3) * 2,
    rot: (i * 47) % 360,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <style>{`@keyframes sb-fall{0%{transform:translateY(-12vh) rotate(0deg);opacity:0}8%{opacity:1}100%{transform:translateY(112vh) rotate(540deg);opacity:.9}}`}</style>
      {bits.map((b, i) => (
        <span key={i} style={{
          position: "absolute", top: 0, left: b.left, width: b.size, height: b.size * 1.6,
          background: b.color, borderRadius: 1, transform: `rotate(${b.rot}deg)`,
          animation: `sb-fall ${b.dur} cubic-bezier(.3,.1,.5,1) ${b.delay} forwards`,
        }} />
      ))}
    </div>
  );
}
