import { ImageResponse } from "next/og";
import { OG, SBWordmark, GoldTop, Pill } from "@/lib/ogTheme";

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt         = "SuperBrain for Venues — your bar's own prediction league";

export default function Image() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", backgroundColor: OG.black, backgroundImage: OG.bgImage, position: "relative",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: 64, textAlign: "center",
    }}>
      <GoldTop />

      <div style={{ display: "flex", marginBottom: 34 }}><SBWordmark chip={48} /></div>

      <div style={{ display: "flex", color: OG.gold, fontSize: 22, fontWeight: 800, letterSpacing: "0.26em", marginBottom: 18 }}>
        FOR SPORTS BARS &amp; PUBS
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: OG.ink, fontSize: 68, fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.02em" }}>
        <span>Your bar&apos;s own</span>
        <span style={{ color: OG.gold }}>prediction league</span>
      </div>

      <p style={{ color: OG.muted, fontSize: 26, marginTop: 24, marginBottom: 38, maxWidth: 820 }}>
        Your name, your logo, your colours. Regulars scan a QR, predict the football, and come back every matchweek.
      </p>

      <div style={{ display: "flex" }}><Pill filled>Free trial · No card · Live the same day</Pill></div>

      <div style={{ position: "absolute", bottom: 40, display: "flex", color: OG.dim, fontSize: 17, letterSpacing: "0.04em" }}>
        superbrain.social/venues
      </div>
    </div>,
    size,
  );
}
