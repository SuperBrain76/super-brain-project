/**
 * lib/venueAssets.tsx — the venue's brandable "Launch Pack" artboards.
 *
 * One source of truth for every printable and shareable a venue gets the
 * moment it finishes onboarding: a QR poster, a table tent, a TV leaderboard
 * screen, and three social graphics — all rendered in the venue's OWN logo and
 * colours, pulled straight from the `venues` row (migration 057 + 065).
 *
 * These are server components at FIXED PIXEL sizes. Fixed px (not mm) means a
 * screenshot of any artboard is pixel-crisp for social, and the print routes
 * scale the same artboard onto A-series paper. Nothing here reads cookies or
 * auth — an artboard renders purely from a venue slug's public brand + league.
 *
 * Asset kinds and their canvases live in ASSET_KINDS so the wizard, the single
 * asset route and the Launch Pack PDF all agree on what exists.
 */

import { admin } from "./venueDb";
import { SITE } from "./stripe";

// ── Brand + data ────────────────────────────────────────────────────────────

export interface VenueBrand {
  slug: string;
  name: string;
  city: string | null;
  language: Lang;
  logoUrl: string | null;
  primary: string;   // accent (buttons, highlights)
  ink: string;       // deep background
  secondary: string; // optional second accent → falls back to primary
}

export interface AssetData {
  brand: VenueBrand;
  leagueName: string;
  competitionName: string;
  inviteCode: string;
  joinUrl: string;
  qr: (size: number) => string;
  members: string[];   // current joined players (for the TV leaderboard)
}

type Lang = "en" | "de" | "es" | "fr" | "it";
const LANGS: Lang[] = ["en", "de", "es", "fr", "it"];

/** Load everything an artboard needs from a venue slug. null → 404 at caller. */
export async function loadAssetData(slug: string): Promise<AssetData | null> {
  const db = admin();

  const { data: venue } = await db
    .from("venues")
    .select("id, slug, name, city, language, logo_url, colour_primary, colour_ink, colour_secondary")
    .eq("slug", slug)
    .maybeSingle();
  if (!venue) return null;

  const { data: league } = await db
    .from("prediction_leagues")
    .select("id, name, invite_code, competition:competitions(name, slug)")
    .eq("venue_id", venue.id)
    .limit(1)
    .maybeSingle();
  if (!league) return null;

  const comp = league.competition as any;
  const compSlug = comp?.slug ?? "premier-league";
  const joinUrl  = `${SITE}/${compSlug}/leagues/join?code=${league.invite_code}`;

  // Current players — real names when we have them, for the TV leaderboard.
  // Best-effort: a missing join must never take the whole Launch Pack down.
  let members: string[] = [];
  try {
    const { data: mem } = await db
      .from("prediction_league_members")
      .select("user:profiles(display_name)")
      .eq("league_id", league.id)
      .limit(12);
    members = (mem ?? [])
      .map((m: any) => m.user?.display_name)
      .filter(Boolean) as string[];
  } catch { /* leaderboard just shows placeholders until players join */ }

  const lang = (LANGS.includes(venue.language) ? venue.language : "en") as Lang;
  const primary = venue.colour_primary || "#F5B301";

  return {
    brand: {
      slug: venue.slug,
      name: venue.name,
      city: venue.city,
      language: lang,
      logoUrl: venue.logo_url,
      primary,
      ink: venue.colour_ink || "#12100E",
      secondary: venue.colour_secondary || primary,
    },
    leagueName: league.name,
    competitionName: comp?.name ?? "Football",
    inviteCode: league.invite_code,
    joinUrl,
    qr: (size: number) => `${SITE}/api/venues/${venue.slug}/qr.png?size=${size}`,
    members,
  };
}

// ── Colour helpers ──────────────────────────────────────────────────────────

/** Black or white text for maximum contrast on a hex background. */
export function textOn(hex: string): string {
  const c = hex.replace("#", "");
  const n = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#12100E" : "#FFFFFF";
}

// ── Copy (5 languages, matches the existing poster) ─────────────────────────

