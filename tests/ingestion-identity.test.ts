/**
 * Fixture identity — the decisive test for the Premier League.
 *
 * The World Cup's ingestion was safe because its matches are >=3 hours
 * apart, not because the matching code was correct. Ten Premier League
 * matches kick off at 15:00 on a Saturday. These tests encode that
 * scenario. See docs/FIXTURE_IDENTITY_RISK.md.
 */

import { describe, it, expect } from "vitest";
import {
  findDbFixtureByProviderId,
  matchProviderFixture,
  findFixtureForBackfill,
  isReversed,
  isInIngestWindow,
  getPollReason,
  extractScore,
  mapStatus,
  providerQuery,
  normalizeTeamName,
  type DbFixture,
  type BackfillCandidate,
  type CompetitionIngestConfig,
  type ApiFootballFixture,
} from "@/lib/ingestion";

// ── Fixtures: a Premier League Saturday ──────────────────────
// Ten matches, all kicking off at exactly 15:00 UTC.

const SATURDAY_3PM = "2026-08-15T15:00:00.000Z";

const PL_CLUBS: [string, string][] = [
  ["Arsenal", "Burnley"],
  ["Chelsea", "Everton"],
  ["Liverpool", "Fulham"],
  ["Manchester City", "Brentford"],
  ["Manchester United", "Wolves"],
  ["Newcastle", "Brighton"],
  ["Tottenham", "Crystal Palace"],
  ["Aston Villa", "Bournemouth"],
  ["West Ham", "Nottingham Forest"],
  ["Leeds", "Sunderland"],
];

function simultaneousFixtures(withProviderIds = true): DbFixture[] {
  return PL_CLUBS.map((_, i) => ({
    id:                  `db-fixture-${i}`,
    kicks_off_at:        SATURDAY_3PM,
    home_score:          null,
    away_score:          null,
    status:              "scheduled",
    provider_fixture_id: withProviderIds ? `provider-${i}` : null,
    home_team_id:        `home-${i}`,
    away_team_id:        `away-${i}`,
  }));
}

describe("findDbFixtureByProviderId", () => {
  it("routes every result to its own fixture when ten kick off simultaneously", () => {
    const db = simultaneousFixtures();

    // Provider returns them in arbitrary order — reversed, to be awkward.
    const providerIds = db.map((f) => f.provider_fixture_id!).reverse();

    const routed = providerIds.map((pid) => findDbFixtureByProviderId(pid, db));

    // Every result found a fixture...
    expect(routed.every((f) => f !== undefined)).toBe(true);
    // ...and each one a DIFFERENT fixture. This is the assertion that
    // kickoff-proximity matching fails: it would return db[0] ten times.
    const ids = new Set(routed.map((f) => f!.id));
    expect(ids.size).toBe(10);
  });

  it("maps each provider id to the correct fixture, not merely a distinct one", () => {
    const db = simultaneousFixtures();
    for (let i = 0; i < db.length; i++) {
      expect(findDbFixtureByProviderId(`provider-${i}`, db)!.id).toBe(`db-fixture-${i}`);
    }
  });

  it("accepts a numeric provider id (the API returns numbers)", () => {
    const db: DbFixture[] = [{
      id: "a", kicks_off_at: SATURDAY_3PM, home_score: null, away_score: null,
      status: "scheduled", provider_fixture_id: "1035432",
    }];
    expect(findDbFixtureByProviderId(1035432, db)?.id).toBe("a");
  });

  it("returns undefined rather than guessing when the id is unknown", () => {
    expect(findDbFixtureByProviderId("nope", simultaneousFixtures())).toBeUndefined();
  });
});

describe("matchProviderFixture", () => {
  it("never falls back to closest-kickoff when the id is unknown", () => {
    const outcome = matchProviderFixture("unknown-id", simultaneousFixtures());
    expect(outcome.kind).toBe("not_ours");
    expect(outcome).not.toHaveProperty("fixture");
  });

  it("reports unmapped separately from untracked, so the cause is actionable", () => {
    // No fixture carries a provider id → the backfill has not been run.
    const outcome = matchProviderFixture("provider-0", simultaneousFixtures(false));
    expect(outcome.kind).toBe("unmapped");
    if (outcome.kind === "unmapped") {
      expect(outcome.reason).toMatch(/backfill/i);
    }
  });

  it("matches when the id is known", () => {
    const outcome = matchProviderFixture("provider-7", simultaneousFixtures());
    expect(outcome.kind).toBe("matched");
    if (outcome.kind === "matched") expect(outcome.fixture.id).toBe("db-fixture-7");
  });
});

// ── Backfill matching ────────────────────────────────────────

