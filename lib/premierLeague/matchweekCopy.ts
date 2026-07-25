/**
 * lib/premierLeague/matchweekCopy.ts — the voice of the product.
 *
 * Real narrative for the opening matchweeks, plus the day-by-day hooks that
 * answer the only question that matters: "will this bring someone back on
 * Thursday, Friday, Saturday and Monday?"
 *
 * Copy, not architecture. It lives in one place so the personality is
 * consistent and easy to tune — the retention lever is words, not features.
 */

export interface RoundEditorial {
  headline:    string;           // the story of the matchweek
  story:       string;           // one punchy line under it
  watch:       string[];         // ⭐ star players
  biggest:     [string, string]; // [homeCode, awayCode] — the marquee tie
  biggestWhy:  string;           // why it's the biggest match
}

export const ROUND_EDITORIAL: Record<number, RoundEditorial> = {
  1: {
    headline:   "It's back. United host Arsenal, City go to Wolves, Sunderland return.",
    story:      "Nine months of football starts here. Get your first predictions in before Liverpool kick us off Friday night.",
    watch:      ["Saka", "Haaland", "Wirtz"],
    biggest:    ["MUN", "ARS"],
    biggestWhy: "Old Trafford, Sunday teatime. Arsenal want the title that keeps slipping away; United want to prove last season was the floor.",
  },
  2: {
    headline:   "London goes to war: West Ham v Chelsea, and City host Spurs.",
    story:      "One week in, the table already lies. Time to make it tell the truth.",
    watch:      ["Palmer", "Kudus", "Richarlison"],
    biggest:    ["NEW", "LIV"],
    biggestWhy: "Monday night at St James'. Newcastle under the lights against the champions — the noisiest ninety minutes of the week.",
  },
  3: {
    headline:   "Anfield hosts the early title six-pointer: Liverpool v Arsenal.",
    story:      "Three games in and this one already feels heavy. Back your gut.",
    watch:      ["Salah", "Ødegaard", "Isak"],
    biggest:    ["LIV", "ARS"],
    biggestWhy: "Two of the three genuine title contenders, at Anfield, in August. Drop points here and the narrative follows you for months.",
  },
};

export function editorialForRound(round: number): RoundEditorial | null {
  return ROUND_EDITORIAL[round] ?? null;
}

// ── The living dashboard's headline, by state ────────────────
// Short, human, and different every day of the matchweek — so opening the app
// feels like checking in on something that's moving, not reading a status.

export interface DayCopy {
  eyebrow: string;   // tiny label
  title:   string;   // the hook
  sub:     string;   // one supporting line
}

export function dashboardCopy(
  state: "preview" | "open" | "locked" | "live" | "results" | "break",
  ctx: { round: number; outstanding: number; predicted: number; total: number; pointsSoFar: number; liveNow: number; rank?: number | null },
): DayCopy {
  const r = ctx.round;
  switch (state) {
    case "preview":
      return {
        eyebrow: "Thursday",
        title:   `Matchweek ${r} is nearly here`,
        sub:     "Fixtures are up. Predictions open shortly — line up your picks.",
      };
    case "open":
      return ctx.outstanding > 0
        ? {
            eyebrow: "Get your picks in",
            title:   `${ctx.outstanding} still to predict`,
            sub:     "One tap each. You can fine-tune the scores right up to kickoff.",
          }
        : {
            eyebrow: "You're locked in",
            title:   "All ten predicted",
            sub:     "Come back Saturday to watch the points land.",
          };
    case "locked":
      return {
        eyebrow: "Locked",
        title:   "You're in. Now we wait.",
        sub:     "First whistle soon — points go live as the goals go in.",
      };
    case "live":
      return {
        eyebrow: `${ctx.liveNow} live now`,
        title:   `${ctx.pointsSoFar} points and counting`,
        sub:     "This is the good bit. Watch your predictions come true (or not).",
      };
    case "results":
      return {
        eyebrow: "Full time",
        title:   `${ctx.pointsSoFar} points this matchweek`,
        sub:     ctx.rank ? `You're ${ordinal(ctx.rank)} — share it or plot your revenge.` : "See where you finished.",
      };
    case "break":
      return {
        eyebrow: "International break",
        title:   "No Premier League this week",
        sub:     "Good time to check the table and see how far you've climbed.",
      };
  }
}

// ── The four return moments ──────────────────────────────────
// The product's whole retention thesis in four lines. Used by notifications
// (§4.8) and as the dashboard's secondary nudge.

export const RETURN_HOOKS = {
  thursday: (round: number) =>
    `⚽ Matchweek ${round} is live. New fixtures, new challenges — get your predictions in.`,
  saturday: (outstanding: number) =>
    `⏳ Last chance — you've still got ${outstanding} ${outstanding === 1 ? "match" : "matches"} to predict before kickoff.`,
  monday: (points: number, rank: number | null) =>
    rank
      ? `🏆 You scored ${points} this matchweek and you're ${ordinal(rank)} in your league.`
      : `🏆 You scored ${points} this matchweek. See the full table.`,
};

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
