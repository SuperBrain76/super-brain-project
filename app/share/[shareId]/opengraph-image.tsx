import { ImageResponse } from "next/og";
import { fetchOGData, scoreColor } from "@/lib/og";

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { shareId: string } }) {
  const d     = await fetchOGData(params.shareId);
  const color = d ? scoreColor(d.score) : "#00d4ff";

  return new ImageResponse(
    <div
      style={{
        background:    "linear-gradient(135deg, #080b0f 0%, #0d1117 100%)",
        width:         "100%",
        height:        "100%",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        justifyContent:"center",
        fontFamily:    "system-ui, sans-serif",
        padding:       "60px",
        position:      "relative",
      }}
    >
      {/* Accent glow */}
      <div
        style={{
          position:     "absolute",
          top:          0, left: "50%",
          transform:    "translateX(-50%)",
          width:        "800px",
          height:       "300px",
          background:   `radial-gradient(ellipse at 50% 0%, ${color}18 0%, transparent 70%)`,
          pointerEvents:"none",
        }}
      />

      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
        <div
          style={{
            width: "40px", height: "40px",
            background: "#00d4ff",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: "5px",
          }}
        >
          <span style={{ color: "#080b0f", fontWeight: 900, fontSize: "14px" }}>SB</span>
        </div>
        <span style={{ color: "#718096", fontSize: "16px", fontWeight: 700, letterSpacing: "0.25em" }}>SUPERBRAIN</span>
      </div>

      {/* Display name */}
      <p style={{ color: "#718096", fontSize: "22px", marginBottom: "8px" }}>
        {d ? d.displayName : "Someone"} scored
      </p>

      {/* Score */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "16px" }}>
        <span style={{ color, fontSize: "136px", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em" }}>
          {d?.score ?? "—"}
        </span>
        <span style={{ color: "#4a5568", fontSize: "40px", fontWeight: 700 }}>/100</span>
      </div>

      {/* Test name */}
      <p style={{ color: "#718096", fontSize: "20px", marginBottom: "10px" }}>
        {d?.testName ?? "SuperBrain Test"}
      </p>

      {/* Result title */}
      <p style={{ color, fontSize: "28px", fontWeight: 700, marginBottom: "36px" }}>
        {d?.resultTitle ?? ""}
      </p>

      {/* CTA */}
      <div
        style={{
          background:   "#00d4ff12",
          border:       "1px solid #00d4ff35",
          borderRadius: "6px",
          padding:      "12px 28px",
          display:      "flex",
        }}
      >
        <span style={{ color: "#00d4ff", fontSize: "18px", fontWeight: 600 }}>
          Can you beat this score?
        </span>
      </div>

      {/* URL */}
      <span style={{ position: "absolute", bottom: "36px", color: "#4a5568", fontSize: "15px" }}>
        superbrain.social
      </span>
    </div>,
    size,
  );
}
