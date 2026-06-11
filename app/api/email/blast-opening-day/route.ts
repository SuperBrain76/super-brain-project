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

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();

  // Get opted-in user IDs
  const { data: optedIn } = await db
    .from("user_profiles")
    .select("id")
    .eq("email_notifications", true);

  const ids = new Set((optedIn ?? []).map((p) => p.id));

  if (ids.size === 0) {
    return NextResponse.json({ skipped: true, reason: "no subscribers" });
  }

  // Fetch all auth users via admin API (supports email access)
  const { data: { users: allUsers }, error: authErr } = await db.auth.admin.listUsers({ perPage: 1000 });

  if (authErr || !allUsers) {
    console.error("[blast-opening-day] auth.admin.listUsers error:", authErr?.message);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const users = allUsers.filter((u) => ids.has(u.id) && u.email);

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
        It Starts Tonight! 🏆
      </h2>
      <p style="font-size:14px;color:#7a8f82;font-family:sans-serif;margin:0 0 20px;line-height:1.6;">
        Hi ${firstName}, the FIFA World Cup 2026 kicks off <strong style="color:#1a3a2a;">tonight</strong>. Here's what you need to do before the whistle blows.
      </p>

      <div style="background:#f0f7f0;border-left:3px solid #b8972a;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 20px;">
        <p style="font-size:13px;color:#1a3a2a;font-family:sans-serif;font-weight:700;margin:0 0 4px;letter-spacing:0.3px;">⚠️ Last chance — Bonus Questions close at kick-off</p>
        <p style="font-size:13px;color:#7a8f82;font-family:sans-serif;margin:0;line-height:1.5;">
          Who wins the Golden Boot? Who lifts the trophy? Answer the bonus questions now — they lock the moment Mexico vs South Africa kicks off and <strong style="color:#1a3a2a;">can't be changed</strong>.
        </p>
      </div>

      ${divider}

      <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;margin:16px 0 10px;font-weight:600;">Today's Matches</p>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #dde5d8;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:right;">Mexico</td>
                  <td style="font-size:11px;color:#b8972a;font-family:sans-serif;font-weight:700;width:16%;text-align:center;letter-spacing:1px;">vs</td>
                  <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:left;">South Africa</td>
                </tr>
                <tr>
                  <td colspan="3" style="text-align:center;font-size:11px;color:#7a8f82;font-family:sans-serif;padding-top:4px;">⏱ 19:00 UTC &nbsp;·&nbsp; 11:00 PM Dubai</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:right;">South Korea</td>
                  <td style="font-size:11px;color:#b8972a;font-family:sans-serif;font-weight:700;width:16%;text-align:center;letter-spacing:1px;">vs</td>
                  <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:left;">Czech Republic</td>
                </tr>
                <tr>
                  <td colspan="3" style="text-align:center;font-size:11px;color:#7a8f82;font-family:sans-serif;padding-top:4px;">⏱ 02:00 UTC &nbsp;·&nbsp; 06:00 AM Dubai</td>
                </tr>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      ${divider}

      ${ctaButton("Complete Bonus Questions + Predict →", `${SITE}/predict`)}

      <p style="font-size:12px;color:#7a8f82;font-family:sans-serif;text-align:center;margin:8px 0 0;line-height:1.5;">
        Good luck — may the best predictor win the SuperBrain Champion Watch! 🏅
      </p>
    `;

    try {
      await getResend().emails.send({
        from: FROM,
        to: user.email,
        subject: "🏆 It starts tonight — complete your bonus questions now!",
        html: emailWrapper(body, user.id),
      });
      sent++;
    } catch (err) {
      console.error(`[blast-opening-day] Failed for ${user.email}:`, err);
      failed++;
    }
  }

  console.log(`[blast-opening-day] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed });
}
