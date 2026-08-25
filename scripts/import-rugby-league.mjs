// import-rugby-league.mjs — generate a full seed for a rugby-union league from
// TheSportsDB (V2, premium). Rugby feeds carry REAL round numbers (unlike
// hockey's gamedays), so rounds come straight from intRound. Emits an
// idempotent seed: competition (sport_code rugby) + season + stage + scoring +
// settings + teams + rounds + fixtures.
//
// The sports row for rugby already exists (migration 045); migration 072 gives
// it max_score 100. Seeds land with lifecycle "draft" / visible false — verify
// with scripts/check-league-readiness.mjs, then flip lifecycle/visible.
//
// Usage: node scripts/import-rugby-league.mjs <slug>            # writes supabase/seeds/<slug>-<season>.sql
//        node scripts/import-rugby-league.mjs <slug> <outFile>
// Then apply:  node scripts/run-sql.mjs --file <outFile>
import fs from "node:fs";

const LEAGUES = {
  "premiership-rugby": {
    name: "Premiership Rugby", leagueId: 4414, season: "2026-2027",
    seasonSlug: "premiership-rugby-2026-27", seasonLabel: "2026/27",
    tz: "Europe/London", displayOrder: 12, clubsFile: "lib/rugby/prem.ts",
  },
  // Six Nations 2027 goes here when its schedule lands (league 4714) —
  // check with scripts/check-league-readiness.mjs first.
};

const slug = process.argv[2];
const cfg = LEAGUES[slug];
if (!cfg) { console.error(`Unknown league "${slug}". Known: ${Object.keys(LEAGUES).join(", ")}`); process.exit(1); }
const outFile = process.argv[3] || `supabase/seeds/${slug}-${cfg.seasonLabel.replace("/", "-")}.sql`;
const SPORT = "rugby";

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
const events = (j.schedule || []).filter((e) => e.strHomeTeam && e.strAwayTeam && Number(e.intRound) >= 1 && Number(e.intRound) < 400);
if (events.length === 0) throw new Error(`No real fixtures for ${slug} yet — check readiness before seeding.`);
process.stderr.write(`fetched ${events.length} events\n`);

const fixtures = events.map((e) => ({
  idEvent: e.idEvent, round: Number(e.intRound), home: code(e.strHomeTeam), away: code(e.strAwayTeam),
  ko: /Z$/.test(e.strTimestamp) ? e.strTimestamp : `${e.strTimestamp}Z`, venue: esc(e.strVenue),
}));
fixtures.sort((a, b) => a.round - b.round || a.ko.localeCompare(b.ko));
const roundNums = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
process.stderr.write(`${roundNums.length} rounds\n`);

const first = fixtures[0].ko;
const last = fixtures.map((f) => f.ko).sort().at(-1);

let sql = `-- AUTO-GENERATED seed — ${cfg.name} ${cfg.season} (${fixtures.length} fixtures / ${roundNums.length} rounds) from TheSportsDB
-- Rugby union: draws are rare (~1-2%) but real, so has_draw stays true (045).
-- Lands as lifecycle "draft" / visible false — verify, then flip to public.
update public.sports set max_score = 100 where code = '${SPORT}' and max_score < 100;

do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_num integer := 0;
begin
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('${esc(cfg.name)}', '${slug}', '${SPORT}', 'active', '${first}', '${last}')
  on conflict (slug) do update set name = excluded.name, sport_code = excluded.sport_code, status = excluded.status returning id into v_comp;
  if v_comp is null then select id into v_comp from public.competitions where slug='${slug}'; end if;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'regular', 'Round', 1, true, false) on conflict (competition_id, code) do nothing;

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
    (v_comp,'round_label','"Round"'::jsonb),
    (v_comp,'round_label_plural','"Rounds"'::jsonb),
    (v_comp,'provider','"thesportsdb"'::jsonb),
    (v_comp,'provider_league_id','${cfg.leagueId}'::jsonb),
    (v_comp,'provider_season','"${cfg.season}"'::jsonb),
    (v_comp,'ingest_enabled','true'::jsonb),
    (v_comp,'lifecycle','"draft"'::jsonb),
    (v_comp,'visible','false'::jsonb),
    (v_comp,'timezone','"${cfg.tz}"'::jsonb),
    (v_comp,'display_order','${cfg.displayOrder}'::jsonb)
  on conflict (competition_id, key) do nothing;

`;
for (const c of clubs) {
  sql += `  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, '${esc(c.name)}', '${c.code}', null) on conflict (competition_id, code) do update set name = excluded.name;\n`;
}
sql += `
  insert into public.season_teams (season_id, team_id)
    select v_season, id from public.teams where competition_id = v_comp on conflict do nothing;

  delete from public.fixtures where season_id = v_season;
`;
for (const n of roundNums) {
  sql += `  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r${n}', 'Round ${n}', 'R${n}', ${n}, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r${n}';
`;
  for (const f of fixtures.filter((x) => x.round === n)) {
    sql += `  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='${f.home}'), (select id from public.teams where competition_id=v_comp and code='${f.away}'), '${f.ko}', '${f.venue}', 'scheduled', '${f.idEvent}');
`;
  }
}
sql += `  raise notice '${cfg.name}: % fixtures / % rounds', v_num, ${roundNums.length};\nend $$;\n`;

fs.writeFileSync(outFile, sql);
console.log(`WROTE ${outFile} — ${cfg.name}: ${fixtures.length} fixtures, ${roundNums.length} rounds, ${clubs.length} clubs`);
console.log(`Apply with: node scripts/run-sql.mjs --file ${outFile}`);
