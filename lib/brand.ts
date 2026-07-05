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