describe("findFixtureForBackfill", () => {
  function candidates(): BackfillCandidate[] {
    return PL_CLUBS.map(([home, away], i) => ({
      id: `db-fixture-${i}`,
      kicks_off_at: SATURDAY_3PM,
      home_score: null, away_score: null, status: "scheduled",
      provider_fixture_id: null,
      home_team_name: home,
      away_team_name: away,
    }));
  }

  it("resolves each simultaneous fixture by BOTH team names", () => {
    const db = candidates();
    for (let i = 0; i < PL_CLUBS.length; i++) {
      const [home, away] = PL_CLUBS[i];
      const res = findFixtureForBackfill(
        { kickoffIso: SATURDAY_3PM, homeName: home, awayName: away }, db,
      );
      expect(res.fixture?.id).toBe(`db-fixture-${i}`);
    }
  });

  it("matches when the provider lists the fixture the other way round", () => {
    const res = findFixtureForBackfill(
      { kickoffIso: SATURDAY_3PM, homeName: "Burnley", awayName: "Arsenal" },
      candidates(),
    );
    expect(res.fixture?.id).toBe("db-fixture-0");
  });

  it("refuses to guess when two candidates are indistinguishable", () => {
    const dupes: BackfillCandidate[] = [
      { id: "x", kicks_off_at: SATURDAY_3PM, home_score: null, away_score: null,
        status: "scheduled", home_team_name: "Arsenal", away_team_name: "Burnley" },
      { id: "y", kicks_off_at: SATURDAY_3PM, home_score: null, away_score: null,
        status: "scheduled", home_team_name: "Arsenal", away_team_name: "Burnley" },
    ];
    const res = findFixtureForBackfill(
      { kickoffIso: SATURDAY_3PM, homeName: "Arsenal", awayName: "Burnley" }, dupes,
    );
    expect(res.fixture).toBeNull();
    expect((res as { reason: string }).reason).toMatch(/AMBIGUOUS/);
  });

  it("does not match on one team alone", () => {
    // Old ingest route matched if EITHER team lined up. "Arsenal v Chelsea"
    // must not resolve to "Arsenal v Burnley".
    const res = findFixtureForBackfill(
      { kickoffIso: SATURDAY_3PM, homeName: "Arsenal", awayName: "Chelsea" },
      candidates(),
    );
    expect(res.fixture).toBeNull();
  });

  it("absorbs the ±90 minute seeded-time tolerance", () => {
    const res = findFixtureForBackfill(
      { kickoffIso: "2026-08-15T16:20:00.000Z", homeName: "Arsenal", awayName: "Burnley" },
      candidates(),
    );
    expect(res.fixture?.id).toBe("db-fixture-0");
  });

  it("rejects a match outside the tolerance", () => {
    const res = findFixtureForBackfill(
      { kickoffIso: "2026-08-15T18:00:00.000Z", homeName: "Arsenal", awayName: "Burnley" },
      candidates(),
    );
    expect(res.fixture).toBeNull();
  });

  it("normalises accented and alternate country names", () => {
    expect(normalizeTeamName("Türkiye")).toBe(normalizeTeamName("Turkey"));
    expect(normalizeTeamName("Czechia")).toBe(normalizeTeamName("Czech Republic"));
    expect(normalizeTeamName("Côte d'Ivoire")).toBe(normalizeTeamName("Ivory Coast"));
  });
});

describe("isReversed", () => {
  it("detects a provider listing the fixture the other way round", () => {
    expect(isReversed("Burnley", "Arsenal")).toBe(true);
    expect(isReversed("Arsenal", "Arsenal")).toBe(false);
  });

  it("does not claim a reversal when the DB name is unknown", () => {
    expect(isReversed("Arsenal", null)).toBe(false);
    expect(isReversed("Arsenal", undefined)).toBe(false);
  });
});

// ── Ingest window ────────────────────────────────────────────

describe("isInIngestWindow", () => {
  const now = new Date("2026-08-15T15:30:00.000Z").getTime();

  it("is open when a fixture is near now", () => {
    expect(isInIngestWindow(simultaneousFixtures(), now)).toBe(true);
  });

  it("is closed when the nearest fixture is days away", () => {
    const far = simultaneousFixtures().map((f) => ({ ...f, kicks_off_at: "2026-09-20T15:00:00.000Z" }));
    expect(isInIngestWindow(far, now)).toBe(false);
  });

  it("is closed for an empty fixture list", () => {
    expect(isInIngestWindow([], now)).toBe(false);
  });

  it("reopens for a NEW season — the bug the old date constants had", () => {
    // TOURNAMENT_END_MS was 2026-07-20, so ingestion became a permanent
    // no-op. A derived window must open again for any future fixture.
    const nextSeason = new Date("2027-08-14T15:00:00.000Z").getTime();
    const fixtures2027 = simultaneousFixtures().map((f) => ({
      ...f, kicks_off_at: "2027-08-14T15:00:00.000Z",
    }));
    expect(isInIngestWindow(fixtures2027, nextSeason)).toBe(true);
  });
});

