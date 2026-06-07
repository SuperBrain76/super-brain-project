import { ImageResponse } from "next/og";

/**
 * Static fallback OG image for league join links when no league code is
 * provided or the code is invalid. Shown as the social card for:
 *   /predict/leagues/join  (no ?code param)
 *
 * When a valid code resolves to a league, the join page's generateMetadata
 * points to the dynamic /predict/leagues/[leagueId]/opengraph-image instead.
 */

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt         = "Join a World Cup 2026 Prediction League — SuperBrain";

export default function Image() {
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
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #b8972a, #e8c44a, #b8972a)" }} />

      {/* Subtle diagonal texture */}
      <div
        style={{
          position:   "absolute",
          inset:      0,
          background: "repeating-linear-gradient(135deg, transparent, transparent 40px, #ffffff03 40px, #ffffff03 41px)",
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
        }}
      />

      {/* ── Top bar ───────────────────────────────────────────── */}
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

        {/* World Cup badge */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          10,
            background:   "#b8972a15",
            border:       "1px solid #b8972a50",
            borderRadius: 6,
            padding:      "10px 20px",
          }}
        >
          <span style={{ fontSize: 20 }}>⚽</span>
          <span style={{ color: "#b8972a", fontSize: 14, fontWeight: 700, letterSpacing: "0.14em" }}>
            WORLD CUP 2026
          </span>
        </div>
      </div>

      {/* ── Centre content ────────────────────────────────────── */}
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
        {/* Trophy */}
        <span style={{ fontSize: 80, marginBottom: 28, lineHeight: 1 }}>🏆</span>

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
            letterSpacing: "0.01em",
          }}
        >
          World Cup 2026 Predictions
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
            padding:      "16px 40px",
          }}
        >
          <span style={{ color: "#e8c44a", fontSize: 22, fontWeight: 700, letterSpacing: "0.02em" }}>
            Predict the World Cup · Free to play
          </span>
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────── */}
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
          Free · No experience needed
        </span>
      </div>

      {/* Gold bottom border */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #b8972a60, transparent)" }} />
    </div>,
    size,
  );
}
