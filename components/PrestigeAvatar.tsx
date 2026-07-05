"use client";

import { currentTier } from "@/lib/prestige";
import { MATERIAL } from "@/lib/brand";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "SB";
}

// Avatar framed by the highest IQ prestige tier unlocked. Bronze/Silver/Gold
// rings, a gold glow + pulsing shimmer at higher tiers, and a pinned emblem
// for Animated / Elite / Founder. Purely cosmetic status — no monetary value.
export function PrestigeAvatar({
  name, url, color, iq, size = 80, radius = 20,
}: {
  name: string;
  url: string | null;
  color: string;
  iq: number;
  size?: number;
  radius?: number;
}) {
  const tier = currentTier(iq);
  const pad = 3;
  const outer = size + pad * 2;

  return (
    <div className="relative inline-block shrink-0" style={{ width: outer, height: outer }}>
      {/* Glow behind the frame (gold+ tiers), pulsing for animated tiers */}
      {tier?.glow && (
        <div
          className={`absolute -inset-2 pointer-events-none ${tier.animated ? "animate-pulse" : ""}`}
          style={{ background: MATERIAL.goldGlow, borderRadius: "50%" }}
        />
      )}

      {/* Frame ring — tier gradient, or a neutral dark frame below the first tier */}
      <div
        className="relative"
        style={{
          width: outer, height: outer, borderRadius: radius, padding: pad,
          background: tier?.ring ?? "#0B0B0D",
          boxShadow: tier?.glow ? MATERIAL.shadowGold : undefined,
        }}
      >
        <div
          className="w-full h-full overflow-hidden flex items-center justify-center text-2xl font-black"
          style={{ borderRadius: radius - pad, background: url ? "transparent" : color, color: "#fff" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : initials(name)}
        </div>
      </div>

      {/* Pinned emblem for the top tiers */}
      {tier?.emblem && (
        <span
          className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center rounded-full text-[13px]"
          style={{ width: 24, height: 24, background: "#0B0B0D", border: "0.5px solid rgba(232,193,90,0.55)", boxShadow: MATERIAL.shadowGold }}
        >
          {tier.emblem}
        </span>
      )}
    </div>
  );
}
