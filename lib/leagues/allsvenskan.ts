/**
 * lib/leagues/allsvenskan.ts — Swedish Allsvenskan, 2026.
 * Club data for coloured monogram crests (no official logos). Names match
 * TheSportsDB so the importer maps them by name. Merged via clubs.ts.
 *
 * Sweden plays a spring-autumn calendar, so the season is the year (2026),
 * not 2026/27 like the winter leagues.
 */

import type { Club } from "@/lib/premierLeague/clubs";

export const ALLSVENSKAN_CLUBS: Club[] = [
  { code: "AIK", name: "AIK",            short: "AIK",        nickname: "Gnaget",         primary: "#1B1B1B", city: "Solna",       stadium: "Strawberry Arena" },
  { code: "BPO", name: "Brommapojkarna", short: "BP",         nickname: "BP",             primary: "#E30613", city: "Stockholm",   stadium: "Grimsta IP" },
  { code: "DEG", name: "Degerfors",      short: "Degerfors",  nickname: "Bruksklubben",   primary: "#D22630", city: "Degerfors",   stadium: "Stora Valla" },
  { code: "DJU", name: "Djurgården",     short: "Djurgården", nickname: "Järnkaminerna",  primary: "#0B5CA8", city: "Stockholm",   stadium: "Tele2 Arena" },
  { code: "ELF", name: "Elfsborg",       short: "Elfsborg",   nickname: "De Gulsvarta",   primary: "#FFD100", city: "Borås",       stadium: "Borås Arena" },
  { code: "GAI", name: "GAIS",           short: "GAIS",       nickname: "Makrillarna",    primary: "#00693E", city: "Gothenburg",  stadium: "Gamla Ullevi" },
  { code: "HBK", name: "Halmstad",       short: "Halmstad",   nickname: "HBK",            primary: "#005CB9", city: "Halmstad",    stadium: "Örjans Vall" },
  { code: "HAM", name: "Hammarby",       short: "Hammarby",   nickname: "Bajen",          primary: "#008C45", city: "Stockholm",   stadium: "Tele2 Arena" },
  { code: "HAK", name: "Häcken",         short: "Häcken",     nickname: "Getingarna",     primary: "#FFDD00", city: "Gothenburg",  stadium: "Bravida Arena" },
  { code: "IFG", name: "IFK Göteborg",   short: "Göteborg",   nickname: "Blåvitt",        primary: "#0055A5", city: "Gothenburg",  stadium: "Gamla Ullevi" },
  { code: "KFF", name: "Kalmar",         short: "Kalmar",     nickname: "KFF",            primary: "#E4002B", city: "Kalmar",      stadium: "Guldfågeln Arena" },
  { code: "MFF", name: "Malmö",          short: "Malmö",      nickname: "Di Blåe",        primary: "#6CACE4", city: "Malmö",       stadium: "Eleda Stadion" },
  { code: "MJA", name: "Mjällby",        short: "Mjällby",    nickname: "MAIF",           primary: "#F4C300", city: "Sölvesborg",  stadium: "Strandvallen" },
  { code: "SIR", name: "Sirius",         short: "Sirius",     nickname: "Svartblå",       primary: "#0A3D91", city: "Uppsala",     stadium: "Studenternas IP" },
  { code: "VSK", name: "Västerås",       short: "Västerås",   nickname: "VSK",            primary: "#262626", city: "Västerås",    stadium: "Hitachi Energy Arena" },
  { code: "OIS", name: "Örgryte",        short: "Örgryte",    nickname: "ÖIS",            primary: "#A6192E", city: "Gothenburg",  stadium: "Gamla Ullevi" },
];
