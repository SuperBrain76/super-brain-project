"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/platform";
import { APP_STORE_URL } from "@/components/AppStoreBadge";

type Platform = "ios" | "android" | null;

// BeforeInstallPromptEvent is not in standard TS lib
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa_banner_dismissed";

export default function PWAInstallBanner() {
  const [platform,    setPlatform]    = useState<Platform>(null);
  const [visible,     setVisible]     = useState(false);
  const [deferredEvt, setDeferredEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Inside the native app there is nothing to install — never show.
    // (Also an App Review risk: "no App Store needed" in front of a reviewer.)
    if (isNativeApp()) return;

    // Already installed as PWA — never show
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Already dismissed this session / recently
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const ua = navigator.userAgent;
    const isIOS     = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua); // Safari only
    const isAndroid = /Android/i.test(ua);

    if (isIOS) {
      setPlatform("ios");
      // Small delay so it doesn't flash on first paint
      setTimeout(() => setVisible(true), 2500);
    } else if (isAndroid) {
      // Android: wait for beforeinstallprompt
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredEvt(e as BeforeInstallPromptEvent);
        setPlatform("android");
        setTimeout(() => setVisible(true), 2500);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  const installAndroid = async () => {
    if (!deferredEvt) return;
    await deferredEvt.prompt();
    const { outcome } = await deferredEvt.userChoice;
    if (outcome === "accepted") setVisible(false);
    else dismiss();
  };

  if (!visible || !platform) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-sm mx-auto bg-cockpit-card border border-cockpit-border rounded-sm shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-0.5 bg-cockpit-accent w-full" />

        <div className="px-4 py-4 flex items-start gap-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-sm bg-cockpit-accent flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-cockpit-bg font-black text-sm tracking-tighter">SB</span>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold leading-snug">
              Install SuperBrain
            </p>
            {platform === "ios" ? (
              <p className="text-cockpit-dim text-xs mt-1 leading-relaxed">
                Get the SuperBrain app on the App Store — free.
              </p>
            ) : (
              <p className="text-cockpit-dim text-xs mt-1 leading-relaxed">
                Install for a native app experience.
              </p>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={dismiss}
            className="text-cockpit-muted hover:text-cockpit-dim transition-colors shrink-0 p-1 -mr-1 -mt-1"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* iOS: link to the App Store listing */}
        {platform === "ios" && (
          <div className="px-4 pb-4 flex gap-2">
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex-1">
              <button className="w-full btn-primary text-sm py-2">
                Get the App
              </button>
            </a>
            <button
              onClick={dismiss}
              className="px-4 py-2 text-cockpit-muted text-sm hover:text-cockpit-dim transition-colors"
            >
              Not now
            </button>
          </div>
        )}

        {/* Android install button */}
        {platform === "android" && (
          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={installAndroid}
              className="flex-1 btn-primary text-sm py-2"
            >
              Install App
            </button>
            <button
              onClick={dismiss}
              className="px-4 py-2 text-cockpit-muted text-sm hover:text-cockpit-dim transition-colors"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
