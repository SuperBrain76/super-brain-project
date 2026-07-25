"use client";

/**
 * ClubCrest — a club's identity, instantly.
 *
 * A coloured monogram badge in the club's real colour. No crest images
 * (licensing), but colour alone carries the recognition — Anfield red, City
 * sky blue, Wolves gold. This one small thing is most of what makes the sheet
 * feel like the Premier League rather than a form.
 */

import { club, textOn } from "@/lib/premierLeague/clubs";

export default function ClubCrest({
  code,
  size = 28,
}: {
  code: string | null | undefined;
  size?: number;
}) {
  const c = code ? club(code) : undefined;

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
