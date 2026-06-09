import { ImageResponse } from "next/og";

/**
 * OG image for /predict and all /predict/** routes that don't have their own.
 *
 * NO emoji — Satori / edge runtime cannot render emoji glyphs from system-ui.
 * Use SVG paths for all icons.
 *
 * 1200 x 630  |  image/png  |  edge runtime
 */

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt         = "SuperBrain World Cup 2026 Predictor — Predict every match. Compete for the Custom Champion Watch.";

// ── Shared SVG primitives ─────────────────────────────────────────────────────

// Soccer ball (pentagon-patch approximation)
function SoccerBall({ size: s = 56, color = "#b8972a" }: { size?: number; color?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" fill="none" />
      {/* top pentagon */}
      <polygon points="12,2.5 14.5,5.5 13,8 11,8 9.5,5.5" fill={color} opacity="0.85" />
      {/* right pentagon */}
      <polygon points="18.5,8 21,11.5 18.5,13.5 16,12 16,9" fill={color} opacity="0.85" />
      {/* lower-right */}
      <polygon points="17,17 14.5,21.5 12,20 11.5,17.5 14,15.5" fill={color} opacity="0.85" />
      {/* lower-left */}
      <polygon points="7,17 9.5,15.5 12,17.5 11.5,20 9,21.5" fill={color} opacity="0.85" />
      {/* left */}
      <polygon points="5.5,8 8,9 8,12 5.5,13.5 3,11.5" fill={color} opacity="0.85" />
    </svg>
  );
}

