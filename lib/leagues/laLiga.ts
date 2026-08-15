/**
 * lib/leagues/laLiga.ts — Spanish La Liga, 2026/27.
 *
 * Club data for the coloured monogram crests (no official logos — trademark /
 * App Store safe, same rule as the Premier League). White-kit sides get a
 * visible associated tone so the badge still reads.
 *
 * Merged into the global club(code) registry via lib/premierLeague/clubs.ts.
 * Codes are unique across every league.
 */

import type { Club } from "@/lib/premierLeague/clubs";

export const LA_LIGA_CLUBS: Club[] = [
  { code: "ATH", name: "Athletic Bilbao",       short: "Athletic",       nickname: "Los Leones",           primary: "#EE2523", city: "Bilbao",         stadium: "San Mamés" },
  { code: "ATM", name: "Atlético Madrid",       short: "Atlético",       nickname: "Los Colchoneros",      primary: "#C8102E", city: "Madrid",         stadium: "Metropolitano" },
  { code: "BAR", name: "Barcelona",             short: "Barça",          nickname: "Blaugrana",            primary: "#A50044", city: "Barcelona",      stadium: "Spotify Camp Nou" },
  { code: "CEL", name: "Celta Vigo",            short: "Celta",          nickname: "Os Celestes",          primary: "#6AADE4", city: "Vigo",           stadium: "Balaídos" },
  { code: "ALA", name: "Deportivo Alavés",      short: "Alavés",         nickname: "Babazorros",           primary: "#1E71B8", city: "Vitoria-Gasteiz",stadium: "Mendizorroza" },
  { code: "DEP", name: "Deportivo de A Coruña", short: "Depor",          nickname: "Dépor",                primary: "#2A6EBB", city: "A Coruña",       stadium: "Riazor" },
  { code: "ELC", name: "Elche",                 short: "Elche",          nickname: "Franjiverdes",         primary: "#128A45", city: "Elche",          stadium: "Martínez Valero" },
  { code: "ESP", name: "Espanyol",              short: "Espanyol",       nickname: "Pericos",              primary: "#0067B7", city: "Barcelona",      stadium: "RCDE Stadium" },
  { code: "GET", name: "Getafe",                short: "Getafe",         nickname: "Azulones",             primary: "#005CA9", city: "Getafe",         stadium: "Coliseum" },
  { code: "LEV", name: "Levante",               short: "Levante",        nickname: "Granotes",             primary: "#9E1B32", city: "Valencia",       stadium: "Ciutat de València" },
  { code: "MAL", name: "Málaga",                short: "Málaga",         nickname: "Boquerones",           primary: "#0067B1", city: "Málaga",         stadium: "La Rosaleda" },
  { code: "OSA", name: "Osasuna",               short: "Osasuna",        nickname: "Los Rojillos",         primary: "#C3132C", city: "Pamplona",       stadium: "El Sadar" },
  { code: "RAC", name: "Racing de Santander",   short: "Racing",         nickname: "Los Racinguistas",     primary: "#0E9E4F", city: "Santander",      stadium: "El Sardinero" },
  { code: "RAY", name: "Rayo Vallecano",        short: "Rayo",           nickname: "Los Franjirrojos",     primary: "#E4322B", city: "Madrid",         stadium: "Vallecas" },
  { code: "BET", name: "Real Betis",            short: "Betis",          nickname: "Los Verdiblancos",     primary: "#148A45", city: "Sevilla",        stadium: "Benito Villamarín" },
  { code: "RMA", name: "Real Madrid",           short: "Real Madrid",    nickname: "Los Blancos",          primary: "#1E2A5A", city: "Madrid",         stadium: "Santiago Bernabéu" },
  { code: "RSO", name: "Real Sociedad",         short: "Real Sociedad",  nickname: "La Real",              primary: "#143C8B", city: "San Sebastián",  stadium: "Reale Arena" },
  { code: "SEV", name: "Sevilla",               short: "Sevilla",        nickname: "Los Nervionenses",     primary: "#C40C24", city: "Sevilla",        stadium: "Ramón Sánchez-Pizjuán" },
  { code: "VAL", name: "Valencia",              short: "Valencia",       nickname: "Los Che",              primary: "#F18E00", city: "Valencia",       stadium: "Mestalla" },
  { code: "VIL", name: "Villarreal",            short: "Villarreal",     nickname: "El Submarino Amarillo",primary: "#FDE100", city: "Villarreal",     stadium: "La Cerámica" },
];
