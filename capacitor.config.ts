import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "social.superbrain.predict",
  appName: "SuperBrain",
  // Live URL — Next.js is SSR so we point to production rather than bundling static files
  server: {
    url: "https://www.superbrain.social",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
