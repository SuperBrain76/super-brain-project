import { ImageResponse } from "next/og";

/**
 * Static fallback OG image for league join links — no emoji, SVG only.
 * Satori (used by next/og) cannot render emoji glyphs from system-ui font.
 */

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt         = "Join a prediction league on SuperBrain";

/**
 * Slug to display label. A static map rather than a database lookup because
 * this renders on the edge runtime. Unknown slugs fall back to title case, so
 * a newly seeded competition still produces a sane card.
 */
const COMPETITION_LABELS: Record<string, string> = {
  "premier-league": "Premier League",
  "la-liga":        "LaLiga",
  "bundesliga":     "Bundesliga",
  "serie-a":        "Serie A",
  "ligue-1":        "Ligue 1",
  "shl":            "SHL",
};

function labelFor(slug?: string): string {
  if (!slug) return "Predictions";
  if (COMPETITION_LABELS[slug]) return COMPETITION_LABELS[slug];
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default function Image({ params }: { params: { competition?: string } }) {
  const label = labelFor(params?.competition);
  return new ImageResponse(
    <div
      style={{
        background:    "linear-gradient(160deg, #0f2818 0%, #1a3a2a 45%, #0d2218 100%)",
        width:         "100%",
        height:        "100%",
        display:       "flex",
        flexDirection: "column",
        fontFamily:    "system-ui, -apple-system, sans-serif",
        position:      "relative",
        overflow:      "hidden",
      }}
    >
      {/* Gold top border */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #b8972a, #e8c44a, #b8972a)", display: "flex" }} />

      {/* Subtle diagonal texture */}
      <div
        style={{
          position:   "absolute",
          inset:      0,
          // Satori (next/og) cannot parse repeating-linear-gradient and throws
          // "Failed to parse declaration", which failed the whole image and left
          // invite links with no preview at all. A plain linear-gradient gives
          // the same barely-visible sheen and renders.
          background: "linear-gradient(135deg, #ffffff08, transparent 45%, #ffffff05)",
          display:    "flex",
        }}
      />

      {/* Gold radial glow */}
      <div
        style={{
          position:   "absolute",
          top:        -120,
          left:       "50%",
          transform:  "translateX(-50%)",
          width:      800,
          height:     500,
          background: "radial-gradient(ellipse at 50% 0%, #b8972a18 0%, transparent 65%)",
          display:    "flex",
        }}
      />

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "44px 64px 0",
          position:       "relative",
        }}
      >
        {/* SuperBrain logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width:          48,
              height:         48,
              background:     "#b8972a",
              borderRadius:   8,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#0f1f17", fontWeight: 900, fontSize: 18, letterSpacing: "-0.5px" }}>SB</span>
          </div>
          <span style={{ color: "#7a9e8a", fontSize: 15, fontWeight: 700, letterSpacing: "0.25em" }}>
            SUPERBRAIN
          </span>
        </div>

        {/* Competition badge. Text only — no sport icon, because the same card
            serves football and ice hockey. */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            background:   "#b8972a15",
            border:       "1px solid #b8972a50",
            borderRadius: 6,
            padding:      "10px 20px",
          }}
        >
          <span style={{ color: "#b8972a", fontSize: 14, fontWeight: 700, letterSpacing: "0.14em" }}>
            {label.toUpperCase()}
          </span>
        </div>
      </div>

      {/* ── Centre content ───────────────────────────────────── */}
      <div
        style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "0 80px",
          position:       "relative",
          gap:            0,
        }}
      >
        {/* Trophy SVG — hero size */}
        <svg width="72" height="76" viewBox="0 0 28 30" fill="none" style={{ marginBottom: 28 }}>
          <path d="M4 2h20M4 2C4 2 2 2 2 6c0 5 4 8 7 9M24 2c0 0 2 0 2 4c0 5-4 8-7 9M9 15c0 4 2 7 5 8m5-8c0 4-2 7-5 8m0 0v4m0 0H9m5 0h5" stroke="#e8c44a" strokeWidth="2" strokeLinecap="round"/>
          <rect x="8" y="27" width="12" height="2.5" rx="1" fill="#e8c44a"/>
        </svg>

        {/* Headline */}
        <p
          style={{
            color:         "#ffffff",
            fontSize:      72,
            fontWeight:    900,
            lineHeight:    1.05,
            textAlign:     "center",
            marginBottom:  16,
            letterSpacing: "-0.02em",
          }}
        >
          Join My League
        </p>

        {/* Sub-label */}
        <p
          style={{
            color:         "#7a9e8a",
            fontSize:      24,
            fontWeight:    500,
            textAlign:     "center",
            marginBottom:  40,
          }}
        >
          {label} Predictions
        </p>

        {/* CTA chip */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          12,
            background:   "linear-gradient(135deg, #b8972a22, #b8972a10)",
            border:       "1px solid #b8972a55",
            borderRadius: 8,
            padding:      "16px 44px",
          }}
        >
          <span style={{ color: "#e8c44a", fontSize: 22, fontWeight: 700, letterSpacing: "0.02em" }}>
            Beat your mates  |  Free to play
          </span>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────── */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "0 64px 40px",
          position:       "relative",
        }}
      >
        <span style={{ color: "#3d6650", fontSize: 15, fontWeight: 600, letterSpacing: "0.06em" }}>
          superbrain.social
        </span>
        <span style={{ color: "#3d6650", fontSize: 14 }}>
          Free  |  No experience needed
        </span>
      </div>

      {/* Gold bottom border */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #b8972a60, transparent)", display: "flex" }} />
    </div>,
    size,
  );
}
