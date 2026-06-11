import { NextRequest, NextResponse } from "next/server";
import { getResend, FROM, SITE, emailWrapper, ctaButton, divider } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = `
    <h2 style="font-size:20px;color:#1a3a2a;margin:0 0 4px;font-family:Georgia,serif;">
      Match Day! ⚽
    </h2>
    <p style="font-size:14px;color:#7a8f82;font-family:sans-serif;margin:0 0 20px;line-height:1.5;">
      Hi Dylan, there are <strong style="color:#1a3a2a;">3 matches</strong> today. Get your predictions in before kick-off!
    </p>

    ${divider}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
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
                <td colspan="3" style="text-align:center;font-size:11px;color:#7a8f82;font-family:sans-serif;padding-top:4px;">⏱ 18:00 UTC</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #dde5d8;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:right;">Argentina</td>
                <td style="font-size:11px;color:#b8972a;font-family:sans-serif;font-weight:700;width:16%;text-align:center;letter-spacing:1px;">vs</td>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:left;">Morocco</td>
              </tr>
              <tr>
                <td colspan="3" style="text-align:center;font-size:11px;color:#7a8f82;font-family:sans-serif;padding-top:4px;">⏱ 21:00 UTC</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:right;">England</td>
                <td style="font-size:11px;color:#b8972a;font-family:sans-serif;font-weight:700;width:16%;text-align:center;letter-spacing:1px;">vs</td>
                <td style="font-size:14px;color:#1a3a2a;font-family:Georgia,serif;font-weight:600;width:42%;text-align:left;">France</td>
              </tr>
              <tr>
                <td colspan="3" style="text-align:center;font-size:11px;color:#7a8f82;font-family:sans-serif;padding-top:4px;">⏱ 21:00 UTC</td>
              </tr>
            </table>
          </td>
        </tr>
      </tbody>
    </table>

    ${divider}

    ${ctaButton("Make Your Predictions →", `${SITE}/predict`)}

    <p style="font-size:12px;color:#7a8f82;font-family:sans-serif;text-align:center;margin:8px 0 0;">
      Predictions lock at kick-off. Don't leave it too late!
    </p>
  `;

  const { error } = await getResend().emails.send({
    from: FROM,
    to: "kj96@hotmail.com",
    subject: "⚽ 3 matches today — make your predictions! [TEST]",
    html: emailWrapper(body, "test-user"),
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent_to: "kj96@hotmail.com" });
}
