"use client";

/**
 * F1Visuals — a small, self-contained motorsport visual kit.
 *
 * Everything here is our OWN artwork (inline SVG + CSS): a checkered
 * finish-line strip, a race-number "board" monogram, and lights-out /
 * stopwatch / flag glyphs. No team logos, liveries or the F1 wordmark are
 * ever used — team identity is conveyed by colour, name and number only,
 * which is licence-safe (see the F1 launch decision). No external assets,
 * so nothing to load and nothing to attribute.
 */

import React from "react";

// Carbon / paddock palette (dark F1 surfaces).
export const F1_INK   = "#0e1116";
export const F1_CARBON = "#171b22";
export const F1_LINE  = "#2a3038";

/** A checkered finish-line strip — the signature F1 motif. Full-width, thin. */
export function CheckeredStrip({
  height = 12,
  cell = 6,
  className,
  style,
}: { height?: number; cell?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="100%" height={height} preserveAspectRatio="none" aria-hidden
         className={className} style={{ display: "block", ...style }}>
      <defs>
        <pattern id="f1-check" width={cell * 2} height={cell * 2} patternUnits="userSpaceOnUse">
          <rect width={cell * 2} height={cell * 2} fill="#ffffff" />
          <rect width={cell} height={cell} fill={F1_INK} />
          <rect x={cell} y={cell} width={cell} height={cell} fill={F1_INK} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#f1-check)" />
    </svg>
  );
}

/** A small waving checkered flag glyph. */
export function CheckeredFlag({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <defs>
        <pattern id="f1-flag" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#fff" />
          <rect width="2" height="2" fill={F1_INK} />
          <rect x="2" y="2" width="2" height="2" fill={F1_INK} />
        </pattern>
      </defs>
      <rect x="1" y="1" width="1.4" height="14" rx="0.7" fill="#c9ced6" />
      <path d="M3 2 h10 q-1.5 2 0 4 q-1.5 2 0 4 h-10 z" fill="url(#f1-flag)" stroke={F1_INK} strokeWidth="0.4" />
    </svg>
  );
}

/** "Lights out" — the five red starting lights. */
export function LightsOut({ on = true, size = 16 }: { on?: boolean; size?: number }) {
  const r = size / 10;
  return (
    <svg width={size * 1.7} height={size} viewBox="0 0 34 20" aria-hidden>
      <rect x="1" y="4" width="32" height="12" rx="3" fill={F1_INK} />
      {[6, 12, 18, 24, 30].map((cx) => (
        <circle key={cx} cx={cx} cy="10" r={r + 1.4} fill={on ? "#e10600" : "#3a2020"} />
      ))}
    </svg>
  );
}

/** A stopwatch glyph (qualifying). */
export function Stopwatch({ size = 16, color = "#c9ced6" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden fill="none" stroke={color} strokeWidth="1.3">
      <circle cx="8" cy="9" r="5.2" />
      <path d="M8 9 V6" strokeLinecap="round" />
      <path d="M6.4 1.6 h3.2" strokeLinecap="round" />
      <path d="M8 1.6 V3.4" />
    </svg>
  );
}

/**
 * A driver's number "board" — a rounded race plate in the team colour with
 * the FIA three-letter code, and (optionally) the permanent number as a
 * small corner tab. Our own design; not a team logo.
 */
export function DriverPlate({
  code,
  colour,
  number,
  size = 40,
}: { code: string; colour: string; number?: number | null; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size, flexShrink: 0 }}>
      <span
        style={{
          width: size, height: size, borderRadius: 9,
          background: colour, color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: size * 0.3, letterSpacing: "-0.02em",
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.14)`,
        }}
      >
        {code}
      </span>
      {number != null && (
        <span
          style={{
            position: "absolute", right: -4, bottom: -4,
            minWidth: 16, height: 16, padding: "0 3px",
            borderRadius: 5, background: F1_INK, color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 800, border: "1.5px solid #fff",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {number}
        </span>
      )}
    </span>
  );
}
