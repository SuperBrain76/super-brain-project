import { ImageResponse } from "next/og";
import { OG, SBWordmark, GoldTop, competitionLabel } from "@/lib/ogTheme";

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt         = "Predict the season on SuperBrain";

export default function Image({ params }: { params: { competition: string } }) {
  const label = competitionLabel(params.competition) || "Football";
  const nameSize = label.length > 22 ? 76 : label.length > 14 ? 92 : 110;

  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", backgroundColor: OG.black, backgroundImage: OG.bgImage, position: "relative",
      display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <GoldTop />

      <div style={{ display: "flex", padding: "48px 64px 0" }}><SBWordmark /></div>

      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "0 72px", textAlign: "center",
      }}>
        <div style={{ display: "flex", color: OG.gold, fontSize: 22, fontWeight: 800, letterSpacing: "0.26em", marginBottom: 18 }}>
          PREDICTION LEAGUE
        </div>
        <div style={{ display: "flex", color: OG.ink, fontSize: nameSize, fontWeight: 900, lineHeight: 1.0, letterSpacing: "-0.02em" }}>
          {label}
        </div>
        <div style={{ display: "flex", color: OG.gold, fontSize: nameSize * 0.62, fontWeight: 900, letterSpacing: "-0.01em", marginTop: 4 }}>
          Predictor
        </div>
        <p style={{ color: OG.muted, fontSize: 26, marginTop: 26 }}>
          Predict every match · Start a private league · Free to play
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px 40px" }}>
        <span style={{ display: "flex", color: OG.dim, fontSize: 16, letterSpacing: "0.05em" }}>superbrain.social</span>
        <span style={{ display: "flex", color: OG.dim, fontSize: 15 }}>No app · Just bragging rights</span>
      </div>
    </div>,
    size,
  );
}
