/**
 * Score → percentile mapping.
 * Based on estimated normal distribution until real user data is available.
 */
const PERCENTILE_MAP: [number, number][] = [
  [97, 99], [93, 95], [88, 88], [83, 80],
  [78, 70], [73, 58], [68, 46], [63, 35],
  [57, 24], [50, 15], [42, 9], [0, 4],
];

export function scoreToPercentile(score: number): number {
  for (const [threshold, pct] of PERCENTILE_MAP) {
    if (score >= threshold) return pct;
  }
  return 4;
}

/**
 * Identity-first result archetypes.
 * Tiers: <45, 45–62, 63–77, 78–89, 90+
 */
const TITLE_MAP: Record<string, [string, string, string, string, string]> = {
  "fighter-pilot": [
    "Grounded",
    "Cleared for Takeoff",
    "Combat Ready",
    "Ace Pilot",
    "Top Gun",
  ],
  reaction: [
    "Slow Response",
    "Average Human",
    "Combat Reflex",
    "Elite Reactor",
    "Superhuman Reactor",
  ],
  pressure: [
    "Crumbles Under Pressure",
    "Steady Under Fire",
    "Tactical Thinker",
    "Pressure Proof",
    "Unbreakable",
  ],
  memory: [
    "Memory Gap",
    "Human Average",
    "Sharp Focus",
    "Neural Archive",
    "Eidetic",
  ],
  "tap-speed": [
    "Slow Tapper",
    "Average Speed",
    "Fast Fingers",
    "Speed Demon",
    "Tap God",
  ],
  "verbal-memory": [
    "Forgetful",
    "Human Average",
    "Sharp Memory",
    "Steel Trap",
    "Eidetic Recall",
  ],
  stroop: [
    "Easily Confused",
    "Slow Processor",
    "Interference Fighter",
    "Stroop Master",
    "Neuro Elite",
  ],
};

function getTier(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score >= 90) return 4;
  if (score >= 78) return 3;
  if (score >= 63) return 2;
  if (score >= 45) return 1;
  return 0;
}

export function getResultTitle(testId: string, score: number): string {
  const titles = TITLE_MAP[testId] ?? TITLE_MAP["fighter-pilot"];
  return titles[getTier(score)];
}

const DESCRIPTIONS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "Most people score higher. You can do better — and you know it.",
  1: "You're in the pack. There's a gap between here and elite. Start closing it.",
  2: "Solid performance. You're above average — but the top tier is still ahead.",
  3: "Well above average. You think fast, act decisively, and hold up under pressure.",
  4: "Exceptional. Less than 5% of people reach this level. You're built different.",
};

export function getResultDescription(testId: string, score: number): string {
  void testId; // reserved for per-test descriptions in future
  return DESCRIPTIONS[getTier(score)];
}
