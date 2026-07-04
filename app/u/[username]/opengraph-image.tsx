import { ImageResponse } from "next/og";
import { fetchProfileOG } from "@/lib/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { username: string } }) {
  const d = await fetchProfileOG(params.username);
  const name = d?.displayName ?? "SuperBrain Partner";
  const handle = d?.username ?? params.username;
  const isPublic = d?.isPublic !== false;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "70px",
          fontFamily: "system-ui, sans-serif",
          background: "linear-gradient(150deg, #24513a 0%, #0f2419 60%, #142d20 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute", top: 0, right: 0, width: "520px", height: "520px",
            background: "radial-gradient(circle at 70% 30%, rgba(201,162,39,0.35), transparent 70%)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", marginBottom: "36px" }}>
          <div
            style={{
              width: "120px", height: "120px", borderRadius: "28px", background: "#c9a227",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "52px", fontWeight: 800, color: "#0f2419", marginRight: "28px",
            }}
          >
            {name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "SB"}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "56px", fontWeight: 800, color: "#ffffff" }}>{name}</span>
            <span style={{ fontSize: "30px", color: "#bfccc2" }}>@{handle}</span>
          </div>
        </div>

        {isPublic && d ? (
          <div style={{ display: "flex", gap: "20px" }}>
            {d.levelName && (
              <Badge label="Partner Level" value={`${d.levelIcon ?? "⭐"} ${d.levelName}`} />
            )}
            {d.balance != null && (
              <Badge label={d.currencyCode ?? "Balance"} value={d.balance.toLocaleString()} />
            )}
            {d.achievements != null && (
              <Badge label="Badges" value={String(d.achievements)} />
            )}
          </div>
        ) : (
          <span style={{ fontSize: "30px", color: "#bfccc2" }}>
            {isPublic ? "On the SuperBrain contribution economy" : "This profile is private"}
          </span>
        )}

        <div style={{ position: "absolute", bottom: "50px", left: "70px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: "28px", fontWeight: 700, color: "#e7cf7a" }}>🧠 SuperBrain</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", padding: "20px 30px",
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: "20px",
      }}
    >
      <span style={{ fontSize: "22px", color: "#bfccc2", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ fontSize: "44px", fontWeight: 800, color: "#e7cf7a" }}>{value}</span>
    </div>
  );
}
