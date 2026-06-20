/**
 * GET /api/admin/send-social-blast
 *
 * One-time blast to ALL registered users: join our Instagram + WhatsApp,
 * and app is coming soon. Hits every user regardless of email_notifications
 * preference (this is a product announcement, not a match update).
 *
 * Protected by CRON_SECRET. Trigger once via browser or curl:
 *   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://www.superbrain.social/api/admin/send-social-blast
 *
 * Safe to call multiple times during testing — add ?dry_run=true to skip
 * actual sending and just return a count of who would receive it.
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

  // Dry run is unauthenticated — it sends nothing, just counts recipients.
  // Real sends require CRON_SECRET.
  if (!dryRun) {
    const cronSecret = process.env.CRON_SECRET ?? "";
    if (!cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const auth = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = adminDb();

  // Fetch ALL registered users — this is a product announcement
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
        We're going social. 🌍
      </h2>
      <p style="font-size:14px;color:#7a8f82;font-family:sans-serif;margin:0 0 20px;">
        Hi ${firstName}, the World Cup is in full swing — and we're building a community around it.
      </p>

      <p style="font-size:15px;color:#1a3a2a;font-family:Georgia,serif;line-height:1.7;margin:0 0 20px;">
        Follow us on Instagram and WhatsApp for live match updates, leaderboard highlights,
        and behind-the-scenes from the SuperBrain Predictor.
      </p>

      ${divider}

      <!-- Instagram -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
          <td style="padding:16px;background:#f8f5f0;border-radius:10px;border:1px solid #dde5d8;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;">Instagram</p>
            <p style="margin:0 0 12px;font-size:18px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;">@superbrain.social</p>
            <p style="margin:0;font-size:13px;color:#7a8f82;font-family:sans-serif;line-height:1.6;">
              Match highlights · Prediction callouts · Leaderboard moments
            </p>
            <div style="margin-top:14px;">
              <a href="https://www.instagram.com/superbrain.social"
                 style="display:inline-block;background:#1a3a2a;color:#ffffff;font-family:sans-serif;
                        font-size:13px;font-weight:700;padding:10px 22px;border-radius:40px;text-decoration:none;">
                Follow on Instagram →
              </a>
            </div>
          </td>
        </tr>
      </table>

      <!-- WhatsApp -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 20px;">
        <tr>
          <td style="padding:16px;background:#f8f5f0;border-radius:10px;border:1px solid #dde5d8;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;">WhatsApp Channel</p>
            <p style="margin:0 0 12px;font-size:18px;color:#1a3a2a;font-family:Georgia,serif;font-weight:700;">SuperBrain</p>
            <p style="margin:0;font-size:13px;color:#7a8f82;font-family:sans-serif;line-height:1.6;">
              Quick updates · Score alerts · No group chat noise
            </p>
            <div style="margin-top:14px;">
              <a href="https://whatsapp.com/channel/0029Vb8BD6q1iUxcrEhi4W2S"
                 style="display:inline-block;background:#25D366;color:#ffffff;font-family:sans-serif;
                        font-size:13px;font-weight:700;padding:10px 22px;border-radius:40px;text-decoration:none;">
                Join on WhatsApp →
              </a>
            </div>
          </td>
        </tr>
      </table>

      ${divider}

      <!-- App teaser -->
      <p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#b8972a;font-family:sans-serif;margin:0 0 8px;">
        Coming Soon
      </p>
      <p style="font-size:15px;color:#1a3a2a;font-family:Georgia,serif;line-height:1.7;margin:0 0 20px;">
        The <strong>SuperBrain app</strong> is on its way to the App Store and Google Play.
        One tap to check the leaderboard, submit predictions, and follow your rivals.
        Stay tuned — we'll let you know the moment it drops. 📱
      </p>

      ${divider}

      ${ctaButton("View Leaderboard →", `${SITE}/predict/leaderboard`)}
    `;

    return {
      from: FROM,
      to: user.email as string,
      subject: `SuperBrain is going social — follow us & stay in the game 🌍`,
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
      console.error("[send-social-blast] batch error:", error);
      failed += chunk.length;
    } else {
      sent += data?.data?.length ?? chunk.length;
    }
  }

  console.log(`[send-social-blast] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed });
}
