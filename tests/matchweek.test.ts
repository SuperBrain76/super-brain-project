/**
 * The matchweek state machine and the H/D/A prediction model.
 *
 * Getting the state wrong is the most visible bug this product can have —
 * a "Predict now" button on a locked matchweek, or a preview on results day.
 * These tests pin every transition. All times are explicit; no clock, no DB.
 */

import { describe, it, expect } from "vitest";
import {
  deriveMatchweekView,
  formatCountdown,
  stateHeadline,
  statePrimaryAction,
  isFixturePredictable,
  PREVIEW_LEAD_MS,
  BREAK_GAP_MS,
} from "@/lib/matchweek";
import {
  DEFAULT_SCORELINE,
  outcomeOf,
  scoreForOutcome,
  selectedOutcome,
  clampGoals,
  stepGoals,
  copyFromPreviousRound,
  fillRemaining,
  groupByKickoff,
  sheetProgress,
} from "@/lib/matchweekPredictions";
import type { Fixture } from "@/lib/predictor";
import type { Round } from "@/lib/competitionEngine";

// ── Builders ──────────────────────────────────────────────────

const HOUR = 3600_000;
const DAY  = 24 * HOUR;

function team(code: string, name = code) {
  return { id: code, name, code, flagEmoji: null, groupName: null, fifaRanking: null };
}

function fixture(over: Partial<Fixture> & { kicksOffAt: string }): Fixture {
  const { kicksOffAt, ...rest } = over;
  return {
    id:            over.id ?? `f-${kicksOffAt}`,
    competitionId: "pl",
    stage:         "league",
    groupName:     null,
    fixtureNumber: 1,
    homeTeam:      team("ARS", "Arsenal"),
    awayTeam:      team("BUR", "Burnley"),
    homeScore:     null,
    awayScore:     null,
    venue:         null,
    status:        "scheduled",
    myPrediction:  null,
    kicksOffAt,
    ...rest,
  } as Fixture;
}

function round(locksAt: string): Round {
  return {
    id: "r1", seasonId: "s1", code: "mw13", label: "Matchweek 13",
    shortLabel: "MW13", sortOrder: 13, kind: "matchweek",
    startsAt: locksAt, endsAt: locksAt, locksAt, lockIsPinned: false,
    status: "upcoming",
  };
}

// A standard matchweek: one Friday match, then five at Saturday 15:00.
const SAT_3PM = Date.parse("2026-11-21T15:00:00Z");
const FRI_8PM = Date.parse("2026-11-20T20:00:00Z");

function standardWeek(): Fixture[] {
  return [
    fixture({ id: "fri", kicksOffAt: new Date(FRI_8PM).toISOString(),
              homeTeam: team("BRE", "Brentford"), awayTeam: team("ARS", "Arsenal") }),
    ...["CHE", "LIV", "NEW", "AVL", "WHU"].map((c, i) =>
      fixture({ id: `sat-${i}`, kicksOffAt: new Date(SAT_3PM).toISOString(),
                homeTeam: team(c), awayTeam: team(`X${i}`) })),
  ];
}

// ── State machine ─────────────────────────────────────────────

