/**
 * Regression tests for outreach selection order.
 *
 * On 2026-08-25 the sync route ordered by fit_score alone. Five venues were
 * approved from a ranked list; the push then selected a different five, because
 * Postgres was free to return tied rows in any order. Nothing was sent — the
 * campaign was paused — but two businesses that were never approved had been
 * queued for contact.
 *
 * These tests fail if selection order ever becomes non-deterministic again, or
 * if the dry-run roster can differ from the pushed roster.
 */
import { describe, it, expect } from "vitest";
import { compareVenues, rankVenues, selectForOutreach, SELECTION_ORDER } from "@/lib/outreachRanking";

type V = { id: string; name: string; fit_score: number | null; shows_live_sport?: boolean | null };

/** The five approved on 2026-08-25, plus the two the old code wrongly picked. */
const TIED: V[] = [
  { id: "id-oxnoble",   name: "The Oxnoble",                  fit_score: 75, shows_live_sport: false },
  { id: "id-nordic",    name: "Nordic Bar",                   fit_score: 75, shows_live_sport: true  },
  { id: "id-blood",     name: "BLOODsports",                  fit_score: 77, shows_live_sport: true  },
  { id: "id-duke",      name: "Duke of Edinburgh Brixton",    fit_score: 75, shows_live_sport: true  },
  { id: "id-frankies",  name: "Frankie's Sports Bar & Grill", fit_score: 77, shows_live_sport: true  },
  { id: "id-brigadier", name: "Brigadiers",                   fit_score: 75, shows_live_sport: true  },
  { id: "id-chequers",  name: "Chequers Walthamstow",         fit_score: 75, shows_live_sport: true  },
];

/** Deterministic shuffle, so a failure is reproducible. */
function shuffle<T>(xs: readonly T[], seed: number): T[] {
  const out = [...xs];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe("selection order is deterministic", () => {
  it("gives the same result whatever order rows arrive in", () => {
    const expected = rankVenues(TIED).map(v => v.id);
    for (let seed = 1; seed <= 200; seed++) {
      expect(rankVenues(shuffle(TIED, seed)).map(v => v.id)).toEqual(expected);
    }
  });

  it("orders by fit_score, then live sport, then name, then id", () => {
    expect(rankVenues(TIED).map(v => v.name)).toEqual([
      "BLOODsports",                  // 77
      "Frankie's Sports Bar & Grill", // 77
      "Brigadiers",                   // 75, live sport
      "Chequers Walthamstow",         // 75, live sport
      "Duke of Edinburgh Brixton",    // 75, live sport
      "Nordic Bar",                   // 75, live sport
      "The Oxnoble",                  // 75, NO live sport — last
    ]);
  });

  it("breaks a total tie on id, so ordering is total", () => {
    const same: V[] = [
      { id: "b", name: "Same Name", fit_score: 70, shows_live_sport: true },
      { id: "a", name: "Same Name", fit_score: 70, shows_live_sport: true },
    ];
    expect(rankVenues(same).map(v => v.id)).toEqual(["a", "b"]);
    expect(compareVenues(same[0], same[1])).toBeGreaterThan(0);
  });

  it("sorts null fit_score and null live-sport last, never first", () => {
    const withNulls: V[] = [
      { id: "n1", name: "No Score", fit_score: null, shows_live_sport: true },
      { id: "n2", name: "Scored",   fit_score: 10,   shows_live_sport: null },
    ];
    expect(rankVenues(withNulls).map(v => v.id)).toEqual(["n2", "n1"]);
  });
});

describe("the dry run and the real push select the same venues", () => {
  it("produces an identical roster for a tied set", () => {
    // Both paths call selectForOutreach with the same eligible set and limit.
    // The `dry` flag is read only when deciding whether to call pushLead.
    const dryRoster  = selectForOutreach(shuffle(TIED, 7),  5).map(v => v.id);
    const realRoster = selectForOutreach(shuffle(TIED, 99), 5).map(v => v.id);
    expect(dryRoster).toEqual(realRoster);
  });

  it("selects exactly the five approved on 2026-08-25", () => {
    expect(selectForOutreach(TIED, 5).map(v => v.name)).toEqual([
      "BLOODsports",
      "Frankie's Sports Bar & Grill",
      "Brigadiers",
      "Chequers Walthamstow",
      "Duke of Edinburgh Brixton",
    ]);
  });

  it("does NOT select the two the old fit_score-only ordering wrongly picked", () => {
    const picked = selectForOutreach(TIED, 5).map(v => v.name);
    expect(picked).not.toContain("Nordic Bar");
    expect(picked).not.toContain("The Oxnoble");
  });

  it("stays stable as the limit grows — the first five never change", () => {
    const five = selectForOutreach(TIED, 5).map(v => v.id);
    for (const n of [6, 7, 50]) {
      expect(selectForOutreach(TIED, n).slice(0, 5).map(v => v.id)).toEqual(five);
    }
  });

  it("never mutates the caller's array", () => {
    const input = [...TIED];
    const before = input.map(v => v.id);
    selectForOutreach(input, 3);
    expect(input.map(v => v.id)).toEqual(before);
  });
});

describe("the database order clauses match the comparator", () => {
  it("declares the same keys, in the same priority, as compareVenues", () => {
    expect(SELECTION_ORDER.map(o => o.column)).toEqual(
      ["fit_score", "shows_live_sport", "name", "id"],
    );
    expect(SELECTION_ORDER.map(o => o.ascending)).toEqual([false, false, true, true]);
  });
});