const COPY: Record<Lang, {
  kicker: string; scan: string; free: string; join: string; playFree: string;
  steps: string[]; foot: string; leaderboard: string; live: string;
  thisWeek: string; announce: string; announceSub: string;
}> = {
  en: { kicker: "Official prediction league", scan: "Scan to join", free: "Free to play",
        join: "Join our league", playFree: "Play free on your phone",
        steps: ["Scan the code", "Predict this week's matches", "Top of the table wins"],
        foot: "Powered by SuperBrain", leaderboard: "Leaderboard", live: "LIVE",
        thisWeek: "This week", announce: "Our prediction league is LIVE",
        announceSub: "Predict the football. Top the table. Free to play." },
  es: { kicker: "Liga oficial de pronósticos", scan: "Escanea para unirte", free: "Gratis",
        join: "Únete a nuestra liga", playFree: "Juega gratis en tu móvil",
        steps: ["Escanea el código", "Pronostica los partidos", "Gana quien lidere la tabla"],
        foot: "Con tecnología de SuperBrain", leaderboard: "Clasificación", live: "EN VIVO",
        thisWeek: "Esta semana", announce: "Nuestra liga de pronósticos ya está aquí",
        announceSub: "Pronostica el fútbol. Lidera la tabla. Gratis." },
  it: { kicker: "Campionato ufficiale di pronostici", scan: "Inquadra per partecipare", free: "Gratis",
        join: "Entra nel campionato", playFree: "Gioca gratis dal telefono",
        steps: ["Inquadra il codice", "Pronostica le partite", "Vince chi guida la classifica"],
        foot: "Powered by SuperBrain", leaderboard: "Classifica", live: "LIVE",
        thisWeek: "Questa settimana", announce: "Il nostro campionato pronostici è LIVE",
        announceSub: "Pronostica il calcio. Guida la classifica. Gratis." },
  fr: { kicker: "Ligue officielle de pronostics", scan: "Scannez pour participer", free: "Gratuit",
        join: "Rejoignez notre ligue", playFree: "Jouez gratuitement sur mobile",
        steps: ["Scannez le code", "Pronostiquez les matchs", "Le premier du classement gagne"],
        foot: "Propulsé par SuperBrain", leaderboard: "Classement", live: "EN DIRECT",
        thisWeek: "Cette semaine", announce: "Notre ligue de pronostics est LANCÉE",
        announceSub: "Pronostiquez le foot. Dominez le classement. Gratuit." },
  de: { kicker: "Offizielle Tippliga", scan: "Zum Mitspielen scannen", free: "Kostenlos",
        join: "Tritt unserer Liga bei", playFree: "Kostenlos am Handy spielen",
        steps: ["Code scannen", "Spiele der Woche tippen", "Tabellenführer gewinnt"],
        foot: "Powered by SuperBrain", leaderboard: "Tabelle", live: "LIVE",
        thisWeek: "Diese Woche", announce: "Unsere Tippliga ist LIVE",
        announceSub: "Fußball tippen. Tabelle anführen. Kostenlos." },
};

// ── Asset registry ──────────────────────────────────────────────────────────

export type AssetKind =
  | "poster" | "table-tent" | "tv-leaderboard"
  | "social-square" | "instagram-story" | "facebook-post";

export interface AssetSpec {
  kind: AssetKind;
  label: string;
  hint: string;
  w: number;              // artboard px
  h: number;
  printable: boolean;     // goes in the printed Launch Pack PDF
  page?: "A4" | "A4-landscape"; // paper when printed
}

export const ASSET_KINDS: AssetSpec[] = [
  { kind: "poster",          label: "Table & wall poster", hint: "A4 · print one per table",       w: 794,  h: 1123, printable: true,  page: "A4" },
  { kind: "table-tent",      label: "Table tent card",     hint: "Folded card for the bar top",     w: 794,  h: 1123, printable: true,  page: "A4" },
  { kind: "tv-leaderboard",  label: "TV leaderboard",      hint: "Cast to the big screen on matchday", w: 1280, h: 720,  printable: false },
  { kind: "social-square",   label: "Announcement post",   hint: "Instagram / Facebook feed",       w: 1080, h: 1080, printable: false },
  { kind: "instagram-story", label: "Instagram / TikTok story", hint: "9:16 vertical",              w: 1080, h: 1920, printable: false },
  { kind: "facebook-post",   label: "Facebook / X banner", hint: "1200 × 630 link card",            w: 1200, h: 630,  printable: false },
];