describe("deriveMatchweekView — state", () => {
  const r = round(new Date(FRI_8PM).toISOString());

  it("is PREVIEW well before the lead window", () => {
    const now = FRI_8PM - PREVIEW_LEAD_MS - DAY;
    expect(deriveMatchweekView(r, standardWeek(), now).state).toBe("preview");
  });

  it("is OPEN once inside the lead window and before first kickoff", () => {
    const now = FRI_8PM - DAY;   // 1 day before, within the 3-day lead
    expect(deriveMatchweekView(r, standardWeek(), now).state).toBe("open");
  });

  it("is LOCKED right after the first kickoff with no results", () => {
    const now = FRI_8PM + 5 * 60_000;  // 5 min into the Friday match
    const v = deriveMatchweekView(r, standardWeek(), now);
    expect(v.state).toBe("locked");
  });

  it("is LIVE when a fixture is playing", () => {
    const fx = standardWeek();
    fx[0] = { ...fx[0], status: "live" };
    const now = FRI_8PM + 30 * 60_000;
    expect(deriveMatchweekView(r, fx, now).state).toBe("live");
  });

  it("is LIVE on Saturday afternoon with the Friday match already settled", () => {
    const fx = standardWeek();
    fx[0] = { ...fx[0], status: "completed", homeScore: 1, awayScore: 2 };
    fx[1] = { ...fx[1], status: "live" };
    const now = SAT_3PM + 20 * 60_000;
    expect(deriveMatchweekView(r, fx, now).state).toBe("live");
  });

  it("is RESULTS when every fixture is completed", () => {
    const fx = standardWeek().map((f) => ({
      ...f, status: "completed" as const, homeScore: 2, awayScore: 1,
    }));
    const now = SAT_3PM + 3 * HOUR;
    expect(deriveMatchweekView(r, fx, now).state).toBe("results");
  });

  it("is BREAK when everything is done and the next round is far away", () => {
    const fx = standardWeek().map((f) => ({
      ...f, status: "completed" as const, homeScore: 0, awayScore: 0,
    }));
    const now = SAT_3PM + 3 * HOUR;
    const nextRound = now + BREAK_GAP_MS + DAY;
    expect(deriveMatchweekView(r, fx, now, nextRound).state).toBe("break");
  });

  it("is BREAK with no fixtures and a distant next round", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    const nextRound = now + BREAK_GAP_MS + DAY;
    expect(deriveMatchweekView(round("2026-11-20T20:00:00Z"), [], now, nextRound).state).toBe("break");
  });

  it("does not flip to BREAK when the next round is only a week away", () => {
    const fx = standardWeek().map((f) => ({
      ...f, status: "completed" as const, homeScore: 1, awayScore: 0,
    }));
    const now = SAT_3PM + 3 * HOUR;
    const nextRound = now + 6 * DAY;   // normal weekly gap
    expect(deriveMatchweekView(r, fx, now, nextRound).state).toBe("results");
  });
});

describe("deriveMatchweekView — progress counting", () => {
  const r = round(new Date(FRI_8PM).toISOString());
  const now = FRI_8PM - DAY;   // OPEN

  it("counts outstanding as predictable-and-unpredicted", () => {
    const fx = standardWeek();
    fx[0] = { ...fx[0], myPrediction: { homeScore: 1, awayScore: 0, pointsAwarded: null } };
    const v = deriveMatchweekView(r, fx, now);
    expect(v.total).toBe(6);
    expect(v.predicted).toBe(1);
    expect(v.outstanding).toBe(5);
  });

  it("🔴 does not count a locked fixture as outstanding", () => {
    // The Friday match has kicked off; it is no longer predictable, so it must
    // not appear in "you still have N to predict".
    const fx = standardWeek();
    const now2 = FRI_8PM + 10 * 60_000;   // Friday match locked, Saturday open
    const v = deriveMatchweekView(r, fx, now2);
    expect(v.predictable).toBe(5);        // only the Saturday matches
    expect(v.outstanding).toBe(5);
    // The Friday match is not predictable and was never predicted — but it is
    // NOT counted as something the user can still act on.
  });

  it("reports zero outstanding once all open fixtures are predicted", () => {
    const fx = standardWeek().map((f) => ({
      ...f, myPrediction: { homeScore: 1, awayScore: 1, pointsAwarded: null },
    }));
    expect(deriveMatchweekView(r, fx, now).outstanding).toBe(0);
  });
});

describe("stateHeadline & statePrimaryAction", () => {
  const r = round(new Date(FRI_8PM).toISOString());

  it("OPEN with outstanding predictions asks the user to predict", () => {
    const v = deriveMatchweekView(r, standardWeek(), FRI_8PM - DAY);
    const action = statePrimaryAction(v);
    expect(action.kind).toBe("predict");
    expect(action.label).toMatch(/Predict 6/);
  });

  it("OPEN with everything predicted offers editing, not predicting-more", () => {
    const fx = standardWeek().map((f) => ({
      ...f, myPrediction: { homeScore: 1, awayScore: 0, pointsAwarded: null },
    }));
    const v = deriveMatchweekView(r, fx, FRI_8PM - DAY);
    expect(statePrimaryAction(v).label).toMatch(/Edit/);
  });

  it("RESULTS points at the results", () => {
    const fx = standardWeek().map((f) => ({
      ...f, status: "completed" as const, homeScore: 1, awayScore: 0,
    }));
    const v = deriveMatchweekView(r, fx, SAT_3PM + 3 * HOUR);
    expect(statePrimaryAction(v).kind).toBe("results");
  });

  it("OPEN headline shows the challenge-lock countdown", () => {
    const v = deriveMatchweekView(r, standardWeek(), FRI_8PM - 2 * HOUR);
    expect(stateHeadline(v, FRI_8PM - 2 * HOUR)).toMatch(/Locks in 02h/);
  });
});

