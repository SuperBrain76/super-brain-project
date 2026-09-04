// import-champions-league.mjs — build the Champions League 2026/27 league phase.
//
// CL is the one competition that spans every domestic league, so it can't come
// from a single clubs file like the others. This generator:
//   1. Pulls the CLEAN 36-team / 144-fixture league phase from football-data.org
//      (matchday 1-8, real matchups + dates), keyed by football-data team id
//      (their tla is NOT unique — Barça and Bayern both read "FCB").
//   2. Cross-matches each fixture to TheSportsDB by (teams + date) to recover the
//      idEvent, so live results ingest through the same pipeline as every other
//      football league (provider=thesportsdb, routed by provider_fixture_id).
//   3. Emits an idempotent seed (matched on provider_fixture_id, updated in
//      place — never deletes a fixture a user has predicted), the new-clubs
//      registry file, and the crest-map additions.
//
// Usage:  node scripts/import-champions-league.mjs
// Apply:  node scripts/run-sql.mjs --file supabase/seeds/champions-league-2026-27.sql
import fs from "node:fs";

// ── Config ────────────────────────────────────────────────────
const SLUG = "champions-league", SEASON_SLUG = "ucl-2026-27", SEASON_LABEL = "2026/27";
const FD_COMP = "CL", FD_SEASON = "2026";           // football-data
const TSDB_LEAGUE = 4480, TSDB_SEASON = "2026-2027"; // TheSportsDB
const OUT_SEED = `supabase/seeds/${SLUG}-2026-27.sql`;
const OUT_CLUBS = `lib/leagues/champions-league.ts`;

// fd team id → app club. Existing clubs reuse their code (new:false); the 15
// clubs the app has never had carry full identity (real brand colours).
const CLUB = {
  4:    { code: "DOR", tsdb: "Borussia Dortmund" },
  5:    { code: "BAY", tsdb: "Bayern Munich" },
  10:   { code: "STU", tsdb: "Stuttgart" },
  57:   { code: "ARS", tsdb: "Arsenal" },
  58:   { code: "AVL", tsdb: "Aston Villa" },
  64:   { code: "LIV", tsdb: "Liverpool" },
  65:   { code: "MCI", tsdb: "Manchester City" },
  66:   { code: "MUN", tsdb: "Manchester United" },
  78:   { code: "ATM", tsdb: "Atlético Madrid" },
  81:   { code: "BAR", tsdb: "Barcelona" },
  86:   { code: "RMA", tsdb: "Real Madrid" },
  90:   { code: "BET", tsdb: "Real Betis" },
  94:   { code: "VIL", tsdb: "Villarreal" },
  100:  { code: "ROM", tsdb: "Roma" },
  108:  { code: "INT", tsdb: "Inter Milan" },
  113:  { code: "NAP", tsdb: "Napoli" },
  521:  { code: "LIL", tsdb: "Lille" },
  524:  { code: "PSG", tsdb: "Paris Saint-Germain" },
  546:  { code: "LEN", tsdb: "Lens" },
  721:  { code: "RBL", tsdb: "RB Leipzig" },
  7397: { code: "COM", tsdb: "Como" },
  // ── new clubs ──
  498:   { code: "SPO", tsdb: "Sporting CP",       new: true, name: "Sporting CP",      short: "Sporting",  nickname: "Os Leões",      primary: "#008057", city: "Lisbon",     stadium: "Estádio José Alvalade" },
  503:   { code: "POR", tsdb: "Porto",             new: true, name: "Porto",            short: "Porto",     nickname: "Dragões",       primary: "#00579C", city: "Porto",      stadium: "Estádio do Dragão" },
  610:   { code: "GAL", tsdb: "Galatasaray",       new: true, name: "Galatasaray",      short: "Galatasaray", nickname: "Cimbom",      primary: "#A90432", city: "Istanbul",   stadium: "Rams Park" },
  613:   { code: "FEN", tsdb: "Fenerbahçe",        new: true, name: "Fenerbahçe",       short: "Fener",     nickname: "Sarı Kanaryalar", primary: "#0A1E3F", city: "Istanbul", stadium: "Şükrü Saracoğlu Stadium" },
  674:   { code: "PSV", tsdb: "PSV Eindhoven",     new: true, name: "PSV Eindhoven",    short: "PSV",       nickname: "Boeren",        primary: "#ED1C24", city: "Eindhoven",  stadium: "Philips Stadion" },
  675:   { code: "FEY", tsdb: "Feyenoord",         new: true, name: "Feyenoord",        short: "Feyenoord", nickname: "De Stadionclub", primary: "#E30613", city: "Rotterdam", stadium: "De Kuip" },
  851:   { code: "BRU", tsdb: "Club Brugge",       new: true, name: "Club Brugge",      short: "Brugge",    nickname: "Blauw-Zwart",   primary: "#005CA9", city: "Bruges",     stadium: "Jan Breydel Stadium" },
  930:   { code: "SLA", tsdb: "Slavia Prague",     new: true, name: "Slavia Prague",    short: "Slavia",    nickname: "Sešívaní",      primary: "#D31145", city: "Prague",     stadium: "Eden Arena" },
  1887:  { code: "SHK", tsdb: "Shakhtar Donetsk",  new: true, name: "Shakhtar Donetsk", short: "Shakhtar",  nickname: "Hirnyky",       primary: "#F58220", city: "Donetsk",    stadium: "Arena Lviv" },
  1899:  { code: "AEK", tsdb: "AEK Athens",        new: true, name: "AEK Athens",       short: "AEK",       nickname: "Dikephalos",    primary: "#F1B300", city: "Athens",     stadium: "OPAP Arena" },
  2016:  { code: "LAS", tsdb: "LASK",             new: true, name: "LASK",             short: "LASK",      nickname: "Die Laskler",   primary: "#1A1A1A", city: "Linz",       stadium: "Raiffeisen Arena" },
  5720:  { code: "VIK", tsdb: "Viking",            new: true, name: "Viking",           short: "Viking",    nickname: "Mørke",         primary: "#003DA5", city: "Stavanger",  stadium: "SR-Bank Arena" },
  5721:  { code: "BOD", tsdb: "Bodø/Glimt",        new: true, name: "Bodø/Glimt",       short: "Bodø",      nickname: "Gutan",         primary: "#FFD200", city: "Bodø",       stadium: "Aspmyra Stadion" },
  7509:  { code: "SLB", tsdb: "Slovan Bratislava", new: true, name: "Slovan Bratislava", short: "Slovan",   nickname: "Belasí",        primary: "#005BAB", city: "Bratislava", stadium: "Tehelné pole" },
  10233: { code: "SAB", tsdb: "Sabah Baku",       new: true, name: "Sabah",            short: "Sabah",     nickname: "Sabah",         primary: "#00843D", city: "Baku",       stadium: "Bank Respublika Arena" },
};

