/**
 * lib/f1/drivers2026.ts — the Formula 1 2026 grid.
 *
 * First motorsport competition on the platform. Unlike the club files, the
 * "teams" rows for F1 are DRIVERS — the prediction engine's entrant unit —
 * and the constructor is carried here as metadata (constructor standings are
 * ingested from Jolpica, never derived from these rows).
 *
 * `jolpicaId` is the Jolpica/Ergast driverId and is the ONLY join key the
 * ingestion adapter uses to map a feed result to our team row (via code).
 * `code` is the official FIA three-letter code. Five of them (HAM, LEC, HUL,
 * COL, STR) also exist as club codes in other competitions — that is fine:
 * the DB constraint is unique(competition_id, code), and F1 surfaces render
 * monograms from THIS registry, never from the global club-crest map. Do not
 * add these to ALL_CLUBS.
 *
 * Colours are the constructor's brand colour, used for monogram backgrounds
 * only (no official logos or liveries ever — licensing).
 *
 * Lineup verified against the Jolpica 2026 driver standings + Dutch GP
 * classification (round 12, 23 Aug 2026): 22 active drivers, 11 constructors.
 * The import script regex-parses code/name/jolpicaId from this file — keep
 * each entry on one line.
 */

export interface F1Driver {
  code: string;            // FIA code — teams.code in the DB
  name: string;            // full name — teams.name in the DB
  short: string;           // family name, for tight UI
  number: number;          // permanent race number
  jolpicaId: string;       // Jolpica/Ergast driverId — the ingestion join key
  constructorId: string;   // Jolpica constructorId
  constructorName: string; // display name
  primary: string;         // constructor brand colour for monograms
}

export const F1_CONSTRUCTOR_COLOURS: Record<string, string> = {
  mclaren:      "#FF8000",
  mercedes:     "#00A19B",
  ferrari:      "#DC0000",
  red_bull:     "#3671C6",
  alpine:       "#0093CC",
  williams:     "#00A3E0",
  aston_martin: "#229971",
  rb:           "#6692FF",
  haas:         "#46494D",
  audi:         "#BB0A30",
  cadillac:     "#1B2A4A",
};

const colour = (constructorId: string): string =>
  F1_CONSTRUCTOR_COLOURS[constructorId] ?? "#444444";

