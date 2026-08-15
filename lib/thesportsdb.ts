/**
 * lib/thesportsdb.ts — TheSportsDB result provider.
 *
 * A second ingestion provider alongside API-Football (lib/ingestion.ts). Our
 * fixtures already carry provider_fixture_id = TheSportsDB idEvent (set at
 * import), so results route by exact id — no name/kickoff guessing.
 *
 * Free tier gives finished results via eventspastleague (last ~15 finished
 * events in the league) and full matchweeks via eventsround; live in-play
 * scoring is premium (V2 /livescore) and is added later. So on the free tier
 * points land at full-time, which is correct and safe.
 *
 * Because we imported home/away FROM TheSportsDB, its results arrive in the
 * same orientation as our fixtures — no reversal handling needed (unlike the
 * API-Football path, whose orientation can differ from our seed).
 */

const BASE = "https://www.thesportsdb.com/api/v1/json";

/** A result normalized to what the cron's write path needs. */
export interface NormalizedResult {
  providerId:  string;                  // idEvent — routes to our fixture
  status:      "scheduled" | "live" | "completed" | "postponed";
  homeScore:   number | null;           // full-time result (null until known)
  awayScore:   number | null;
  homeName:    string;                  // for logging only
  awayName:    string;
  kickoffIso:  string;                  // UTC ISO
}

interface TsdbEvent {
  idEvent?:      string;
  strHomeTeam?:  string;
  strAwayTeam?:  string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strStatus?:    string | null;
  strProgress?:  string | null;   // V2 livescore uses this for the live phase
  strTimestamp?: string | null;
  dateEvent?:    string | null;
}

// TheSportsDB status strings → our DB status. Finished forms all map to
// completed; anything unrecognised stays scheduled (never invents a result).
const STATUS_MAP: Record<string, NormalizedResult["status"]> = {
  "NS": "scheduled", "Not Started": "scheduled", "TBD": "scheduled",
  "1H": "live", "2H": "live", "HT": "live", "ET": "live", "LIVE": "live", "Live": "live",
  "FT": "completed", "AET": "completed", "PEN": "completed",
  "Match Finished": "completed", "AP": "completed", "FT_PEN": "completed",
  "PP": "postponed", "Postponed": "postponed", "Cancelled": "postponed",
  "Canc.": "postponed", "Abandoned": "postponed",
};

export function mapTsdbStatus(raw: string | null | undefined): NormalizedResult["status"] {
  if (!raw) return "scheduled";
  return STATUS_MAP[raw] ?? STATUS_MAP[raw.trim()] ?? "scheduled";
}

function toScore(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function normalizeTsdbEvent(e: TsdbEvent): NormalizedResult | null {
  if (!e.idEvent) return null;
  const status = mapTsdbStatus(e.strStatus ?? e.strProgress);
  // A finished event with no score is unusable — leave scores null so the
  // cron writes only the status, never a fabricated 0-0.
  const finished = status === "completed" || status === "live";
  return {
    providerId: String(e.idEvent),
    status,
    homeScore:  finished ? toScore(e.intHomeScore) : null,
    awayScore:  finished ? toScore(e.intAwayScore) : null,
    homeName:   e.strHomeTeam ?? "",
    awayName:   e.strAwayTeam ?? "",
    kickoffIso: e.strTimestamp
      ? (/Z$/.test(e.strTimestamp) ? e.strTimestamp : `${e.strTimestamp}Z`)
      : `${e.dateEvent ?? ""}T00:00:00Z`,
  };
}

async function fetchEvents(path: string): Promise<TsdbEvent[]> {
  const res = await fetch(`${BASE}/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`TheSportsDB HTTP ${res.status}`);
  const json = await res.json();
  return (json.events as TsdbEvent[] | null) ?? [];
}

/** Recent finished results for a league (free tier V1). ~15 most recent. */
export async function fetchTsdbPastLeague(apiKey: string, leagueId: number): Promise<NormalizedResult[]> {
  const events = await fetchEvents(`${apiKey}/eventspastleague.php?id=${leagueId}`);
  return events.map(normalizeTsdbEvent).filter((r): r is NormalizedResult => r !== null);
}

const V2_BASE = "https://www.thesportsdb.com/api/v2/json";

async function fetchV2(path: string, apiKey: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${V2_BASE}/${path}`, { headers: { "X-API-KEY": apiKey }, cache: "no-store" });
  if (!res.ok) throw new Error(`TheSportsDB V2 HTTP ${res.status}`);
  return res.json();
}

/**
 * Results for the ingestion cron. A premium key uses V2 (header auth) — live
 * in-play scores + recent finals; the free key uses V1 finals only. Same
 * normalized shape either way, so the caller doesn't care which ran.
 */
export async function fetchTsdbResults(apiKey: string, leagueId: number): Promise<NormalizedResult[]> {
  const isPremium = apiKey && apiKey !== "123";
  if (!isPremium) return fetchTsdbPastLeague(apiKey, leagueId);

  const [prev, live] = await Promise.all([
    fetchV2(`schedule/previous/league/${leagueId}`, apiKey).catch(() => ({} as Record<string, unknown>)),
    fetchV2(`livescore/${leagueId}`, apiKey).catch(() => ({} as Record<string, unknown>)),
  ]);
  const events: TsdbEvent[] = [
    ...(Array.isArray(prev.schedule)  ? (prev.schedule  as TsdbEvent[]) : []),
    ...(Array.isArray(live.livescore) ? (live.livescore as TsdbEvent[]) : []),
  ];
  return events.map(normalizeTsdbEvent).filter((r): r is NormalizedResult => r !== null);
}

/** All events in one matchweek of a season (free tier). */
export async function fetchTsdbRound(apiKey: string, leagueId: number, round: number, season: string): Promise<NormalizedResult[]> {
  const events = await fetchEvents(`${apiKey}/eventsround.php?id=${leagueId}&r=${round}&s=${season}`);
  return events.map(normalizeTsdbEvent).filter((r): r is NormalizedResult => r !== null);
}
