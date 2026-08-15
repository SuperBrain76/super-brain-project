/**
 * lib/hockey/nhl.ts — the NHL, 2026/27 season (all 32 franchises).
 *
 * Prebuilt and merged into ALL_CLUBS so the moment TheSportsDB publishes the
 * real NHL regular-season schedule (league 4380) the competition can be seeded
 * and it lights up with correct names, colours and codes — no scramble.
 *
 * `name` matches the TheSportsDB feed EXACTLY (verified against list/teams). Codes
 * are the standard NHL abbreviations, EXCEPT Toronto → TML (TOR is taken by
 * Torino in Serie A; codes are globally unique across ALL_CLUBS). Coloured
 * monograms, no crest images.
 */

import type { Club } from "@/lib/premierLeague/clubs";

export const NHL_CLUBS: Club[] = [
  { code: "ANA", name: "Anaheim Ducks",        short: "Ducks",        nickname: "The Ducks",      primary: "#F47A38", city: "Anaheim",         stadium: "Honda Center" },
  { code: "BOS", name: "Boston Bruins",        short: "Bruins",       nickname: "The B's",        primary: "#FFB81C", city: "Boston",          stadium: "TD Garden" },
  { code: "BUF", name: "Buffalo Sabres",       short: "Sabres",       nickname: "The Sabres",     primary: "#003087", city: "Buffalo",         stadium: "KeyBank Center" },
  { code: "CGY", name: "Calgary Flames",       short: "Flames",       nickname: "The Flames",     primary: "#C8102E", city: "Calgary",         stadium: "Scotiabank Saddledome" },
  { code: "CAR", name: "Carolina Hurricanes",  short: "Hurricanes",   nickname: "The Canes",      primary: "#CC0000", city: "Raleigh",         stadium: "Lenovo Center" },
  { code: "CHI", name: "Chicago Blackhawks",   short: "Blackhawks",   nickname: "The Hawks",      primary: "#CF0A2C", city: "Chicago",         stadium: "United Center" },
  { code: "COL", name: "Colorado Avalanche",   short: "Avalanche",    nickname: "The Avs",        primary: "#6F263D", city: "Denver",          stadium: "Ball Arena" },
  { code: "CBJ", name: "Columbus Blue Jackets",short: "Blue Jackets", nickname: "The Jackets",    primary: "#002654", city: "Columbus",        stadium: "Nationwide Arena" },
  { code: "DAL", name: "Dallas Stars",         short: "Stars",        nickname: "The Stars",      primary: "#006847", city: "Dallas",          stadium: "American Airlines Center" },
  { code: "DET", name: "Detroit Red Wings",    short: "Red Wings",    nickname: "The Wings",      primary: "#CE1126", city: "Detroit",         stadium: "Little Caesars Arena" },
  { code: "EDM", name: "Edmonton Oilers",      short: "Oilers",       nickname: "The Oilers",     primary: "#FF4C00", city: "Edmonton",        stadium: "Rogers Place" },
  { code: "FLA", name: "Florida Panthers",     short: "Panthers",     nickname: "The Cats",       primary: "#041E42", city: "Sunrise",         stadium: "Amerant Bank Arena" },
  { code: "LAK", name: "Los Angeles Kings",    short: "Kings",        nickname: "The Kings",      primary: "#111111", city: "Los Angeles",     stadium: "Crypto.com Arena" },
  { code: "MIN", name: "Minnesota Wild",       short: "Wild",         nickname: "The Wild",       primary: "#154734", city: "Saint Paul",      stadium: "Xcel Energy Center" },
  { code: "MTL", name: "Montreal Canadiens",   short: "Canadiens",    nickname: "The Habs",       primary: "#AF1E2D", city: "Montreal",        stadium: "Bell Centre" },
  { code: "NSH", name: "Nashville Predators",  short: "Predators",    nickname: "The Preds",      primary: "#FFB81C", city: "Nashville",       stadium: "Bridgestone Arena" },
  { code: "NJD", name: "New Jersey Devils",    short: "Devils",       nickname: "The Devils",     primary: "#CE1126", city: "Newark",          stadium: "Prudential Center" },
  { code: "NYI", name: "New York Islanders",   short: "Islanders",    nickname: "The Isles",      primary: "#00539B", city: "Elmont",          stadium: "UBS Arena" },
  { code: "NYR", name: "New York Rangers",     short: "Rangers",      nickname: "The Rangers",    primary: "#0038A8", city: "New York",        stadium: "Madison Square Garden" },
  { code: "OTT", name: "Ottawa Senators",      short: "Senators",     nickname: "The Sens",       primary: "#C8102E", city: "Ottawa",          stadium: "Canadian Tire Centre" },
  { code: "PHI", name: "Philadelphia Flyers",  short: "Flyers",       nickname: "The Flyers",     primary: "#F74902", city: "Philadelphia",    stadium: "Wells Fargo Center" },
  { code: "PIT", name: "Pittsburgh Penguins",  short: "Penguins",     nickname: "The Pens",       primary: "#FCB514", city: "Pittsburgh",      stadium: "PPG Paints Arena" },
  { code: "SJS", name: "San Jose Sharks",      short: "Sharks",       nickname: "The Sharks",     primary: "#006D75", city: "San Jose",        stadium: "SAP Center" },
  { code: "SEA", name: "Seattle Kraken",       short: "Kraken",       nickname: "The Kraken",     primary: "#001628", city: "Seattle",         stadium: "Climate Pledge Arena" },
  { code: "STL", name: "St. Louis Blues",      short: "Blues",        nickname: "The Blues",      primary: "#002F87", city: "St. Louis",       stadium: "Enterprise Center" },
  { code: "TBL", name: "Tampa Bay Lightning",  short: "Lightning",    nickname: "The Bolts",      primary: "#002868", city: "Tampa",           stadium: "Amalie Arena" },
  { code: "TML", name: "Toronto Maple Leafs",  short: "Maple Leafs",  nickname: "The Leafs",      primary: "#00205B", city: "Toronto",         stadium: "Scotiabank Arena" },
  { code: "UTA", name: "Utah Mammoth",         short: "Mammoth",      nickname: "The Mammoth",    primary: "#71AFE5", city: "Salt Lake City",  stadium: "Delta Center" },
  { code: "VAN", name: "Vancouver Canucks",    short: "Canucks",      nickname: "The Canucks",    primary: "#00843D", city: "Vancouver",       stadium: "Rogers Arena" },
  { code: "VGK", name: "Vegas Golden Knights", short: "Golden Knights",nickname: "The Knights",   primary: "#B4975A", city: "Las Vegas",       stadium: "T-Mobile Arena" },
  { code: "WSH", name: "Washington Capitals",  short: "Capitals",     nickname: "The Caps",       primary: "#C8102E", city: "Washington",      stadium: "Capital One Arena" },
  { code: "WPG", name: "Winnipeg Jets",        short: "Jets",         nickname: "The Jets",       primary: "#041E42", city: "Winnipeg",        stadium: "Canada Life Centre" },
];
