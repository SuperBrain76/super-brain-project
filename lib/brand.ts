// ============================================================================
// SuperBrain — "Midnight Gold" design tokens
// ----------------------------------------------------------------------------
// One source of truth for the brand. Rules:
//   • GOLD represents VALUE ONLY — IQ, levels, achievements, rewards, premium
//     actions. Never decoration, never a background wash.
//   • The shell is near-black with fine hairlines. Restraint over ornament.
//   • Each module keeps an identity via a single ACCENT (not gold), used only
//     for that module's active states + icons.
// ============================================================================

export const BRAND = {
  // Surfaces
  black: "#0B0B0D",      // page canvas
  surface: "#141418",    // card
  elevated: "#1F1F25",   // raised control
  hairline: "rgba(255,255,255,0.08)",
  hairlineStrong: "rgba(255,255,255,0.14)",

  // Ink
  ink: "#F5F5F2",        // primary text
  muted: "#A0A0A8",      // secondary text
  dim: "#6B6B73",        // tertiary / inactive

  // Gold — VALUE ONLY
  gold: "#E8C15A",
  goldSoft: "#F0D98B",
  goldDeep: "#8A6D12",
  goldInk: "#2A2205",    // text on a gold fill

  // Module accents — identity, never value
  sports: "#35C56F",     // Sports / Predictor — the pitch
  tests: "#33D6D6",      // Brain Tests — cool, clinical
  battle: "#FF6A3D",     // Battles — heat
  neutral: "#F5F5F2",    // cross-module (Rankings, generic)
} as const;

// ── Material & light (sculpted, from the app icon: metallic gold on luminous
// black, a fine gold ring, a neural glow). Use as inline CSS values. ──────────
export const MATERIAL = {
  // Polished-gold fill (catches light top-left → deepens bottom-right).
  goldFill: "linear-gradient(140deg, #F6E6A8 0%, #E8C15A 42%, #B8972A 78%, #8A6D12 100%)",
  // Luminous-black elevation — lit from above, not a flat card.
  raise: "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 12%, rgba(255,255,255,0) 40%), #101116",
  // The icon's glow — light source behind value.
  goldGlow: "radial-gradient(closest-side, rgba(232,193,90,0.22), rgba(232,193,90,0.06) 55%, transparent 75%)",
  // Ambient page vignette so black reads sculpted, not painted.
  vignette: "radial-gradient(120% 90% at 50% -10%, rgba(232,193,90,0.06), transparent 45%), radial-gradient(100% 100% at 50% 120%, rgba(0,0,0,0.6), transparent 55%), #08090B",
  ring: "rgba(232,193,90,0.55)",
  ringFaint: "rgba(232,193,90,0.22)",
  shadowSoft: "0 24px 60px -24px rgba(0,0,0,0.85)",
  shadowGold: "0 10px 30px -10px rgba(232,193,90,0.35)",
} as const;

export type ModuleKey = "iq" | "sports" | "tests" | "battle" | "neutral";

/** Accent for a module — gold for the economy/identity (value), colour elsewhere. */
export function accentFor(module: ModuleKey): string {
  switch (module) {
    case "iq": return BRAND.gold;
    case "sports": return BRAND.sports;
    case "tests": return BRAND.tests;
    case "battle": return BRAND.battle;
    default: return BRAND.neutral;
  }
}
