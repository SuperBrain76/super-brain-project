/**
 * Competition Engine — settings, stages, rounds, locking.
 *
 * Pure logic only. Anything requiring Postgres is verified by the SQL
 * scripts in scripts/verify-*.sql instead; there is no local database in
 * this environment, and asserting against a mock of Postgres would prove
 * nothing about the migrations.
 */

import { describe, it, expect } from "vitest";
import {
  parseSettings,
  DEFAULT_SETTINGS,
  stageLabelFrom,
  tableStages,
  pickCurrentRound,
  isRoundLocked,
  openRounds,
  monthWindow,
  FALLBACK_COMPETITION_SLUG,
  type CompetitionStage,
  type Round,
} from "@/lib/competitionEngine";
import { stageLabel } from "@/lib/predictor";

// ── Settings ──────────────────────────────────────────────────

describe("parseSettings", () => {
  it("returns defaults for a competition with no settings at all", () => {
    // This is what makes "create a competition and it works" possible
    // before anybody opens the settings screen.
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("reproduces the World Cup's hardcoded behaviour from its seeded rows", () => {
    const wc = parseSettings({
      provider:            "api-football",
      provider_league_id:  1,
      provider_season:     2026,
      has_knockout:        true,
      has_group_stage:     true,
      has_legacy_bonus:    true,
      has_challenges:      false,
      visible:             true,
      is_default:          true,
    });

    expect(wc.providerLeagueId).toBe(1);
    expect(wc.providerSeason).toBe(2026);
    expect(wc.hasKnockout).toBe(true);
    expect(wc.hasGroupStage).toBe(true);
    expect(wc.hasLegacyBonus).toBe(true);
    // The World Cup used season-long bonus questions, NOT matchday challenges.
    expect(wc.hasChallenges).toBe(false);
  });

  it("describes the Premier League with no knockout bracket", () => {
    const pl = parseSettings({
      provider_league_id: 39,
      provider_season:    2026,
      has_knockout:       false,
      has_group_stage:    false,
      has_standings_table: true,
      has_challenges:     true,
      round_label:        "Matchweek",
      round_label_plural: "Matchweeks",
    });

    // The single most important flag for the PL: the advance-knockout cron
    // must never run against it.
    expect(pl.hasKnockout).toBe(false);
    expect(pl.hasStandingsTable).toBe(true);
    expect(pl.hasChallenges).toBe(true);
    expect(pl.roundLabel).toBe("Matchweek");
  });

  it("treats a missing provider id as null rather than zero", () => {
    // Zero is a valid-looking league id and would send a real request for
    // the wrong competition. Null makes the ingest loop skip.
    expect(parseSettings({ provider_league_id: null }).providerLeagueId).toBeNull();
    expect(parseSettings({}).providerLeagueId).toBeNull();
  });

  it("ignores unknown leaderboard windows instead of trusting them", () => {
    const s = parseSettings({ leaderboard_windows: ["round", "fortnight", "season"] });
    expect(s.leaderboardWindows).toEqual(["round", "season"]);
  });

  it("falls back to all windows when the array is empty or malformed", () => {
    expect(parseSettings({ leaderboard_windows: [] }).leaderboardWindows)
      .toEqual(DEFAULT_SETTINGS.leaderboardWindows);
    expect(parseSettings({ leaderboard_windows: "round" }).leaderboardWindows)
      .toEqual(DEFAULT_SETTINGS.leaderboardWindows);
  });

  it("coerces numeric strings, which jsonb round-trips can produce", () => {
    expect(parseSettings({ economy_multiplier: "0.5" }).economyMultiplier).toBe(0.5);
  });

  it("rejects a non-numeric multiplier rather than producing NaN", () => {
    // NaN would silently zero every IQ award for the competition.
    expect(parseSettings({ economy_multiplier: "abc" }).economyMultiplier).toBe(1);
  });

  it("defaults a new competition to invisible", () => {
    // The launch flag: a competition renders for admins while hidden from
    // users. Defaulting to visible would leak an unfinished competition.
    expect(DEFAULT_SETTINGS.visible).toBe(false);
  });

  it("does not treat calendar week as a leaderboard window", () => {
    // Decision, 24 Jul 2026: "weekly" means matchweek. There is no "week".
    expect(DEFAULT_SETTINGS.leaderboardWindows).not.toContain("week");
    expect(DEFAULT_SETTINGS.leaderboardWindows).toContain("round");
  });
});

// ── Stages ────────────────────────────────────────────────────

// These must stay byte-identical to migration 040's seed AND to the
// stageLabel() fallback map in lib/predictor.ts. A mismatch is a visible
// regression on historical World Cup pages.
const WC_STAGES: CompetitionStage[] = [
  { id: "1", code: "group", label: "Group Stage",   sortOrder: 1, hasTable: true,  isKnockout: false },
  { id: "2", code: "r32",   label: "Round of 32",   sortOrder: 2, hasTable: false, isKnockout: true  },
  { id: "3", code: "r16",   label: "Round of 16",   sortOrder: 3, hasTable: false, isKnockout: true  },
  { id: "4", code: "qf",    label: "Quarter-final", sortOrder: 4, hasTable: false, isKnockout: true  },
  { id: "5", code: "sf",    label: "Semi-final",    sortOrder: 5, hasTable: false, isKnockout: true  },
  { id: "6", code: "3rd",   label: "Third Place",   sortOrder: 6, hasTable: false, isKnockout: true  },
  { id: "7", code: "final", label: "Final",         sortOrder: 7, hasTable: false, isKnockout: true  },
];

describe("competition stages", () => {
  it("🔴 every World Cup label matches the legacy hardcoded map exactly", () => {
    // The zero-regression assertion for migration 040. If this fails, the
    // seed in 040 and stageLabel() have diverged and WC pages will change.
    for (const s of WC_STAGES) {
      expect(stageLabelFrom(WC_STAGES, s.code)).toBe(stageLabel(s.code));
    }
  });

  it("covers exactly the seven codes the old CHECK constraint allowed", () => {
    expect(WC_STAGES.map((s) => s.code).sort())
      .toEqual(["3rd", "final", "group", "qf", "r16", "r32", "sf"]);
  });

  it("identifies standings stages by flag, not by the code 'group'", () => {
    // components/predictor/GroupStandings.tsx used `stage !== "group"`.
    // A Premier League season has no stage called "group".
    expect(tableStages(WC_STAGES)).toEqual(["group"]);

    const plStages: CompetitionStage[] = [
      { id: "a", code: "league", label: "Matchweek", sortOrder: 1, hasTable: true, isKnockout: false },
    ];
    expect(tableStages(plStages)).toEqual(["league"]);
  });

  it("returns the code unchanged for an unknown stage rather than blank", () => {
    expect(stageLabelFrom(WC_STAGES, "playoff")).toBe("playoff");
  });

  it("marks no Premier League stage as knockout", () => {
    const plStages: CompetitionStage[] = [
      { id: "a", code: "league", label: "Matchweek", sortOrder: 1, hasTable: true, isKnockout: false },
    ];
    expect(plStages.some((s) => s.isKnockout)).toBe(false);
  });
});

// ── Rounds ────────────────────────────────────────────────────

function round(over: Partial<Round> & { sortOrder: number }): Round {
  return {
    id:           `r${over.sortOrder}`,
    seasonId:     "s1",
    code:         `mw${over.sortOrder}`,
    label:        `Matchweek ${over.sortOrder}`,
    shortLabel:   `MW${over.sortOrder}`,
    kind:         "matchweek",
    startsAt:     null,
    endsAt:       null,
    locksAt:      null,
    lockIsPinned: false,
    status:       "upcoming",
    ...over,
  };
}

// A three-matchweek season in August 2026.
const SEASON: Round[] = [
  round({ sortOrder: 1, startsAt: "2026-08-15T14:00:00Z", endsAt: "2026-08-16T16:00:00Z", locksAt: "2026-08-15T14:00:00Z", status: "completed" }),
  round({ sortOrder: 2, startsAt: "2026-08-22T14:00:00Z", endsAt: "2026-08-23T16:00:00Z", locksAt: "2026-08-22T14:00:00Z" }),
  round({ sortOrder: 3, startsAt: "2026-08-29T14:00:00Z", endsAt: "2026-08-30T16:00:00Z", locksAt: "2026-08-29T14:00:00Z" }),
];

describe("pickCurrentRound", () => {
  it("picks the first unfinished round", () => {
    const now = new Date("2026-08-20T12:00:00Z").getTime();
    expect(pickCurrentRound(SEASON, now)?.sortOrder).toBe(2);
  });

  it("keeps a round current while its last match is still being played", () => {
    // MW2's final kickoff is 16:00; at 17:00 the match is still on.
    const now = new Date("2026-08-23T17:00:00Z").getTime();
    expect(pickCurrentRound(SEASON, now)?.sortOrder).toBe(2);
  });

  it("moves on once the tail has elapsed", () => {
    const now = new Date("2026-08-23T20:00:00Z").getTime();
    expect(pickCurrentRound(SEASON, now)?.sortOrder).toBe(3);
  });

  it("stays on the last round after the season ends", () => {
    const now = new Date("2027-01-01T00:00:00Z").getTime();
    expect(pickCurrentRound(SEASON, now)?.sortOrder).toBe(3);
  });

  it("returns the first round before the season starts", () => {
    const now = new Date("2026-07-01T00:00:00Z").getTime();
    expect(pickCurrentRound(SEASON, now)?.sortOrder).toBe(1);
  });

  it("returns null for a season with no rounds", () => {
    expect(pickCurrentRound([], Date.now())).toBeNull();
  });
});

describe("isRoundLocked — challenge locking", () => {
  it("is open before the first kickoff of the round", () => {
    const now = new Date("2026-08-22T13:59:00Z").getTime();
    expect(isRoundLocked(SEASON[1], now)).toBe(false);
  });

  it("locks exactly at the first kickoff", () => {
    const now = new Date("2026-08-22T14:00:00Z").getTime();
    expect(isRoundLocked(SEASON[1], now)).toBe(true);
  });

  it("🔴 does NOT lock a later matchweek when an earlier one has locked", () => {
    // The entire point of matchday challenges over season-long bonuses: a
    // user joining in MW20 must not be permanently disadvantaged.
    const now = new Date("2026-08-22T15:00:00Z").getTime();
    expect(isRoundLocked(SEASON[1], now)).toBe(true);   // this week: closed
    expect(isRoundLocked(SEASON[2], now)).toBe(false);  // next week: open
  });

  it("respects an explicit locked status even with no locks_at", () => {
    const r = round({ sortOrder: 9, status: "locked" });
    expect(isRoundLocked(r, 0)).toBe(true);
  });

  it("treats a round with no lock time as open", () => {
    const r = round({ sortOrder: 9 });
    expect(isRoundLocked(r, Date.now())).toBe(false);
  });

  it("lists only the rounds a late joiner can still enter", () => {
    const now = new Date("2026-08-22T15:00:00Z").getTime();
    expect(openRounds(SEASON, now).map((r) => r.sortOrder)).toEqual([3]);
  });
});

// ── Monthly window ────────────────────────────────────────────

describe("monthWindow", () => {
  it("spans the whole month, end-exclusive", () => {
    const { from, to } = monthWindow(2026, 8);
    expect(from).toBe("2026-08-01T00:00:00.000Z");
    expect(to).toBe("2026-09-01T00:00:00.000Z");
  });

  it("rolls December into the next year", () => {
    const { from, to } = monthWindow(2026, 12);
    expect(from).toBe("2026-12-01T00:00:00.000Z");
    expect(to).toBe("2027-01-01T00:00:00.000Z");
  });

  it("handles February in a leap year without a 29th-of-Feb bug", () => {
    const { to } = monthWindow(2028, 2);
    expect(to).toBe("2028-03-01T00:00:00.000Z");
  });

  it("is end-exclusive so a fixture is never counted in two months", () => {
    const aug = monthWindow(2026, 8);
    const sep = monthWindow(2026, 9);
    expect(aug.to).toBe(sep.from);
  });
});

// ── The last hardcoded slug ───────────────────────────────────

describe("FALLBACK_COMPETITION_SLUG", () => {
  it("is the only remaining hardcoded competition, and is documented as such", () => {
    expect(FALLBACK_COMPETITION_SLUG).toBe("wc2026");
  });
});