describe("isFixturePredictable", () => {
  it("is open only while scheduled and before kickoff", () => {
    const f = fixture({ kicksOffAt: new Date(SAT_3PM).toISOString() });
    expect(isFixturePredictable(f, SAT_3PM - HOUR)).toBe(true);
    expect(isFixturePredictable(f, SAT_3PM + 1)).toBe(false);
  });

  it("is closed once live even if the clock says otherwise", () => {
    const f = fixture({ kicksOffAt: new Date(SAT_3PM).toISOString(), status: "live" });
    expect(isFixturePredictable(f, SAT_3PM - HOUR)).toBe(false);
  });
});

describe("formatCountdown", () => {
  it("shows days when far out", () => {
    expect(formatCountdown(DAY * 2 + HOUR * 4 + 60_000 * 11, 0)).toBe("2d 04h 11m");
  });
  it("drops to hours inside a day", () => {
    expect(formatCountdown(HOUR * 4 + 60_000 * 11, 0)).toBe("04h 11m");
  });
  it("drops to minutes and seconds in the last hour", () => {
    expect(formatCountdown(60_000 * 11 + 30_000, 0)).toBe("11m 30s");
  });
  it("never goes negative", () => {
    expect(formatCountdown(0, DAY)).toBe("00m 00s");
  });
});

// ── H/D/A prediction model ────────────────────────────────────

describe("outcome ↔ score", () => {
  it("maps each outcome to its modal scoreline", () => {
    expect(DEFAULT_SCORELINE.home).toEqual({ home: 1, away: 0 });
    expect(DEFAULT_SCORELINE.draw).toEqual({ home: 1, away: 1 });
    expect(DEFAULT_SCORELINE.away).toEqual({ home: 0, away: 1 });
  });

  it("reads the outcome from any scoreline", () => {
    expect(outcomeOf({ home: 3, away: 1 })).toBe("home");
    expect(outcomeOf({ home: 0, away: 0 })).toBe("draw");
    expect(outcomeOf({ home: 1, away: 2 })).toBe("away");
  });

  it("🔴 keeps an exact score when the tapped outcome still matches", () => {
    // Re-tapping "Home" on an existing 3-1 must NOT reset it to 1-0 — that
    // would throw away a considered prediction and the chance at a 5.
    expect(scoreForOutcome("home", { home: 3, away: 1 })).toEqual({ home: 3, away: 1 });
  });

  it("drops to the default only when the outcome actually changes", () => {
    expect(scoreForOutcome("away", { home: 3, away: 1 })).toEqual({ home: 0, away: 1 });
    expect(scoreForOutcome("draw", { home: 3, away: 1 })).toEqual({ home: 1, away: 1 });
  });

  it("uses the default when there is no existing pick", () => {
    expect(scoreForOutcome("home", null)).toEqual({ home: 1, away: 0 });
  });

  it("reads the selected outcome off a fixture's prediction", () => {
    const f = fixture({ kicksOffAt: new Date(SAT_3PM).toISOString(),
                        myPrediction: { homeScore: 2, awayScore: 2, pointsAwarded: null } });
    expect(selectedOutcome(f)).toBe("draw");
  });

  it("returns null selected outcome when unpredicted", () => {
    expect(selectedOutcome(fixture({ kicksOffAt: new Date(SAT_3PM).toISOString() }))).toBeNull();
  });
});

describe("goal bounds", () => {
  it("clamps to the DB's 0–20 CHECK", () => {
    expect(clampGoals(-3)).toBe(0);
    expect(clampGoals(25)).toBe(20);
    expect(clampGoals(2.6)).toBe(3);
  });
  it("steps within bounds", () => {
    expect(stepGoals(0, -1)).toBe(0);
    expect(stepGoals(20, 1)).toBe(20);
    expect(stepGoals(1, 1)).toBe(2);
  });
});

// ── Bulk helpers ──────────────────────────────────────────────