export function assetSpec(kind: string): AssetSpec | undefined {
  return ASSET_KINDS.find((a) => a.kind === kind);
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function Logo({ brand, max }: { brand: VenueBrand; max: number }) {
  if (brand.logoUrl) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={brand.logoUrl} alt="" style={{ maxHeight: max, maxWidth: max * 3, objectFit: "contain" }} />;
  }
  return (
    <div style={{
      fontWeight: 900, fontSize: max * 0.5, letterSpacing: "-0.02em",
      color: brand.primary, lineHeight: 1,
    }}>
      {brand.name.toUpperCase()}
    </div>
  );
}

function Qr({ data, size }: { data: AssetData; size: number }) {
  return (
    <div style={{ background: "#fff", padding: size * 0.06, borderRadius: size * 0.08, display: "inline-block" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.qr(Math.min(1200, Math.round(size * 2)))} alt="QR"
           style={{ width: size, height: size, display: "block" }} />
    </div>
  );
}

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

/** A fixed-size artboard box. Everything inside is absolute/flow within w×h. */
function Board({ w, h, children, style }: {
  w: number; h: number; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      width: w, height: h, position: "relative", overflow: "hidden",
      fontFamily: FONT, ...style,
    }}>
      {children}
    </div>
  );
}

// ── The artboards ───────────────────────────────────────────────────────────

/** A4 poster — venue identity, big QR, three steps. */
function Poster({ data }: { data: AssetData }) {
  const { brand } = data;
  const t = COPY[brand.language];
  return (
    <Board w={794} h={1123} style={{ background: brand.ink, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "64px 56px" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 60% at 50% -10%, ${brand.primary}22, transparent 55%)` }} />
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <Logo brand={brand} max={110} />
        {brand.logoUrl && <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.02em", marginTop: 22, lineHeight: 1 }}>{brand.name.toUpperCase()}</div>}
        <div style={{ fontSize: 15, letterSpacing: "0.42em", textTransform: "uppercase", color: brand.primary, marginTop: 16 }}>{t.kicker}</div>
      </div>

      <div style={{ textAlign: "center", zIndex: 1, padding: "0 24px" }}>
        <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.12 }}>{data.leagueName}</div>
        <div style={{ display: "inline-block", marginTop: 18, padding: "8px 24px", borderRadius: 999, background: brand.primary, color: textOn(brand.primary), fontWeight: 900, fontSize: 18, letterSpacing: "0.04em" }}>{t.free}</div>
      </div>

      <div style={{ textAlign: "center", zIndex: 1 }}>
        <Qr data={data} size={280} />
        <div style={{ fontSize: 30, fontWeight: 900, marginTop: 22, color: brand.primary }}>{t.scan}</div>
        <div style={{ fontSize: 16, color: "#ffffffaa", marginTop: 8, letterSpacing: "0.28em" }}>{data.inviteCode}</div>
      </div>

      <div style={{ display: "flex", gap: 22, width: "100%", justifyContent: "center", zIndex: 1 }}>
        {t.steps.map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", maxWidth: 180 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: brand.primary, color: textOn(brand.primary), fontWeight: 900, fontSize: 19, lineHeight: "40px", margin: "0 auto 12px" }}>{i + 1}</div>
            <div style={{ fontSize: 15, lineHeight: 1.35, color: "#ffffffdd" }}>{s}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "#ffffff66", letterSpacing: "0.2em", zIndex: 1 }}>{t.foot} · superbrain.social</div>
    </Board>
  );
}

/** Table tent — two mirrored panels on one A4, folds down the middle. */
function TableTent({ data }: { data: AssetData }) {
  const { brand } = data;
  const t = COPY[brand.language];
  const panel = (flip: boolean) => (
    <div style={{ height: "50%", transform: flip ? "rotate(180deg)" : "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "34px 40px", background: brand.ink, color: "#fff", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(100% 60% at 50% 0%, ${brand.primary}1f, transparent 60%)` }} />
      <div style={{ zIndex: 1, textAlign: "center" }}>
        <Logo brand={brand} max={64} />
        {brand.logoUrl && <div style={{ fontSize: 22, fontWeight: 900, marginTop: 12 }}>{brand.name.toUpperCase()}</div>}
        <div style={{ fontSize: 11, letterSpacing: "0.34em", textTransform: "uppercase", color: brand.primary, marginTop: 8 }}>{t.join} · {t.free}</div>
      </div>
      <div style={{ zIndex: 1 }}><Qr data={data} size={150} /></div>
      <div style={{ zIndex: 1, fontSize: 18, fontWeight: 900, color: brand.primary }}>{t.scan}</div>
    </div>
  );
  return (
    <Board w={794} h={1123} style={{ background: "#fff" }}>
      {panel(true)}
      <div style={{ height: 0, borderTop: `2px dashed ${brand.primary}88`, position: "relative" }}>
        <span style={{ position: "absolute", right: 12, top: -9, fontSize: 10, color: brand.ink, background: "#fff", padding: "0 6px", letterSpacing: "0.2em" }}>✂ FOLD</span>
      </div>
      {panel(false)}
    </Board>
  );
}

