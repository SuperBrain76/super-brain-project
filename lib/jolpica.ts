/**
 * lib/jolpica.ts — Jolpica-F1 result provider (the Ergast successor).
 *
 * Third ingestion provider, for ordering fixtures (F1). Unlike API-Football
 * and TheSportsDB this is NOT a live feed: a session's classification appears
 * some time after it ends and never changes shape — so there is no live
 * write path, and the cron keeps polling a finished-but-unsettled session
 * (up to a window) instead of only during play. Free, no auth; rate limits
 * (4 req/s, 500 req/h unauthenticated) are far above our gate-before-poll
 * usage. Cloudflare fronts the API, so every request sends a real
 * User-Agent.
 *
 * Fixture identity: F1 has no provider event ids, so provider_fixture_id is
 * CONSTRUCTED and deterministic — "f1-<season>-<round>-<q|r>" (e.g.
 * "f1-2026-13-q" = Italian GP qualifying). The importer writes these at seed
 * time and this module parses them back; the id embeds everything a fetch
 * needs, honouring the no-guessing routing rule (docs/FIXTURE_IDENTITY_RISK).
 *
 * Driver identity: Jolpica driverId → FIA code via lib/f1/drivers2026.ts.
 * An entrant the feed names that the registry cannot map FAILS the
 * settlement loudly — a wrong board must never settle (same posture as
 * settle_ordering_fixture's own team check).
 */

const BASE = "https://api.jolpi.ca/ergast/f1";
const USER_AGENT = "SuperBrain/1.0 (+https://superbrain.social)";

export type F1Session = "q" | "r";

export interface F1ProviderId {
  season: string;   // "2026"
  round:  number;   // 13
  session: F1Session;
}

/** "f1-2026-13-q" → parts, or null for any non-F1 provider id. */
export function parseF1ProviderId(id: string | null | undefined): F1ProviderId | null {
  if (!id) return null;
  const m = /^f1-(\d{4})-(\d{1,2})-(q|r)$/.exec(id);
  if (!m) return null;
  return { season: m[1], round: Number(m[2]), session: m[3] as F1Session };
}

export function makeF1ProviderId(season: string | number, round: number, session: F1Session): string {
  return `f1-${season}-${round}-${session}`;
}

/** One classified entrant of a session, in provider identity. */
export interface JolpicaClassifiedRow {
  driverId: string;        // Jolpica/Ergast driverId — map via F1_JOLPICA_TO_CODE
  position: number;        // 1-based classification order
  status:   string | null; // "Finished", "Retired", "+1 Lap", … (race only)
}

export interface JolpicaStandingRow {
  position: number;
  points:   number;
  wins:     number;
  name:     string;          // display name
  driverId: string | null;   // drivers only
  code:     string | null;   // FIA code (drivers only)
}

async function fetchJson(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Jolpica HTTP ${res.status} for ${path}`);
  return res.json();
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Ergast JSON is deeply nested and untyped */
function raceTable(json: Record<string, unknown>): any | null {
  const races = (json as any)?.MRData?.RaceTable?.Races;
  return Array.isArray(races) && races.length > 0 ? races[0] : null;
}

/**
 * Race classification for one round. Empty array = not published yet
 * (Jolpica returns an empty Races list until results land).
 */
export async function fetchJolpicaRaceResults(season: string, round: number): Promise<JolpicaClassifiedRow[]> {
  const race = raceTable(await fetchJson(`${season}/${round}/results.json?limit=40`));
  const rows: any[] = race?.Results ?? [];
  return rows
    .map((x) => ({
      driverId: String(x?.Driver?.driverId ?? ""),
      position: Number(x?.position),
      status:   x?.status != null ? String(x.status) : null,
    }))
    .filter((x) => x.driverId && Number.isFinite(x.position));
}

/** Qualifying classification for one round. Empty = not published yet. */
export async function fetchJolpicaQualifying(season: string, round: number): Promise<JolpicaClassifiedRow[]> {
  const race = raceTable(await fetchJson(`${season}/${round}/qualifying.json?limit=40`));
  const rows: any[] = race?.QualifyingResults ?? [];
  return rows
    .map((x) => ({
      driverId: String(x?.Driver?.driverId ?? ""),
      position: Number(x?.position),
      status:   null,
    }))
    .filter((x) => x.driverId && Number.isFinite(x.position));
}

export async function fetchJolpicaDriverStandings(season: string): Promise<{ round: number; rows: JolpicaStandingRow[] }> {
  const json = await fetchJson(`${season}/driverstandings.json?limit=40`);
  const list = (json as any)?.MRData?.StandingsTable?.StandingsLists?.[0];
  const rows: any[] = list?.DriverStandings ?? [];
  return {
    round: Number(list?.round ?? 0),
    rows: rows.map((x) => ({
      position: Number(x?.position),
      points:   Number(x?.points ?? 0),
      wins:     Number(x?.wins ?? 0),
      name:     `${x?.Driver?.givenName ?? ""} ${x?.Driver?.familyName ?? ""}`.trim(),
      driverId: x?.Driver?.driverId ? String(x.Driver.driverId) : null,
      code:     x?.Driver?.code ? String(x.Driver.code) : null,
    })).filter((x) => Number.isFinite(x.position) && x.name),
  };
}

export async function fetchJolpicaConstructorStandings(season: string): Promise<{ round: number; rows: JolpicaStandingRow[] }> {
  const json = await fetchJson(`${season}/constructorstandings.json?limit=20`);
  const list = (json as any)?.MRData?.StandingsTable?.StandingsLists?.[0];
  const rows: any[] = list?.ConstructorStandings ?? [];
  return {
    round: Number(list?.round ?? 0),
    rows: rows.map((x) => ({
      position: Number(x?.position),
      points:   Number(x?.points ?? 0),
      wins:     Number(x?.wins ?? 0),
      name:     String(x?.Constructor?.name ?? ""),
      driverId: null,
      code:     null,
    })).filter((x) => Number.isFinite(x.position) && x.name),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Is a classification complete enough to settle on?
 *
 * The SQL gate needs the top 5; this stricter provider-side gate also
 * requires most of the field to be classified, so a partially-published
 * board (a mid-upload snapshot) is never treated as final. F1 classifies
 * every starter including retirees, so a real final board has ~20+ rows.
 */
export const MIN_CLASSIFIED_ROWS = 15;

export function isCompleteClassification(rows: JolpicaClassifiedRow[]): boolean {
  if (rows.length < MIN_CLASSIFIED_ROWS) return false;
  const positions = new Set(rows.map((r) => r.position));
  for (let p = 1; p <= 5; p++) if (!positions.has(p)) return false;
  return true;
}