describe("copyFromPreviousRound", () => {
  const now = SAT_3PM - DAY;   // this week still open

  it("copies by team match-up, re-orienting home/away", () => {
    // Last week: Arsenal(H) 2-1 Chelsea(A).
    const prev = [fixture({
      id: "p1", kicksOffAt: "2026-11-14T15:00:00Z",
      homeTeam: team("ARS", "Arsenal"), awayTeam: team("CHE", "Chelsea"),
      myPrediction: { homeScore: 2, awayScore: 1, pointsAwarded: null },
    })];
    // This week the SAME pair, reversed: Chelsea(H) v Arsenal(A).
    const current = [fixture({
      id: "c1", kicksOffAt: new Date(SAT_3PM).toISOString(),
      homeTeam: team("CHE", "Chelsea"), awayTeam: team("ARS", "Arsenal"),
    })];

    const out = copyFromPreviousRound(current, prev, now);
    expect(out).toHaveLength(1);
    // Arsenal won 2-1 last week; Arsenal is now away, so 1-2 to the home side.
    expect(out[0]).toEqual({ fixtureId: "c1", pick: { home: 1, away: 2 } });
  });

  it("never overwrites an existing prediction", () => {
    const prev = [fixture({ id: "p", kicksOffAt: "2026-11-14T15:00:00Z",
      myPrediction: { homeScore: 3, awayScore: 0, pointsAwarded: null } })];
    const current = [fixture({ id: "c", kicksOffAt: new Date(SAT_3PM).toISOString(),
      myPrediction: { homeScore: 1, awayScore: 1, pointsAwarded: null } })];
    expect(copyFromPreviousRound(current, prev, now)).toEqual([]);
  });

  it("never touches a locked fixture", () => {
    const prev = [fixture({ id: "p", kicksOffAt: "2026-11-14T15:00:00Z",
      myPrediction: { homeScore: 3, awayScore: 0, pointsAwarded: null } })];
    const current = [fixture({ id: "c", kicksOffAt: new Date(SAT_3PM).toISOString(), status: "live" })];
    expect(copyFromPreviousRound(current, prev, now)).toEqual([]);
  });
});

describe("fillRemaining", () => {
  it("fills only open, unpredicted fixtures with the given scoreline", () => {
    const fx = [
      fixture({ id: "a", kicksOffAt: new Date(SAT_3PM).toISOString() }),
      fixture({ id: "b", kicksOffAt: new Date(SAT_3PM).toISOString(),
                myPrediction: { homeScore: 2, awayScore: 0, pointsAwarded: null } }),
      fixture({ id: "c", kicksOffAt: new Date(SAT_3PM).toISOString(), status: "live" }),
    ];
    const out = fillRemaining(fx, SAT_3PM - DAY);
    expect(out).toEqual([{ fixtureId: "a", pick: { home: 1, away: 1 } }]);
  });
});

// ── Grouping and progress ─────────────────────────────────────

describe("groupByKickoff", () => {
  it("groups fixtures into kickoff slots and marks the first as the lock", () => {
    const groups = groupByKickoff(standardWeek(), "UTC");
    expect(groups).toHaveLength(2);          // Fri 20:00, Sat 15:00
    expect(groups[0].fixtures).toHaveLength(1);
    expect(groups[0].locksFirst).toBe(true);
    expect(groups[1].fixtures).toHaveLength(5);
    expect(groups[1].locksFirst).toBe(false);
  });

  it("orders groups chronologically", () => {
    const groups = groupByKickoff(standardWeek(), "UTC");
    expect(groups[0].kickoffMs).toBeLessThan(groups[1].kickoffMs);
  });
});

describe("sheetProgress", () => {
  it("is complete when every open fixture has a pick", () => {
    const fx = standardWeek().map((f) => ({
      ...f, myPrediction: { homeScore: 1, awayScore: 1, pointsAwarded: null },
    }));
    const p = sheetProgress(fx, FRI_8PM - DAY);
    expect(p.complete).toBe(true);
    expect(p.predicted).toBe(6);
  });

  it("is incomplete while an open fixture is unpicked", () => {
    const p = sheetProgress(standardWeek(), FRI_8PM - DAY);
    expect(p.complete).toBe(false);
    expect(p.predictable).toBe(6);
  });

  it("🔴 is complete even with unpicked LOCKED fixtures — you cannot act on them", () => {
    // Friday match locked and unpicked; all Saturday matches picked. The user
    // has done everything they still can, so the sheet is 'complete' and must
    // not nag about the Friday match.
    const fx = standardWeek();
    const now = FRI_8PM + 10 * 60_000;
    for (let i = 1; i < fx.length; i++) {
      fx[i] = { ...fx[i], myPrediction: { homeScore: 1, awayScore: 0, pointsAwarded: null } };
    }
    const p = sheetProgress(fx, now);
    expect(p.locked).toBe(1);
    expect(p.complete).toBe(true);
  });
});