/** TV leaderboard — 16:9 screen for the bar's television on matchday. */
function TvLeaderboard({ data }: { data: AssetData }) {
  const { brand } = data;
  const t = COPY[brand.language];
  const rows = (data.members.length ? data.members : ["—", "—", "—", "—", "—"]).slice(0, 8);
  return (
    <Board w={1280} h={720} style={{ background: brand.ink, color: "#fff", padding: "44px 56px", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(90% 60% at 100% 0%, ${brand.primary}22, transparent 55%)` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Logo brand={brand} max={58} />
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{data.leagueName}</div>
            <div style={{ fontSize: 13, letterSpacing: "0.3em", textTransform: "uppercase", color: brand.primary, marginTop: 6 }}>{t.leaderboard} · {t.thisWeek}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 15, color: brand.primary }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ff4d4d" }} />{t.live}
        </div>
      </div>

      <div style={{ flex: 1, marginTop: 26, display: "flex", gap: 32, zIndex: 1 }}>
        <div style={{ flex: 1.6, display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((name, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, background: i === 0 ? `${brand.primary}22` : "#ffffff0a", border: `1px solid ${i === 0 ? brand.primary + "66" : "#ffffff14"}`, borderRadius: 14, padding: "12px 20px" }}>
              <div style={{ width: 34, fontWeight: 900, fontSize: 22, color: i === 0 ? brand.primary : "#ffffff88" }}>{i + 1}</div>
              <div style={{ flex: 1, fontWeight: 700, fontSize: 20, color: name === "—" ? "#ffffff44" : "#fff" }}>{name}</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: brand.primary }}>{name === "—" ? "" : "—"}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#ffffff0a", border: "1px solid #ffffff14", borderRadius: 18, padding: 24 }}>
          <Qr data={data} size={190} />
          <div style={{ fontSize: 22, fontWeight: 900, color: brand.primary }}>{t.scan}</div>
          <div style={{ fontSize: 14, color: "#ffffffaa", letterSpacing: "0.24em" }}>{data.inviteCode}</div>
        </div>
      </div>
    </Board>
  );
}

/** Square social announcement — 1080×1080. */
function SocialSquare({ data }: { data: AssetData }) {
  const { brand } = data;
  const t = COPY[brand.language];
  return (
    <Board w={1080} h={1080} style={{ background: brand.ink, color: "#fff", padding: 88, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(80% 50% at 50% -5%, ${brand.primary}2a, transparent 55%)` }} />
      <div style={{ zIndex: 1, display: "flex", alignItems: "center", gap: 20 }}>
        <Logo brand={brand} max={80} />
        {brand.logoUrl && <div style={{ fontSize: 26, fontWeight: 900 }}>{brand.name.toUpperCase()}</div>}
      </div>
      <div style={{ zIndex: 1 }}>
        <div style={{ display: "inline-block", padding: "8px 20px", borderRadius: 999, background: brand.primary, color: textOn(brand.primary), fontWeight: 900, fontSize: 18, letterSpacing: "0.06em" }}>{t.live}</div>
        <div style={{ fontSize: 62, fontWeight: 900, lineHeight: 1.02, marginTop: 22, letterSpacing: "-0.02em" }}>{t.announce}</div>
        <div style={{ fontSize: 26, color: "#ffffffcc", marginTop: 18, lineHeight: 1.4 }}>{t.announceSub}</div>
      </div>
      <div style={{ zIndex: 1, display: "flex", alignItems: "center", gap: 28 }}>
        <Qr data={data} size={190} />
        <div>
          <div style={{ fontSize: 30, fontWeight: 900, color: brand.primary }}>{t.scan}</div>
          <div style={{ fontSize: 20, color: "#ffffffaa", marginTop: 6, letterSpacing: "0.2em" }}>{t.free} · {data.inviteCode}</div>
        </div>
      </div>
    </Board>
  );
}

