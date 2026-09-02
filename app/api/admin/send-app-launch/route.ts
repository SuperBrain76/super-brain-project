/**
 * GET /api/admin/send-app-launch
 *
 * One-time announcement: SuperBrain Social is on the App Store.
 *
 * A product announcement, so it goes to every registered user regardless of the
 * email_notifications preference. The unsubscribe link is still included.
 *
 * The CTA is a league, not a download. A solo installer opens an empty
 * leaderboard and churns; a group of six holds each other in for a season. The
 * App Store link is the second line, not the headline.
 *
 * Plain text only — no emoji anywhere, including the subject.
 *
 *   Dry run (no auth, counts only):
 *     .../api/admin/send-app-launch?dry_run=true
 *   Test to one inbox first — always do this:
 *     curl -H "Authorization: Bearer $CRON_SECRET" \
 *       ".../api/admin/send-app-launch?test=dylan@vidaevergreen.ae"
 *   Full send:
 *     curl -H "Authorization: Bearer $CRON_SECRET" ".../api/admin/send-app-launch"
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getResend, FROM, SITE, emailWrapper, ctaButton, divider } from "@/lib/email";

export const dynamic = "force-dynamic";

const APP_STORE_URL = process.env.APP_STORE_URL
  ?? "https://apps.apple.com/app/superbrain-social/id6780331791";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

const SUBJECT = "SuperBrain is on the App Store";

function buildBody(first: string) {
  return `
    <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#b8972a;font-family:sans-serif;margin:0 0 6px;">Now on iPhone</p>
    <h2 style="font-size:23px;color:#1a3a2a;margin:0 0 10px;font-family:Georgia,serif;">SuperBrain is on the App Store</h2>

    <p style="font-size:15px;color:#5a6b60;font-family:sans-serif;line-height:1.6;margin:0 0 18px;">
      Hi ${first}, you played the World Cup predictor with us this summer. The app
      is now live on the App Store, the new season is under way, and everything
      you had on the web is there — plus it takes about ten seconds to make your
      picks on the way to work.
    </p>

    ${divider}

    <p style="font-size:15px;color:#1a3a2a;font-family:Georgia,serif;line-height:1.75;margin:14px 0 6px;">
      <strong>Start a league and bring people into it.</strong> That is the whole game.
      A leaderboard of one is not much fun; a leaderboard of eight people who know
      each other runs itself for a season.
    </p>

    <p style="font-size:14px;color:#5a6b60;font-family:sans-serif;line-height:1.6;margin:0 0 6px;">
      Nine competitions are live right now: the Premier League, La Liga, Serie A,
      Bundesliga, Ligue 1, Allsvenskan, Formula 1, Premiership Rugby, and SHL
      hockey from 19 September. Free, no stakes, nothing to buy.
    </p>

    ${ctaButton("Start your league — free", SITE)}

    <p style="font-size:14px;color:#5a6b60;font-family:sans-serif;line-height:1.6;text-align:center;margin:14px 0 0;">
      Prefer the app? <a href="${APP_STORE_URL}" style="color:#b8972a;font-weight:600;text-decoration:none;">Download SuperBrain Social for iPhone</a>
    </p>

    <p style="font-size:12px;color:#9fb0a4;font-family:sans-serif;text-align:center;margin:14px 0 0;">
      superbrain.social — predict, compete, grow your SuperBrain
    </p>
  `;
}

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

  if (testTo) {
    const { error } = await resend.emails.send({
      from: FROM, to: testTo, subject: SUBJECT,
      html: emailWrapper(buildBody("Dylan"), "test"),
    });
    if (error) return NextResponse.json({ error: String(error) }, { status: 500 });
    return NextResponse.json({ ok: true, test: true, sentTo: testTo, appStoreUrl: APP_STORE_URL });
  }

  const db = adminDb();
  const { data: listed, error: authErr } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (authErr || !listed?.users) {
    return NextResponse.json({ error: "Failed to fetch users", detail: authErr?.message }, { status: 500 });
  }
  const users = listed.users.filter((u) => !!u.email);

  if (dryRun) return NextResponse.json({ dry_run: true, wouldSendTo: users.length, appStoreUrl: APP_STORE_URL });

  const emails = users.map((user) => {
    const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "there";
    return {
      from: FROM, to: user.email as string, subject: SUBJECT,
      html: emailWrapper(buildBody(String(displayName).split(" ")[0]), user.id),
    };
  });

  let sent = 0, failed = 0;
  const RESEND_BATCH_LIMIT = 100;
  for (let i = 0; i < emails.length; i += RESEND_BATCH_LIMIT) {
    const chunk = emails.slice(i, i + RESEND_BATCH_LIMIT);
    const { data, error } = await resend.batch.send(chunk);
    if (error) { console.error("[app-launch] batch error:", error); failed += chunk.length; }
    else { sent += data?.data?.length ?? chunk.length; }
  }

  console.log(`[send-app-launch] sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, failed });
}
