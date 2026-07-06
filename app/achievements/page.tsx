"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyAchievements, type Achievement } from "@/lib/economy";
import { BRAND, MATERIAL } from "@/lib/brand";

const CARD = "#111116";
const BORDER = "rgba(255,255,255,0.08)";

function fmt(n: number) { return n.toLocaleString(); }

export default function AchievementsPage() {
  const [items, setItems] = useState<Achievement[] | null | undefined>(undefined);

  useEffect(() => { getMyAchievements().then(setItems); }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: MATERIAL.vignette }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 backdrop-blur-md"
        style={{ background: "rgba(8,9,11,0.72)", borderBottom: `0.5px solid ${BORDER}` }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Link href="/iq" className="text-sm font-semibold" style={{ color: BRAND.muted }}>← Dashboard</Link>
          <span className="text-base font-semibold tracking-wide ml-auto" style={{ color: BRAND.ink }}>Achievements</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-5">
        <div className="max-w-md mx-auto space-y-5">
          <Body items={items} />
        </div>
      </div>
    </div>
  );
}

function Body({ items }: { items: Achievement[] | null | undefined }) {
  if (items === undefined) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-24 rounded-3xl" style={{ background: "#17181D" }} />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-28 rounded-2xl" style={{ background: "#17181D" }} />)}
        </div>
      </div>
    );
  }
  if (items === null || items.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <p className="text-3xl mb-2">🎖️</p>
        <p className="text-sm font-bold" style={{ color: BRAND.ink }}>No achievements yet</p>
        <p className="text-xs mt-1" style={{ color: BRAND.muted }}>Sign in and start playing to unlock your first.</p>
      </div>
    );
  }

  const unlocked = items.filter((a) => a.unlocked).length;
  const total = items.length;
  const toGo = total - unlocked;
  const pct = total > 0 ? (unlocked / total) * 100 : 0;

  // Unlocked first, then the ones still to chase.
  const sorted = [...items].sort((a, b) => Number(b.unlocked) - Number(a.unlocked));

  return (
    <>
      {/* Hero — the count that pulls you forward */}
      <div className="rounded-3xl p-5 relative overflow-hidden" style={{ background: MATERIAL.raise, border: `0.5px solid ${BORDER}` }}>
        <div className="absolute -top-14 -right-14 w-52 h-52 pointer-events-none" style={{ background: MATERIAL.goldGlow }} />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: BRAND.muted }}>Unlocked</p>
            <p className="text-4xl font-black" style={{ color: BRAND.ink }}>
              {unlocked}<span className="text-xl" style={{ color: BRAND.dim }}> / {total}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black" style={{ background: MATERIAL.goldFill, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>{fmt(toGo)}</p>
            <p className="text-[11px]" style={{ color: BRAND.muted }}>to unlock</p>
          </div>
        </div>
        <div className="relative mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: MATERIAL.goldFill }} />
        </div>
      </div>

      {/* Full gallery — unlocked in colour, locked greyed with 🔒 */}
      <div className="grid grid-cols-3 gap-2">
        {sorted.map((a) => (
          <div key={a.code} className="relative rounded-2xl p-3 text-center flex flex-col items-center"
            style={{
              background: a.unlocked ? CARD : "rgba(255,255,255,0.02)",
              border: `1px solid ${a.unlocked ? "rgba(232,193,90,0.18)" : BORDER}`,
            }}
            title={a.description}>
            <div className="text-3xl leading-none mb-1.5"
              style={{ filter: a.unlocked ? "none" : "grayscale(1)", opacity: a.unlocked ? 1 : 0.4 }}>
              {a.unlocked ? a.icon : "🔒"}
            </div>
            <p className="text-[11px] font-bold leading-tight line-clamp-2" style={{ color: a.unlocked ? BRAND.ink : BRAND.muted }}>{a.name}</p>
            <p className="text-[10px] mt-1 font-semibold" style={{ color: a.unlocked ? BRAND.gold : BRAND.dim }}>
              {a.unlocked ? "Unlocked" : `+${fmt(a.rewardAmount)} IQ`}
            </p>
          </div>
        ))}
      </div>

      <p className="text-center text-[11px] pt-1" style={{ color: BRAND.dim }}>
        {toGo > 0 ? `${fmt(toGo)} achievements still to unlock — keep playing.` : "Every achievement unlocked. Legend."}
      </p>
    </>
  );
}
