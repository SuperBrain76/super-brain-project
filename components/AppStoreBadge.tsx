"use client";

/**
 * AppStoreBadge — "Download on the App Store" button linking to the live
 * listing. Hidden inside the native app itself (tapping it there would be
 * pointless) — web/PWA only.
 */

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/platform";

export const APP_STORE_URL = "https://apps.apple.com/app/id6780331791";

export default function AppStoreBadge({ className = "" }: { className?: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (isNativeApp()) setHidden(true);
  }, []);
  if (hidden) return null;

  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download on the App Store"
      className={`inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-opacity hover:opacity-85 ${className}`}
      style={{ background: "#000", border: "1px solid #3a3a3a" }}
    >
      {/* Apple logo */}
      <svg width="22" height="26" viewBox="0 0 814 1000" fill="#fff" aria-hidden>
        <path d="M788 341c-6 4-107 61-107 187 0 146 128 198 132 199-1 3-20 71-67 140-42 61-86 122-153 122s-84-39-161-39c-75 0-102 40-163 40s-104-56-153-125C60 785 14 664 14 549c0-184 120-282 238-282 63 0 115 41 155 41 38 0 97-44 169-44 27 0 125 3 212 77zM554 176c31-36 52-87 52-137 0-7-1-14-2-20-50 2-109 33-145 74-28 32-54 83-54 134 0 8 1 15 2 18 3 1 8 2 13 2 45 0 101-30 134-71z"/>
      </svg>
      <span className="flex flex-col leading-none text-left">
        <span className="text-[10px] font-medium" style={{ color: "#c7c7c7" }}>Download on the</span>
        <span className="text-[17px] font-semibold text-white mt-0.5">App Store</span>
      </span>
    </a>
  );
}
