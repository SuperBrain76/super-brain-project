import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM = "SuperBrain <update@superbrain.social>";
export const SITE = "https://www.superbrain.social";

// ── Unsubscribe footer (included in every email) ──────────────
export function unsubscribeFooter(userId: string) {
  const url = `${SITE}/api/email/unsubscribe?uid=${userId}`;
  return `
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #dde5d8;text-align:center;font-family:sans-serif;">
      <p style="font-size:11px;color:#7a8f82;margin:0;">
        You're receiving this because you signed up for SuperBrain World Cup Predictor.<br/>
        <a href="${url}" style="color:#b8972a;text-decoration:underline;">Unsubscribe</a> — one click, no questions asked.
      </p>
    </div>
  `;
}

// ── Base email wrapper ────────────────────────────────────────
export function emailWrapper(content: string, userId: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f8f5f0;font-family:Georgia,serif;">
      <div style="max-width:560px;margin:0 auto;padding:24px 16px;">

        <!-- Header -->
        <div style="background:#1a3a2a;border-radius:12px 12px 0 0;padding:20px 24px;text-align:center;">
          <p style="margin:0;font-size:11px;letter-spacing:3px;color:#b8972a;font-family:sans-serif;text-transform:uppercase;">SuperBrain</p>
          <p style="margin:4px 0 0;font-size:11px;color:#7a8f82;font-family:sans-serif;">World Cup Predictor 2026</p>
        </div>

        <!-- Body -->
        <div style="background:#ffffff;padding:28px 24px;border-left:1px solid #dde5d8;border-right:1px solid #dde5d8;">
          ${content}
        </div>

        <!-- Footer -->
        <div style="background:#f8f5f0;border-radius:0 0 12px 12px;padding:4px 24px 20px;border:1px solid #dde5d8;border-top:none;">
          ${unsubscribeFooter(userId)}
        </div>

      </div>
    </body>
    </html>
  `;
}

// ── CTA button ────────────────────────────────────────────────
export function ctaButton(text: string, url: string) {
  return `
    <div style="text-align:center;margin:24px 0;">
      <a href="${url}"
         style="display:inline-block;background:#b8972a;color:#ffffff;font-family:sans-serif;
                font-size:15px;font-weight:700;padding:14px 32px;border-radius:40px;
                text-decoration:none;letter-spacing:0.5px;">
        ${text}
      </a>
    </div>
  `;
}

// ── Divider ───────────────────────────────────────────────────
export const divider = `<div style="height:1px;background:#dde5d8;margin:20px 0;"></div>`;
