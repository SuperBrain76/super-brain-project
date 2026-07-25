/**
 * Path-based competition routing, and the CSV importer.
 *
 * `/[competition]` is a TOP-LEVEL dynamic segment, so a competition slug
 * shares a namespace with every application route. Most of this file exists
 * to make that collision impossible rather than unlikely.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RESERVED_SLUGS,
  isReservedSlug,
  isValidCompetitionSlug,
  slugifyCompetitionName,
  competitionPath,
  legacyPathToCompetitionPath,
} from "@/lib/competitionRoutes";
import { parseFixtureCsv } from "@/lib/competitionAdmin";

// ── Slug safety ───────────────────────────────────────────────

describe("reserved slugs", () => {
  it("blocks every top-level application route", () => {
    // A competition called "settings" would be permanently unreachable:
    // Next.js resolves static segments first, so /settings would always be
    // the settings page and the competition would silently 404.
    for (const route of ["admin", "api", "login", "settings", "tests", "battle", "leaderboard", "u", "iq"]) {
      expect(isReservedSlug(route)).toBe(true);
    }
  });

  it("blocks the legacy predictor prefix", () => {
    // /predict is the redirect route; a competition there would shadow it
    // and break every shared link at once.
    expect(isReservedSlug("predict")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isReservedSlug("Admin")).toBe(true);
    expect(isReservedSlug("SETTINGS")).toBe(true);
  });

  it("allows real competition names", () => {
    for (const slug of ["premier-league", "la-liga", "serie-a", "bundesliga", "wc2026", "ipl", "formula-1"]) {
      expect(isReservedSlug(slug)).toBe(false);
    }
  });

  it("🔴 matches the list enforced in migration 049", () => {
    // RESERVED_SLUGS is duplicated: TypeScript answers the wizard instantly,
    // Postgres is the real guard (it also catches a competition created by
    // hand in SQL). If they drift, one of them is wrong — and the dangerous
    // direction is the database being MORE permissive than the UI.
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/049_competition_wizard.sql"),
      "utf8",
    );

    const block = sql.split("if v_slug in (")[1]?.split(") then")[0] ?? "";
    const sqlSlugs = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);

    expect(sqlSlugs.length).toBeGreaterThan(0);
    expect([...sqlSlugs].sort()).toEqual([...RESERVED_SLUGS].sort());
  });
});

describe("isValidCompetitionSlug", () => {
  it("accepts lowercase words joined by single hyphens", () => {
    expect(isValidCompetitionSlug("premier-league")).toBe(true);
    expect(isValidCompetitionSlug("wc2026")).toBe(true);
    expect(isValidCompetitionSlug("formula-1")).toBe(true);
  });

  it("rejects anything that would not survive a URL", () => {
    for (const bad of [
      "Premier-League",   // uppercase
      "premier_league",   // underscore
      "premier league",   // space
      "-premier",         // leading hyphen
      "premier-",         // trailing hyphen
      "premier--league",  // doubled hyphen
      "premier/league",   // path separator — would invent a route
      "",
    ]) {
      expect(isValidCompetitionSlug(bad), bad).toBe(false);
    }
  });

  it("rejects reserved slugs even though they are well-formed", () => {
    expect(isValidCompetitionSlug("admin")).toBe(false);
  });
});

describe("slugifyCompetitionName", () => {
  it("produces the expected slug for the competitions actually planned", () => {
    expect(slugifyCompetitionName("Premier League")).toBe("premier-league");
    expect(slugifyCompetitionName("La Liga")).toBe("la-liga");
    expect(slugifyCompetitionName("Serie A")).toBe("serie-a");
    expect(slugifyCompetitionName("UEFA Champions League")).toBe("uefa-champions-league");
    expect(slugifyCompetitionName("Formula 1")).toBe("formula-1");
  });

  it("folds accents rather than dropping the letters", () => {
    // "Ligue 1 Uber Eats" style names and Turkish/Spanish競 competitions
    // must not lose characters silently.
    expect(slugifyCompetitionName("Süper Lig")).toBe("super-lig");
    expect(slugifyCompetitionName("Primeira Liga — Portugal")).toBe("primeira-liga-portugal");
  });

  it("collapses punctuation and trims stray hyphens", () => {
    expect(slugifyCompetitionName("  A.F.C.  Cup!! ")).toBe("a-f-c-cup");
  });

  it("always produces something a route can use", () => {
    const s = slugifyCompetitionName("Premier League");
    expect(isValidCompetitionSlug(s)).toBe(true);
  });
});

// ── Path builders ─────────────────────────────────────────────

describe("competitionPath", () => {
  it("puts the competition at the root, with no /predict prefix", () => {
    expect(competitionPath.hub("premier-league")).toBe("/premier-league");
    expect(competitionPath.leaderboard("premier-league")).toBe("/premier-league/leaderboard");
    expect(competitionPath.standings("la-liga")).toBe("/la-liga/standings");
    expect(competitionPath.leagues("wc2026")).toBe("/wc2026/leagues");
  });

  it("nests fixtures under an explicit segment", () => {
    // /premier-league/<uuid> would be ambiguous with /premier-league/leaderboard.
    expect(competitionPath.fixture("premier-league", "abc-123"))
      .toBe("/premier-league/fixture/abc-123");
  });

  it("builds nested league paths", () => {
    expect(competitionPath.league("la-liga", "lg-9")).toBe("/la-liga/leagues/lg-9");
    expect(competitionPath.leaguesDiscover("la-liga")).toBe("/la-liga/leagues/discover");
  });

  it("encodes the round parameter", () => {
    expect(competitionPath.round("premier-league", "mw 12")).toBe("/premier-league?round=mw%2012");
  });
});

// ── Legacy redirects ──────────────────────────────────────────

describe("legacyPathToCompetitionPath", () => {
  const SLUG = "premier-league";

  it("maps the bare prefix to the hub", () => {
    expect(legacyPathToCompetitionPath(SLUG, [])).toBe("/premier-league");
  });

  it("maps sub-pages one to one", () => {
    expect(legacyPathToCompetitionPath(SLUG, ["leaderboard"])).toBe("/premier-league/leaderboard");
    expect(legacyPathToCompetitionPath(SLUG, ["leagues"])).toBe("/premier-league/leagues");
    expect(legacyPathToCompetitionPath(SLUG, ["leagues", "discover"])).toBe("/premier-league/leagues/discover");
  });

  it("🔴 re-nests a bare fixture UUID under /fixture/", () => {
    // /predict/<uuid> was the old fixture URL. These are in shared WhatsApp
    // messages and sent emails and cannot be recalled — this is the one
    // non-mechanical case in the whole redirect.
    const uuid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    expect(legacyPathToCompetitionPath(SLUG, [uuid]))
      .toBe(`/premier-league/fixture/${uuid}`);
  });

  it("does not mistake a page name for a fixture id", () => {
    expect(legacyPathToCompetitionPath(SLUG, ["bracket"])).toBe("/premier-league/bracket");
  });

  it("preserves a league id in a deeper path", () => {
    expect(legacyPathToCompetitionPath(SLUG, ["leagues", "abc-123"]))
      .toBe("/premier-league/leagues/abc-123");
  });
});

// ── Fixture CSV ───────────────────────────────────────────────

describe("parseFixtureCsv", () => {
  const HEADER = "round,home,away,kicks_off_at,venue,provider_fixture_id";

  it("parses a well-formed matchweek", () => {
    const { rows, errors } = parseFixtureCsv(
      `${HEADER}\n1,ARS,BUR,2026-08-15T14:00:00Z,Emirates,1035432\n1,CHE,EVE,2026-08-15T14:00:00Z,Bridge,1035433`,
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      round: 1, home: "ARS", away: "BUR",
      venue: "Emirates", provider_fixture_id: "1035432",
    });
  });

  it("uppercases team codes so ars and ARS are the same club", () => {
    const { rows } = parseFixtureCsv(`${HEADER}\n1,ars,bur,2026-08-15T14:00:00Z,,`);
    expect(rows[0].home).toBe("ARS");
    expect(rows[0].away).toBe("BUR");
  });

  it("normalises kickoff times to ISO UTC", () => {
    const { rows } = parseFixtureCsv(`round,home,away,kicks_off_at\n1,ARS,BUR,2026-08-15T14:00:00Z`);
    expect(rows[0].kicks_off_at).toBe("2026-08-15T14:00:00.000Z");
  });

  it("accepts columns in any order", () => {
    const { rows, errors } = parseFixtureCsv(
      `away,kicks_off_at,round,home\nBUR,2026-08-15T14:00:00Z,1,ARS`,
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ round: 1, home: "ARS", away: "BUR" });
  });

  it("reports missing required columns rather than importing partial data", () => {
    const { rows, errors } = parseFixtureCsv(`round,home\n1,ARS`);
    expect(rows).toEqual([]);
    expect(errors[0]).toMatch(/Missing required column/);
  });

  it("🔴 skips only the bad line, keeping a 380-row paste usable", () => {
    const { rows, errors } = parseFixtureCsv(
      `${HEADER}\n1,ARS,BUR,2026-08-15T14:00:00Z,,\n1,CHE,EVE,not-a-date,,\n2,LIV,FUL,2026-08-22T14:00:00Z,,`,
    );
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Line 3/);
    expect(errors[0]).toMatch(/ISO 8601/);
  });

  it("rejects a row with no round number", () => {
    const { rows, errors } = parseFixtureCsv(`${HEADER}\nx,ARS,BUR,2026-08-15T14:00:00Z,,`);
    expect(rows).toEqual([]);
    expect(errors[0]).toMatch(/round is not a number/);
  });

  it("rejects a row missing a team", () => {
    const { errors } = parseFixtureCsv(`${HEADER}\n1,ARS,,2026-08-15T14:00:00Z,,`);
    expect(errors[0]).toMatch(/home and away are required/);
  });

  it("handles a header-only paste without throwing", () => {
    const { rows, errors } = parseFixtureCsv(HEADER);
    expect(rows).toEqual([]);
    expect(errors[0]).toMatch(/header row and at least one fixture/);
  });

  it("ignores blank lines and trailing newlines", () => {
    const { rows, errors } = parseFixtureCsv(
      `${HEADER}\n\n1,ARS,BUR,2026-08-15T14:00:00Z,,\n\n`,
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it("leaves optional columns unset rather than empty strings", () => {
    const { rows } = parseFixtureCsv(`round,home,away,kicks_off_at\n1,ARS,BUR,2026-08-15T14:00:00Z`);
    expect(rows[0].venue).toBeUndefined();
    expect(rows[0].provider_fixture_id).toBeUndefined();
  });

  it("keeps provider ids as strings so long numeric ids survive", () => {
    const { rows } = parseFixtureCsv(`${HEADER}\n1,ARS,BUR,2026-08-15T14:00:00Z,,9007199254740993`);
    expect(rows[0].provider_fixture_id).toBe("9007199254740993");
  });
});
