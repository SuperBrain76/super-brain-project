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

function formatKickoff(utcStr: string) {
  const d = new Date(utcStr);
  return (
    d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    }) + " UTC"
  );
}

function matchRow(home: string, away: string, kickoff: string) {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #dde5d8;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:right;">${home}</td>
            <td style="font-size:11px;color:#b8972a;font-family:sans-serif;font-weight:700;width:16%;text-align:center;letter-spacing:1px;">vs</td>
            <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:left;">${away}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align:center;font-size:11px;color:#7a8f82;font-family:sans-serif;padding-top:3px;">⏱ ${formatKickoff(kickoff)}</td>
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

  // "Match day" window: 06:00 UTC today → 06:00 UTC tomorrow
  // Covers afternoon games (18-20 UTC) + late-night games (00-04 UTC next calendar day)
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(6, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  // Get this match-day's scheduled fixtures
  const { data: rawFixtures, error: fxErr } = await db
    .from("fixtures")
    .select("id, home_team_id, away_team_id, kicks_off_at")
    .gte("kicks_off_at", dayStart.toISOString())
    .lt("kicks_off_at", dayEnd.toISOString())
    .eq("status", "scheduled")
    .order("kicks_off_at");

  if (fxErr) console.error("[email-matchday] fixture query error:", fxErr.message);

  if (!rawFixtures || rawFixtures.length === 0) {
    console.log("[email-matchday] No scheduled fixtures today, skipping.");
    return NextResponse.json({ skipped: true, reason: "no fixtures today" });
  }

  // Resolve team names
  const allTeamIds = [...new Set([
    ...rawFixtures.map((f) => f.home_team_id as string),
    ...rawFixtures.map((f) => f.away_team_id as string),
  ])];
  const { data: teamsData } = await db.from("teams").select("id, name").in("id", allTeamIds);
  const teamName = new Map((teamsData ?? []).map((t) => [t.id, t.name as string]));

  const fixtures = rawFixtures.map((f) => ({
    home:      teamName.get(f.home_team_id as string) ?? "TBD",
    away:      teamName.get(f.away_team_id as string) ?? "TBD",
    kicksOffAt: f.kicks_off_at as string,
  }));

  // Get opted-in user IDs
  const { data: optedIn } = await db
    .from("user_profiles")
    .select("id")
    .eq("email_notifications", true);

  const ids = new Set((optedIn ?? []).map((p) => p.id));
  if (ids.size === 0) {
    return NextResponse.json({ skipped: true, reason: "no subscribers" });
  }

  const { data: { users: allUsers }, error: authErr } =
    await db.auth.admin.listUsers({ perPage: 1000 });

  if (authErr || !allUsers) {
    console.error("[email-matchday] auth error:", authErr?.message);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const users = allUsers.filter((u) => ids.has(u.id) && u.email);
  const matchCount = fixtures.length;

  const rows = fixtures.map((f) =>
    matchRow(f.home, f.away, f.kicksOffAt)
  ).join("");

  // Guard: only send within 45 minutes of the scheduled 14:00 UTC time (6pm UAE).
  // Prevents Vercel retry invocations (which fire late) from sending duplicates.
  const minutesPastSchedule = (now.getUTCHours() * 60 + now.getUTCMinutes()) - (14 * 60);
  if (minutesPastSchedule > 45) {
    console.log(`[email-matchday] Outside send window (${minutesPastSchedule}m past schedule), skipping to prevent duplicate.`);
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

      const body = `
        <h2 style="font-size:20px;color:#1a3a2a;margin:0 0 4px;font-family:Georgia,serif;">
          Match Day! ⚽
        </h2>
        <p style="font-size:14px;color:#7a8f82;font-family:sans-serif;margin:0 0 20px;">
          Hi ${firstName}, there ${matchCount === 1 ? "is" : "are"} <strong style="color:#1a3a2a;">${matchCount} match${matchCount === 1 ? "" : "es"}</strong> today. Get your predictions in before kick-off!
        </p>

        ${divider}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
          <tbody>${rows}</tbody>
        </table>

        ${divider}

        ${ctaButton("Make Your Predictions →", `${SITE}/predict`)}

        <p style="font-size:12px;color:#7a8f82;font-family:sans-serif;text-align:center;margin:8px 0 0;">
          Predictions lock at kick-off. Don't leave it too late!
        </p>
      `;

      return {
        from: FROM,
        to: user.email as string,
        subject: `⚽ ${matchCount} match${matchCount === 1 ? "" : "es"} today — make your predictions!`,
        html: emailWrapper(body, user.id),
      };
    });

  // Use Resend batch API — single API call, Resend handles delivery internally.
  // Supports up to 100 emails per batch call; we chunk to stay within that limit.
  // This completes in ~1-2 seconds regardless of recipient count, no timeout risk.
  const resend = getResend();
  const RESEND_BATCH_LIMIT = 100;
  for (let i = 0; i < emails.length; i += RESEND_BATCH_LIMIT) {
    const chunk = emails.slice(i, i + RESEND_BATCH_LIMIT);
    const { data, error } = await resend.batch.send(chunk);
    if (error) {
      console.error("[email-matchday] batch error:", error);
      failed += chunk.length;
    } else {
      sent += data?.data?.length ?? chunk.length;
    }
  }

  console.log(`[email-matchday] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed });
}
