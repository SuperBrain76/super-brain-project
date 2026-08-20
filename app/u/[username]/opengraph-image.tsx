import { ImageResponse } from "next/og";
import { fetchProfileOG } from "@/lib/og";
import { OG, SBWordmark, GoldTop } from "@/lib/ogTheme";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// No emoji — Satori can't render them from system-ui.

export default async function Image({ params }: { params: { username: string } }) {
  const d = await fetchProfileOG(params.username);
  const name = d?.displayName ?? "SuperBrain Member";
  const handle = d?.username ?? params.username;
  const isPublic = d?.isPublic !== false;
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "SB";

  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", backgroundColor: OG.black, backgroundImage: OG.bgImage, position: "relative",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: 70, fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <GoldTop />

      <div style={{ display: "flex", alignItems: "center", marginBottom: 36 }}>
        <div style={{
          width: 120, height: 120, borderRadius: 28, background: OG.gold,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 52, fontWeight: 900, color: OG.goldInk, marginRight: 28,
        }}>
          {initials}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 56, fontWeight: 900, color: OG.ink, letterSpacing: "-0.02em" }}>{name}</span>
          <span style={{ fontSize: 30, color: OG.muted }}>@{handle}</span>
        </div>
      </div>

      {isPublic && d ? (
        <div style={{ display: "flex", gap: 20 }}>
          {d.levelName && <Badge label="Level" value={d.levelName} />}
          {d.balance != null && <Badge label={d.currencyCode ?? "Balance"} value={d.balance.toLocaleString()} />}
          {d.achievements != null && <Badge label="Badges" value={String(d.achievements)} />}
        </div>
      ) : (
        <span style={{ fontSize: 30, color: OG.muted, display: "flex" }}>
          {isPublic ? "Predicting on SuperBrain" : "This profile is private"}
        </span>
      )}

      <div style={{ position: "absolute", bottom: 50, left: 70, display: "flex" }}>
        <SBWordmark chip={38} />
      </div>
    </div>,
    { ...size },
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", padding: "20px 30px",
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 20,
    }}>
      <span style={{ fontSize: 22, color: OG.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ fontSize: 44, fontWeight: 900, color: OG.gold }}>{value}</span>
    </div>
  );
}
