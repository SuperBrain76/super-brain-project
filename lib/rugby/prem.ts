/**
 * lib/rugby/prem.ts — the Gallagher PREM (English Premiership Rugby), 2026/27.
 *
 * England's top rugby-union flight: 10 clubs after the 2026 rebrand season
 * (Newcastle relaunched as the Red Bulls). First rugby competition on the
 * platform — same idea as the football and hockey club files (data, not
 * architecture; coloured monograms, no crest images for licensing reasons).
 *
 * `name` matches the TheSportsDB feed EXACTLY (league 4414) so imported
 * fixtures resolve by name → code with no guessing. Codes are 3 letters and
 * unique across every competition in ALL_CLUBS (Leicester Tigers → TIG so the
 * code stays free of Leicester City; Bristol → BRI, distinct from Brentford's
 * BRE).
 */

import type { Club } from "@/lib/premierLeague/clubs";

// The real 2026/27 Gallagher PREM. Verified vs the TheSportsDB schedule
// (10 teams, 18 rounds, 90 fixtures).
export const PREM_RUGBY_CLUBS: Club[] = [
  { code: "BTH", name: "Bath Rugby",          short: "Bath",        nickname: "The Blue, Black and White", primary: "#12284B", city: "Bath",        stadium: "The Recreation Ground" },
  { code: "BRI", name: "Bristol Bears",       short: "Bristol",     nickname: "The Bears",                 primary: "#012169", city: "Bristol",     stadium: "Ashton Gate" },
  { code: "EXE", name: "Exeter Chiefs",       short: "Exeter",      nickname: "The Chiefs",                primary: "#1A1A1A", city: "Exeter",      stadium: "Sandy Park" },
  { code: "GLO", name: "Gloucester",          short: "Gloucester",  nickname: "The Cherry and Whites",     primary: "#D22630", city: "Gloucester",  stadium: "Kingsholm" },
  { code: "HAR", name: "Harlequins",          short: "Quins",       nickname: "Quins",                     primary: "#8D1B3D", city: "London",      stadium: "Twickenham Stoop" },
  { code: "TIG", name: "Leicester Tigers",    short: "Leicester",   nickname: "The Tigers",                primary: "#046A38", city: "Leicester",   stadium: "Mattioli Woods Welford Road" },
  { code: "NRB", name: "Newcastle Red Bulls", short: "Newcastle",   nickname: "The Red Bulls",             primary: "#D50032", city: "Newcastle",   stadium: "Kingston Park" },
  { code: "NTH", name: "Northampton Saints",  short: "Northampton", nickname: "The Saints",                primary: "#007A53", city: "Northampton", stadium: "Franklin's Gardens" },
  { code: "SAL", name: "Sale Sharks",         short: "Sale",        nickname: "The Sharks",                primary: "#0B2265", city: "Salford",     stadium: "Salford Community Stadium" },
  { code: "SAR", name: "Saracens",            short: "Saracens",    nickname: "Sarries",                   primary: "#101820", city: "London",      stadium: "StoneX Stadium" },
];