/* eslint-disable max-len */
export const F1_DRIVERS_2026: F1Driver[] = [
  { code: "NOR", name: "Lando Norris",          short: "Norris",     number: 1,  jolpicaId: "norris",         constructorId: "mclaren",      constructorName: "McLaren",      primary: colour("mclaren") },
  { code: "PIA", name: "Oscar Piastri",         short: "Piastri",    number: 81, jolpicaId: "piastri",        constructorId: "mclaren",      constructorName: "McLaren",      primary: colour("mclaren") },
  { code: "ANT", name: "Andrea Kimi Antonelli", short: "Antonelli",  number: 12, jolpicaId: "antonelli",      constructorId: "mercedes",     constructorName: "Mercedes",     primary: colour("mercedes") },
  { code: "RUS", name: "George Russell",        short: "Russell",    number: 63, jolpicaId: "russell",        constructorId: "mercedes",     constructorName: "Mercedes",     primary: colour("mercedes") },
  { code: "HAM", name: "Lewis Hamilton",        short: "Hamilton",   number: 44, jolpicaId: "hamilton",       constructorId: "ferrari",      constructorName: "Ferrari",      primary: colour("ferrari") },
  { code: "LEC", name: "Charles Leclerc",       short: "Leclerc",    number: 16, jolpicaId: "leclerc",        constructorId: "ferrari",      constructorName: "Ferrari",      primary: colour("ferrari") },
  { code: "VER", name: "Max Verstappen",        short: "Verstappen", number: 3,  jolpicaId: "max_verstappen", constructorId: "red_bull",     constructorName: "Red Bull",     primary: colour("red_bull") },
  { code: "LAW", name: "Liam Lawson",           short: "Lawson",     number: 30, jolpicaId: "lawson",         constructorId: "red_bull",     constructorName: "Red Bull",     primary: colour("red_bull") },
  { code: "GAS", name: "Pierre Gasly",          short: "Gasly",      number: 10, jolpicaId: "gasly",          constructorId: "alpine",       constructorName: "Alpine",       primary: colour("alpine") },
  { code: "COL", name: "Franco Colapinto",      short: "Colapinto",  number: 43, jolpicaId: "colapinto",      constructorId: "alpine",       constructorName: "Alpine",       primary: colour("alpine") },
  { code: "ALB", name: "Alexander Albon",       short: "Albon",      number: 23, jolpicaId: "albon",          constructorId: "williams",     constructorName: "Williams",     primary: colour("williams") },
  { code: "SAI", name: "Carlos Sainz",          short: "Sainz",      number: 55, jolpicaId: "sainz",          constructorId: "williams",     constructorName: "Williams",     primary: colour("williams") },
  { code: "ALO", name: "Fernando Alonso",       short: "Alonso",     number: 14, jolpicaId: "alonso",         constructorId: "aston_martin", constructorName: "Aston Martin", primary: colour("aston_martin") },
  { code: "STR", name: "Lance Stroll",          short: "Stroll",     number: 18, jolpicaId: "stroll",         constructorId: "aston_martin", constructorName: "Aston Martin", primary: colour("aston_martin") },
  { code: "TSU", name: "Yuki Tsunoda",          short: "Tsunoda",    number: 22, jolpicaId: "tsunoda",        constructorId: "rb",           constructorName: "Racing Bulls", primary: colour("rb") },
  { code: "LIN", name: "Arvid Lindblad",        short: "Lindblad",   number: 41, jolpicaId: "arvid_lindblad", constructorId: "rb",           constructorName: "Racing Bulls", primary: colour("rb") },
  { code: "BEA", name: "Oliver Bearman",        short: "Bearman",    number: 87, jolpicaId: "bearman",        constructorId: "haas",         constructorName: "Haas",         primary: colour("haas") },
  { code: "OCO", name: "Esteban Ocon",          short: "Ocon",       number: 31, jolpicaId: "ocon",           constructorId: "haas",         constructorName: "Haas",         primary: colour("haas") },
  { code: "HUL", name: "Nico Hulkenberg",       short: "Hulkenberg", number: 27, jolpicaId: "hulkenberg",     constructorId: "audi",         constructorName: "Audi",         primary: colour("audi") },
  { code: "BOR", name: "Gabriel Bortoleto",     short: "Bortoleto",  number: 5,  jolpicaId: "bortoleto",      constructorId: "audi",         constructorName: "Audi",         primary: colour("audi") },
  { code: "PER", name: "Sergio Perez",          short: "Perez",      number: 11, jolpicaId: "perez",          constructorId: "cadillac",     constructorName: "Cadillac",     primary: colour("cadillac") },
  { code: "BOT", name: "Valtteri Bottas",       short: "Bottas",     number: 77, jolpicaId: "bottas",         constructorId: "cadillac",     constructorName: "Cadillac",     primary: colour("cadillac") },
  // Hadjar sat out the Dutch GP but holds 68 points this season — Red Bull
  // rotate seats mid-year, so he stays in the registry: an entrant the feed
  // can name must always be mappable, or settlement fails loudly (by design).
  { code: "HAD", name: "Isack Hadjar",          short: "Hadjar",     number: 6,  jolpicaId: "hadjar",         constructorId: "red_bull",     constructorName: "Red Bull",     primary: colour("red_bull") },
];
/* eslint-enable max-len */

/** jolpicaId → FIA code, for the ingestion adapter. */
export const F1_JOLPICA_TO_CODE: Record<string, string> = Object.fromEntries(
  F1_DRIVERS_2026.map((x) => [x.jolpicaId, x.code]),
);

export function f1DriverByCode(code: string): F1Driver | undefined {
  return F1_DRIVERS_2026.find((x) => x.code === code);
}
