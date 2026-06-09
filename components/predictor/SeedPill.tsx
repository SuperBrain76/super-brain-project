"use client";

/**
 * SeedPill — small qualification-path badge shown below a team name
 * when the team slot is still TBD (e.g. "1E", "3ABCD", "W73").
 *
 * Design: grey/gold pill, consistent with the predictor token set.
 * Display only — no logic changes.
 */

interface SeedPillProps {
  label:   string;
  /** "group" → gold accent (known pool), "winner" → muted grey */
  variant?: "group" | "winner";
  className?: string;
}

export default function SeedPill({ label, variant, className = "" }: SeedPillProps) {
  // Infer variant from label if not supplied
  const v = variant ?? (label.startsWith("W") || label.startsWith("L") ? "winner" : "group");

  const style =
    v === "group"
      ? {
          color:      "#7a5e14",
          background: "#fdf3d7",
          border:     "1px solid #e8d48a",
        }
      : {
          color:      "#5a6e60",
          background: "#eef3ec",
          border:     "1px solid #c4d4c8",
        };

  return (
    <span
      className={`inline-block text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-sm tracking-wide ${className}`}
      style={style}
    >
      {label}
    </span>
  );
}
