/**
 * GET /api/admin/send-season-launch
 *
 * One-time season-announcement blast to ALL registered users: the 2026/27
 * season is here, when each league starts, invite your friends, build your IQ.
 * This is a product announcement, so it hits every user regardless of the
 * email_notifications preference (unsubscribe link still included).
 *
 * Protected by CRON_SECRET. Usage:
 *   Dry run (no auth, counts only):
 *     https://www.superbrain.social/api/admin/send-season-launch?dry_run=true
 *   Test to one inbox first (recommended):
 *     curl -H "Authorization: Bearer $CRON_SECRET" \
 *       "https://www.superbrain.social/api/admin/send-season-launch?test=dylan@vidaevergreen.ae"
 *   Full blast:
 *     curl -H "Authorization: Bearer $CRON_SECRET" \
 *       "https://www.superbrain.social/api/admin/send-season-launch"
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

// Real league start dates (from the fixtures DB).
const LEAGUES = [
  { flag: "🇪🇸", name: "La Liga",        when: "Underway now",  live: true  },
  { flag: "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", name: "Premier League", when: "Fri 21 Aug", live: false },
  { flag: "🇫🇷", name: "Ligue 1",        when: "Fri 21 Aug",    live: false },
  { flag: "🇮🇹", name: "Serie A",        when: "Sat 22 Aug",    live: false },
  { flag: "🇩🇪", name: "Bundesliga",     when: "Fri 28 Aug",    live: false },
  { flag: "🏒", name: "SHL — Ice Hockey", when: "Sat 19 Sep",   live: false },
];

function leagueRow(l: { flag: string; name: string; when: string; live: boolean }) {
  return `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid #e4ebe0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:20px;width:34px;">${l.flag}</td>
          <td style="font-size:15px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;">${l.name}</td>
          <td style="text-align:right;font-size:12px;font-family:sans-serif;font-weight:700;color:${l.live ? "#1f9d55" : "#b8972a"};white-space:nowrap;">
            ${l.live ? "● LIVE" : l.when}
          </td>
        </tr></table>
      </td>
    </tr>`;
}

function buildBody(firstName: string) {
  const leagueRows = LEAGUES.map(leagueRow).join("");
  return `
    <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#b8972a;font-family:sans-serif;margin:0 0 6px;">The 2026 / 27 Season</p>
    <h2 style="font-size:26px;line-height:1.2;color:#1a3a2a;margin:0 0 10px;font-family:Georgia,serif;">
      It's kicking off. Are you ready? ⚽
    </h2>
    <p style="font-size:15px;color:#5a6b60;font-family:sans-serif;line-height:1.6;margin:0 0 22px;">
      Hi ${firstName}, the new season is here — and SuperBrain just got a whole lot bigger.
      Predict <strong style="color:#1a3a2a;">Europe's five biggest leagues</strong> and, for the first time,
      <strong style="color:#1a3a2a;">ice hockey</strong>. Free, always. One tap to play.
    </p>

    ${divider}

    <p style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;margin:18px 0 4px;">Mark your calendar</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;"><tbody>${leagueRows}</tbody></table>
    <p style="font-size:12px;color:#9fb0a4;font-family:sans-serif;margin:10px 0 0;">More on the way: UEFA Champions League &amp; the NHL. 👀</p>

    ${divider}

    <p style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;margin:18px 0 6px;">How you win bragging rights</p>
    <p style="font-size:15px;color:#1a3a2a;font-family:Georgia,serif;line-height:1.75;margin:0 0 18px;">
      Call the scores — <strong>exact result = 5 points</strong>, right goal difference = 3, right winner = 2.
      Back your <strong>Banker</strong> to double one match a week. Every correct call grows your
      <strong>SuperBrain IQ</strong>. Miss a week and your rivals pull ahead — so keep predicting.
    </p>

    ${divider}

    <p style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#7a8f82;font-family:sans-serif;margin:18px 0 6px;">Bring your crew 👥</p>
    <p style="font-size:15px;color:#1a3a2a;font-family:Georgia,serif;line-height:1.75;margin:0 0 6px;">
      The real fun is beating people you know. Start a <strong>private league</strong> and go head-to-head with
      your <strong>mates</strong>, your <strong>city</strong>, your <strong>club's fans</strong>, or the whole
      <strong>office</strong>. New season, clean table — settle who actually knows their football.
    </p>
    <p style="font-size:14px;color:#5a6b60;font-family:sans-serif;line-height:1.6;margin:8px 0 0;">
      Forward this to the friends you want in your league. Big things are planned for our league winners this season. 🏆
    </p>

    ${ctaButton("Pick your leagues — free →", SITE)}

    <p style="font-size:12px;color:#9fb0a4;font-family:sans-serif;text-align:center;margin:6px 0 0;">
      superbrain.social · Predict. Compete. Grow your SuperBrain. 🧠
    </p>
  `;
}

const SUBJECT = "⚽ The 2026/27 season is here — pick your leagues & bring your friends";

export async function GET(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get("dry_run") === "true";
  const testTo = req.nextUrl.searchParams.get("test");

  // Dry run is unauthenticated (counts only). Any real send needs CRON_SECRET.
  if (!dryRun) {
    const cronSecret = process.env.CRON_SECRET ?? "";
    const auth = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    if (!cronSecret || (auth !== `Bearer ${cronSecret}` && querySecret !== cronSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const resend = getResend();

  // Test mode: send a single email to the given address, no user lookup.
  if (testTo) {
    const { error } = await resend.emails.send({
      from: FROM,
      to: testTo,
      subject: SUBJECT,
      html: emailWrapper(buildBody("Dylan"), "test"),
    });
    if (error) return NextResponse.json({ error: String(error) }, { status: 500 });
    return NextResponse.json({ ok: true, test: true, sentTo: testTo });
  }

  const db = adminDb();
  const { data: { users: allUsers }, error: authErr } =
    await db.auth.admin.listUsers({ perPage: 1000 });
  if (authErr || !allUsers) {
    return NextResponse.json({ error: "Failed to fetch users", detail: authErr?.message }, { status: 500 });
  }
  const users = allUsers.filter((u) => !!u.email);

  if (dryRun) return NextResponse.json({ dry_run: true, wouldSendTo: users.length });

  const emails = users.map((user) => {
    const displayName =
      user.user_metadata?.full_name ?? user.user_metadata?.name ?? "Predictor";
    const firstName = String(displayName).split(" ")[0];
    return {
      from: FROM,
      to: user.email as string,
      subject: SUBJECT,
      html: emailWrapper(buildBody(firstName), user.id),
    };
  });

  let sent = 0, failed = 0;
  const RESEND_BATCH_LIMIT = 100;
  for (let i = 0; i < emails.length; i += RESEND_BATCH_LIMIT) {
    const chunk = emails.slice(i, i + RESEND_BATCH_LIMIT);
    const { data, error } = await resend.batch.send(chunk);
    if (error) { console.error("[season-launch] batch error:", error); failed += chunk.length; }
    else { sent += data?.data?.length ?? chunk.length; }
  }

  console.log(`[send-season-launch] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed });
}
