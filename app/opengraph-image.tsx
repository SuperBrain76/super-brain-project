import { ImageResponse } from "next/og";

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt         = "SuperBrain — Test Your Mind Under Pressure";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(135deg, #080b0f 0%, #0d1117 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: "60px",
        position: "relative",
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "48px" }}>
        <div
          style={{
            width: "44px", height: "44px",
            background: "#00d4ff",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "6px",
          }}
        >
          <span style={{ color: "#080b0f", fontWeight: 900, fontSize: "16px" }}>SB</span>
        </div>
        <span style={{ color: "#718096", fontSize: "18px", fontWeight: 700, letterSpacing: "0.25em" }}>SUPERBRAIN</span>
      </div>

      {/* Headline */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.25em",
          fontSize: "64px", fontWeight: 900, color: "#ffffff",
          textAlign: "center", lineHeight: 1.1, marginBottom: "24px",
          letterSpacing: "-0.02em",
        }}
      >
        <span>How sharp is</span>
        <span style={{ color: "#00d4ff" }}>your mind?</span>
      </div>

      {/* Subtext */}
      <p style={{ color: "#718096", fontSize: "24px", textAlign: "center", marginBottom: "40px" }}>
        Precision cognitive tests. Instant results. See where you stand.
      </p>

      {/* CTA pill */}
      <div
        style={{
          background: "#00d4ff15",
          border: "1px solid #00d4ff40",
          borderRadius: "6px",
          padding: "14px 32px",
          display: "flex",
        }}
      >
        <span style={{ color: "#00d4ff", fontSize: "20px", fontWeight: 600 }}>
          Free · No signup · Results in 2 min
        </span>
      </div>

      {/* URL */}
      <div
        style={{
          display: "flex", position: "absolute", bottom: "40px",
          color: "#4a5568", fontSize: "16px",
        }}
      >
        superbrain.social
      </div>
    </div>,
    size,
  );
}
