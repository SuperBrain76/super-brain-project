// import-hockey-league.mjs — generate a full seed for an ice-hockey league from
// TheSportsDB (V2, premium). Groups the flat schedule into date-based GAMEDAYS
// (hockey feeds report round 0/500), and emits an idempotent seed: sports row +
// competition (sport_code ice_hockey) + season + stage + scoring + settings +
// teams + gamedays + fixtures.
//
// This produced the live SHL seed; NHL is prewired so it seeds the instant its
// real regular season lands (check with scripts/check-league-readiness.mjs).
//
// Usage: node scripts/import-hockey-league.mjs <slug>            # writes supabase/seeds/<slug>-<season>.sql
//        node scripts/import-hockey-league.mjs <slug> <outFile>
// Then apply:  node scripts/run-sql.mjs --file <outFile>
import fs from "node:fs";

const LEAGUES = {
  shl: {
    name: "SHL", leagueId: 4419, season: "2026-2027",
    seasonSlug: "shl-2026-27", seasonLabel: "2026/27",
    tz: "Europe/Stockholm", displayOrder: 10, clubsFile: "lib/hockey/shl.ts",
  },
  nhl: {
    name: "NHL", leagueId: 4380, season: "2026-2027",
    seasonSlug: "nhl-2026-27", seasonLabel: "2026/27",
    tz: "America/New_York", displayOrder: 11, clubsFile: "lib/hockey/nhl.ts",
    // NHL preseason is round 500; only seed real games (< 400) once ready.
    excludeRoundsAtLeast: 400,
  },
};

const slug = process.argv[2];
const cfg = LEAGUES[slug];
if (!cfg) { console.error(`Unknown league "${slug}". Known: ${Object.keys(LEAGUES).join(", ")}`); process.exit(1); }
const outFile = process.argv[3] || `supabase/seeds/${slug}-${cfg.seasonLabel.replace("/", "-")}.sql`;
const SPORT = "ice_hockey";

let KEY = process.env.THESPORTSDB_API_KEY || "123";
try {
  const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/^THESPORTSDB_API_KEY=(.+)$/m);
  if (m) KEY = m[1].trim();
} catch { /* use env/default */ }

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const esc  = (s) => (s ?? "").replace(/'/g, "''");

const src = fs.readFileSync(cfg.clubsFile, "utf8");
const clubs = [];
const re = /code:\s*"([A-Z0-9]{2,4})",\s*name:\s*"([^"]+)"/g;
let m;
while ((m = re.exec(src))) clubs.push({ code: m[1], name: m[2] });
const name2code = Object.fromEntries(clubs.map((c) => [norm(c.name), c.code]));
const code = (n) => {
  const c = name2code[norm(n)];
  if (!c) throw new Error(`Unmapped feed team "${n}" (norm=${norm(n)}) for ${slug}`);
  return c;
};

const res = await fetch(`https://www.thesportsdb.com/api/v2/json/schedule/league/${cfg.leagueId}/${cfg.season}`, { headers: { "X-API-KEY": KEY } });
if (!res.ok) throw new Error(`V2 schedule HTTP ${res.status}`);
const j = await res.json();
let events = (j.schedule || []).filter((e) => e.strHomeTeam && e.strAwayTeam);
if (cfg.excludeRoundsAtLeast != null) events = events.filter((e) => Number(e.intRound) < cfg.excludeRoundsAtLeast);
if (events.length === 0) throw new Error(`No real fixtures for ${slug} yet — check readiness before seeding.`);
process.stderr.write(`fetched ${events.length} events\n`);

const fixtures = events.map((e) => ({
  idEvent: e.idEvent, date: e.dateEvent, home: code(e.strHomeTeam), away: code(e.strAwayTeam),
  ko: /Z$/.test(e.strTimestamp) ? e.strTimestamp : `${e.strTimestamp}Z`, venue: esc(e.strVenue),
}));
const dates = [...new Set(fixtures.map((f) => f.date))].sort();
const dateToRound = Object.fromEntries(dates.map((d, i) => [d, i + 1]));
for (const f of fixtures) f.round = dateToRound[f.date];
fixtures.sort((a, b) => a.round - b.round || a.ko.localeCompare(b.ko));
const rounds = dates.map((d, i) => ({ n: i + 1 }));
process.stderr.write(`grouped into ${rounds.length} gamedays\n`);

