/**
 * lib/premierLeague/clubs.ts — the real Premier League, 2025/26 season.
 *
 * The 20 actual clubs, their real club colours and how their fans actually
 * call them. This is what makes the product feel like football instead of a
 * spreadsheet: Liverpool is Anfield red, City is sky blue, Wolves is gold.
 *
 * Data, not architecture. No crest images (licensing) — we render a coloured
 * monogram badge, which reads instantly and never breaks.
 */

export interface Club {
  code:      string;   // "ARS" — matches the fixture data + import CSV
  name:      string;   // "Arsenal"
  short:     string;   // "Arsenal" — what fans say ("Spurs", "Man Utd")
  nickname:  string;   // "The Gunners"
  primary:   string;   // club colour
  city:      string;
  stadium:   string;   // home ground — the smell of real football
}

// The real 2026/27 top flight: Coventry City, Ipswich Town and Hull City came
// up; West Ham, Burnley and Wolves went down. Verified vs premierleague.com.
export const PREMIER_LEAGUE_CLUBS: Club[] = [
  { code: "ARS", name: "Arsenal",            short: "Arsenal",    nickname: "The Gunners",     primary: "#EF0107", city: "London",        stadium: "Emirates Stadium" },
  { code: "AVL", name: "Aston Villa",        short: "Villa",      nickname: "The Villans",     primary: "#670E36", city: "Birmingham",    stadium: "Villa Park" },
  { code: "BOU", name: "Bournemouth",        short: "Bournemouth",nickname: "The Cherries",    primary: "#DA291C", city: "Bournemouth",   stadium: "Vitality Stadium" },
  { code: "BRE", name: "Brentford",          short: "Brentford",  nickname: "The Bees",        primary: "#E30613", city: "London",        stadium: "Gtech Community Stadium" },
  { code: "BHA", name: "Brighton",           short: "Brighton",   nickname: "The Seagulls",    primary: "#0057B8", city: "Brighton",      stadium: "Amex Stadium" },
  { code: "CHE", name: "Chelsea",            short: "Chelsea",    nickname: "The Blues",       primary: "#034694", city: "London",        stadium: "Stamford Bridge" },
  { code: "COV", name: "Coventry City",      short: "Coventry",   nickname: "The Sky Blues",   primary: "#6CADDF", city: "Coventry",      stadium: "Coventry Building Society Arena" },
  { code: "CRY", name: "Crystal Palace",     short: "Palace",     nickname: "The Eagles",      primary: "#1B458F", city: "London",        stadium: "Selhurst Park" },
  { code: "EVE", name: "Everton",            short: "Everton",    nickname: "The Toffees",     primary: "#003399", city: "Liverpool",     stadium: "Hill Dickinson Stadium" },
  { code: "FUL", name: "Fulham",             short: "Fulham",     nickname: "The Cottagers",   primary: "#1B1B1B", city: "London",        stadium: "Craven Cottage" },
  { code: "HUL", name: "Hull City",          short: "Hull",       nickname: "The Tigers",      primary: "#F5A12D", city: "Hull",          stadium: "MKM Stadium" },
  { code: "IPS", name: "Ipswich Town",       short: "Ipswich",    nickname: "The Tractor Boys",primary: "#2C5AA0", city: "Ipswich",       stadium: "Portman Road" },
  { code: "LEE", name: "Leeds United",       short: "Leeds",      nickname: "The Whites",      primary: "#1D428A", city: "Leeds",         stadium: "Elland Road" },
  { code: "LIV", name: "Liverpool",          short: "Liverpool",  nickname: "The Reds",        primary: "#C8102E", city: "Liverpool",     stadium: "Anfield" },
  { code: "MCI", name: "Man City",           short: "Man City",   nickname: "The Cityzens",    primary: "#6CABDD", city: "Manchester",    stadium: "Etihad Stadium" },
  { code: "MUN", name: "Man United",         short: "Man Utd",    nickname: "The Red Devils",  primary: "#DA020E", city: "Manchester",    stadium: "Old Trafford" },
  { code: "NEW", name: "Newcastle",          short: "Newcastle",  nickname: "The Magpies",     primary: "#241F20", city: "Newcastle",     stadium: "St James' Park" },
  { code: "NFO", name: "Nott'm Forest",      short: "Forest",     nickname: "The Tricky Trees",primary: "#DD0000", city: "Nottingham",    stadium: "The City Ground" },
  { code: "SUN", name: "Sunderland",         short: "Sunderland", nickname: "The Black Cats",  primary: "#EB172B", city: "Sunderland",    stadium: "Stadium of Light" },
  { code: "TOT", name: "Tottenham",          short: "Spurs",      nickname: "Spurs",           primary: "#132257", city: "London",        stadium: "Tottenham Hotspur Stadium" },
];

// Global registry across every league. Each league's clubs live in its own
// file under lib/leagues/ and are merged here; codes are unique across all of
// them, so club(code) resolves any team in any competition. (Type-only import
// in the league files avoids a runtime cycle.)
import { LA_LIGA_CLUBS } from "@/lib/leagues/laLiga";
import { BUNDESLIGA_CLUBS } from "@/lib/leagues/bundesliga";
import { SERIE_A_CLUBS } from "@/lib/leagues/serieA";
import { LIGUE_1_CLUBS } from "@/lib/leagues/ligue1";
import { ALLSVENSKAN_CLUBS } from "@/lib/leagues/allsvenskan";
import { SHL_CLUBS } from "@/lib/hockey/shl";
import { NHL_CLUBS } from "@/lib/hockey/nhl";
import { PREM_RUGBY_CLUBS } from "@/lib/rugby/prem";

export const ALL_CLUBS: Club[] = [
  ...PREMIER_LEAGUE_CLUBS,
  ...LA_LIGA_CLUBS,
  ...BUNDESLIGA_CLUBS,
  ...SERIE_A_CLUBS,
  ...LIGUE_1_CLUBS,
  ...ALLSVENSKAN_CLUBS,
  ...SHL_CLUBS,
  ...NHL_CLUBS,
  ...PREM_RUGBY_CLUBS,
];

const BY_CODE = new Map(ALL_CLUBS.map((c) => [c.code, c]));

export function club(code: string): Club | undefined {
  return BY_CODE.get(code);
}

/**
 * Readable text colour on a club's badge — white on dark colours, near-black
 * on light ones (Man City sky blue, Wolves gold). Computed, not hand-listed,
 * so a new club can never ship with unreadable text.
 */
export function textOn(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Relative luminance (sRGB approximation).
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.6 ? "#1a1a1a" : "#ffffff";
}

/** A 2–3 letter monogram for the badge. */
export function monogram(code: string): string {
  return code;
}
