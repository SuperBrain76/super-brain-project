/**
 * lib/leagues/ligue1.ts — French Ligue 1, 2026/27.
 * Club data for coloured monogram crests (no official logos). Names match
 * TheSportsDB. Merged via clubs.ts.
 */

import type { Club } from "@/lib/premierLeague/clubs";

export const LIGUE_1_CLUBS: Club[] = [
  { code: "ANG", name: "Angers",               short: "Angers",     nickname: "Le SCO",          primary: "#1A1A1A", city: "Angers",      stadium: "Raymond Kopa" },
  { code: "AUX", name: "Auxerre",              short: "Auxerre",    nickname: "l'AJA",           primary: "#005EB8", city: "Auxerre",     stadium: "Abbé-Deschamps" },
  { code: "BST", name: "Brest",                short: "Brest",      nickname: "Les Ty-Zefs",     primary: "#D2001C", city: "Brest",       stadium: "Francis-Le Blé" },
  { code: "HAC", name: "Le Havre",             short: "Le Havre",   nickname: "Les Ciel et Marine",primary: "#005BAA", city: "Le Havre",  stadium: "Stade Océane" },
  { code: "LMN", name: "Le Mans",              short: "Le Mans",    nickname: "Les Sang et Or",  primary: "#E30613", city: "Le Mans",     stadium: "MMArena" },
  { code: "LEN", name: "Lens",                 short: "Lens",       nickname: "Les Sang et Or",  primary: "#E20613", city: "Lens",        stadium: "Bollaert-Delelis" },
  { code: "LIL", name: "Lille",                short: "Lille",      nickname: "Les Dogues",      primary: "#E01E13", city: "Lille",       stadium: "Pierre-Mauroy" },
  { code: "LOR", name: "Lorient",              short: "Lorient",    nickname: "Les Merlus",      primary: "#F5A800", city: "Lorient",     stadium: "Stade du Moustoir" },
  { code: "LYO", name: "Lyon",                 short: "Lyon",       nickname: "l'OL",            primary: "#D9001C", city: "Lyon",        stadium: "Groupama Stadium" },
  { code: "MAR", name: "Marseille",            short: "Marseille",  nickname: "l'OM",            primary: "#2FAADE", city: "Marseille",   stadium: "Stade Vélodrome" },
  { code: "ASM", name: "Monaco",               short: "Monaco",     nickname: "Les Monégasques", primary: "#E63329", city: "Monaco",      stadium: "Stade Louis II" },
  { code: "NIC", name: "Nice",                 short: "Nice",       nickname: "Les Aiglons",     primary: "#C7002B", city: "Nice",        stadium: "Allianz Riviera" },
  { code: "PFC", name: "Paris FC",             short: "Paris FC",   nickname: "Les Parisiens",   primary: "#0055A4", city: "Paris",       stadium: "Stade Jean-Bouin" },
  { code: "PSG", name: "Paris Saint-Germain",  short: "PSG",        nickname: "Les Parisiens",   primary: "#004170", city: "Paris",       stadium: "Parc des Princes" },
  { code: "REN", name: "Rennes",               short: "Rennes",     nickname: "Les Rouge et Noir",primary: "#E23125", city: "Rennes",     stadium: "Roazhon Park" },
  { code: "STR", name: "Strasbourg",           short: "Strasbourg", nickname: "Le Racing",       primary: "#0091D4", city: "Strasbourg",  stadium: "Stade de la Meinau" },
  { code: "TOU", name: "Toulouse",             short: "Toulouse",   nickname: "Les Violets",     primary: "#6E267B", city: "Toulouse",    stadium: "Stadium de Toulouse" },
  { code: "TRO", name: "Troyes",               short: "Troyes",     nickname: "l'ESTAC",         primary: "#005BAA", city: "Troyes",      stadium: "Stade de l'Aube" },
];
