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

function leaderRow(rank: number, name: string, pts: number) {
  return `
    <tr>
      <td style="padding:8px 4px;font-size:13px;color:#7a8f82;font-family:sans-serif;width:32px;text-align:center;">${medal(rank)}</td>
      <td style="padding:8px 4px;font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;">${name}</td>
      <td style="padding:8px 4px;font-size:14px;color:#b8972a;font-family:sans-serif;font-weight:700;text-align:right;white-space:nowrap;">${pts} pts</td>
    </tr>
  `;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const today = new Date().toISOString().slice(0, 10);

  // Check there were completed matches today
  const { data: todayFixtures } = await db
    .from("fixtures")
    .select("id")
    .gte("kickoff_time", `${today}T00:00:00Z`)
    .lt("kickoff_time", `${today}T23:59:59Z`)
    .not("home_score", "is", null);

  if (!todayFixtures || todayFixtures.length === 0) {
    console.log("[email-standings] No completed matches today, skipping.");
    return NextResponse.json({ skipped: true, reason: "no completed matches today" });
  }

  const todayFixtureIds = todayFixtures.map((f) => f.id);

  // Look up the WC2026 competition
  const { data: comp } = await db
    .from("competitions")
    .select("id")
    .eq("slug", "wc2026")
    .single();

  // Global top 10 via RPC
  const { data: globalLeader } = await db.rpc("get_predictor_leaderboard", {
    p_competition_id: comp?.id ?? null,
  });
  const top10 = (globalLeader ?? []).slice(0, 10) as Array<{
    rank: number;
    display_name: string;
    total_points: number;
  }>;

  // Top 5 scorers today
  const { data: todayPredictions } = await db
    .from("predictions")
    .select("user_id, points_awarded, user_profiles(display_name)")
    .in("fixture_id", todayFixtureIds)
    .not("points_awarded", "is", null);

  const todayMap = new Map<string, { name: string; pts: number }>();
  for (const row of todayPredictions ?? []) {
    const existing = todayMap.get(row.user_id) ?? {
      name:
        (row.user_profiles as { display_name?: string } | null)?.display_name ?? "—",
      pts: 0,
    };
    existing.pts += row.points_awarded ?? 0;
    todayMap.set(row.user_id, existing);
  }
  const todayTop5 = Array.from(todayMap.entries())
    .sort((a, b) => b[1].pts - a[1].pts)
    .slice(0, 5);

  // Get opted-in subscribers
  const { data: optedInProfiles } = await db
    .from("user_profiles")
    .select("id")
    .eq("email_notifications", true);

  const optedInIds = (optedInProfiles ?? []).map((p) => p.id);

  const { data: users } = await db
    .schema("auth")
    .from("users")
    .select("id, email, raw_user_meta_data")
    .in("id", optedInIds);

  if (!users || users.length === 0) {
    return NextResponse.json({ skipped: true, reason: "no subscribers" });
  }

  const globalRows = top10
    .map((u) => leaderRow(Number(u.rank), u.display_name ?? "—", Number(u.total_points ?? 0)))
    .join("");

  const todayRows = todayTop5
    .map(([, { name, pts }], i) => leaderRow(i + 1, name, pts))
    .join("");

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email) continue;

    const displayName =
      user.raw_user_meta_data?.full_name ??
      user.raw_user_meta_data?.name ??
      "Predictor";
    const firstName = String(displayName).split(" ")[0];

    // Personal rank line omitted — leaderboard RPC returns display_name only, not user_id
    const rankLine = "";

    const body = `
      <h2 style="font-size:20px;color:#1a3a2a;margin:0 0 4px;font-family:Georgia,serif;">
        Today's Results Are In
      </h2>
      <p style="font-size:14px;color:#7a8f82;font-family:sans-serif;margin:0 0 20px;">
        Hi ${firstName}, here's how the SuperBrain Predictor stands after today's matches.
      </p>

      ${rankLine}

      ${divider}

      <h3 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;margin:16px 0 8px;">
        Global Top 10
      </h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>${globalRows}</tbody>
      </table>

      ${
        todayTop5.length > 0
          ? `${divider}
        <h3 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;margin:16px 0 8px;">
          Today's Top Scorers
        </h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tbody>${todayRows}</tbody>
        </table>`
          : ""
      }

      ${divider}

      ${ctaButton("View Full Leaderboard →", `${SITE}/predict`)}
    `;

    try {
      await getResend().emails.send({
        from: FROM,
        to: user.email,
        subject: `📊 Today's SuperBrain standings — who's leading?`,
        html: emailWrapper(body, user.id),
      });
      sent++;
    } catch (err) {
      console.error(`[email-standings] Failed for ${user.email}:`, err);
      failed++;
    }
  }

  console.log(`[email-standings] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed });
}
