"use client";

/**
 * FeaturedLeagueBanner — the big, unmissable banner for a sponsored / venue
 * league. Their logo, their name, their brand colour, animated flash (gradient
 * + spotlight sweep + shine + glow) so it dominates the leagues screen. Works
 * with any brand colour (dark treatment, light text). Falls back gracefully.
 */

import Link from "next/link";
import type { PredictionLeague } from "@/lib/predictor";

const INK = "#0A0D0A", CREAM = "#F7EFDD", MUTED = "#B9C2AC", GOLD = "#E6B94E";

export default function FeaturedLeagueBanner({
  league, onJoin, joining, joined, competitionSlug, color, viewHref,
}: {
  league: PredictionLeague;
  onJoin: (id: string) => void;
  joining: boolean;
  joined: boolean;
  competitionSlug: string;
  /** Venue brand colour (any hue) — the banner darkens it for legibility. */
  color?: string;
  /** Override the View link (e.g. a branded demo page). */
  viewHref?: string;
}) {
  const brand = color ?? "#C9A54B";
  const initial = (league.sponsorName ?? league.name ?? "★").trim()[0]?.toUpperCase() ?? "★";
  const href = viewHref ?? `/${competitionSlug}/leagues/${league.id}`;

  return (
    <div className="relative rounded-3xl overflow-hidden" style={{ border: "1px solid #ffffff14", boxShadow: "0 24px 60px -24px #000" }}>
      <style>{`
        @keyframes flBg{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes flSweep{from{left:-25%}to{left:125%}}
        @keyframes flHalo{0%,100%{opacity:.3;transform:scale(.9)}50%{opacity:.8;transform:scale(1.1)}}
        @keyframes flCta{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
        @keyframes flLive{0%,100%{opacity:1}50%{opacity:.35}}
        .fl-beam{position:absolute;top:-40%;width:80px;height:180%;background:linear-gradient(90deg,transparent,#ffffff26,transparent);filter:blur(5px);transform:skewX(-18deg);animation:flSweep 5.5s linear infinite}
        .fl-beam.b2{animation-delay:2.75s;opacity:.6}
        @media (prefers-reduced-motion: reduce){.fl-beam{animation:none}}
      `}</style>

      {/* Animated brand → dark gradient */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(80% 120% at 50% -10%, ${brand}2e 0%, transparent 55%), linear-gradient(125deg, ${brand} 0%, ${brand}bb 40%, ${INK} 100%)`,
        backgroundSize: "200% 200%", animation: "flBg 15s ease-in-out infinite",
      }} />
      <div className="fl-beam" /><div className="fl-beam b2" />

      <div className="relative p-5 sm:p-7">
        {/* Live pill */}
        <div className="inline-flex items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ background: "#00000040", border: `1px solid ${GOLD}44` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80", animation: "flLive 1.6s ease-in-out infinite" }} />
          <span className="text-[9px] font-black tracking-[0.22em]" style={{ color: GOLD }}>FEATURED LEAGUE · LIVE</span>
        </div>

        {/* Crest + venue */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative w-14 h-14 rounded-2xl grid place-items-center shrink-0 font-black text-2xl"
               style={{ background: "#fff", color: INK, boxShadow: "0 10px 30px -8px #000" }}>
            {league.sponsorLogoUrl
              ? <img src={league.sponsorLogoUrl} alt={league.sponsorName ?? ""} className="w-full h-full object-contain rounded-2xl p-1" />
              : initial}
            <span className="absolute -inset-2 rounded-3xl -z-10" style={{ background: `radial-gradient(circle,${GOLD}66,transparent 70%)`, animation: "flHalo 2.6s ease-in-out infinite" }} />
          </div>
          <div className="min-w-0">
            {league.sponsorName && <div className="text-lg font-black leading-tight truncate" style={{ color: CREAM }}>{league.sponsorName}</div>}
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: MUTED }}>Members&apos; league</div>
          </div>
          <div className="ml-auto text-center shrink-0">
            <div className="text-2xl font-black tabular-nums" style={{ color: CREAM }}>{league.memberCount ?? "—"}</div>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>members</div>
          </div>
        </div>

        {/* League name — the hero line */}
        <h3 className="text-3xl sm:text-4xl font-black leading-[0.95] mb-2" style={{ color: CREAM }}>{league.name}</h3>

        {league.sponsorDescription && (
          <p className="text-[13px] font-medium leading-snug mb-4 max-w-prose" style={{ color: "#D8E0CE" }}>{league.sponsorDescription}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onJoin(league.id)}
            disabled={joining || joined}
            className="flex-1 font-black py-3.5 px-4 rounded-full text-sm tracking-wide transition-transform active:scale-[0.98] disabled:opacity-70"
            style={{ background: joined ? "#ffffff22" : "#fff", color: joined ? CREAM : INK, boxShadow: "0 10px 26px -8px #000000aa", animation: joined || joining ? "none" : "flCta 2.2s ease-in-out infinite" }}
          >
            {joining ? "Joining…" : joined ? "✓ You're in" : "Join the league →"}
          </button>
          <Link href={href} className="py-3.5 px-6 rounded-full text-sm font-bold" style={{ color: CREAM, background: "#00000040", border: "1px solid #ffffff2a" }}>
            View
          </Link>
        </div>

        <div className="text-[10px] font-semibold mt-3 text-center" style={{ color: MUTED }}>Powered by SuperBrain</div>
      </div>
    </div>
  );
}
