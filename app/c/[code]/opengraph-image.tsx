import { ImageResponse } from "next/og";
import { fetchChallengeOG } from "@/lib/og";
import { OG, SBWordmark, GoldTop } from "@/lib/ogTheme";

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { code: string } }) {
  const c = await fetchChallengeOG(params.code);
  const name  = c?.name ?? "Matchday Challenge";
  const venue = c?.venueName ?? "";
  const nMatches = c?.fixtures ?? 0;
  const nameSize = name.length > 26 ? 60 : name.length > 16 ? 76 : 92;

  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", backgroundColor: OG.black, backgroundImage: OG.bgImage, position: "relative",
      display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <GoldTop />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "44px 64px 0" }}>
        <SBWordmark />
        <div style={{ display: "flex", background: "rgba(232,193,90,0.12)", border: `1px solid ${OG.gold}55`, borderRadius: 8, padding: "10px 20px" }}>
          <span style={{ color: OG.gold, fontSize: 15, fontWeight: 800, letterSpacing: "0.14em" }}>MATCHDAY CHALLENGE</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 80px", textAlign: "center" }}>
        {venue ? <div style={{ display: "flex", color: OG.muted, fontSize: 24, fontWeight: 700, marginBottom: 14 }}>{venue}</div> : <div style={{ display: "flex" }} />}
        <div style={{ display: "flex", color: OG.ink, fontSize: nameSize, fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.02em" }}>{name}</div>
        {nMatches > 0 && (
          <div style={{ display: "flex", background: "#ffffff0a", border: "1px solid #ffffff18", borderRadius: 999, padding: "8px 22px", marginTop: 26 }}>
            <span style={{ color: OG.muted, fontSize: 18 }}>Predict {nMatches} match{nMatches === 1 ? "" : "es"} across competitions</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px 44px" }}>
        <span style={{ display: "flex", color: OG.dim, fontSize: 16, letterSpacing: "0.05em" }}>superbrain.social</span>
        <div style={{ display: "flex", background: OG.gold, borderRadius: 999, padding: "14px 34px" }}>
          <span style={{ color: OG.goldInk, fontSize: 24, fontWeight: 900 }}>Play free →</span>
        </div>
      </div>
    </div>,
    size,
  );
}
