import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");

  if (!uid) {
    return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  }

  const db = adminDb();
  const { error } = await db
    .from("user_profiles")
    .update({ email_notifications: false })
    .eq("id", uid);

  if (error) {
    console.error("[unsubscribe] error:", error.message);
    return new NextResponse("Something went wrong. Please try again.", { status: 500 });
  }

  // Return a clean confirmation page
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Unsubscribed — SuperBrain</title>
    </head>
    <body style="margin:0;padding:0;background:#f8f5f0;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
      <div style="max-width:400px;text-align:center;padding:40px 24px;">
        <div style="width:56px;height:56px;background:#1a3a2a;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
          <span style="color:#b8972a;font-size:24px;">✓</span>
        </div>
        <h1 style="font-size:22px;color:#1a3a2a;margin:0 0 8px;">You're unsubscribed.</h1>
        <p style="font-size:14px;color:#7a8f82;line-height:1.6;margin:0 0 28px;">
          You won't receive any more emails from SuperBrain Predictor.<br/>No questions asked.
        </p>
        <a href="https://www.superbrain.social/predict"
           style="display:inline-block;background:#1a3a2a;color:#fff;font-family:sans-serif;
                  font-size:14px;font-weight:600;padding:12px 28px;border-radius:40px;text-decoration:none;">
          Back to Predictor
        </a>
      </div>
    </body>
    </html>`,
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
}