// Trophy
function Trophy({ size: s = 48, color = "#e8c44a" }: { size?: number; color?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Checkmark in circle
function Check({ color = "#b8972a" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill={color} fillOpacity="0.18" />
      <polyline points="5.5,10 8.5,13 14.5,7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Image() {
  const features = [
    "Predict every match",
    "Private leagues",
    "Compete for the Custom Champion Watch",
  ];

  return new ImageResponse(
    <div
      style={{
        background:    "linear-gradient(160deg, #0f2818 0%, #1a3a2a 50%, #0d2218 100%)",
        width:         "100%",
        height:        "100%",
        display:       "flex",
        flexDirection: "column",
        fontFamily:    "system-ui, -apple-system, sans-serif",
        position:      "relative",
        overflow:      "hidden",
      }}
    >
      {/* ── Gold top border ─────────────────────────────────── */}
      <div
        style={{
          position:   "absolute",
          top:        0, left: 0, right: 0,
          height:     4,
          background: "linear-gradient(90deg, #b8972a, #e8c44a 50%, #b8972a)",
          display:    "flex",
        }}
      />

      {/* ── Diagonal texture overlay ─────────────────────────── */}
      <div
        style={{
          position:   "absolute",
          inset:      0,
          background: "repeating-linear-gradient(135deg, transparent, transparent 50px, #ffffff03 50px, #ffffff03 51px)",
          display:    "flex",
        }}
      />

      {/* ── Gold radial glow — top centre ───────────────────── */}
      <div
        style={{
          position:   "absolute",
          top:        -160,
          left:       "50%",
          transform:  "translateX(-50%)",
          width:      900,
          height:     600,
          background: "radial-gradient(ellipse at 50% 0%, #b8972a1a 0%, transparent 65%)",
          display:    "flex",
        }}
      />

      {/* ── Right-side gold glow ─────────────────────────────── */}
      <div
        style={{
          position:   "absolute",
          top:        0, bottom: 0,
          right:      -100,
          width:      500,
          background: "radial-gradient(ellipse at 100% 50%, #b8972a14 0%, transparent 65%)",
          display:    "flex",
        }}
      />

      {/* ══════════════════════════════════════════════════════ */}
      {/*  MAIN LAYOUT: left copy | right visual                */}
      {/* ══════════════════════════════════════════════════════ */}
      <div
        style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "row",
          alignItems:     "stretch",
          padding:        "0 64px",
          gap:            0,
          position:       "relative",
        }}
      >
        {/* ── LEFT: copy ────────────────────────────────────── */}
        <div
          style={{
            flex:           1,
            display:        "flex",
            flexDirection:  "column",
            justifyContent: "center",
            paddingRight:   48,
            gap:            0,
          }}
        >
          {/* SuperBrain + WC badge row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
            {/* SB logo */}
            <div
              style={{
                width:          46,
                height:         46,
                background:     "#b8972a",
                borderRadius:   8,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "#0f1f17", fontWeight: 900, fontSize: 17, letterSpacing: "-0.5px" }}>SB</span>
            </div>
            <span style={{ color: "#7a9e8a", fontSize: 15, fontWeight: 700, letterSpacing: "0.24em" }}>
              SUPERBRAIN
            </span>

            {/* Separator */}
            <div style={{ width: 1, height: 20, background: "#3d6650", display: "flex", marginLeft: 4 }} />

            {/* WC 2026 badge */}
            <div
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          8,
                background:   "#b8972a14",
                border:       "1px solid #b8972a45",
                borderRadius: 5,
                padding:      "7px 14px",
              }}
            >
              <SoccerBall size={16} color="#b8972a" />
              <span style={{ color: "#b8972a", fontSize: 13, fontWeight: 700, letterSpacing: "0.16em" }}>
                WORLD CUP 2026
              </span>
            </div>
          </div>

          {/* Eyebrow */}
          <span
            style={{
              color:         "#b8972a",
              fontSize:      15,
              fontWeight:    700,
              letterSpacing: "0.2em",
              marginBottom:  12,
              textTransform: "uppercase",
              display:       "flex",
            }}
          >
            PREDICTOR
          </span>

          {/* Main headline */}
          <div
            style={{
              display:       "flex",
              flexDirection: "column",
              gap:           4,
              marginBottom:  28,
            }}
          >
            <span
              style={{
                color:         "#ffffff",
                fontSize:      62,
                fontWeight:    900,
                lineHeight:    1.02,
                letterSpacing: "-0.02em",
                display:       "flex",
              }}
            >
              World Cup 2026
            </span>
            <span
              style={{
                color:         "#e8c44a",
                fontSize:      62,
                fontWeight:    900,
                lineHeight:    1.02,
                letterSpacing: "-0.02em",
                display:       "flex",
              }}
            >
              Predictor
            </span>
          </div>

          {/* Feature list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
            {features.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Check color="#b8972a" />
                <span style={{ color: "#a8c4b0", fontSize: 18, fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* CTA chip */}
          <div
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          12,
              background:   "linear-gradient(135deg, #b8972a22, #b8972a0c)",
              border:       "1px solid #b8972a55",
              borderRadius: 8,
              padding:      "14px 28px",
              alignSelf:    "flex-start",
            }}
          >
            <span style={{ color: "#e8c44a", fontSize: 18, fontWeight: 700, letterSpacing: "0.04em" }}>
              Free to play  |  superbrain.social
            </span>
          </div>
        </div>

        {/* ── RIGHT: visual ─────────────────────────────────── */}
        <div
          style={{
            width:          340,
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            gap:            24,
            position:       "relative",
          }}
        >
          {/* Large soccer ball */}
          <div style={{ display: "flex", position: "relative" }}>
            {/* Glow */}
            <div
              style={{
                position:   "absolute",
                inset:      -40,
                background: "radial-gradient(ellipse at center, #b8972a20 0%, transparent 70%)",
                display:    "flex",
                borderRadius: "50%",
              }}
            />
            <SoccerBall size={160} color="#b8972a" />
          </div>

          {/* Trophy */}
          <div
            style={{
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              gap:            10,
              background:     "#b8972a10",
              border:         "1px solid #b8972a40",
              borderRadius:   12,
              padding:        "20px 36px",
            }}
          >
            <Trophy size={40} color="#e8c44a" />
            <span
              style={{
                color:         "#e8c44a",
                fontSize:      14,
                fontWeight:    700,
                letterSpacing: "0.12em",
                textAlign:     "center",
                display:       "flex",
              }}
            >
              CUSTOM CHAMPION WATCH
            </span>
            <span
              style={{
                color:     "#7a9e8a",
                fontSize:  12,
                textAlign: "center",
                display:   "flex",
              }}
            >
              Grand Prize for #1 Predictor
            </span>
          </div>
        </div>
      </div>

      {/* ── Gold bottom border ──────────────────────────────── */}
      <div
        style={{
          position:   "absolute",
          bottom:     0, left: 0, right: 0,
          height:     3,
          background: "linear-gradient(90deg, transparent, #b8972a70, transparent)",
          display:    "flex",
        }}
      />
    </div>,
    size,
  );
}
