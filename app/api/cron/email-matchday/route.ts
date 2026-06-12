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
  const today = new Date().toISOString().slice(0, 10);

  // Get today's scheduled fixtures with team names via join
  const { data: fixtures } = await db
    .from("fixtures")
    .select(`
      id, kicks_off_at, status,
      home_team:teams!home_team_id ( name ),
      away_team:teams!away_team_id ( name )
    `)
    .gte("kicks_off_at", `${today}T00:00:00Z`)
    .lt("kicks_off_at", `${today}T23:59:59Z`)
    .eq("status", "scheduled")
    .order("kicks_off_at");

  if (!fixtures || fixtures.length === 0) {
    console.log("[email-matchday] No scheduled fixtures today, skipping.");
    return NextResponse.json({ skipped: true, reason: "no fixtures today" });
  }

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

  const rows = fixtures.map((f) => {
    const home = (f.home_team as { name: string } | null)?.name ?? "TBD";
    const away = (f.away_team as { name: string } | null)?.name ?? "TBD";
    return matchRow(home, away, f.kicks_off_at as string);
  }).join("");

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email) continue;
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

    try {
      await getResend().emails.send({
        from: FROM,
        to: user.email,
        subject: `⚽ ${matchCount} match${matchCount === 1 ? "" : "es"} today — make your predictions!`,
        html: emailWrapper(body, user.id),
      });
      sent++;
    } catch (err) {
      console.error(`[email-matchday] Failed for ${user.email}:`, err);
      failed++;
    }
  }

  console.log(`[email-matchday] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed });
}
