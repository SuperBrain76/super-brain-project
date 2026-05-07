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

/** Convert a 2-letter country code → emoji flag (server-safe). */
export function scoreColor(score: number): string {
  if (score >= 90) return "#00d4ff";
  if (score >= 80) return "#00e676";
  if (score >= 70) return "#69f0ae";
  if (score >= 60) return "#ffab00";
  return "#ff3d00";
}
