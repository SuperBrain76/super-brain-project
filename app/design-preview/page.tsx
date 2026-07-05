import { BRAND, MATERIAL } from "@/lib/brand";

// Reference screen — the "Midnight Gold, sculpted" direction. Hardcoded sample
// values; no data, no nav. Delete once the language is approved and rolled out.
export default function DesignPreview() {
  return (
    <div style={{ minHeight: "100vh", background: MATERIAL.vignette, color: BRAND.ink, fontFamily: "var(--font-sans, system-ui)" }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "28px 24px 64px" }}>

        {/* Wordmark — quiet, monochrome */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 15, letterSpacing: "0.32em", color: BRAND.muted }}>SUPERBRAIN</span>
          <span style={{ fontSize: 12, color: BRAND.dim, letterSpacing: "0.1em" }}>Member</span>
        </div>

        {/* IQ — the sculpted hero. Framed by the icon's gold ring + glow. Boxless. */}
        <div style={{ position: "relative", height: 300, display: "flex", alignItems: "center", justifyContent: "center", margin: "18px 0 4px" }}>
          <div style={{ position: "absolute", width: 300, height: 300, background: MATERIAL.goldGlow, filter: "blur(2px)" }} />
          <div style={{ position: "absolute", width: 236, height: 236, borderRadius: "50%", border: `1px solid ${MATERIAL.ringFaint}` }} />
          <div style={{ position: "absolute", width: 236, height: 236, borderRadius: "50%", border: "1.5px solid transparent", borderTopColor: MATERIAL.ring, borderRightColor: MATERIAL.ring, transform: "rotate(-38deg)" }} />
          <div style={{ position: "relative", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.34em", color: BRAND.dim }}>YOUR IQ</p>
            <p style={{
              margin: "6px 0 0", fontSize: 76, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.03em",
              background: MATERIAL.goldFill, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              WebkitTextFillColor: "transparent", filter: "drop-shadow(0 6px 14px rgba(232,193,90,0.28))",
              fontVariantNumeric: "tabular-nums",
            }}>1,840</p>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: BRAND.muted }}>
              <span style={{ color: BRAND.gold, fontWeight: 600 }}>Gold</span> · Level 4
            </p>
          </div>
        </div>

        {/* Progress to next level — a drawn line of light, not a boxed bar */}
        <div style={{ padding: "0 8px" }}>
          <div style={{ position: "relative", height: 1, background: BRAND.hairline }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: 1, width: "61%", background: MATERIAL.goldFill }} />
            <div style={{ position: "absolute", left: "61%", top: -2, width: 5, height: 5, borderRadius: "50%", background: BRAND.goldSoft, boxShadow: MATERIAL.shadowGold }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: BRAND.dim }}>
            <span>3,065</span><span>1,935 to Platinum</span>
          </div>
        </div>

        {/* Three figures — separated by space + hairlines, not cards */}
        <div style={{ display: "flex", marginTop: 30 }}>
          {[
            { v: "6", l: "day streak" },
            { v: "#12", l: "global rank" },
            { v: "6 / 10", l: "achievements" },
          ].map((s, i) => (
            <div key={s.l} style={{ flex: 1, textAlign: "center", borderLeft: i === 0 ? "none" : `0.5px solid ${BRAND.hairline}`, padding: "2px 4px" }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: BRAND.ink, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
              <div style={{ fontSize: 11, color: BRAND.dim, marginTop: 3 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Reward — gold because it is earned. Sculpted metal pill. */}
        <div style={{ marginTop: 34, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: BRAND.ink }}>Daily reward ready</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: BRAND.muted }}>Day 7 · keep your streak alive</p>
          </div>
          <button style={{
            border: "none", borderRadius: 999, padding: "12px 22px", fontSize: 14, fontWeight: 700,
            color: BRAND.goldInk, background: MATERIAL.goldFill, boxShadow: MATERIAL.shadowGold, cursor: "pointer",
          }}>Claim +25</button>
        </div>

        {/* Recent — rows of light, dividers not boxes */}
        <p style={{ margin: "40px 0 12px", fontSize: 11, letterSpacing: "0.28em", color: BRAND.dim }}>RECENT</p>
        {[
          { t: "Match prediction scored", d: "5m ago", v: "+50" },
          { t: "Referred partner became active", d: "2h ago", v: "+100" },
          { t: "Login streak bonus", d: "1d ago", v: "+20" },
        ].map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "14px 2px", borderTop: i === 0 ? "none" : `0.5px solid ${BRAND.hairline}` }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, color: BRAND.ink }}>{r.t}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: BRAND.dim }}>{r.d}</p>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: BRAND.gold, fontVariantNumeric: "tabular-nums" }}>{r.v}</span>
          </div>
        ))}

      </div>
    </div>
  );
}
