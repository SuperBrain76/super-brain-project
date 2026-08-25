/**
 * tests/rugby.test.ts — rugby sport support (added Aug 2026).
 *
 * Pins the three things rugby changed:
 *   1. Sport metadata — rugby exists, draws allowed, 0–100 score bounds,
 *      rugby default scorelines (a one-tap pick stores 24–17, not 1–0).
 *   2. Score clamps accept a per-sport max (migration 072 mirrors this in
 *      the DB trigger).
 *   3. League table — 4 pts a win, 2 a draw, losing bonus within 7.
 *      The try bonus is NOT computable (try counts aren't stored) and is
 *      deliberately absent.
 */

import { describe, it, expect } from "vitest";
import { SPORTS, sportOf, FOOTBALL } from "@/lib/sports";
import { clampGoals, stepGoals, scoreForOutcome } from "@/lib/matchweekPredictions";
import { computeLeagueTable } from "@/lib/leagueTable";
import { PREM_RUGBY_CLUBS } from "@/lib/rugby/prem";
import { ALL_CLUBS } from "@/lib/premierLeague/clubs";
import type { Fixture } from "@/lib/predictor";

const RUGBY = SPORTS.rugby;

describe("rugby sport metadata", () => {
  it("exists, allows draws, caps at 100", () => {
    expect(RUGBY).toBeDefined();
    expect(RUGBY.hasDraw).toBe(true);
    expect(RUGBY.maxScore).toBe(100);
    expect(RUGBY.scoreNoun).toBe("points");
  });

  it("sportOf resolves rugby and still falls back to football", () => {
    expect(sportOf("rugby")).toBe(RUGBY);
    expect(sportOf("underwater_hockey")).toBe(FOOTBALL);
  });

  it("one-tap picks store rugby scorelines, not football ones", () => {
    expect(scoreForOutcome("home", null, RUGBY.defaultScoreline)).toEqual({ home: 24, away: 17 });
    expect(scoreForOutcome("draw", null, RUGBY.defaultScoreline)).toEqual({ home: 20, away: 20 });
    // A kept score whose outcome matches survives the re-tap, as in football.
    expect(scoreForOutcome("home", { home: 31, away: 13 }, RUGBY.defaultScoreline)).toEqual({ home: 31, away: 13 });
  });

  it("clamps respect the per-sport max", () => {
    expect(clampGoals(85, RUGBY.maxScore)).toBe(85);   // fine for rugby
    expect(clampGoals(85)).toBe(20);                   // football unchanged
    expect(clampGoals(120, RUGBY.maxScore)).toBe(100);
    expect(stepGoals(100, 1, RUGBY.maxScore)).toBe(100);
  });
});

describe("rugby club registry", () => {
  it("has the 10 PREM 2026/27 clubs with globally unique codes", () => {
    expect(PREM_RUGBY_CLUBS).toHaveLength(10);
    const codes = new Map<string, number>();
    for (const c of ALL_CLUBS) codes.set(c.code, (codes.get(c.code) ?? 0) + 1);
    for (const c of PREM_RUGBY_CLUBS) expect(codes.get(c.code)).toBe(1);
  });
});

// Minimal fixture builder — only the fields computeLeagueTable reads.
function fx(home: string, away: string, hs: number | null, as: number | null): Fixture {
  return {
    id: `${home}-${away}`,
    homeTeam: { code: home, name: home },
    awayTeam: { code: away, name: away },
    homeScore: hs,
    awayScore: as,
    status: hs == null ? "scheduled" : "completed",
    kicksOffAt: "2026-09-26T14:00:00Z",
  } as unknown as Fixture;
}

describe("rugby league table", () => {
  it("scores 4 a win, 2 a draw, and the losing bonus within 7", () => {
    const rows = computeLeagueTable(
      [
        fx("BTH", "SAR", 24, 17),   // Bath win by 7 → Bath 4, Sarries 0 + losing bonus 1
        fx("TIG", "HAR", 31, 13),   // Tigers win by 18 → Tigers 4, Quins 0
        fx("EXE", "GLO", 20, 20),   // draw → 2 each
      ],
      RUGBY,
    );
    const pts = Object.fromEntries(rows.map((r) => [r.code, r.points]));
    expect(pts.BTH).toBe(4);
    expect(pts.SAR).toBe(1);   // the losing bonus
    expect(pts.TIG).toBe(4);
    expect(pts.HAR).toBe(0);
    expect(pts.EXE).toBe(2);
    expect(pts.GLO).toBe(2);
  });

  it("football tables are unchanged", () => {
    const rows = computeLeagueTable([fx("ARS", "CHE", 1, 0), fx("LIV", "TOT", 2, 2)]);
    const pts = Object.fromEntries(rows.map((r) => [r.code, r.points]));
    expect(pts.ARS).toBe(3);
    expect(pts.CHE).toBe(0);   // no losing bonus in football, however close
    expect(pts.LIV).toBe(1);
  });
});
