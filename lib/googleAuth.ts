import { supabase } from "./supabase";
import { Browser } from "@capacitor/browser";

// Opens OAuth URL in SFSafariViewController (iOS) rather than the system browser,
// satisfying App Store guideline 4 which requires auth to stay within the app.
async function openOAuthInAppBrowser(url: string): Promise<void> {
  try {
    await Browser.open({ url, presentationStyle: "popover" });
  } catch {
    // Fallback for non-Capacitor environments (web browser)
    window.location.href = url;
  }
}

async function signInWithProvider(
  provider: "google" | "apple",
  next?: string,
  queryParams?: Record<string, string>,
): Promise<string | null> {
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
  const callbackUrl = next
    ? `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`
    : `${siteUrl}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo:          callbackUrl,
      queryParams,
      skipBrowserRedirect: true,
    },
  });

  if (error) return error.message;
  if (data.url) await openOAuthInAppBrowser(data.url);
  return null;
}

export async function signInWithGoogle(next?: string): Promise<string | null> {
  return signInWithProvider("google", next, {
    access_type: "offline",
    prompt:      "select_account",
  });
}

export async function signInWithApple(next?: string): Promise<string | null> {
  return signInWithProvider("apple", next);
}
