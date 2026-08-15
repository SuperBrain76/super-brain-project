/**
 * lib/leagues/list.ts — the competitions offered, for the landing + Sports hub.
 *
 * One source of truth so the landing picker and /sports stay in sync. Marquee
 * club codes give each card a recognisable face (coloured monograms, no logos).
 * Add a league here + seed it, and it appears in both places.
 */

export interface LeagueEntry {
  slug:    string;
  name:    string;
  country: string;   // flag + country, for the card
  clubs:   string[]; // a few marquee club codes
  sport:   string;   // sport_code — "football" | "ice_hockey" | … (for grouping)
}

export const LEAGUES: LeagueEntry[] = [
  { slug: "premier-league", name: "Premier League", country: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 England", clubs: ["LIV", "ARS", "MCI", "MUN", "CHE", "TOT"], sport: "football" },
  { slug: "la-liga",        name: "La Liga",        country: "🇪🇸 Spain",   clubs: ["RMA", "BAR", "ATM", "SEV", "VAL", "BET"], sport: "football" },
  { slug: "bundesliga",     name: "Bundesliga",     country: "🇩🇪 Germany", clubs: ["BAY", "DOR", "RBL", "LVK", "SGE", "STU"], sport: "football" },
  { slug: "serie-a",        name: "Serie A",        country: "🇮🇹 Italy",   clubs: ["JUV", "MIL", "INT", "NAP", "ROM", "ATA"], sport: "football" },
  { slug: "ligue-1",        name: "Ligue 1",        country: "🇫🇷 France",  clubs: ["PSG", "MAR", "LYO", "ASM", "LIL", "NIC"], sport: "football" },
  { slug: "champions-league", name: "Champions League", country: "🇪🇺 Europe", clubs: ["RMA", "BAR", "BAY", "MCI", "PSG", "LIV"], sport: "football" },
  { slug: "shl",            name: "SHL",            country: "🇸🇪 Sweden",  clubs: ["FRL", "SKE", "LUL", "DIF", "FBK", "HV7"], sport: "ice_hockey" },
  { slug: "nhl",            name: "NHL",            country: "🇺🇸 North America", clubs: ["EDM", "TML", "BOS", "NYR", "COL", "VGK"], sport: "ice_hockey" },
];
