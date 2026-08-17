import { ImageResponse } from "next/og";
import { fetchLeagueOGById } from "@/lib/og";

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

// NO emoji anywhere in this file — Satori / edge runtime cannot render emoji
// glyphs from system-ui. Use SVG paths or plain Unicode symbols only.

export default async function Image({ params }: { params: { leagueId: string } }) {
  const league = await fetchLeagueOGById(params.leagueId);
  const name   = league?.name ?? "WC League";
  const count  = league?.memberCount ?? 0;

  const nameFontSize = name.length > 28 ? 58 : name.length > 20 ? 70 : name.length > 14 ? 82 : 94;

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
          // Satori cannot parse repeating-linear-gradient; see the note in
          // ../join/opengraph-image.tsx.
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

        {/* WC 2026 badge — SVG ball instead of emoji */}
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
          {/* Soccer ball SVG */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="#b8972a" strokeWidth="1.5" fill="none"/>
            <polygon points="10,3 12.5,6.5 10,8.5 7.5,6.5" fill="#b8972a" opacity="0.8"/>
            <polygon points="15.5,7 17,10.5 14,11.5 12.5,8.5" fill="#b8972a" opacity="0.8"/>
            <polygon points="14,14.5 11,16 10,13 12.5,11.5" fill="#b8972a" opacity="0.8"/>
            <polygon points="8,13 7,16 4,14.5 5.5,11.5" fill="#b8972a" opacity="0.8"/>
            <polygon points="3,10.5 4.5,7 7.5,8.5 6,11.5" fill="#b8972a" opacity="0.8"/>
          </svg>
          <span style={{ color: "#b8972a", fontSize: 14, fontWeight: 700, letterSpacing: "0.14em" }}>
            WORLD CUP 2026
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
        }}
      >
        {/* "JOIN MY LEAGUE" label with rules */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 40, height: 1, background: "#b8972a60", display: "flex" }} />
          <span style={{ color: "#b8972a", fontSize: 16, fontWeight: 700, letterSpacing: "0.22em" }}>
            JOIN MY LEAGUE
          </span>
          <div style={{ width: 40, height: 1, background: "#b8972a60", display: "flex" }} />
        </div>

        {/* League name */}
        <p
          style={{
            color:         "#ffffff",
            fontSize:      nameFontSize,
            fontWeight:    900,
            lineHeight:    1.08,
            textAlign:     "center",
            marginBottom:  32,
            letterSpacing: "-0.02em",
          }}
        >
          {name}
        </p>

        {/* Member count chip — only if available */}
        {count > 0 && (
          <div
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          8,
              background:   "#ffffff0a",
              border:       "1px solid #ffffff18",
              borderRadius: 20,
              padding:      "8px 20px",
              marginBottom: 32,
            }}
          >
            <span style={{ color: "#7a9e8a", fontSize: 16 }}>
              {count} {count === 1 ? "predictor" : "predictors"} competing
            </span>
          </div>
        )}

        {/* Trophy SVG + CTA */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          16,
            background:   "linear-gradient(135deg, #b8972a22, #b8972a10)",
            border:       "1px solid #b8972a55",
            borderRadius: 8,
            padding:      "16px 44px",
            marginTop:    count > 0 ? 0 : 8,
          }}
        >
          {/* Trophy SVG */}
          <svg width="28" height="30" viewBox="0 0 28 30" fill="none">
            <path d="M4 2h20M4 2C4 2 2 2 2 6c0 5 4 8 7 9M24 2c0 0 2 0 2 4c0 5-4 8-7 9M9 15c0 4 2 7 5 8m5-8c0 4-2 7-5 8m0 0v4m0 0H9m5 0h5" stroke="#e8c44a" strokeWidth="2" strokeLinecap="round"/>
            <rect x="8" y="27" width="12" height="2.5" rx="1" fill="#e8c44a"/>
          </svg>
          <span style={{ color: "#e8c44a", fontSize: 22, fontWeight: 700, letterSpacing: "0.02em" }}>
            Predict the WC
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
          Free to play  |  Predict every match
        </span>
      </div>

      {/* Gold bottom border */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #b8972a60, transparent)", display: "flex" }} />
    </div>,
    size,
  );
}
