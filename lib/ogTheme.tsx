/**
 * lib/ogTheme.tsx — one brand for every Open Graph image.
 *
 * The app's current identity is "Midnight Gold" (black #0B0B0D + gold #E8C15A,
 * see lib/brand.ts). Social previews had drifted into two dead brands — cyan
 * cognitive-test and green World-Cup — so every OG route now pulls its colours,
 * background, competition labels and wordmark from here. Edge-safe: no fonts,
 * no raster fetches, inline SVG + plain gradients only (Satori limits).
 */

import type { ReactNode } from "react";

export const OG = {
  black: "#0B0B0D",
  panel: "#141418",
  ink: "#F5F5F2",
  muted: "#9A9AA3",
  dim: "#6B6B73",
  gold: "#E8C15A",
  goldSoft: "#F0D98B",
  goldDeep: "#8A6D12",
  goldInk: "#2A2205",
  green: "#35C56F",
  size: { width: 1200, height: 630 },
  // Satori's `background` shorthand rejects a trailing solid hex, so the black
  // goes on `backgroundColor` and only the gradients on `backgroundImage`.
  // A gold glow top + a faint gold pool bottom (plain radials — no repeating).
  bgImage: "radial-gradient(120% 80% at 50% -5%, rgba(232,193,90,0.16), transparent 45%), radial-gradient(90% 70% at 50% 115%, rgba(232,193,90,0.06), transparent 55%)",
} as const;

// Competition slug → display label (mirrors the app; unknown slugs title-case).
const LABELS: Record<string, string> = {
  "premier-league":   "Premier League",
  "la-liga":          "LaLiga",
  "bundesliga":       "Bundesliga",
  "serie-a":          "Serie A",
  "ligue-1":          "Ligue 1",
  "allsvenskan":      "Allsvenskan",
  "champions-league": "Champions League",
  "shl":              "SHL",
  "nhl":              "NHL",
};

export function competitionLabel(slug?: string): string {
  if (!slug) return "";
  if (LABELS[slug]) return LABELS[slug];
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** The official SuperBrain wordmark: black chip + gold "SB" + SUPERBRAIN. */
export function SBWordmark({ chip = 46 }: { chip?: number }): ReactNode {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{
        width: chip, height: chip, borderRadius: chip * 0.2, background: OG.black,
        border: `1px solid ${OG.gold}88`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: chip * 0.5, color: OG.gold, letterSpacing: "-1px" }}>SB</span>
      </div>
      <span style={{ color: OG.muted, fontSize: 16, fontWeight: 800, letterSpacing: "0.26em" }}>SUPERBRAIN</span>
    </div>
  );
}

/** Thin gold rule used as a top accent on cards. */
export function GoldTop(): ReactNode {
  return <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${OG.goldDeep}, ${OG.gold}, ${OG.goldDeep})`, display: "flex" }} />;
}

/** A small pill (label + optional value) in the brand's gold-on-black style. */
export function Pill({ children, filled = false }: { children: ReactNode; filled?: boolean }): ReactNode {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, borderRadius: 999,
      padding: "12px 26px",
      background: filled ? OG.gold : "rgba(232,193,90,0.12)",
      border: filled ? "none" : `1px solid ${OG.gold}55`,
    }}>
      <span style={{ color: filled ? OG.goldInk : OG.gold, fontSize: 22, fontWeight: 800, letterSpacing: "0.01em" }}>{children}</span>
    </div>
  );
}
