import { ImageResponse } from "next/og";

/**
 * OG image for /predict/prize
 * Highlights the Custom Champion Watch grand prize.
 * NO emoji — SVG only (Satori / edge runtime limitation).
 */

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt         = "Custom Champion Watch — Grand Prize, SuperBrain World Cup Prediction 2026";

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

function Check({ color = "#b8972a" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="10" fill={color} fillOpacity="0.15" />
      <polyline points="6,11 9.5,14.5 16,8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Image() {
  const facts = [
    "Custom-built luxury watch",
    "Assembled in Sweden",
    "Swiss movement",
    "Personalized winner engraving",
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
      {/* Gold top border */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #b8972a, #e8c44a 50%, #b8972a)", display: "flex" }} />

      {/* Diagonal texture */}
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg, transparent, transparent 50px, #ffffff03 50px, #ffffff03 51px)", display: "flex" }} />

      {/* Gold glow */}
      <div style={{ position: "absolute", top: -160, left: "50%", transform: "translateX(-50%)", width: 900, height: 600, background: "radial-gradient(ellipse at 50% 0%, #b8972a1c 0%, transparent 65%)", display: "flex" }} />

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 72px", gap: 64, position: "relative" }}>

        {/* Left: trophy visual */}
        <div
          style={{
            width:          280,
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            gap:            24,
            flexShrink:     0,
          }}
        >
          {/* Giant trophy */}
          <div style={{ display: "flex", position: "relative" }}>
            <div style={{ position: "absolute", inset: -40, background: "radial-gradient(ellipse at center, #b8972a28 0%, transparent 70%)", display: "flex", borderRadius: "50%" }} />
            <Trophy size={180} color="#e8c44a" />
          </div>

          <div
            style={{
              background:   "#b8972a18",
              border:       "1px solid #b8972a50",
              borderRadius: 8,
              padding:      "10px 22px",
              display:      "flex",
            }}
          >
            <span style={{ color: "#e8c44a", fontSize: 15, fontWeight: 700, letterSpacing: "0.14em" }}>
              GRAND PRIZE
            </span>
          </div>
        </div>

        {/* Right: copy */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>

          {/* SuperBrain logo row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <div style={{ width: 42, height: 42, background: "#b8972a", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#0f1f17", fontWeight: 900, fontSize: 15 }}>SB</span>
            </div>
            <span style={{ color: "#7a9e8a", fontSize: 14, fontWeight: 700, letterSpacing: "0.24em" }}>SUPERBRAIN</span>
          </div>

          {/* Eyebrow */}
          <span style={{ color: "#b8972a", fontSize: 14, fontWeight: 700, letterSpacing: "0.2em", marginBottom: 12, display: "flex" }}>
            WORLD CUP 2026 PREDICTOR
          </span>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 30 }}>
            <span style={{ color: "#ffffff", fontSize: 52, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em", display: "flex" }}>
              Win the Custom
            </span>
            <span style={{ color: "#e8c44a", fontSize: 52, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em", display: "flex" }}>
              Champion Watch
            </span>
          </div>

          {/* Facts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
            {facts.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Check color="#b8972a" />
                <span style={{ color: "#a8c4b0", fontSize: 17, fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Footer line */}
          <span style={{ color: "#3d6650", fontSize: 14, fontWeight: 600, letterSpacing: "0.08em", display: "flex" }}>
            superbrain.social  |  Free to enter  |  Predict every match
          </span>
        </div>
      </div>

      {/* Gold bottom border */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #b8972a70, transparent)", display: "flex" }} />
    </div>,
    size,
  );
}