// ── Preserved behaviour (characterization) ───────────────────
// These must not change. They pin the World Cup's proven semantics.

describe("preserved: getPollReason", () => {
  const base: DbFixture = {
    id: "f", kicks_off_at: SATURDAY_3PM, home_score: null, away_score: null, status: "scheduled",
  };

  it("polls when the DB says live", () => {
    expect(getPollReason([{ ...base, status: "live" }])).toBe("live_match");
  });

  it("polls for a match started within 3h and not finished", () => {
    const now = new Date("2026-08-15T16:00:00.000Z").getTime();
    expect(getPollReason([base], now)).toBe("match_in_progress");
  });

  it("polls within 30 minutes of kickoff", () => {
    const now = new Date("2026-08-15T14:45:00.000Z").getTime();
    expect(getPollReason([base], now)).toBe("kickoff_imminent");
  });

  it("does not poll between matches", () => {
    const now = new Date("2026-08-15T10:00:00.000Z").getTime();
    expect(getPollReason([base], now)).toBeNull();
  });

  it("does not poll for a completed match", () => {
    const now = new Date("2026-08-15T16:00:00.000Z").getTime();
    expect(getPollReason([{ ...base, status: "completed" }], now)).toBeNull();
  });
});

describe("preserved: extractScore — 90-minute result only", () => {
  function apiFixture(short: string, opts: Partial<{
    ft: [number | null, number | null];
    goals: [number | null, number | null];
    pen: [number | null, number | null];
  }> = {}): ApiFootballFixture {
    const [fh, fa] = opts.ft    ?? [null, null];
    const [gh, ga] = opts.goals ?? [null, null];
    const [ph, pa] = opts.pen   ?? [null, null];
    return {
      fixture: { id: 1, date: SATURDAY_3PM, status: { short } },
      teams:   { home: { id: 1, name: "A" }, away: { id: 2, name: "B" } },
      goals:   { home: gh, away: ga },
      score:   {
        fulltime:  { home: fh, away: fa },
        extratime: { home: null, away: null },
        penalty:   { home: ph, away: pa },
      },
    };
  }

  it("uses fulltime for FT", () => {
    expect(extractScore(apiFixture("FT", { ft: [2, 1], goals: [2, 1] })))
      .toEqual({ homeScore: 2, awayScore: 1 });
  });

  it("uses the 90-minute draw for AET, not the extra-time winner", () => {
    expect(extractScore(apiFixture("AET", { ft: [1, 1], goals: [2, 1] })))
      .toEqual({ homeScore: 1, awayScore: 1 });
  });

  it("never stores penalty shootout goals", () => {
    const s = extractScore(apiFixture("PEN", { ft: [0, 0], goals: [0, 0], pen: [4, 3] }));
    expect(s).toEqual({ homeScore: 0, awayScore: 0 });
  });

  it("returns nulls for a match that has not started", () => {
    expect(extractScore(apiFixture("NS"))).toEqual({ homeScore: null, awayScore: null });
  });

  it("returns nulls for a postponed match", () => {
    expect(extractScore(apiFixture("PST"))).toEqual({ homeScore: null, awayScore: null });
  });

  it("returns the running score while live (current behaviour, documented)", () => {
    expect(extractScore(apiFixture("2H", { goals: [1, 0] })))
      .toEqual({ homeScore: 1, awayScore: 0 });
  });
});

describe("preserved: mapStatus", () => {
  it.each([
    ["NS", "scheduled"], ["1H", "live"], ["HT", "live"], ["2H", "live"],
    ["ET", "live"], ["P", "live"], ["SUSP", "live"], ["INT", "live"],
    ["FT", "completed"], ["AET", "completed"], ["PEN", "completed"],
    ["AWD", "completed"], ["WO", "completed"],
    ["PST", "postponed"], ["CANC", "postponed"], ["ABD", "postponed"],
  ])("maps %s → %s", (short, expected) => {
    expect(mapStatus(short)).toBe(expected);
  });

  it("defaults unknown codes to scheduled rather than throwing", () => {
    expect(mapStatus("WHAT")).toBe("scheduled");
  });
});

// ── Competition configuration ────────────────────────────────

describe("providerQuery", () => {
  const cfg = (leagueId: number, season: number): CompetitionIngestConfig => ({
    competitionId: "c", slug: "s", provider: "api-football",
    providerLeagueId: leagueId, providerSeason: season,
    ingestEnabled: true, hasKnockout: false,
  });

  it("reproduces the World Cup's retired constant byte for byte", () => {
    // lib/ingestion.ts previously: const WC2026 = "league=1&season=2026"
    expect(providerQuery(cfg(1, 2026))).toBe("league=1&season=2026");
  });

  it("builds the Premier League query from configuration alone", () => {
    expect(providerQuery(cfg(39, 2026))).toBe("league=39&season=2026");
  });
});
