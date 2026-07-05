"use client";

import { tiersWithState, currentTier, nextTier } from "@/lib/prestige";
import { BRAND, MATERIAL } from "@/lib/brand";

function fmt(n: number) { return n.toLocaleString(); }

// One-line "so what" for the dashboard hero: what your IQ has unlocked and
// what's next. Makes IQ feel purposeful the moment you look at it.
export function PrestigeStatusLine({ iq }: { iq: number }) {
  const now = currentTier(iq);
  const nxt = nextTier(iq);
  return (
    <p className="text-center text-[12px] leading-relaxed" style={{ color: BRAND.muted }}>
      {now
        ? <span style={{ color: BRAND.gold, fontWeight: 600 }}>{now.icon} {now.name} unlocked</span>
        : <span>Earn <span style={{ color: BRAND.gold, fontWeight: 600 }}>100 IQ</span> to unlock your first frame</span>}
      {nxt && (
        <> · Next: <span style={{ color: BRAND.ink }}>{nxt.name}</span> · {fmt(Math.max(0, nxt.threshold - iq))} to go</>
      )}
    </p>
  );
}

// The full prestige ladder — every tier, with unlocked / "X to go" state.
export function IqUnlocksLadder({ iq }: { iq: number }) {
  const rows = tiersWithState(iq);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#111116", border: `1px solid ${BRAND.hairline}` }}>
      {rows.map(({ tier, unlocked }, i) => {
        const toGo = Math.max(0, tier.threshold - iq);
        return (
          <div
            key={tier.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: i === 0 ? "none" : `1px solid ${BRAND.hairline}` }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{
                background: unlocked ? "rgba(232,193,90,0.12)" : "rgba(255,255,255,0.04)",
                border: `0.5px solid ${unlocked ? MATERIAL.ringFaint : BRAND.hairline}`,
                filter: unlocked ? "none" : "grayscale(1)",
                opacity: unlocked ? 1 : 0.75,
              }}
            >
              {unlocked ? tier.icon : "🔒"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: unlocked ? BRAND.ink : BRAND.muted }}>{tier.name}</p>
              <p className="text-[11px] truncate" style={{ color: BRAND.dim }}>{fmt(tier.threshold)} IQ · {tier.reward}</p>
            </div>
            {unlocked
              ? <span className="text-xs font-black shrink-0" style={{ color: BRAND.gold }}>Unlocked ✓</span>
              : <span className="text-[11px] font-semibold shrink-0" style={{ color: BRAND.muted }}>{fmt(toGo)} to go</span>}
          </div>
        );
      })}
    </div>
  );
}
