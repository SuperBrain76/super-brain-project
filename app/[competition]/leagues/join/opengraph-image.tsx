import { ImageResponse } from "next/og";
import { OG, SBWordmark, GoldTop, competitionLabel } from "@/lib/ogTheme";

/** Fallback OG image for a join link with no resolvable league code. Per-league
 *  invites use ../[leagueId]/opengraph-image instead. No emoji (Satori). */

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt         = "Join a prediction league on SuperBrain";

export default function Image({ params }: { params: { competition?: string } }) {
  const label = competitionLabel(params?.competition);

  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", backgroundColor: OG.black, backgroundImage: OG.bgImage, position: "relative",
      display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <GoldTop />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "44px 64px 0" }}>
        <SBWordmark />
        {label ? (
          <div style={{ display: "flex", background: "rgba(232,193,90,0.12)", border: `1px solid ${OG.gold}55`, borderRadius: 8, padding: "10px 20px" }}>
            <span style={{ color: OG.gold, fontSize: 15, fontWeight: 800, letterSpacing: "0.14em" }}>{label.toUpperCase()}</span>
          </div>
        ) : <div style={{ display: "flex" }} />}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 80px", textAlign: "center" }}>
        <div style={{ display: "flex", color: OG.ink, fontSize: 88, fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          Join the league
        </div>
        <p style={{ color: OG.muted, fontSize: 27, marginTop: 22 }}>
          {label ? `Predict every ${label} match, beat your mates and top the table.` : "Predict every match, beat your mates and top the table."}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px 44px" }}>
        <span style={{ display: "flex", color: OG.dim, fontSize: 16, letterSpacing: "0.05em" }}>superbrain.social</span>
        <div style={{ display: "flex", background: OG.gold, borderRadius: 999, padding: "14px 34px" }}>
          <span style={{ color: OG.goldInk, fontSize: 24, fontWeight: 900 }}>Join free →</span>
        </div>
      </div>
    </div>,
    size,
  );
}
