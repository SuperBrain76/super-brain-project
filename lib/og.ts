/**
 * Server-side / Edge-safe helper for fetching challenge result data.
 * Uses a direct REST fetch instead of the Supabase JS client so it
 * works in both Node.js server components and edge OG image routes.
 */
export interface OGShareData {
  displayName:  string;
  score:        number;
  testName:     string;
  resultTitle:  string;
}

export async function fetchOGData(shareId: string): Promise<OGShareData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !shareId) return null;

  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_challenge_result`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        key,
        "Authorization": `Bearer ${key}`,
      },
      body:  JSON.stringify({ p_share_id: shareId }),
      next:  { revalidate: 3600 }, // cache OG data for 1 hour
    });
    if (!res.ok) return null;

    const data = await res.json();
    const row  = Array.isArray(data) ? data[0] : null;
    if (!row)  return null;

    return {
      displayName: (row.display_name as string) || "Someone",
      score:       Number(row.score),
      testName:    row.test_name as string,
      resultTitle: row.result_title as string,
    };
  } catch {
    return null;
  }
}

// ── League OG data ────────────────────────────────────────────

export interface LeagueOGData {
  id:          string;
  name:        string;
  memberCount: number;
  visibility:  "private" | "public";
}

async function fetchLeagueMemberCount(url: string, key: string, leagueId: string): Promise<number> {
  try {
    const res = await fetch(
      `${url}/rest/v1/prediction_league_members?league_id=eq.${leagueId}&select=user_id`,
      {
        headers: {
          "apikey":        key,
          "Authorization": `Bearer ${key}`,
          "Prefer":        "count=exact",
          "Range":         "0-0",
        },
        next: { revalidate: 300 },
      },
    );
    const range = res.headers.get("content-range"); // "0-0/12"
    return range ? parseInt(range.split("/")[1] ?? "0", 10) : 0;
  } catch {
    return 0;
  }
}

/** Fetch league OG data by invite code (used by join page metadata). */
export async function fetchLeagueOGByCode(code: string): Promise<LeagueOGData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !code) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/prediction_leagues?invite_code=eq.${encodeURIComponent(code.toUpperCase())}&select=id,name,visibility&limit=1`,
      {
        headers: {
          "apikey":        key,
          "Authorization": `Bearer ${key}`,
          "Accept":        "application/json",
        },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>[];
    const row  = data[0];
    if (!row) return null;

    const id          = row.id as string;
    const memberCount = await fetchLeagueMemberCount(url, key, id);

    return {
      id,
      name:        (row.name as string) || "League",
      memberCount,
      visibility:  (row.visibility as "private" | "public") ?? "private",
    };
  } catch {
    return null;
  }
}

/** Fetch league OG data by league ID (used by league detail OG image). */
export async function fetchLeagueOGById(leagueId: string): Promise<LeagueOGData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !leagueId) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/prediction_leagues?id=eq.${encodeURIComponent(leagueId)}&select=id,name,visibility&limit=1`,
      {
        headers: {
          "apikey":        key,
          "Authorization": `Bearer ${key}`,
          "Accept":        "application/json",
        },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>[];
    const row  = data[0];
    if (!row) return null;

    const id          = row.id as string;
    const memberCount = await fetchLeagueMemberCount(url, key, id);

    return {
      id,
      name:        (row.name as string) || "League",
      memberCount,
      visibility:  (row.visibility as "private" | "public") ?? "private",
    };
  } catch {
    return null;
  }
}

// ── Public profile OG data ────────────────────────────────────

export interface ProfileOGData {
  displayName: string;
  username: string;
  levelName: string | null;
  levelIcon: string | null;
  balance: number | null;
  currencyCode: string | null;
  achievements: number | null;
  isPublic: boolean;
}

/** Fetch minimal public-profile data for OG image + metadata (edge-safe). */
export async function fetchProfileOG(username: string): Promise<ProfileOGData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !username) return null;

  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_public_profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({ p_username: username }),
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d || !d.found) return null;

    return {
      displayName: (d.display_name as string) || "SuperBrain Member",
      username: (d.username as string) || username,
      levelName: d.level?.name ?? null,
      levelIcon: d.level?.icon ?? null,
      balance: d.balance ?? null,
      currencyCode: d.currency?.code ?? null,
      achievements: d.achievements?.unlocked ?? null,
      isPublic: d.is_public !== false,
    };
  } catch {
    return null;
  }
}

/** Convert a 2-letter country code → emoji flag (server-safe). */
export function scoreColor(score: number): string {
  if (score >= 90) return "#00d4ff";
  if (score >= 80) return "#00e676";
  if (score >= 70) return "#69f0ae";
  if (score >= 60) return "#ffab00";
  return "#ff3d00";
}