/** Instagram / TikTok story — 1080×1920 vertical. */
function InstagramStory({ data }: { data: AssetData }) {
  const { brand } = data;
  const t = COPY[brand.language];
  return (
    <Board w={1080} h={1920} style={{ background: brand.ink, color: "#fff", padding: 96, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", textAlign: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(70% 40% at 50% 8%, ${brand.primary}30, transparent 55%), radial-gradient(70% 40% at 50% 96%, ${brand.secondary}22, transparent 55%)` }} />
      <div style={{ zIndex: 1 }}>
        <Logo brand={brand} max={150} />
        {brand.logoUrl && <div style={{ fontSize: 40, fontWeight: 900, marginTop: 26 }}>{brand.name.toUpperCase()}</div>}
      </div>
      <div style={{ zIndex: 1 }}>
        <div style={{ fontSize: 74, fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.02em" }}>{t.announce}</div>
        <div style={{ fontSize: 30, color: "#ffffffcc", marginTop: 26, lineHeight: 1.4 }}>{t.announceSub}</div>
      </div>
      <div style={{ zIndex: 1 }}>
        <Qr data={data} size={300} />
        <div style={{ fontSize: 40, fontWeight: 900, marginTop: 26, color: brand.primary }}>{t.scan}</div>
        <div style={{ fontSize: 24, color: "#ffffffaa", marginTop: 10, letterSpacing: "0.24em" }}>{t.playFree}</div>
      </div>
    </Board>
  );
}

/** Facebook / X link banner — 1200×630. */
function FacebookPost({ data }: { data: AssetData }) {
  const { brand } = data;
  const t = COPY[brand.language];
  return (
    <Board w={1200} h={630} style={{ background: brand.ink, color: "#fff", padding: 64, display: "flex", alignItems: "center", gap: 48 }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(70% 90% at 0% 50%, ${brand.primary}26, transparent 60%)` }} />
      <div style={{ zIndex: 1, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Logo brand={brand} max={64} />
          {brand.logoUrl && <div style={{ fontSize: 22, fontWeight: 900 }}>{brand.name.toUpperCase()}</div>}
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.03, marginTop: 22, letterSpacing: "-0.02em" }}>{t.announce}</div>
        <div style={{ fontSize: 22, color: "#ffffffcc", marginTop: 16 }}>{t.announceSub}</div>
      </div>
      <div style={{ zIndex: 1, textAlign: "center" }}>
        <Qr data={data} size={230} />
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 16, color: brand.primary }}>{t.scan}</div>
      </div>
    </Board>
  );
}

/** Render any asset kind at its native size. */
export function Artboard({ kind, data }: { kind: AssetKind; data: AssetData }) {
  switch (kind) {
    case "poster":          return <Poster data={data} />;
    case "table-tent":      return <TableTent data={data} />;
    case "tv-leaderboard":  return <TvLeaderboard data={data} />;
    case "social-square":   return <SocialSquare data={data} />;
    case "instagram-story": return <InstagramStory data={data} />;
    case "facebook-post":   return <FacebookPost data={data} />;
  }
}
