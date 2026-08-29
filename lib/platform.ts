import { Capacitor } from "@capacitor/core";

/**
 * True when running inside the native Capacitor shell (the iOS/Android app),
 * false in any ordinary browser and during SSR.
 *
 * App Store agreement (App Review call, Aug 2026): the native app must never
 * display third-party club crest imagery — only the website may. ClubCrest
 * checks this and permanently falls back to coloured monogram badges in the
 * app. Do not remove or bypass this gate in the native app: showing crests
 * there after approval is a hidden-content violation (guideline 2.3.1).
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
