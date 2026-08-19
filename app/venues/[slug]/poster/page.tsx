/**
 * /venues/<slug>/poster — the physical table card, ready to print.
 *
 * A4 portrait, cut marks off, four-up is overkill — one per table is what a
 * bar actually wants. Everything is inline-styled and print-media aware so
 * "Cmd-P → Save as PDF" from a phone or a laptop produces the same sheet.
 *
 * Server-rendered from the venue's real league, so the QR on the printed card
 * always matches the live invite code.
 */

import { notFound } from "next/navigation";
import { admin } from "@/lib/venueDb";
import { SITE } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type Lang = "en" | "de" | "es" | "fr" | "it";

const COPY: Record<Lang, { kicker: string; scan: string; free: string; steps: string[]; foot: string }> = {
  en: { kicker: "Official prediction league", scan: "Scan to join", free: "Free to play",
        steps: ["Scan the code", "Predict this week's matches", "Top of the table wins"],
        foot: "Powered by SuperBrain" },
  es: { kicker: "Liga oficial de pronósticos", scan: "Escanea para unirte", free: "Gratis",
        steps: ["Escanea el código", "Pronostica los partidos de la semana", "Gana quien lidere la tabla"],
        foot: "Con tecnología de SuperBrain" },
  it: { kicker: "Campionato ufficiale di pronostici", scan: "Inquadra per partecipare", free: "Gratis",
        steps: ["Inquadra il codice", "Pronostica le partite della settimana", "Vince chi guida la classifica"],
        foot: "Powered by SuperBrain" },
  fr: { kicker: "Ligue officielle de pronostics", scan: "Scannez pour participer", free: "Gratuit",
        steps: ["Scannez le code", "Pronostiquez les matchs de la semaine", "Le premier du classement gagne"],
        foot: "Propulsé par SuperBrain" },
  de: { kicker: "Offizielle Tippliga", scan: "Zum Mitspielen scannen", free: "Kostenlos",
        steps: ["Code scannen", "Spiele der Woche tippen", "Tabellenführer gewinnt"],
        foot: "Powered by SuperBrain" },
};

export default async function PosterPage({ params }: { params: { slug: string } }) {
  const db = admin();

  const { data: venue } = await db
    .from("venues")
    .select("id, name, slug, city, language, colour_primary, colour_ink, logo_url")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!venue) notFound();

  const { data: league } = await db
    .from("prediction_leagues")
    .select("name, invite_code, competition:competitions(name)")
    .eq("venue_id", venue.id)
    .limit(1)
    .maybeSingle();
  if (!league) notFound();

  const lang = (["en", "de", "es", "fr", "it"].includes(venue.language) ? venue.language : "en") as Lang;
  const t = COPY[lang];
  const amber = venue.colour_primary || "#F5B301";
  const ink   = venue.colour_ink || "#12100E";
  const qr    = `${SITE}/api/venues/${venue.slug}/qr.png?size=900`;

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print" style={{
        background: "#111", color: "#fff", padding: "12px 16px",
        fontFamily: "system-ui, sans-serif", fontSize: 13, textAlign: "center",
      }}>
        Print this page (Cmd/Ctrl + P) → A4 → one on every table.
        &nbsp;·&nbsp; Invite code <strong>{league.invite_code}</strong>
      </div>

      <div style={{
        width: "210mm", minHeight: "297mm", margin: "0 auto", background: ink,
        color: "#fff", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "space-between",
        padding: "18mm 14mm", boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        {/* Venue identity */}
        <div style={{ textAlign: "center" }}>
          {venue.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={venue.logo_url} alt="" style={{ maxHeight: "26mm", marginBottom: "6mm" }} />
          ) : null}
          <div style={{ fontSize: "13mm", fontWeight: 900, letterSpacing: "-0.5mm", lineHeight: 1 }}>
            {venue.name.toUpperCase()}
          </div>
          <div style={{
            fontSize: "3.6mm", letterSpacing: "1.6mm", textTransform: "uppercase",
            color: amber, marginTop: "4mm",
          }}>
            {t.kicker}
          </div>
        </div>

        {/* League name */}
        <div style={{ textAlign: "center", padding: "0 6mm" }}>
          <div style={{ fontSize: "9mm", fontWeight: 800, lineHeight: 1.1 }}>{league.name}</div>
          <div style={{
            display: "inline-block", marginTop: "5mm", padding: "2mm 6mm",
            borderRadius: "20mm", background: amber, color: ink,
            fontWeight: 900, fontSize: "4.5mm", letterSpacing: "0.4mm",
          }}>
            {t.free}
          </div>
        </div>

        {/* QR */}
        <div style={{ textAlign: "center" }}>
          <div style={{ background: "#fff", padding: "5mm", borderRadius: "6mm", display: "inline-block" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR" style={{ width: "72mm", height: "72mm", display: "block" }} />
          </div>
          <div style={{ fontSize: "7mm", fontWeight: 900, marginTop: "6mm", color: amber }}>
            {t.scan}
          </div>
          <div style={{ fontSize: "4mm", color: "#ffffffaa", marginTop: "2mm", letterSpacing: "0.8mm" }}>
            {league.invite_code}
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", gap: "6mm", width: "100%", justifyContent: "center" }}>
          {t.steps.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", maxWidth: "50mm" }}>
              <div style={{
                width: "10mm", height: "10mm", borderRadius: "10mm", background: amber, color: ink,
                fontWeight: 900, fontSize: "5mm", lineHeight: "10mm", margin: "0 auto 3mm",
              }}>{i + 1}</div>
              <div style={{ fontSize: "3.8mm", lineHeight: 1.35, color: "#ffffffdd" }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: "3.2mm", color: "#ffffff77", letterSpacing: "0.6mm" }}>
          {t.foot} · superbrain.social
        </div>
      </div>
    </>
  );
}
