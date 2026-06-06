import { ImageResponse } from "next/og";
import { fetchLeagueOGById } from "@/lib/og";

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { leagueId: string } }) {
  const league = await fetchLeagueOGById(params.leagueId);
  const name   = league?.name        ?? "World Cup League";
  const count  = league?.memberCount ?? 0;

  return new ImageResponse(
    <div
      style={{
        background:    "linear-gradient(135deg, #080b0f 0%, #0d1117 60%, #091510 100%)",
        width:         "100%",
        height:        "100%",
        display:       "flex",
        flexDirection: "column",
        fontFamily:    "system-ui, sans-serif",
        position:      "relative",
        overflow:      "hidden",
      }}
    >
      {/* Top accent glow */}
      <div
        style={{
          position:   "absolute",
          top:        -80,
          left:       "50%",
          transform:  "translateX(-50%)",
          width:      900,
          height:     400,
          background: "radial-gradient(ellipse at 50% 0%, #00e67622 0%, transparent 68%)",
        }}
      />

      {/* Grid lines — cockpit aesthetic */}
      <div
        style={{
          position:   "absolute",
          inset:      0,
          background: "repeating-linear-gradient(0deg, transparent, transparent 59px, #ffffff04 59px, #ffffff04 60px), repeating-linear-gradient(90deg, transparent, transparent 59px, #ffffff04 59px, #ffffff04 60px)",
        }}
      />

      {/* Top bar — logo + WC label */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "44px 60px 0",
          position:       "relative",
        }}
      >
        {/* SB logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width:           44,
              height:          44,
              background:      "#00d4ff",
              borderRadius:    6,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
            }}
          >
            <span style={{ color: "#080b0f", fontWeight: 900, fontSize: 16 }}>SB</span>
          </div>
          <span style={{ color: "#4a6a7a", fontSize: 16, fontWeight: 700, letterSpacing: "0.22em" }}>
            SUPERBRAIN
          </span>
        </div>

        {/* WC badge */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          8,
            background:   "#00e67612",
            border:       "1px solid #00e67638",
            borderRadius: 4,
            padding:      "8px 18px",
          }}
        >
          <span style={{ fontSize: 18 }}>⚽</span>
          <span style={{ color: "#00e676", fontSize: 14, fontWeight: 700, letterSpacing: "0.12em" }}>
            WORLD CUP 2026
          </span>
        </div>
      </div>

      {/* Centre content */}
      <div
        style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "0 80px",
          gap:            0,
          position:       "relative",
        }}
      >
        {/* "Prediction League" label */}
        <p
          style={{
            color:         "#4a6a7a",
            fontSize:      20,
            fontWeight:    600,
            letterSpacing: "0.18em",
            marginBottom:  20,
            textTransform: "uppercase",
          }}
        >
          Prediction League
        </p>

        {/* League name */}
        <p
          style={{
            color:         "#ffffff",
            fontSize:      name.length > 24 ? 68 : name.length > 16 ? 80 : 96,
            fontWeight:    900,
            lineHeight:    1.05,
            textAlign:     "center",
            marginBottom:  32,
            letterSpacing: "-0.02em",
          }}
        >
          {name}
        </p>

        {/* Member count chip */}
        {count > 0 && (
          <div
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          8,
              background:   "#ffffff08",
              border:       "1px solid #ffffff18",
              borderRadius: 4,
              padding:      "8px 20px",
              marginBottom: 44,
            }}
          >
            <span style={{ color: "#718096", fontSize: 16 }}>
              {count} {count === 1 ? "predictor" : "predictors"} competing
            </span>
          </div>
        )}

        {/* CTA */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          12,
            background:   "#00e67618",
            border:       "1px solid #00e67650",
            borderRadius: 6,
            padding:      "16px 36px",
          }}
        >
          <span style={{ fontSize: 24 }}>🏆</span>
          <span style={{ color: "#00e676", fontSize: 22, fontWeight: 700 }}>
            Join now — it&apos;s free
          </span>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "0 60px 40px",
          position:       "relative",
        }}
      >
        <span style={{ color: "#2d3f4f", fontSize: 15, fontWeight: 600, letterSpacing: "0.08em" }}>
          superbrain.social
        </span>
        <span style={{ color: "#2d3f4f", fontSize: 14 }}>
          SB Champion Watch · Predict every match
        </span>
      </div>
    </div>,
    size,
  );
}
