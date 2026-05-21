"use client";

import { useState } from "react";

export default function DesktopRecommended() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="w-full max-w-xl mx-auto mb-4 px-4 py-3 flex items-start gap-3 bg-cockpit-amber bg-opacity-5 border border-cockpit-amber border-opacity-30 rounded-sm">
      <svg
        className="shrink-0 mt-0.5"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffab00"
        strokeWidth="2"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="text-cockpit-amber text-xs flex-1 leading-relaxed">
        <span className="font-semibold">Best on desktop.</span>{" "}
        This test requires precise, fast input — it works but scores lower on phones and tablets.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-cockpit-amber opacity-60 hover:opacity-100 transition-opacity shrink-0 leading-none"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