const first = fixtures[0].ko, last = fixtures[fixtures.length - 1].ko;

let sql = `-- AUTO-GENERATED seed — ${cfg.name} ${cfg.season} (${fixtures.length} fixtures / ${rounds.length} gamedays) from TheSportsDB
-- Ice hockey: no draws (OT/SO decides).
insert into public.sports (code, name, has_draw, default_prediction_type, icon)
values ('${SPORT}', 'Ice Hockey', false, 'score', '🏒')
on conflict (code) do nothing;

do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_num integer := 0;
begin
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('${esc(cfg.name)}', '${slug}', '${SPORT}', 'active', '${first}', '${last}')
  on conflict (slug) do update set name = excluded.name, sport_code = excluded.sport_code, status = excluded.status returning id into v_comp;
  if v_comp is null then select id into v_comp from public.competitions where slug='${slug}'; end if;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'regular', 'Gameday', 1, true, false) on conflict (competition_id, code) do nothing;

  insert into public.seasons (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_comp, '${cfg.seasonSlug}', '${cfg.seasonLabel}', 'upcoming', true, '${first}', '${last}')
  on conflict (slug) do nothing;
  select id into v_season from public.seasons where slug='${cfg.seasonSlug}';

  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_comp,'exact',5,1),(v_comp,'gd',3,2),(v_comp,'result',2,3),(v_comp,'wrong',0,4)
  on conflict (competition_id, rule_code) do nothing;

  insert into public.competition_settings (competition_id, key, value) values
    (v_comp,'home_style','"matchweek"'::jsonb),
    (v_comp,'has_knockout','false'::jsonb),
    (v_comp,'has_group_stage','false'::jsonb),
    (v_comp,'has_standings_table','true'::jsonb),
    (v_comp,'has_challenges','false'::jsonb),
    (v_comp,'round_label','"Gameday"'::jsonb),
    (v_comp,'round_label_plural','"Gamedays"'::jsonb),
    (v_comp,'provider','"thesportsdb"'::jsonb),
    (v_comp,'provider_league_id','${cfg.leagueId}'::jsonb),
    (v_comp,'provider_season','"${cfg.season}"'::jsonb),
    (v_comp,'ingest_enabled','true'::jsonb),
    (v_comp,'lifecycle','"public"'::jsonb),
    (v_comp,'visible','true'::jsonb),
    (v_comp,'timezone','"${cfg.tz}"'::jsonb),
    (v_comp,'display_order','${cfg.displayOrder}'::jsonb)
  on conflict (competition_id, key) do update set value = excluded.value;

`;
for (const c of clubs) {
  sql += `  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, '${esc(c.name)}', '${c.code}', null) on conflict (competition_id, code) do update set name = excluded.name;\n`;
}
sql += `
  insert into public.season_teams (season_id, team_id)
    select v_season, id from public.teams where competition_id = v_comp on conflict do nothing;

  delete from public.fixtures where season_id = v_season;
`;
for (const r of rounds) {
  sql += `  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd${r.n}', 'Gameday ${r.n}', 'GD${r.n}', ${r.n}, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd${r.n}';
`;
  for (const f of fixtures.filter((x) => x.round === r.n)) {
    sql += `  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='${f.home}'), (select id from public.teams where competition_id=v_comp and code='${f.away}'), '${f.ko}', '${f.venue}', 'scheduled', '${f.idEvent}');
`;
  }
}
sql += `  raise notice '${cfg.name}: % fixtures / % gamedays', v_num, ${rounds.length};\nend $$;\n`;

fs.writeFileSync(outFile, sql);
console.log(`WROTE ${outFile} — ${cfg.name}: ${fixtures.length} fixtures, ${rounds.length} gamedays, ${clubs.length} clubs`);
console.log(`Apply with: node scripts/run-sql.mjs --file ${outFile}`);
