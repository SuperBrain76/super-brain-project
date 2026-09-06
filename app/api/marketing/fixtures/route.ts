/**
 * GET /api/marketing/fixtures — real fixture data for the Marketing OS.
 *
 * The content engine had no connection to fixture data, so every post was
 * generic ("matchweek is here") and anything specific was invented — one post
 * claimed the Premier League has 22 matchdays. This is the fix: n8n asks what
 * is actually happening and writes about that.
 *
 * ── Why an endpoint and not Supabase creds in n8n ─────────────
 * n8n already holds Meta, X and Discord tokens in plaintext node code. Adding a
 * service-role database key to that blast radius is a bad trade for a read that
 * a 60-line route can serve.
 *
 * ── Auth ──────────────────────────────────────────────────────
 * Bearer secret, same shape as the existing admin/cron routes.
 * MARKETING_API_SECRET if set, otherwise CRON_SECRET.
 *
 * ── Beats ─────────────────────────────────────────────────────
 *   beat=preview  next round that has not kicked off — for the T-48h post
 *   beat=results  fixtures finished in the last N hours — for the T+12h post
 *   beat=both     (default) whichever exist
 *
 * Returns ONLY facts. No prose, no invented stats. If there is nothing to say,
 * it says so with `hasContent: false` and the caller skips generation rather
 * than filling the gap with guesswork.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type TeamRow = { id: string; name: string; code: string };

export async function GET(req: NextRequest) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  // Accept either — `A || B` makes B stop working the day A is set, which is
  // how /api/cron/instantly-poll silently 401'd for eleven days.
  const ACCEPTED = [process.env.MARKETING_API_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .map((s) => `Bearer ${s}`);

  const auth = req.headers.get("authorization") ?? "";
  if (!ACCEPTED.length || !ACCEPTED.includes(auth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SRK) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const slug = (url.searchParams.get("competition") || "premier-league").trim();
  const beat = (url.searchParams.get("beat") || "both").trim();
  const resultsWindowHours = Number(url.searchParams.get("hours") || 36);
  const maxFixtures = Math.min(Number(url.searchParams.get("limit") || 10), 20);

  const db = createClient(SUPABASE_URL, SUPABASE_SRK, {
    auth: { persistSession: false },
  });

  // ── competition + current season ────────────────────────────
  const { data: comp } = await db
    .from("competitions")
    .select("id, name, slug, sport_code, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!comp) {
    return NextResponse.json({ error: `Unknown competition: ${slug}` }, { status: 404 });
  }

  const { data: season } = await db
    .from("seasons")
    .select("id, slug, label, is_current")
    .eq("competition_id", comp.id)
    .order("is_current", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return NextResponse.json({
      competition: comp.name, hasContent: false,
      reason: "no season seeded for this competition",
    });
  }

  // Teams once, then resolve ids locally — avoids a join the client cannot express.
  const { data: teamRows } = await db
    .from("teams")
    .select("id, name, code")
    .eq("competition_id", comp.id);
  const teams = new Map<string, TeamRow>((teamRows ?? []).map((t) => [t.id, t as TeamRow]));
  const nameOf = (id: string | null) => (id && teams.get(id)?.name) || null;

  const now = new Date();
  const nowIso = now.toISOString();
  const sinceIso = new Date(now.getTime() - resultsWindowHours * 3600_000).toISOString();

  const shape = (f: Record<string, unknown>) => ({
    home: nameOf(f.home_team_id as string),
    away: nameOf(f.away_team_id as string),
    kicksOffAt: f.kicks_off_at as string,
    venue: (f.venue as string) ?? null,
    homeScore: (f.home_score as number) ?? null,
    awayScore: (f.away_score as number) ?? null,
    status: f.status as string,
  });

  const out: Record<string, unknown> = {
    competition: comp.name,
    slug: comp.slug,
    sport: comp.sport_code,
    season: season.label,
    generatedAt: nowIso,
  };

  // ── preview: the next round that has not started ────────────
  if (beat === "preview" || beat === "both") {
    const { data: upcoming } = await db
      .from("fixtures")
      .select("id, round_id, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score")
      .eq("season_id", season.id)
      .gte("kicks_off_at", nowIso)
      .order("kicks_off_at", { ascending: true })
      .limit(maxFixtures * 3);

    const first = (upcoming ?? [])[0];
    if (first) {
      const roundId = first.round_id;
      const inRound = (upcoming ?? []).filter((f) => f.round_id === roundId).slice(0, maxFixtures);
      const { data: round } = await db
        .from("rounds")
        .select("code, label, short_label")
        .eq("id", roundId)
        .maybeSingle();

      const kickoff = new Date(first.kicks_off_at as string);
      out.preview = {
        round: round?.label ?? null,
        roundShort: round?.short_label ?? null,
        firstKickoff: first.kicks_off_at,
        hoursUntilFirstKickoff: Math.round((kickoff.getTime() - now.getTime()) / 3600_000),
        fixtures: inRound.map(shape),
      };
    }
  }

  // ── results: what just finished ─────────────────────────────
  if (beat === "results" || beat === "both") {
    const { data: done } = await db
      .from("fixtures")
      .select("id, round_id, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score")
      .eq("season_id", season.id)
      .lte("kicks_off_at", nowIso)
      .gte("kicks_off_at", sinceIso)
      .not("home_score", "is", null)
      .order("kicks_off_at", { ascending: false })
      .limit(maxFixtures);

    const finished = (done ?? []).map(shape);
    if (finished.length) {
      // Biggest margin is the one worth writing about.
      const byMargin = [...finished].sort(
        (a, b) =>
          Math.abs((b.homeScore ?? 0) - (b.awayScore ?? 0)) -
          Math.abs((a.homeScore ?? 0) - (a.awayScore ?? 0)),
      );
      out.results = {
        windowHours: resultsWindowHours,
        fixtures: finished,
        biggestMargin: byMargin[0] ?? null,
        drawCount: finished.filter((f) => f.homeScore === f.awayScore).length,
      };
    }
  }

  out.hasContent = Boolean(out.preview || out.results);
  if (!out.hasContent) {
    out.reason = "no upcoming fixtures and no recent results in the window";
  }
  return NextResponse.json(out);
}
