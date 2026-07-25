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
}

export const PREMIER_LEAGUE_CLUBS: Club[] = [
  { code: "ARS", name: "Arsenal",            short: "Arsenal",    nickname: "The Gunners",     primary: "#EF0107", city: "London" },
  { code: "AVL", name: "Aston Villa",        short: "Villa",      nickname: "The Villans",     primary: "#670E36", city: "Birmingham" },
  { code: "BOU", name: "Bournemouth",        short: "Bournemouth",nickname: "The Cherries",    primary: "#DA291C", city: "Bournemouth" },
  { code: "BRE", name: "Brentford",          short: "Brentford",  nickname: "The Bees",        primary: "#E30613", city: "London" },
  { code: "BHA", name: "Brighton",           short: "Brighton",   nickname: "The Seagulls",    primary: "#0057B8", city: "Brighton" },
  { code: "BUR", name: "Burnley",            short: "Burnley",    nickname: "The Clarets",     primary: "#6C1D45", city: "Burnley" },
  { code: "CHE", name: "Chelsea",            short: "Chelsea",    nickname: "The Blues",       primary: "#034694", city: "London" },
  { code: "CRY", name: "Crystal Palace",     short: "Palace",     nickname: "The Eagles",      primary: "#1B458F", city: "London" },
  { code: "EVE", name: "Everton",            short: "Everton",    nickname: "The Toffees",     primary: "#003399", city: "Liverpool" },
  { code: "FUL", name: "Fulham",             short: "Fulham",     nickname: "The Cottagers",   primary: "#1B1B1B", city: "London" },
  { code: "LEE", name: "Leeds United",       short: "Leeds",      nickname: "The Whites",      primary: "#1D428A", city: "Leeds" },
  { code: "LIV", name: "Liverpool",          short: "Liverpool",  nickname: "The Reds",        primary: "#C8102E", city: "Liverpool" },
  { code: "MCI", name: "Man City",           short: "Man City",   nickname: "The Cityzens",    primary: "#6CABDD", city: "Manchester" },
  { code: "MUN", name: "Man United",         short: "Man Utd",    nickname: "The Red Devils",  primary: "#DA020E", city: "Manchester" },
  { code: "NEW", name: "Newcastle",          short: "Newcastle",  nickname: "The Magpies",     primary: "#241F20", city: "Newcastle" },
  { code: "NFO", name: "Nott'm Forest",      short: "Forest",     nickname: "The Tricky Trees",primary: "#DD0000", city: "Nottingham" },
  { code: "SUN", name: "Sunderland",         short: "Sunderland", nickname: "The Black Cats",  primary: "#EB172B", city: "Sunderland" },
  { code: "TOT", name: "Tottenham",          short: "Spurs",      nickname: "Spurs",           primary: "#132257", city: "London" },
  { code: "WHU", name: "West Ham",           short: "West Ham",   nickname: "The Hammers",     primary: "#7A263A", city: "London" },
  { code: "WOL", name: "Wolves",             short: "Wolves",     nickname: "Wolves",          primary: "#FDB913", city: "Wolverhampton" },
];

const BY_CODE = new Map(PREMIER_LEAGUE_CLUBS.map((c) => [c.code, c]));

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
