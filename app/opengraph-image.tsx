import { ImageResponse } from "next/og";
import { OG, SBWordmark, GoldTop, Pill } from "@/lib/ogTheme";

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt         = "SuperBrain — free sports prediction leagues";

export default function Image() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", backgroundColor: OG.black, backgroundImage: OG.bgImage, position: "relative",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: 64,
    }}>
      <GoldTop />

      <div style={{ display: "flex", marginBottom: 44 }}><SBWordmark chip={50} /></div>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        fontSize: 76, fontWeight: 900, color: OG.ink, textAlign: "center",
        lineHeight: 1.04, letterSpacing: "-0.02em",
      }}>
        <span>Predict the match.</span>
        <span style={{ color: OG.gold }}>Top the table.</span>
      </div>

      <p style={{ color: OG.muted, fontSize: 27, textAlign: "center", marginTop: 26, marginBottom: 40, maxWidth: 860 }}>
        Free prediction leagues for you and your mates — the Premier League, Champions League, La Liga, ice hockey and more.
      </p>

      <div style={{ display: "flex" }}><Pill filled>Free · No app · Any league</Pill></div>

      <div style={{ position: "absolute", bottom: 40, display: "flex", color: OG.dim, fontSize: 17, letterSpacing: "0.04em" }}>
        superbrain.social
      </div>
    </div>,
    size,
  );
}
