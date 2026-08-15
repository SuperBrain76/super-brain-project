/**
 * lib/leagues/bundesliga.ts — German Bundesliga, 2026/27.
 * Club data for coloured monogram crests (no official logos). Names match
 * TheSportsDB so the importer maps them by name. Merged via clubs.ts.
 */

import type { Club } from "@/lib/premierLeague/clubs";

export const BUNDESLIGA_CLUBS: Club[] = [
  { code: "AUG", name: "Augsburg",                 short: "Augsburg",     nickname: "Die Fuggerstädter", primary: "#BA3733", city: "Augsburg",       stadium: "WWK Arena" },
  { code: "LVK", name: "Bayer Leverkusen",         short: "Leverkusen",   nickname: "Die Werkself",      primary: "#E32219", city: "Leverkusen",     stadium: "BayArena" },
  { code: "BAY", name: "Bayern Munich",            short: "Bayern",       nickname: "Die Roten",         primary: "#DC052D", city: "Munich",         stadium: "Allianz Arena" },
  { code: "DOR", name: "Borussia Dortmund",        short: "Dortmund",     nickname: "BVB",               primary: "#FDE100", city: "Dortmund",       stadium: "Signal Iduna Park" },
  { code: "GLA", name: "Borussia Mönchengladbach", short: "Gladbach",     nickname: "Die Fohlen",        primary: "#22A45D", city: "Mönchengladbach",stadium: "Borussia-Park" },
  { code: "SGE", name: "Eintracht Frankfurt",      short: "Frankfurt",    nickname: "Die Adler",         primary: "#E1000F", city: "Frankfurt",      stadium: "Deutsche Bank Park" },
  { code: "ELV", name: "Elversberg",               short: "Elversberg",   nickname: "Die SVE",           primary: "#E2001A", city: "Elversberg",     stadium: "Ursapharm-Arena" },
  { code: "FRE", name: "Freiburg",                 short: "Freiburg",     nickname: "Breisgau-Brasilianer",primary: "#C1002A", city: "Freiburg",     stadium: "Europa-Park Stadion" },
  { code: "HSV", name: "Hamburg",                  short: "Hamburg",      nickname: "Die Rothosen",      primary: "#0A3F7F", city: "Hamburg",        stadium: "Volksparkstadion" },
  { code: "HOF", name: "Hoffenheim",               short: "Hoffenheim",   nickname: "Die Kraichgauer",   primary: "#1961B5", city: "Sinsheim",       stadium: "PreZero Arena" },
  { code: "KOE", name: "Köln",                     short: "Köln",         nickname: "Die Geißböcke",     primary: "#ED1C24", city: "Cologne",        stadium: "RheinEnergieStadion" },
  { code: "MAI", name: "Mainz",                    short: "Mainz",        nickname: "Die Nullfünfer",    primary: "#C3141E", city: "Mainz",          stadium: "Mewa Arena" },
  { code: "PAD", name: "Paderborn",                short: "Paderborn",    nickname: "Die Ostwestfalen",  primary: "#003D7C", city: "Paderborn",      stadium: "Home Deluxe Arena" },
  { code: "RBL", name: "RB Leipzig",               short: "Leipzig",      nickname: "Die Roten Bullen",  primary: "#DD0741", city: "Leipzig",        stadium: "Red Bull Arena" },
  { code: "SCH", name: "Schalke 04",               short: "Schalke",      nickname: "Die Knappen",       primary: "#004D9D", city: "Gelsenkirchen",  stadium: "Veltins-Arena" },
  { code: "STU", name: "Stuttgart",                short: "Stuttgart",    nickname: "Die Schwaben",      primary: "#E30613", city: "Stuttgart",      stadium: "MHPArena" },
  { code: "UNB", name: "Union Berlin",             short: "Union",        nickname: "Die Eisernen",      primary: "#EB1923", city: "Berlin",         stadium: "An der Alten Försterei" },
  { code: "WER", name: "Werder Bremen",            short: "Bremen",       nickname: "Die Werderaner",    primary: "#1D9053", city: "Bremen",         stadium: "Weserstadion" },
];