// ── Keys ──────────────────────────────────────────────────────
function envKey(name, fallback) {
  try {
    const m = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").match(new RegExp(`^${name}=(.+)$`, "m"));
    if (m) return m[1].trim();
  } catch { /* */ }
  return process.env[name] || fallback;
}
const FD_TOKEN = envKey("FOOTBALL_DATA_TOKEN");
const TSDB_KEY = envKey("THESPORTSDB_API_KEY", "123");

const esc = (s) => (s ?? "").replace(/'/g, "''");
const dayOf = (iso) => (iso || "").slice(0, 10);

// ── Fetch ─────────────────────────────────────────────────────
const fdRes = await fetch(`https://api.football-data.org/v4/competitions/${FD_COMP}/matches?season=${FD_SEASON}`, { headers: { "X-Auth-Token": FD_TOKEN } });
if (!fdRes.ok) throw new Error(`football-data HTTP ${fdRes.status}`);
const fdMatches = ((await fdRes.json()).matches || []).filter((m) => m.stage === "LEAGUE_STAGE");
process.stderr.write(`football-data: ${fdMatches.length} league-stage matches\n`);

const tsRes = await fetch(`https://www.thesportsdb.com/api/v2/json/schedule/league/${TSDB_LEAGUE}/${TSDB_SEASON}`, { headers: { "X-API-KEY": TSDB_KEY } });
if (!tsRes.ok) throw new Error(`TheSportsDB HTTP ${tsRes.status}`);
const tsEvents = ((await tsRes.json()).schedule || []).filter((e) => e.strHomeTeam && e.strAwayTeam && e.idEvent);
process.stderr.write(`TheSportsDB: ${tsEvents.length} events\n`);

// ── Cross-match TheSportsDB idEvent by teams + date ───────────
const tsdbName2code = {};
for (const c of Object.values(CLUB)) tsdbName2code[c.tsdb] = c.code;
const tsIndex = new Map(); // key: sortedCodes|date -> idEvent
for (const e of tsEvents) {
  const h = tsdbName2code[e.strHomeTeam], a = tsdbName2code[e.strAwayTeam];
  if (!h || !a) continue;
  const d = e.dateEvent || dayOf(e.strTimestamp);
  tsIndex.set(`${[h, a].sort().join("|")}|${d}`, e.idEvent);
}

// ── Build fixtures ────────────────────────────────────────────
let unmappedTeam = 0, unmatchedEvent = 0;
const fixtures = [];
for (const m of fdMatches) {
  const H = CLUB[m.homeTeam?.id], A = CLUB[m.awayTeam?.id];
  if (!H || !A) { unmappedTeam++; process.stderr.write(`  unmapped team: ${m.homeTeam?.name} (${m.homeTeam?.id}) v ${m.awayTeam?.name} (${m.awayTeam?.id})\n`); continue; }
  const ko = m.utcDate, d = dayOf(ko), sortedKey = [H.code, A.code].sort().join("|");
  let idEvent = tsIndex.get(`${sortedKey}|${d}`);
  if (!idEvent) { // tolerate a ±1 day timezone drift
    for (const off of [-1, 1]) {
      const dd = new Date(Date.parse(d) + off * 86400000).toISOString().slice(0, 10);
      idEvent = tsIndex.get(`${sortedKey}|${dd}`); if (idEvent) break;
    }
  }
  if (!idEvent) unmatchedEvent++;
  fixtures.push({ md: m.matchday, home: H.code, away: A.code, ko, idEvent: idEvent || null, venue: esc(H.stadium || "") });
}
fixtures.sort((a, b) => a.md - b.md || a.ko.localeCompare(b.ko));
process.stderr.write(`fixtures: ${fixtures.length} | unmapped teams: ${unmappedTeam} | no idEvent: ${unmatchedEvent}\n`);
if (unmappedTeam > 0) throw new Error("Some league-stage teams are not in the CLUB crosswalk — fix before seeding.");

const first = fixtures[0].ko, last = fixtures[fixtures.length - 1].ko;
const codeToTeam = Object.fromEntries(Object.values(CLUB).map((c) => [c.code, c]));
const allCodes = [...new Set(fixtures.flatMap((f) => [f.home, f.away]))];

// ── Emit: new-clubs registry file ─────────────────────────────
const newClubs = Object.values(CLUB).filter((c) => c.new).sort((a, b) => a.code.localeCompare(b.code));
let ts = `/**
 * lib/leagues/champions-league.ts — clubs that enter the app THROUGH the
 * Champions League (not in any domestic league we run). Merged into ALL_CLUBS
 * so club(code) / ClubCrest resolve them everywhere. The 21 CL clubs that also
 * play in our domestic leagues keep their existing entries — they are not
 * duplicated here. GENERATED by scripts/import-champions-league.mjs.
 */
import type { Club } from "@/lib/premierLeague/clubs";

export const CHAMPIONS_LEAGUE_CLUBS: Club[] = [
`;
for (const c of newClubs) {
  ts += `  { code: ${JSON.stringify(c.code)}, name: ${JSON.stringify(c.name)}, short: ${JSON.stringify(c.short)}, nickname: ${JSON.stringify(c.nickname)}, primary: ${JSON.stringify(c.primary)}, city: ${JSON.stringify(c.city)}, stadium: ${JSON.stringify(c.stadium)} },\n`;
}
ts += `];\n`;
fs.writeFileSync(OUT_CLUBS, ts);

// ── Emit: crest-map additions (printed for manual insert) ─────
const crestLines = newClubs.map((c) => {
  const id = Object.keys(CLUB).find((k) => CLUB[k].code === c.code);
  return `  ${JSON.stringify(c.code)}: "https://crests.football-data.org/${id}.png",`;
});

// ── Emit: seed SQL ────────────────────────────────────────────
const val = (v) => (v == null ? "null" : `'${esc(v)}'`);
let sql = `-- AUTO-GENERATED seed — Champions League ${SEASON_LABEL} league phase
-- ${fixtures.length} fixtures / 8 matchdays / ${allCodes.length} clubs, from football-data.org
-- (structure) cross-matched to TheSportsDB (idEvent, for live results).
-- Idempotent: fixtures matched on provider_fixture_id and updated in place.
insert into public.sports (code, name, has_draw, default_prediction_type, icon)
values ('football', 'Football', true, 'score', '⚽') on conflict (code) do nothing;

do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_num integer := 0; v_fix uuid;
begin
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('Champions League', '${SLUG}', 'football', 'active', '${first}', '${last}')
  on conflict (slug) do update set name = excluded.name, sport_code = excluded.sport_code, status = excluded.status returning id into v_comp;
  if v_comp is null then select id into v_comp from public.competitions where slug='${SLUG}'; end if;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'league', 'Matchday', 1, true, false) on conflict (competition_id, code) do nothing;

  insert into public.seasons (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_comp, '${SEASON_SLUG}', '${SEASON_LABEL}', 'active', true, '${first}', '${last}')
  on conflict (slug) do nothing;
  select id into v_season from public.seasons where slug='${SEASON_SLUG}';

  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_comp,'exact',5,1),(v_comp,'gd',3,2),(v_comp,'result',2,3),(v_comp,'wrong',0,4)
  on conflict (competition_id, rule_code) do nothing;

  insert into public.competition_settings (competition_id, key, value) values
    (v_comp,'home_style','"matchweek"'::jsonb),
    (v_comp,'has_knockout','false'::jsonb),
    (v_comp,'has_group_stage','false'::jsonb),
    (v_comp,'has_standings_table','true'::jsonb),
    (v_comp,'has_challenges','false'::jsonb),
    (v_comp,'round_label','"Matchday"'::jsonb),
    (v_comp,'round_label_plural','"Matchdays"'::jsonb),
    (v_comp,'provider','"thesportsdb"'::jsonb),
    (v_comp,'provider_league_id','${TSDB_LEAGUE}'::jsonb),
    (v_comp,'provider_season','"${TSDB_SEASON}"'::jsonb),
    (v_comp,'ingest_enabled','true'::jsonb),
    (v_comp,'lifecycle','"public"'::jsonb),
    (v_comp,'visible','true'::jsonb),
    (v_comp,'timezone','"Europe/Zurich"'::jsonb),
    (v_comp,'display_order','6'::jsonb)
  on conflict (competition_id, key) do update set value = excluded.value;

`;
for (const code of allCodes.sort()) {
  const t = codeToTeam[code];
  sql += `  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, '${esc(t.name || t.tsdb)}', '${code}', null) on conflict (competition_id, code) do update set name = excluded.name;\n`;
}
sql += `
  insert into public.season_teams (season_id, team_id)
    select v_season, id from public.teams where competition_id = v_comp on conflict do nothing;
`;
for (let md = 1; md <= 8; md++) {
  const inMd = fixtures.filter((f) => f.md === md);
  if (!inMd.length) continue;
  sql += `
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'md${md}', 'Matchday ${md}', 'MD${md}', ${md}, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set label = excluded.label;
  select id into v_round from public.rounds where season_id = v_season and code = 'md${md}';
`;
  for (const f of inMd) {
    sql += `  v_num := v_num + 1;
  v_fix := ${f.idEvent ? `(select id from public.fixtures where season_id = v_season and provider_fixture_id = '${f.idEvent}')` : "null"};
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='${f.home}'), (select id from public.teams where competition_id=v_comp and code='${f.away}'), '${f.ko}', ${val(f.venue)}, 'scheduled', ${f.idEvent ? `'${f.idEvent}'` : "null"});
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '${f.ko}' where id = v_fix;
  end if;
`;
  }
}
sql += `  raise notice 'Champions League: % fixtures / 8 matchdays', v_num;\nend $$;\n`;
fs.writeFileSync(OUT_SEED, sql);

console.log(`WROTE ${OUT_SEED} — ${fixtures.length} fixtures, ${allCodes.length} clubs, ${fixtures.filter(f=>f.idEvent).length} with idEvent (${unmatchedEvent} without)`);
console.log(`WROTE ${OUT_CLUBS} — ${newClubs.length} new clubs`);
console.log(`\nAdd these to lib/leagues/crests.ts (CREST_BY_CODE):`);
console.log(crestLines.join("\n"));
