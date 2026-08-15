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
}

export const LEAGUES: LeagueEntry[] = [
  { slug: "premier-league", name: "Premier League", country: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 England", clubs: ["LIV", "ARS", "MCI", "MUN", "CHE", "TOT"] },
  { slug: "la-liga",        name: "La Liga",        country: "🇪🇸 Spain",   clubs: ["RMA", "BAR", "ATM", "SEV", "VAL", "BET"] },
  { slug: "bundesliga",     name: "Bundesliga",     country: "🇩🇪 Germany", clubs: ["BAY", "DOR", "RBL", "LVK", "SGE", "STU"] },
  { slug: "serie-a",        name: "Serie A",        country: "🇮🇹 Italy",   clubs: ["JUV", "MIL", "INT", "NAP", "ROM", "ATA"] },
  { slug: "ligue-1",        name: "Ligue 1",        country: "🇫🇷 France",  clubs: ["PSG", "MAR", "LYO", "ASM", "LIL", "NIC"] },
];
