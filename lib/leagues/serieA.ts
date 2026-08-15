/**
 * lib/leagues/serieA.ts — Italian Serie A, 2026/27.
 * Club data for coloured monogram crests (no official logos). Names match
 * TheSportsDB. Merged via clubs.ts.
 */

import type { Club } from "@/lib/premierLeague/clubs";

export const SERIE_A_CLUBS: Club[] = [
  { code: "MIL", name: "AC Milan",     short: "Milan",      nickname: "Rossoneri",           primary: "#FB090B", city: "Milan",         stadium: "San Siro" },
  { code: "ATA", name: "Atalanta",     short: "Atalanta",   nickname: "La Dea",              primary: "#1E71B8", city: "Bergamo",       stadium: "Gewiss Stadium" },
  { code: "BOL", name: "Bologna",      short: "Bologna",    nickname: "Rossoblù",            primary: "#A81E22", city: "Bologna",       stadium: "Renato Dall'Ara" },
  { code: "CAG", name: "Cagliari",     short: "Cagliari",   nickname: "Casteddu",            primary: "#A50021", city: "Cagliari",      stadium: "Unipol Domus" },
  { code: "COM", name: "Como",         short: "Como",       nickname: "Lariani",             primary: "#004B87", city: "Como",          stadium: "Stadio Sinigaglia" },
  { code: "FIO", name: "Fiorentina",   short: "Fiorentina", nickname: "La Viola",            primary: "#592C82", city: "Florence",      stadium: "Artemio Franchi" },
  { code: "FRO", name: "Frosinone",    short: "Frosinone",  nickname: "Canarini",            primary: "#003D7C", city: "Frosinone",     stadium: "Benito Stirpe" },
  { code: "GEN", name: "Genoa",        short: "Genoa",      nickname: "Il Grifone",          primary: "#B01E23", city: "Genoa",         stadium: "Luigi Ferraris" },
  { code: "INT", name: "Inter Milan",  short: "Inter",      nickname: "Nerazzurri",          primary: "#0068A8", city: "Milan",         stadium: "San Siro" },
  { code: "JUV", name: "Juventus",     short: "Juventus",   nickname: "Bianconeri",          primary: "#1A1A1A", city: "Turin",         stadium: "Allianz Stadium" },
  { code: "LAZ", name: "Lazio",        short: "Lazio",      nickname: "Biancocelesti",       primary: "#4AA5DE", city: "Rome",          stadium: "Stadio Olimpico" },
  { code: "LEC", name: "Lecce",        short: "Lecce",      nickname: "Giallorossi",         primary: "#D2001C", city: "Lecce",         stadium: "Via del Mare" },
  { code: "MON", name: "Monza",        short: "Monza",      nickname: "Biancorossi",         primary: "#E20613", city: "Monza",         stadium: "U-Power Stadium" },
  { code: "NAP", name: "Napoli",       short: "Napoli",     nickname: "Partenopei",          primary: "#12A0D7", city: "Naples",        stadium: "Diego Armando Maradona" },
  { code: "PAR", name: "Parma",        short: "Parma",      nickname: "Crociati",            primary: "#F9C700", city: "Parma",         stadium: "Ennio Tardini" },
  { code: "ROM", name: "Roma",         short: "Roma",       nickname: "Giallorossi",         primary: "#8E1F2F", city: "Rome",          stadium: "Stadio Olimpico" },
  { code: "SAS", name: "Sassuolo",     short: "Sassuolo",   nickname: "Neroverdi",           primary: "#00A752", city: "Reggio Emilia", stadium: "Mapei Stadium" },
  { code: "TOR", name: "Torino",       short: "Torino",     nickname: "Il Toro",             primary: "#8A1E03", city: "Turin",         stadium: "Grande Torino" },
  { code: "UDI", name: "Udinese",      short: "Udinese",    nickname: "Le Zebrette",         primary: "#1A1A1A", city: "Udine",         stadium: "Bluenergy Stadium" },
  { code: "VEN", name: "Venezia",      short: "Venezia",    nickname: "Arancioneroverdi",    primary: "#0B6E4F", city: "Venice",        stadium: "Pier Luigi Penzo" },
];
