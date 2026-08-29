"use client";

/**
 * ClubCrest — a club's identity, instantly.
 *
 * Renders the club's real crest (via CREST_BY_CODE, sourced from the paid data
 * feeds — football-data.org + TheSportsDB) and falls back to a coloured
 * monogram badge in the club's real colour whenever a crest is missing or fails
 * to load. The monogram is the safety net + loading state, so a badge is never
 * blank and never breaks — Anfield red, City sky blue, Wolves gold still carry
 * the recognition for anything the feed doesn't cover.
 *
 * In the NATIVE APP (Capacitor shell) crest images are never shown — the
 * monogram always renders instead, per our App Review agreement with Apple
 * (guideline 5.2.1). The website is unaffected. See lib/platform.ts.
 */

import { useEffect, useState } from "react";
import { club, textOn } from "@/lib/premierLeague/clubs";
import { CREST_BY_CODE } from "@/lib/leagues/crests";
import { isNativeApp } from "@/lib/platform";

export default function ClubCrest({
  code,
  size = 28,
}: {
  code: string | null | undefined;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  // Per App Review agreement, the native app never shows crest images —
  // it always uses the coloured monogram. See lib/platform.ts.
  const [native, setNative] = useState(false);
  useEffect(() => {
    if (isNativeApp()) setNative(true);
  }, []);
  const c = code ? club(code) : undefined;
  const crest = code ? (CREST_BY_CODE[code] ?? CREST_BY_CODE[code.toUpperCase()]) : undefined;

  // Real crest — free-standing logo, transparent background.
  if (c && crest && !imgFailed && !native) {
    return (
      <span
        aria-hidden
        title={c.name}
        style={{
          width: size, height: size, flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={crest}
          alt=""
          width={size}
          height={size}
          decoding="async"
          onError={() => setImgFailed(true)}
          style={{ width: size, height: size, objectFit: "contain", display: "block" }}
        />
      </span>
    );
  }

  // Unknown club → neutral placeholder.
  if (!c) {
    return (
      <span
        aria-hidden
        style={{
          width: size, height: size, borderRadius: 7,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "#e6ebe4", color: "#9aa89a",
          fontSize: size * 0.34, fontWeight: 800, flexShrink: 0,
        }}
      >
        ?
      </span>
    );
  }

  // Fallback — coloured monogram in the club's real colour.
  return (
    <span
      aria-hidden
      title={c.name}
      style={{
        width: size, height: size, borderRadius: 7,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: c.primary, color: textOn(c.primary),
        fontSize: size * 0.32, fontWeight: 800, letterSpacing: "-0.02em",
        flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
      }}
    >
      {c.code}
    </span>
  );
}

/** The club's short name — "Spurs", "Man Utd" — for tight layouts. */
export function clubShort(code: string | null | undefined): string {
  return (code ? club(code)?.short : undefined) ?? code ?? "TBD";
}
