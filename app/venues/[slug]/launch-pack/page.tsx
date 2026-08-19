/**
 * /venues/<slug>/launch-pack — the venue's whole marketing kit as one document.
 *
 * A branded cover, then every printable at full-bleed A4 (poster, table tent),
 * then a contact sheet of the digital graphics with their live links. "Cmd/Ctrl
 * + P → Save as PDF" gives a venue a professional launch pack it can print at
 * the bar and hand to staff — the thing that turns a subscription into a
 * complete, done-for-you promotion.
 *
 * Every page is exactly A4 (794×1123 px = A4 at 96 dpi) so the artboards from
 * lib/venueAssets drop straight onto paper with no scaling.
 */

import { notFound } from "next/navigation";
import { loadAssetData, Artboard, ASSET_KINDS, textOn, type AssetData } from "@/lib/venueAssets";

export const dynamic = "force-dynamic";

const A4 = { width: 794, height: 1123 };

export default async function LaunchPackPage({ params }: { params: { slug: string } }) {
  const data = await loadAssetData(params.slug);
  if (!data) notFound();
  const { brand } = data;

  const printables = ASSET_KINDS.filter((a) => a.printable);
  const digital = ASSET_KINDS.filter((a) => !a.printable);

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { width: ${A4.width}px; height: ${A4.height}px; overflow: hidden; page-break-after: always; position: relative; margin: 0 auto; background: #fff; }
        .page:last-child { page-break-after: auto; }
        @media screen {
          body { background: #0c0c0e; }
          .page { margin: 24px auto; box-shadow: 0 24px 60px -24px rgba(0,0,0,0.8); }
        }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div className="no-print" style={{
        background: "#111", color: "#fff", padding: "12px 16px", textAlign: "center",
        fontFamily: "system-ui, sans-serif", fontSize: 14,
      }}>
        <strong>{brand.name} — Launch Pack.</strong> Print this page (Cmd/Ctrl + P) → <em>Save as PDF</em> or send straight to the printer.
      </div>

      {/* ── Cover ── */}
      <div className="page" style={{ background: brand.ink, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 72, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(90% 50% at 50% 0%, ${brand.primary}2a, transparent 55%)` }} />
        <div style={{ zIndex: 1 }}>
          {brand.logoUrl
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={brand.logoUrl} alt="" style={{ maxHeight: 150, maxWidth: 420, objectFit: "contain" }} />
            : <div style={{ fontSize: 60, fontWeight: 900, color: brand.primary }}>{brand.name.toUpperCase()}</div>}
          <div style={{ fontSize: 40, fontWeight: 900, marginTop: 34, letterSpacing: "-0.02em" }}>{brand.name.toUpperCase()}</div>
          <div style={{ display: "inline-block", marginTop: 26, padding: "10px 28px", borderRadius: 999, background: brand.primary, color: textOn(brand.primary), fontWeight: 900, fontSize: 20, letterSpacing: "0.08em" }}>LAUNCH PACK</div>
          <div style={{ fontSize: 22, color: "#ffffffcc", marginTop: 40, lineHeight: 1.5, maxWidth: 480 }}>
            Everything you need to launch <strong style={{ color: "#fff" }}>{data.leagueName}</strong>. Print the poster and table tents, cast the leaderboard to your TV, and post the graphics on socials.
          </div>
          <div style={{ marginTop: 44, fontSize: 15, color: "#ffffff88", letterSpacing: "0.2em" }}>INVITE CODE&nbsp;&nbsp;<span style={{ color: brand.primary, fontWeight: 900 }}>{data.inviteCode}</span></div>
        </div>
        <div style={{ position: "absolute", bottom: 40, fontSize: 13, color: "#ffffff66", letterSpacing: "0.2em", zIndex: 1 }}>Powered by SuperBrain · superbrain.social</div>
      </div>

      {/* ── Printables, one per A4 page ── */}
      {printables.map((a) => (
        <div key={a.kind} className="page">
          <Artboard kind={a.kind} data={data} />
        </div>
      ))}

      {/* ── Digital contact sheet ── */}
      <div className="page" style={{ background: "#fff", color: brand.ink, padding: 56, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ fontSize: 13, letterSpacing: "0.3em", textTransform: "uppercase", color: brand.primary, fontWeight: 900 }}>Post these online</div>
        <div style={{ fontSize: 30, fontWeight: 900, marginTop: 8, letterSpacing: "-0.02em" }}>Your digital graphics</div>
        <div style={{ fontSize: 15, color: "#555", marginTop: 8, lineHeight: 1.5 }}>
          Open each link on a phone or laptop and screenshot it to post. The TV leaderboard can be cast to your bar screen on matchday.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 32 }}>
          {digital.map((a) => (
            <div key={a.kind} style={{ border: `1px solid ${brand.ink}18`, borderRadius: 14, overflow: "hidden" }}>
              <Thumb kind={a.kind} data={data} />
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{a.label}</div>
                <div style={{ fontSize: 12.5, color: "#777", marginTop: 3 }}>{a.hint}</div>
                <div style={{ fontSize: 12, color: brand.primary, marginTop: 8, wordBreak: "break-all", fontWeight: 700 }}>
                  superbrain.social/venues/{brand.slug}/assets/{a.kind}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** A scaled preview of a digital artboard inside the contact sheet. */
function Thumb({ kind, data }: { kind: any; data: AssetData }) {
  const spec = ASSET_KINDS.find((a) => a.kind === kind)!;
  const boxW = 320, scale = boxW / spec.w, boxH = spec.h * scale;
  return (
    <div style={{ width: "100%", height: boxH > 220 ? 220 : boxH, background: "#0c0c0e", overflow: "hidden", display: "grid", placeItems: "center" }}>
      <div style={{ width: spec.w, height: spec.h, transform: `scale(${Math.min(scale, 220 / spec.h)})`, transformOrigin: "center" }}>
        <Artboard kind={kind} data={data} />
      </div>
    </div>
  );
}
