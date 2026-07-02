import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "social.superbrain.predict",
  appName: "SuperbrainSocial",
  // Live URL — Next.js is SSR so we point to production rather than bundling static files
  server: {
    url: "https://www.superbrain.social",
    cleartext: false,
    // Allow OAuth URLs to load inside the WebView rather than opening the device's
    // default browser — required by App Store guideline 4
    allowNavigation: [
      "accounts.google.com",
      "*.google.com",
      "appleid.apple.com",
      "*.apple.com",
    ],
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
