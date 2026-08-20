import { ImageResponse } from "next/og";
import { fetchLeagueOGById } from "@/lib/og";
import { OG, SBWordmark, GoldTop, competitionLabel } from "@/lib/ogTheme";

export const runtime     = "edge";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

// NO emoji — Satori cannot render emoji from system-ui. Inline SVG / text only.

export default async function Image({ params }: { params: { competition: string; leagueId: string } }) {
  const league = await fetchLeagueOGById(params.leagueId);
  const name   = league?.name ?? "Prediction League";
  const count  = league?.memberCount ?? 0;
  const label  = competitionLabel(params.competition);

  const nameSize = name.length > 30 ? 56 : name.length > 22 ? 68 : name.length > 14 ? 80 : 92;

  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", backgroundColor: OG.black, backgroundImage: OG.bgImage, position: "relative",
      display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <GoldTop />

      {/* Top bar: wordmark + competition badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "44px 64px 0" }}>
        <SBWordmark />
        {label ? (
          <div style={{ display: "flex", background: "rgba(232,193,90,0.12)", border: `1px solid ${OG.gold}55`, borderRadius: 8, padding: "10px 20px" }}>
            <span style={{ color: OG.gold, fontSize: 15, fontWeight: 800, letterSpacing: "0.14em" }}>{label.toUpperCase()}</span>
          </div>
        ) : <div style={{ display: "flex" }} />}
      </div>

      {/* Centre: invited → league name → members */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 80px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <div style={{ width: 40, height: 1, background: `${OG.gold}55`, display: "flex" }} />
          <span style={{ color: OG.gold, fontSize: 17, fontWeight: 800, letterSpacing: "0.22em" }}>YOU&apos;RE INVITED TO</span>
          <div style={{ width: 40, height: 1, background: `${OG.gold}55`, display: "flex" }} />
        </div>

        <div style={{ display: "flex", color: OG.ink, fontSize: nameSize, fontWeight: 900, lineHeight: 1.06, letterSpacing: "-0.02em" }}>
          {name}
        </div>

        {count > 0 && (
          <div style={{ display: "flex", background: "#ffffff0a", border: "1px solid #ffffff18", borderRadius: 999, padding: "8px 22px", marginTop: 26 }}>
            <span style={{ color: OG.muted, fontSize: 18 }}>{count} {count === 1 ? "player" : "players"} already competing</span>
          </div>
        )}
      </div>

      {/* Bottom: Join free CTA + url */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px 44px" }}>
        <span style={{ display: "flex", color: OG.dim, fontSize: 16, letterSpacing: "0.05em" }}>superbrain.social</span>
        <div style={{ display: "flex", background: OG.gold, borderRadius: 999, padding: "14px 34px" }}>
          <span style={{ color: OG.goldInk, fontSize: 24, fontWeight: 900, letterSpacing: "0.01em" }}>Join free →</span>
        </div>
      </div>
    </div>,
    size,
  );
}
