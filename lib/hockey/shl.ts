/**
 * lib/hockey/shl.ts — the SHL (Svenska Hockeyligan), 2026/27 season.
 *
 * Sweden's top ice-hockey league: 14 clubs, their real colours and what the
 * fans call them. First ice-hockey competition on the platform — same idea as
 * the football club files (data, not architecture; coloured monograms, no
 * crest images for licensing reasons).
 *
 * `name` matches the TheSportsDB feed EXACTLY (league 4419) so imported
 * fixtures resolve by name → code with no guessing. `stadium` holds the arena.
 * Codes are 3 letters and unique across every competition in ALL_CLUBS
 * (Frölunda → FRL and Malmö Redhawks → MRH avoid the football codes FRO/MAL).
 */

import type { Club } from "@/lib/premierLeague/clubs";

// The real 2026/27 SHL. Verified vs the TheSportsDB schedule (14 teams,
// 52 games each) — IF Björklöven are up; no relegation quirks to reconcile.
export const SHL_CLUBS: Club[] = [
  { code: "BRY", name: "Brynäs IF",       short: "Brynäs",     nickname: "Tigrarna",        primary: "#F2A900", city: "Gävle",       stadium: "Monitor ERP Arena" },
  { code: "DIF", name: "Djurgårdens IF",  short: "Djurgården", nickname: "Järnkaminerna",   primary: "#002D5B", city: "Stockholm",   stadium: "Avicii Arena" },
  { code: "FBK", name: "Färjestad BK",    short: "Färjestad",  nickname: "Stjärnorna",      primary: "#1A1A1A", city: "Karlstad",    stadium: "Löfbergs Arena" },
  { code: "FRL", name: "Frölunda HC",     short: "Frölunda",   nickname: "Indians",         primary: "#007A33", city: "Göteborg",    stadium: "Frölundaborg" },
  { code: "HV7", name: "HV71",            short: "HV71",       nickname: "Gula Faran",      primary: "#0067B1", city: "Jönköping",   stadium: "Husqvarna Garden" },
  { code: "BJO", name: "IF Björklöven",   short: "Björklöven", nickname: "Löven",           primary: "#00693E", city: "Umeå",        stadium: "A3 Arena" },
  { code: "LHC", name: "Linköpings HC",   short: "Linköping",  nickname: "LHC",             primary: "#003DA5", city: "Linköping",   stadium: "Saab Arena" },
  { code: "LUL", name: "Luleå HF",        short: "Luleå",      nickname: "Luleå Hockey",    primary: "#D2001C", city: "Luleå",       stadium: "Coop Norrbotten Arena" },
  { code: "MRH", name: "Malmö Redhawks",  short: "Malmö",      nickname: "Redhawks",        primary: "#C8102E", city: "Malmö",       stadium: "Malmö Arena" },
  { code: "ORE", name: "Örebro HK",       short: "Örebro",     nickname: "Örebro Hockey",   primary: "#333333", city: "Örebro",      stadium: "Behrn Arena" },
  { code: "ROG", name: "Rögle BK",        short: "Rögle",      nickname: "Rögle",           primary: "#009A44", city: "Ängelholm",   stadium: "Catena Arena" },
  { code: "SKE", name: "Skellefteå AIK",  short: "Skellefteå", nickname: "Skellefteå",      primary: "#F6BE00", city: "Skellefteå",  stadium: "Skellefteå Kraft Arena" },
  { code: "TIM", name: "Timrå IK",        short: "Timrå",      nickname: "Röda Vargarna",   primary: "#E4002B", city: "Timrå",       stadium: "NHK Arena" },
  { code: "VAX", name: "Växjö Lakers",    short: "Växjö",      nickname: "Lakers",          primary: "#00573F", city: "Växjö",       stadium: "Vida Arena" },
];
