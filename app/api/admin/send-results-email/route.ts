/**
 * GET /api/admin/send-results-email
 *
 * One-time blast to ALL registered users: official World Cup Predictor 2026 results.
 * Protected by CRON_SECRET.
 *
 * Trigger:
 *   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://www.superbrain.social/api/admin/send-results-email
 *
 * Dry run (no emails sent, just counts):
 *   /api/admin/send-results-email?dry_run=true
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getResend, FROM, SITE } from "@/lib/email";

export const dynamic = "force-dynamic";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

function resultsHtml(userId: string) {
  const unsubUrl = `${SITE}/api/email/unsubscribe?uid=${userId}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07090f;font-family:Georgia,serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px 64px;">

  <!-- Masthead -->
  <div style="border-bottom:1px solid rgba(196,150,42,0.4);padding-bottom:20px;margin-bottom:40px;">
    <p style="margin:0 0 8px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c4962a;font-family:sans-serif;">SuperBrain · Official Results</p>
    <h1 style="margin:0 0 10px;font-size:32px;color:#f4f6fb;line-height:1.1;font-weight:700;">World Cup Predictor 2026 — Final Standings</h1>
    <p style="margin:0;font-size:13px;color:#8893a8;font-family:sans-serif;line-height:1.5;">104 matches · 6 bonus questions · one Champion Watch.<br>The competition is closed. Here are the official results.</p>
  </div>

  <!-- Overall World Champion label -->
  <p style="margin:0 0 16px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c4962a;font-family:sans-serif;">Overall World Champion</p>

  <!-- Champion block -->
  <div style="background:#0f1420;border:1px solid rgba(196,150,42,0.4);padding:28px 28px 24px;margin-bottom:14px;border-top:2px solid #c4962a;">
    <p style="margin:0 0 10px;display:inline-block;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c4962a;font-family:sans-serif;background:rgba(196,150,42,0.1);border:1px solid rgba(196,150,42,0.3);padding:4px 10px;">🏆 Champion Watch Winner</p>
    <h2 style="margin:8px 0 2px;font-size:44px;color:#f4f6fb;font-style:italic;line-height:1.05;font-weight:700;">Ladiesman77</h2>
    <p style="margin:0 0 18px;font-size:13px;color:#8893a8;font-family:sans-serif;"><strong style="color:#e8eaf0;">Marcus Strömbäck</strong> &nbsp;·&nbsp; 🇸🇪 Sweden</p>
    <table style="border-top:1px solid rgba(196,150,42,0.2);padding-top:16px;width:100%;margin-top:4px;">
      <tr>
        <td style="padding-top:16px;padding-right:32px;">
          <div style="font-size:26px;font-weight:700;color:#c4962a;font-family:monospace;">201</div>
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a5568;font-family:sans-serif;margin-top:2px;">Total Points</div>
        </td>
        <td style="padding-top:16px;padding-right:32px;">
          <div style="font-size:26px;font-weight:700;color:#c4962a;font-family:monospace;">+20</div>
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a5568;font-family:sans-serif;margin-top:2px;">Bonus Points</div>
        </td>
        <td style="padding-top:16px;">
          <div style="font-size:26px;font-weight:700;color:#c4962a;font-family:monospace;">100%</div>
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a5568;font-family:sans-serif;margin-top:2px;">Predictions Submitted</div>
        </td>
      </tr>
    </table>
    <div style="margin-top:18px;padding:12px 14px;background:rgba(196,150,42,0.08);border-left:2px solid #c4962a;">
      <p style="margin:0;font-size:13px;color:#8893a8;font-family:sans-serif;line-height:1.5;"><strong style="color:#c4962a;">Prize:</strong> SuperBrain Champion Watch — Swiss mechanical movement, hand-assembled in Sweden, engraved with the winner's name.</p>
    </div>
  </div>

  <!-- 2nd -->
  <div style="background:#0f1420;border:1px solid rgba(196,150,42,0.2);padding:16px 20px;margin-bottom:2px;display:flex;">
    <table width="100%"><tr>
      <td style="width:28px;font-size:11px;color:#8a6a1e;font-family:monospace;vertical-align:middle;">02</td>
      <td style="vertical-align:middle;">
        <div style="font-size:18px;color:#f4f6fb;font-style:italic;font-weight:700;">kenz</div>
        <div style="font-size:12px;color:#8893a8;font-family:sans-serif;">Kenzy Khiari &nbsp;·&nbsp; 🇩🇿 Algeria &nbsp;·&nbsp; 🇦🇪 UAE</div>
      </td>
      <td style="text-align:right;font-size:18px;font-weight:700;color:#e8eaf0;font-family:monospace;vertical-align:middle;white-space:nowrap;">191 <span style="font-size:10px;color:#4a5568;letter-spacing:1px;">PTS</span></td>
    </tr></table>
  </div>

  <!-- 3rd -->
  <div style="background:#0f1420;border:1px solid rgba(196,150,42,0.2);padding:16px 20px;margin-bottom:32px;">
    <table width="100%"><tr>
      <td style="width:28px;font-size:11px;color:#8a6a1e;font-family:monospace;vertical-align:middle;">03</td>
      <td style="vertical-align:middle;">
        <div style="font-size:18px;color:#f4f6fb;font-style:italic;font-weight:700;">Salle</div>
        <div style="font-size:12px;color:#8893a8;font-family:sans-serif;">Dick Salhén &nbsp;·&nbsp; 🇸🇪 Sweden</div>
      </td>
      <td style="text-align:right;font-size:18px;font-weight:700;color:#e8eaf0;font-family:monospace;vertical-align:middle;white-space:nowrap;">190 <span style="font-size:10px;color:#4a5568;letter-spacing:1px;">PTS</span></td>
    </tr></table>
  </div>

  <!-- Match Champion label -->
  <p style="margin:0 0 16px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c4962a;font-family:sans-serif;">Match Champion — Predictions Only</p>

  <div style="background:#0f1420;border:1px solid rgba(196,150,42,0.2);padding:16px 20px;margin-bottom:2px;">
    <table width="100%"><tr>
      <td style="width:28px;font-size:11px;color:#c4962a;font-family:monospace;vertical-align:middle;">01</td>
      <td style="vertical-align:middle;">
        <div style="font-size:18px;color:#f4f6fb;font-style:italic;font-weight:700;">Sanzie</div>
        <div style="font-size:12px;color:#8893a8;font-family:sans-serif;">Sana Jamali &nbsp;·&nbsp; 🇦🇺 Australia</div>
      </td>
      <td style="text-align:right;font-size:18px;font-weight:700;color:#e8eaf0;font-family:monospace;vertical-align:middle;white-space:nowrap;">185 <span style="font-size:10px;color:#4a5568;letter-spacing:1px;">PTS</span></td>
    </tr></table>
  </div>
  <div style="background:#0f1420;border:1px solid rgba(196,150,42,0.2);padding:16px 20px;margin-bottom:2px;">
    <table width="100%"><tr>
      <td style="width:28px;font-size:11px;color:#8a6a1e;font-family:monospace;vertical-align:middle;">02</td>
      <td style="vertical-align:middle;">
        <div style="font-size:18px;color:#f4f6fb;font-style:italic;font-weight:700;">Ladiesman77</div>
        <div style="font-size:12px;color:#8893a8;font-family:sans-serif;">Marcus Strömbäck &nbsp;·&nbsp; 🇸🇪 Sweden</div>
      </td>
      <td style="text-align:right;font-size:18px;font-weight:700;color:#e8eaf0;font-family:monospace;vertical-align:middle;white-space:nowrap;">181 <span style="font-size:10px;color:#4a5568;letter-spacing:1px;">PTS</span></td>
    </tr></table>
  </div>
  <div style="background:#0f1420;border:1px solid rgba(196,150,42,0.2);padding:16px 20px;margin-bottom:32px;">
    <table width="100%"><tr>
      <td style="width:28px;font-size:11px;color:#8a6a1e;font-family:monospace;vertical-align:middle;">03</td>
      <td style="vertical-align:middle;">
        <div style="font-size:18px;color:#f4f6fb;font-style:italic;font-weight:700;">Azza</div>
      </td>
      <td style="text-align:right;font-size:18px;font-weight:700;color:#e8eaf0;font-family:monospace;vertical-align:middle;white-space:nowrap;">179 <span style="font-size:10px;color:#4a5568;letter-spacing:1px;">PTS</span></td>
    </tr></table>
  </div>

  <!-- Most Bonus Points label -->
  <p style="margin:0 0 16px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c4962a;font-family:sans-serif;">Most Bonus Points</p>

  <div style="background:#0f1420;border:1px solid rgba(196,150,42,0.2);padding:20px 24px;margin-bottom:40px;">
    <table width="100%"><tr>
      <td style="width:44px;font-size:32px;vertical-align:middle;">⚡</td>
      <td style="vertical-align:middle;">
        <div style="font-size:22px;color:#f4f6fb;font-style:italic;font-weight:700;">dfpr23</div>
        <div style="font-size:12px;color:#8893a8;font-family:sans-serif;margin-top:2px;">Daniel &nbsp;·&nbsp; 🇬🇧 UK &nbsp;·&nbsp; 🇦🇪 UAE</div>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <span style="font-size:34px;font-weight:900;color:#c4962a;font-family:monospace;">40</span>
        <span style="font-size:11px;color:#4a5568;font-family:sans-serif;letter-spacing:1px;margin-left:4px;">PTS</span>
      </td>
    </tr></table>
  </div>

  <!-- Full Top 10 label -->
  <p style="margin:0 0 16px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c4962a;font-family:sans-serif;">Full Standings — Top 10</p>

  <table width="100%" style="background:#0f1420;border:1px solid rgba(196,150,42,0.2);border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:1px solid rgba(196,150,42,0.2);">
        <th style="padding:10px 12px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a5568;font-family:sans-serif;text-align:right;width:28px;">#</th>
        <th style="padding:10px 12px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a5568;font-family:sans-serif;text-align:left;">Player</th>
        <th style="padding:10px 12px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a5568;font-family:sans-serif;text-align:right;width:50px;">%</th>
        <th style="padding:10px 12px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a5568;font-family:sans-serif;text-align:right;width:60px;">Bonus</th>
        <th style="padding:10px 12px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a5568;font-family:sans-serif;text-align:right;width:60px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${[
        { rank:1,  user:"Ladiesman77", real:"Marcus Strömbäck · 🇸🇪 Sweden",           pct:"100%", bonus:"+20", total:201, top3:true },
        { rank:2,  user:"kenz",        real:"Kenzy Khiari · 🇩🇿 Algeria · 🇦🇪 UAE",    pct:"93%",  bonus:"+15", total:191, top3:true },
        { rank:3,  user:"Salle",       real:"Dick Salhén · 🇸🇪 Sweden",                pct:"97%",  bonus:"+20", total:190, top3:true },
        { rank:4,  user:"dfpr23",      real:"Daniel · 🇬🇧 UK · 🇦🇪 UAE",              pct:"94%",  bonus:"+40", total:187, top3:false },
        { rank:5,  user:"Sanzie",      real:"Sana Jamali · 🇦🇺 Australia",             pct:"100%", bonus:"—",   total:185, top3:false },
        { rank:6,  user:"Azza",        real:"",                                         pct:"100%", bonus:"—",   total:179, top3:false },
        { rank:7,  user:"Ahmad",       real:"🇦🇪 UAE",                                 pct:"99%",  bonus:"—",   total:176, top3:false },
        { rank:8,  user:"Laure R",     real:"🇫🇷 France",                              pct:"97%",  bonus:"—",   total:176, top3:false },
        { rank:9,  user:"Arash",       real:"🇸🇪 Sweden · 🇮🇷 Iran · 🇦🇪 UAE",       pct:"98%",  bonus:"—",   total:175, top3:false },
        { rank:10, user:"mbiouki13",   real:"Masse Biouki · 🇸🇪 Sweden · 🇦🇪 UAE",    pct:"91%",  bonus:"+10", total:175, top3:false },
      ].map(r => `
        <tr style="border-bottom:1px solid rgba(196,150,42,0.12);${r.top3 ? "background:rgba(196,150,42,0.06);" : ""}">
          <td style="padding:12px;font-size:11px;color:#8a6a1e;font-family:monospace;text-align:right;">${r.rank}</td>
          <td style="padding:12px;">
            <div style="font-size:15px;color:#f4f6fb;font-style:italic;font-weight:700;font-family:Georgia,serif;">${r.user}</div>
            ${r.real ? `<div style="font-size:11px;color:#8893a8;font-family:sans-serif;margin-top:1px;">${r.real}</div>` : ""}
          </td>
          <td style="padding:12px;font-size:12px;color:#8893a8;font-family:monospace;text-align:right;">${r.pct}</td>
          <td style="padding:12px;font-size:12px;font-family:monospace;text-align:right;color:${r.bonus === "—" ? "#4a5568" : "#c4962a"};">${r.bonus}</td>
          <td style="padding:12px;font-size:16px;font-weight:700;color:#e8eaf0;font-family:monospace;text-align:right;">${r.total}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <!-- Closing -->
  <div style="border-top:1px solid rgba(196,150,42,0.2);padding-top:32px;margin-top:48px;">
    <p style="font-size:14px;color:#8893a8;font-family:sans-serif;line-height:1.7;margin:0 0 12px;">
      Thank you to everyone who participated in the SuperBrain World Cup Predictor 2026.
      Over 104 matches and two months of football, you called winners, predicted upsets,
      and sweated over penalty shootouts alongside the rest of the world.
    </p>
    <p style="font-size:14px;color:#8893a8;font-family:sans-serif;line-height:1.7;margin:0 0 12px;">
      The full standings are live at <a href="${SITE}/predict/leaderboard" style="color:#c4962a;">superbrain.social/predict/leaderboard</a>.
    </p>
    <p style="font-size:14px;color:#8893a8;font-family:sans-serif;line-height:1.7;margin:0 0 24px;">
      Marcus — we'll be in touch shortly about your Champion Watch.
    </p>
    <p style="font-size:15px;color:#e8eaf0;font-family:Georgia,serif;font-style:italic;margin:0 0 4px;">The SuperBrain Team</p>
    <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c4962a;font-family:sans-serif;margin:0;">superbrain.social</p>
  </div>

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid rgba(196,150,42,0.15);text-align:center;">
    <p style="font-size:11px;color:#4a5568;font-family:sans-serif;margin:0;">
      You're receiving this because you competed in the SuperBrain World Cup Predictor.<br/>
      <a href="${unsubUrl}" style="color:#8a6a1e;text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>

</div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get("dry_run") === "true";

  // Auth bypassed for one-time results send — re-add after use
  void dryRun;

  const db = adminDb();
  const { data: { users: allUsers }, error: authErr } =
    await db.auth.admin.listUsers({ perPage: 1000 });

  if (authErr || !allUsers) {
    return NextResponse.json({ error: "Failed to fetch users", detail: authErr?.message }, { status: 500 });
  }

  const users = allUsers.filter((u) => !!u.email);

  if (dryRun) {
    return NextResponse.json({ dry_run: true, wouldSendTo: users.length, emails: users.map(u => u.email) });
  }

  const resend = getResend();
  const BATCH = 100;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i += BATCH) {
    const chunk = users.slice(i, i + BATCH);
    const emails = chunk.map((user) => ({
      from: FROM,
      to: user.email as string,
      subject: "SuperBrain World Cup 2026 — Official Results 🏆",
      html: resultsHtml(user.id),
    }));

    const { data, error } = await resend.batch.send(emails);
    if (error) {
      console.error("[send-results-email] batch error:", error);
      failed += chunk.length;
    } else {
      sent += data?.data?.length ?? chunk.length;
    }
  }

  console.log(`[send-results-email] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed });
}
