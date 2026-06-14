import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getResend, FROM, SITE, emailWrapper, ctaButton, divider } from "@/lib/email";

export const dynamic = "force-dynamic";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

function medal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

function leaderRow(rank: number, name: string, pts: number, highlight = false) {
  return `
    <tr style="${highlight ? "background:#eef8f0;" : ""}">
      <td style="padding:8px 4px;font-size:13px;color:#7a8f82;font-family:sans-serif;width:32px;text-align:center;">${medal(rank)}</td>
      <td style="padding:8px 4px;font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:${highlight ? "700" : "600"};">${name}${highlight ? " 👈" : ""}</td>
      <td style="padding:8px 4px;font-size:14px;color:#b8972a;font-family:sans-serif;font-weight:700;text-align:right;white-space:nowrap;">${pts} pts</td>
    </tr>
  `;
}

function resultRow(home: string, homeScore: number, awayScore: number, away: string) {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #dde5d8;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:40%;text-align:right;">${home}</td>
            <td style="font-size:15px;color:#1a3a2a;font-family:sans-serif;font-weight:900;width:20%;text-align:center;letter-spacing:2px;">${homeScore}–${awayScore}</td>
            <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:40%;text-align:left;">${away}</td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();

  // "Match day" window: 06:00 UTC yesterday → 06:00 UTC today
  // This groups all Americas match-day games correctly:
  // afternoon (18-20 UTC) + late-night (00-04 UTC next calendar day)
  const now = new Date();
  const dayEnd   = new Date(now);
  dayEnd.setUTCHours(6, 0, 0, 0);           // 06:00 UTC today
  const dayStart = new Date(dayEnd);
  dayStart.setUTCDate(dayStart.getUTCDate() - 1); // 06:00 UTC yesterday

  // Get the match-day's completed fixtures
  const { data: rawFixtures, error: fxErr } = await db
    .from("fixtures")
    .select("id, home_team_id, away_team_id, home_score, away_score")
    .gte("kicks_off_at", dayStart.toISOString())
    .lt("kicks_off_at", dayEnd.toISOString())
    .not("home_score", "is", null);

  if (fxErr) console.error("[email-standings] fixture query error:", fxErr.message);

  if (!rawFixtures || rawFixtures.length === 0) {
    console.log("[email-standings] No completed matches today, skipping.");
    return NextResponse.json({ skipped: true, reason: "no completed matches today" });
  }

  // Resolve team names
  const allTeamIds = [...new Set([
    ...rawFixtures.map((f) => f.home_team_id),
    ...rawFixtures.map((f) => f.away_team_id),
  ])];
  const { data: teamsData } = await db.from("teams").select("id, name").in("id", allTeamIds);
  const teamName = new Map((teamsData ?? []).map((t) => [t.id, t.name as string]));

  const todayFixtures = rawFixtures.map((f) => ({
    id:        f.id as string,
    home:      teamName.get(f.home_team_id as string) ?? "TBD",
    away:      teamName.get(f.away_team_id as string) ?? "TBD",
    homeScore: f.home_score as number,
    awayScore: f.away_score as number,
  }));

  // Competition ID
  const { data: comp } = await db
    .from("competitions")
    .select("id")
    .eq("slug", "wc2026")
    .single();

  // Global top 10 (now includes user_id)
  const { data: globalLeader } = await db.rpc("get_predictor_leaderboard", {
    p_competition_id: comp?.id ?? null,
  });
  const leaderboard = (globalLeader ?? []) as Array<{
    rank: number; user_id: string; display_name: string; total_points: number;
  }>;
  const top10 = leaderboard.slice(0, 10);

  // Build user_id → rank/pts lookup for personal rank line
  const rankMap = new Map(leaderboard.map((r) => [r.user_id, { rank: Number(r.rank), pts: Number(r.total_points) }]));

  // Today's top scorers
  const todayFixtureIds = todayFixtures.map((f) => f.id as string);
  const { data: todayPredictions } = await db
    .from("predictions")
    .select("user_id, points_awarded")
    .in("fixture_id", todayFixtureIds)
    .not("points_awarded", "is", null);

  const todayMap = new Map<string, number>();
  for (const row of todayPredictions ?? []) {
    todayMap.set(row.user_id, (todayMap.get(row.user_id) ?? 0) + (row.points_awarded ?? 0));
  }
  // Attach display names from leaderboard
  const todayTop5 = Array.from(todayMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([uid, pts]) => ({
      name: leaderboard.find((r) => r.user_id === uid)?.display_name ?? "—",
      pts,
    }));

  // Opted-in subscribers
  const { data: optedInProfiles } = await db
    .from("user_profiles")
    .select("id")
    .eq("email_notifications", true);

  const ids = new Set((optedInProfiles ?? []).map((p) => p.id));
  if (ids.size === 0) {
    return NextResponse.json({ skipped: true, reason: "no subscribers" });
  }

  const { data: { users: allUsers }, error: authErr } =
    await db.auth.admin.listUsers({ perPage: 1000 });

  if (authErr || !allUsers) {
    console.error("[email-standings] auth error:", authErr?.message);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const users = allUsers.filter((u) => ids.has(u.id) && u.email);

  // Pre-build global rows
  const globalRows = top10
    .map((u) => leaderRow(Number(u.rank), u.display_name ?? "—", Number(u.total_points ?? 0)))
    .join("");

  const todayRows = todayTop5
    .map(({ name, pts }, i) => leaderRow(i + 1, name, pts))
    .join("");

  // Results section
  const resultsRows = todayFixtures.map((f) =>
    resultRow(f.home, f.homeScore, f.awayScore, f.away)
  ).join("");

  // Guard: standings cron runs at 08:00 UTC. Skip if >30 min past schedule to block retries.
  const minutesPastSchedule = (now.getUTCHours() * 60 + now.getUTCMinutes()) - (8 * 60);
  if (minutesPastSchedule > 30) {
    console.log(`[email-standings] Outside send window (${minutesPastSchedule}m past schedule), skipping.`);
    return NextResponse.json({ skipped: true, reason: "outside send window" });
  }

  let sent = 0;
  let failed = 0;

  // Build all email payloads first
  const emails = users
    .filter((u) => !!u.email)
    .map((user) => {
      const displayName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        "Predictor";
      const firstName = String(displayName).split(" ")[0];

      const myRank = rankMap.get(user.id);
      const rankLine = myRank
        ? `<p style="font-size:14px;color:#1a3a2a;font-family:sans-serif;margin:0 0 20px;">
             You're currently <strong style="color:#b8972a;">#${myRank.rank}</strong> globally with <strong style="color:#1a3a2a;">${myRank.pts} pts</strong>.
           </p>`
        : "";

      const body = `
        <h2 style="font-size:20px;color:#1a3a2a;margin:0 0 4px;font-family:Georgia,serif;">
          Today's Results Are In
        </h2>
        <p style="font-size:14px;color:#7a8f82;font-family:sans-serif;margin:0 0 12px;">
          Hi ${firstName}, here's how the SuperBrain Predictor stands after today's matches.
        </p>

        ${rankLine}

        <h3 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;margin:16px 0 8px;">
          Today's Results
        </h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
          <tbody>${resultsRows}</tbody>
        </table>

        ${divider}

        <h3 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;margin:16px 0 8px;">
          Global Top 10
        </h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tbody>${globalRows}</tbody>
        </table>

        ${todayTop5.length > 0 ? `
          ${divider}
          <h3 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;margin:16px 0 8px;">
            Today's Top Scorers
          </h3>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tbody>${todayRows}</tbody>
          </table>
        ` : ""}

        ${divider}

        ${ctaButton("View Full Leaderboard →", `${SITE}/predict/leaderboard`)}
      `;

      return {
        from: FROM,
        to: user.email as string,
        subject: `📊 Today's SuperBrain standings — who's leading?`,
        html: emailWrapper(body, user.id),
      };
    });

  // Resend batch API — single call per 100 recipients, scales to any list size
  const resend = getResend();
  const RESEND_BATCH_LIMIT = 100;
  for (let i = 0; i < emails.length; i += RESEND_BATCH_LIMIT) {
    const chunk = emails.slice(i, i + RESEND_BATCH_LIMIT);
    const { data, error } = await resend.batch.send(chunk);
    if (error) {
      console.error("[email-standings] batch error:", error);
      failed += chunk.length;
    } else {
      sent += data?.data?.length ?? chunk.length;
    }
  }

  console.log(`[email-standings] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed });
}
