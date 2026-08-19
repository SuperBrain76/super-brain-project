/**
 * /venues/<slug>/assets/<kind> — a single branded asset at native size.
 *
 * One artboard (poster, table tent, TV leaderboard, or a social graphic),
 * rendered from the venue's live brand + league. Sits on a neutral canvas with
 * a print/screenshot hint so the owner can save it straight from the browser.
 * Printable kinds carry an @page rule so Cmd/Ctrl-P → Save as PDF is clean.
 */

import { notFound } from "next/navigation";
import { loadAssetData, assetSpec, Artboard, ASSET_KINDS } from "@/lib/venueAssets";

export const dynamic = "force-dynamic";

export default async function AssetPage({ params }: { params: { slug: string; kind: string } }) {
  const spec = assetSpec(params.kind);
  if (!spec) notFound();

  const data = await loadAssetData(params.slug);
  if (!data) notFound();

  const digital = !spec.printable;
  const hint = spec.printable
    ? "Print this page (Cmd/Ctrl + P) → Save as PDF, or screenshot it."
    : "Screenshot this graphic (or right-click the image area) to post it.";

  const pageSize = spec.page === "A3" ? "A3 portrait"
    : spec.page === "A4-landscape" ? "A4 landscape" : "A4 portrait";

  return (
    <>
      <style>{`
        @page { size: ${pageSize}; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          .board-scale { transform: none !important; }
          .board-fit { padding: 0 !important; }
        }
      `}</style>

      <div className="no-print" style={{
        background: "#111", color: "#fff", padding: "10px 16px", textAlign: "center",
        fontFamily: "system-ui, sans-serif", fontSize: 13,
      }}>
        <strong>{spec.label}</strong> · {hint}
        &nbsp;·&nbsp;<a href={`/venues/${params.slug}/launch-pack`} style={{ color: "#F5B301" }}>Full Launch Pack →</a>
      </div>

      <div className="board-fit" style={{
        minHeight: "100vh", background: "#0c0c0e", display: "grid", placeItems: "center", padding: 28,
        fontFamily: "system-ui, sans-serif", overflow: "hidden",
      }}>
        {/* Native-size artboard, scaled down to fit the viewport for preview.
            The inline script sets a transform + reserves the scaled height so
            the page never scrolls sideways; print resets both. */}
        <div id="fit" style={{ transformOrigin: "top center", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8)" }}>
          <div className="board-scale">
            <Artboard kind={spec.kind} data={data} />
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var W=${spec.w},H=${spec.h},fit=document.getElementById('fit');
            function apply(){
              if(!fit)return;
              var avail=Math.min(window.innerWidth-56, W);
              var s=Math.min(1, avail/W);
              fit.style.transform='scale('+s+')';
              fit.style.width=W+'px';
              fit.style.height=(H*s)+'px';
            }
            apply(); window.addEventListener('resize',apply);
          })();
        `}} />
      </div>

      <div className="no-print" style={{
        background: "#0c0c0e", color: "#888", padding: "0 16px 40px", textAlign: "center",
        fontFamily: "system-ui, sans-serif", fontSize: 12,
      }}>
        Other assets:&nbsp;
        {ASSET_KINDS.filter((a) => a.kind !== spec.kind).map((a, i) => (
          <span key={a.kind}>
            {i > 0 ? " · " : ""}
            <a href={`/venues/${params.slug}/assets/${a.kind}`} style={{ color: "#F5B301" }}>{a.label}</a>
          </span>
        ))}
      </div>
    </>
  );
}
