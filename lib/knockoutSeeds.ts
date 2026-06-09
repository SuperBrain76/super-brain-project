/**
 * lib/knockoutSeeds.ts
 *
 * Maps fixture_number → { home seed label, away seed label }
 * for every WC2026 knockout fixture (numbers 73–104).
 *
 * Source: FIFA official bracket released after the 5 Dec 2025 draw,
 * cross-referenced with NBC Sports / SKY Sports schedules.
 *
 * "W" prefix = winner of that fixture number.
 * Group qualifiers follow the standard FIFA notation:
 *   1X  = group winner of group X
 *   2X  = group runner-up of group X
 *   3XY = best third-placed team from groups X and Y
 *
 * The "best third-place" combinations are per FIFA's pre-announced
 * bracket paths; exact group combinations are official.
 *
 * Do NOT touch scoring logic or API ingestion — display only.
 */

export interface SeedPair {
  home: string;
  away: string;
}

// ── Round of 32 (fixture numbers 73–88) ──────────────────────
// Mapped from the official FIFA bracket draw.

const R32_SEEDS: Record<number, SeedPair> = {
  73:  { home: "1E",  away: "3ABCD" },
  74:  { home: "1D",  away: "2F"    },
  75:  { home: "1C",  away: "3ABDE" },
  76:  { home: "1B",  away: "2D"    },
  77:  { home: "1A",  away: "3BCDF" },
  78:  { home: "2E",  away: "2C"    },
  79:  { home: "1F",  away: "3ACDE" },
  80:  { home: "2A",  away: "2B"    },
  81:  { home: "1I",  away: "3GHIL" },
  82:  { home: "1H",  away: "2J"    },
  83:  { home: "1G",  away: "3HIJK" },
  84:  { home: "1J",  away: "2H"    },
  85:  { home: "1K",  away: "3GHIJ" },
  86:  { home: "2G",  away: "2I"    },
  87:  { home: "1L",  away: "3IJKL" },
  88:  { home: "2K",  away: "2L"    },
};

// ── Round of 16 (fixture numbers 89–96) ──────────────────────
// Winners of specific R32 pairs.

const R16_SEEDS: Record<number, SeedPair> = {
  89:  { home: "W73", away: "W74" },
  90:  { home: "W75", away: "W76" },
  91:  { home: "W77", away: "W78" },
  92:  { home: "W79", away: "W80" },
  93:  { home: "W81", away: "W82" },
  94:  { home: "W83", away: "W84" },
  95:  { home: "W85", away: "W86" },
  96:  { home: "W87", away: "W88" },
};

// ── Quarterfinals (fixture numbers 97–100) ────────────────────

const QF_SEEDS: Record<number, SeedPair> = {
  97:  { home: "W89", away: "W90" },
  98:  { home: "W91", away: "W92" },
  99:  { home: "W93", away: "W94" },
  100: { home: "W95", away: "W96" },
};

// ── Semifinals (fixture numbers 101–102) ──────────────────────

const SF_SEEDS: Record<number, SeedPair> = {
  101: { home: "W97",  away: "W98"  },
  102: { home: "W99",  away: "W100" },
};

// ── Third place + Final (fixture numbers 103–104) ─────────────

const LATE_SEEDS: Record<number, SeedPair> = {
  103: { home: "L101", away: "L102" },
  104: { home: "W101", away: "W102" },
};

// ── Unified lookup ─────────────────────────────────────────────

const ALL_SEEDS: Record<number, SeedPair> = {
  ...R32_SEEDS,
  ...R16_SEEDS,
  ...QF_SEEDS,
  ...SF_SEEDS,
  ...LATE_SEEDS,
};

/**
 * Returns the seed label pair for a knockout fixture number,
 * or null for group-stage fixtures.
 */
export function getKnockoutSeeds(fixtureNumber: number): SeedPair | null {
  return ALL_SEEDS[fixtureNumber] ?? null;
}

/**
 * Returns the home seed label for a fixture, or null.
 */
export function getHomeSeed(fixtureNumber: number): string | null {
  return ALL_SEEDS[fixtureNumber]?.home ?? null;
}

/**
 * Returns the away seed label for a fixture, or null.
 */
export function getAwaySeed(fixtureNumber: number): string | null {
  return ALL_SEEDS[fixtureNumber]?.away ?? null;
}

/**
 * Given a team (may be null/TBD) and a fixture number + side,
 * returns the best displayable label:
 *   actual team name  →  seed label  →  "TBD"
 */
export function resolveTeamLabel(
  team: { name: string } | null | undefined,
  fixtureNumber: number,
  side: "home" | "away",
): string {
  if (team?.name) return team.name;
  const seeds = ALL_SEEDS[fixtureNumber];
  if (seeds) return side === "home" ? seeds.home : seeds.away;
  return "TBD";
}

// ── Full R32 bracket reference (for path view) ─────────────────

export interface BracketMatch {
  fixtureNumber: number;
  home:          string;
  away:          string;
}

export const R32_BRACKET: BracketMatch[] = Object.entries(R32_SEEDS)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([num, pair]) => ({
    fixtureNumber: Number(num),
    home: pair.home,
    away: pair.away,
  }));
