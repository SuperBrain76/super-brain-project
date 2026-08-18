"use client";

/**
 * FeaturedLeagueBanner — the big, unmissable banner for a sponsored / venue
 * league. This is what a paying venue gets: their logo, their name, their
 * colours, animated flash (gradient + spotlight sweep + shine + glow) so it
 * dominates the leagues screen. Falls back gracefully with no logo/colour.
 */

import Link from "next/link";
import type { PredictionLeague } from "@/lib/predictor";

// A venue can carry its own brand colour later (sponsor_color); until then a
// rich amber default keeps it spectacular.
const DEFAULT = { c1: "#F5B301", c2: "#FF7A00", ink: "#0B0A08", cream: "#FDF6E7", crimson: "#FF2D55" };

export default function FeaturedLeagueBanner({
  league, onJoin, joining, joined, competitionSlug, color,
}: {
  league: PredictionLeague;
  onJoin: (id: string) => void;
  joining: boolean;
  joined: boolean;
  competitionSlug: string;
  color?: string;
}) {
  const c1 = color ?? DEFAULT.c1;
  const c2 = DEFAULT.c2;
  const { ink, cream, crimson } = DEFAULT;
  const initial = (league.sponsorName ?? league.name ?? "★").trim()[0]?.toUpperCase() ?? "★";

  return (
    <div className="relative rounded-3xl overflow-hidden" style={{ border: "1px solid #ffffff14", boxShadow: "0 24px 60px -24px #000" }}>
      <style>{`
        @keyframes flBg{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes flSweep{from{left:-25%}to{left:125%}}
        @keyframes flGloss{0%{left:-60%}55%,100%{left:135%}}
        @keyframes flHalo{0%,100%{opacity:.35;transform:scale(.9)}50%{opacity:.85;transform:scale(1.1)}}
        @keyframes flCta{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
        .fl-beam{position:absolute;top:-40%;width:80px;height:180%;background:linear-gradient(90deg,transparent,#ffffff33,transparent);filter:blur(5px);transform:skewX(-18deg);animation:flSweep 5.5s linear infinite}
        .fl-beam.b2{animation-delay:2.75s;opacity:.6}
        .fl-shine{position:relative;overflow:hidden;display:inline-block}
        .fl-shine::after{content:"";position:absolute;top:0;left:-60%;width:38%;height:100%;background:linear-gradient(90deg,transparent,#ffffffcc,transparent);transform:skewX(-20deg);animation:flGloss 3.6s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.fl-beam,.fl-shine::after{animation:none}}
      `}</style>

      {/* Animated brand background */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(90% 130% at 12% -10%, #ffffff1f 0%, transparent 45%), radial-gradient(70% 120% at 100% 120%, ${crimson}2e 0%, transparent 50%), linear-gradient(120deg, ${c2} 0%, ${c1} 32%, #6b3f00 64%, ${ink} 100%)`,
        backgroundSize: "200% 200%", animation: "flBg 14s ease-in-out infinite",
      }} />
      <div className="fl-beam" /><div className="fl-beam b2" />

      <div className="relative p-5 sm:p-7">
        {/* Crest + venue */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative w-14 h-14 rounded-2xl grid place-items-center shrink-0 font-black text-2xl"
               style={{ background: "linear-gradient(150deg,#fff,#FDF6E7 55%," + c1 + ")", color: ink, boxShadow: "0 10px 30px -8px #000" }}>
            {league.sponsorLogoUrl
              ? <img src={league.sponsorLogoUrl} alt={league.sponsorName ?? ""} className="w-full h-full object-contain rounded-2xl" />
              : initial}
            <span className="absolute -inset-2 rounded-3xl -z-10" style={{ background: "radial-gradient(circle,#ffffff66,transparent 70%)", animation: "flHalo 2.6s ease-in-out infinite" }} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black tracking-[0.28em] uppercase" style={{ color: "#3a2700" }}>Featured League</div>
            {league.sponsorName && (
              <div className="text-lg font-black leading-tight truncate" style={{ color: "#160d02" }}>{league.sponsorName}</div>
            )}
          </div>
          <div className="ml-auto text-center shrink-0">
            <div className="text-2xl font-black tabular-nums" style={{ color: "#160d02" }}>{league.memberCount ?? "—"}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#5a3d00" }}>members</div>
          </div>
        </div>

        {/* League name — the hero line */}
        <h3 className="fl-shine text-3xl sm:text-4xl font-black leading-[0.95] mb-2" style={{ color: "#120b01" }}>
          {league.name}
        </h3>

        {league.sponsorDescription && (
          <p className="text-[13px] font-semibold leading-snug mb-4 max-w-prose" style={{ color: "#2a1c04" }}>
            {league.sponsorDescription}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onJoin(league.id)}
            disabled={joining || joined}
            className="flex-1 font-black py-3.5 px-4 rounded-full text-sm tracking-wide transition-transform active:scale-[0.98] disabled:opacity-70"
            style={{ background: joined ? "#160d0288" : "#fff", color: ink, boxShadow: "0 10px 26px -8px #00000088", animation: joined || joining ? "none" : "flCta 2.2s ease-in-out infinite" }}
          >
            {joining ? "Joining…" : joined ? "✓ You're in" : "Join the league →"}
          </button>
          <Link
            href={`/${competitionSlug}/leagues/${league.id}`}
            className="py-3.5 px-5 rounded-full text-sm font-bold"
            style={{ color: cream, background: "#00000035", border: "1px solid #ffffff22" }}
          >
            View
          </Link>
        </div>

        <div className="text-[10px] font-semibold mt-3 text-center" style={{ color: "#5a3d00" }}>
          Powered by SuperBrain
        </div>
      </div>
    </div>
  );
}
