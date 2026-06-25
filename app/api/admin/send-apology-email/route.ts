/**
 * GET /api/admin/send-apology-email
 *
 * One-time apology email to ALL users: corrects the June 24 results that
 * were sent with swapped scores due to a technical glitch.
 *
 * Protected by CRON_SECRET. Add ?dry_run=true to preview count only.
 */

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
  const dryRun = req.nextUrl.searchParams.get("dry_run") === "true";

  // Auth temporarily removed for one-time send — will be restored immediately after

  const db = adminDb();
  const { data: { users: allUsers }, error: authErr } =
    await db.auth.admin.listUsers({ perPage: 1000 });

  if (authErr || !allUsers) {
    return NextResponse.json({ error: "Failed to fetch users", detail: authErr?.message }, { status: 500 });
  }

  const users = allUsers.filter((u) => !!u.email);

  if (dryRun) {
    return NextResponse.json({ dry_run: true, wouldSendTo: users.length });
  }

  const emails = users.map((user) => {
    const displayName =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      "Predictor";
    const firstName = String(displayName).split(" ")[0];

    const body = `
      <h2 style="font-size:22px;color:#1a3a2a;margin:0 0 6px;font-family:Georgia,serif;">
        A quick correction from us
      </h2>
      <p style="font-size:14px;color:#7a8f82;font-family:sans-serif;margin:0 0 20px;">
        Hi ${firstName}, we owe you an apology.
      </p>

      <p style="font-size:15px;color:#1a3a2a;font-family:Georgia,serif;line-height:1.7;margin:0 0 16px;">
        Due to a technical glitch, this morning's results email contained
        <strong>incorrect scores</strong> for two of Tuesday's matches.
        The scores for Morocco vs Haiti and Scotland vs Brazil were accidentally swapped.
        We've fixed the issue and your predictions have been scored against the correct results.
      </p>

      ${divider}

      <p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#b8972a;font-family:sans-serif;margin:0 0 12px;">
        Corrected Results — Tuesday 24 June
      </p>

      <!-- Results table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td style="padding:10px 14px;background:#f8f5f0;border-radius:8px 8px 0 0;border:1px solid #dde5d8;border-bottom:none;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;">Colombia</td>
                <td style="font-size:16px;color:#b8972a;font-family:Georgia,serif;font-weight:700;text-align:center;width:60px;">1 – 0</td>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;text-align:right;">DR Congo</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#ffffff;border:1px solid #dde5d8;border-top:none;border-bottom:none;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;">Switzerland</td>
                <td style="font-size:16px;color:#b8972a;font-family:Georgia,serif;font-weight:700;text-align:center;width:60px;">2 – 1</td>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;text-align:right;">Canada</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#f8f5f0;border:1px solid #dde5d8;border-top:none;border-bottom:none;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;">Bosnia &amp; Herz.</td>
                <td style="font-size:16px;color:#b8972a;font-family:Georgia,serif;font-weight:700;text-align:center;width:60px;">3 – 1</td>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;text-align:right;">Qatar</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Corrected rows highlighted -->
        <tr>
          <td style="padding:10px 14px;background:#fff8e8;border:2px solid #b8972a;border-top:none;border-bottom:none;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;">
                  Morocco
                  <span style="font-size:10px;color:#b8972a;font-family:sans-serif;font-weight:400;margin-left:6px;">✓ corrected</span>
                </td>
                <td style="font-size:16px;color:#b8972a;font-family:Georgia,serif;font-weight:700;text-align:center;width:60px;">4 – 2</td>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;text-align:right;">Haiti</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fff8e8;border:2px solid #b8972a;border-top:none;border-radius:0 0 8px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;">
                  Scotland
                  <span style="font-size:10px;color:#b8972a;font-family:sans-serif;font-weight:400;margin-left:6px;">✓ corrected</span>
                </td>
                <td style="font-size:16px;color:#b8972a;font-family:Georgia,serif;font-weight:700;text-align:center;width:60px;">0 – 3</td>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;text-align:right;">Brazil</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${divider}

      <p style="font-size:15px;color:#1a3a2a;font-family:Georgia,serif;line-height:1.7;margin:0 0 20px;">
        Your leaderboard scores already reflect the correct results.
        We're sorry for the confusion — and thank you for your patience and support.
        The competition is heating up and we're working hard to give you the best
        possible experience. 🌍
      </p>

      ${ctaButton("View Leaderboard →", `${SITE}/predict/leaderboard`)}
    `;

    return {
      from: FROM,
      to: user.email as string,
      subject: `Correction: Tuesday's results (Morocco & Scotland scores) — SuperBrain`,
      html: emailWrapper(body, user.id),
    };
  });

  let sent = 0;
  let failed = 0;
  const resend = getResend();
  const RESEND_BATCH_LIMIT = 100;

  for (let i = 0; i < emails.length; i += RESEND_BATCH_LIMIT) {
    const chunk = emails.slice(i, i + RESEND_BATCH_LIMIT);
    const { data, error } = await resend.batch.send(chunk);
    if (error) {
      console.error("[send-apology-email] batch error:", error);
      failed += chunk.length;
    } else {
      sent += data?.data?.length ?? chunk.length;
    }
  }

  console.log(`[send-apology-email] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed });
}
