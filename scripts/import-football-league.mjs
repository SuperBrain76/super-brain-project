// import-football-league.mjs — generate a full seed for a football league from
// TheSportsDB (V2, premium). The football sibling of import-hockey-league.mjs:
// football feeds carry a real intRound, so MATCHWEEKS come straight from the
// feed instead of being derived from dates. Emits an idempotent seed: sports
// row + competition (sport_code football) + season + stage + scoring +
// settings + teams + matchweeks + fixtures.
//
// Mid-season safe. Sweden plays a spring-autumn calendar, so Allsvenskan is
// imported with matches already played: finished events are seeded WITH their
// result and status 'completed', which is what makes the standings table real
// from the first page load.
//
// Re-running is safe on a live league: fixtures are matched on
// provider_fixture_id and UPDATED in place (never deleted and re-inserted), so
// existing user predictions keep pointing at the same rows.
//
// Usage: node scripts/import-football-league.mjs <slug>            # writes supabase/seeds/<slug>-<season>.sql
//        node scripts/import-football-league.mjs <slug> <outFile>
// Then apply:  node scripts/run-sql.mjs --file <outFile>
import fs from "node:fs";

const LEAGUES = {
  allsvenskan: {
    name: "Allsvenskan", leagueId: 4347, season: "2026",
    seasonSlug: "allsvenskan-2026", seasonLabel: "2026",
    tz: "Europe/Stockholm", displayOrder: 15, clubsFile: "lib/leagues/allsvenskan.ts",
  },
};

const slug = process.argv[2];
const cfg = LEAGUES[slug];
if (!cfg) { console.error(`Unknown league "${slug}". Known: ${Object.keys(LEAGUES).join(", ")}`); process.exit(1); }
const outFile = process.argv[3] || `supabase/seeds/${slug}-${cfg.seasonLabel.replace("/", "-")}.sql`;
const SPORT = "football";

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
const re = /code:\s*"([A-Z0-9]{2,4})",\s*name:\s*"([^"]+)"[\s\S]*?stadium:\s*"([^"]+)"/g;
let m;
while ((m = re.exec(src))) clubs.push({ code: m[1], name: m[2], stadium: m[3] });
const name2code = Object.fromEntries(clubs.map((c) => [norm(c.name), c.code]));
// The feed leaves some venues blank (Västerås, 2026). Our own club registry is
// the fallback so a fixture card never renders an empty ground.
const homeGround = Object.fromEntries(clubs.map((c) => [c.code, c.stadium]));
const code = (n) => {
  const c = name2code[norm(n)];
  if (!c) throw new Error(`Unmapped feed team "${n}" (norm=${norm(n)}) for ${slug}`);
  return c;
};

const res = await fetch(`https://www.thesportsdb.com/api/v2/json/schedule/league/${cfg.leagueId}/${cfg.season}`, { headers: { "X-API-KEY": KEY } });
if (!res.ok) throw new Error(`V2 schedule HTTP ${res.status}`);
const j = await res.json();
const events = (j.schedule || []).filter((e) => e.strHomeTeam && e.strAwayTeam && Number(e.intRound) > 0);
if (events.length === 0) throw new Error(`No fixtures for ${slug} yet — check the feed before seeding.`);
process.stderr.write(`fetched ${events.length} events\n`);

// A result only counts when BOTH scores are present — a finished match with a
// missing score is left scheduled rather than seeded as a fabricated 0-0.
const score = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const fixtures = events.map((e) => {
  const hs = score(e.intHomeScore), as = score(e.intAwayScore);
  const played = hs !== null && as !== null;
  return {
    idEvent: e.idEvent, round: Number(e.intRound),
    home: code(e.strHomeTeam), away: code(e.strAwayTeam),
    ko: /Z$/.test(e.strTimestamp) ? e.strTimestamp : `${e.strTimestamp}Z`,
    venue: esc(e.strVenue?.trim() || homeGround[code(e.strHomeTeam)] || ""),
    hs: played ? hs : null, as: played ? as : null,
    status: played ? "completed" : "scheduled",
  };
});
fixtures.sort((a, b) => a.round - b.round || a.ko.localeCompare(b.ko));

const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b).map((n) => {
  const inRound = fixtures.filter((f) => f.round === n);
  // A matchweek is complete once every one of its fixtures has a result.
  return { n, status: inRound.every((f) => f.status === "completed") ? "completed" : "upcoming" };
});
const playedCount = fixtures.filter((f) => f.status === "completed").length;
process.stderr.write(`${rounds.length} matchweeks — ${playedCount} played, ${fixtures.length - playedCount} to come\n`);

const kos = fixtures.map((f) => f.ko).sort();
const first = kos[0], last = kos[kos.length - 1];

let sql = `-- AUTO-GENERATED seed — ${cfg.name} ${cfg.season} (${fixtures.length} fixtures / ${rounds.length} matchweeks, ${playedCount} already played) from TheSportsDB
-- Fixtures are matched on provider_fixture_id and updated in place, so re-running
-- this seed never deletes a fixture a user has already predicted.
insert into public.sports (code, name, has_draw, default_prediction_type, icon)
values ('${SPORT}', 'Football', true, 'score', '⚽')
on conflict (code) do nothing;

do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_num integer := 0; v_fix uuid;
begin
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('${esc(cfg.name)}', '${slug}', '${SPORT}', 'active', '${first}', '${last}')
  on conflict (slug) do update set name = excluded.name, sport_code = excluded.sport_code, status = excluded.status returning id into v_comp;
  if v_comp is null then select id into v_comp from public.competitions where slug='${slug}'; end if;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'league', 'Matchweek', 1, true, false) on conflict (competition_id, code) do nothing;

  insert into public.seasons (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_comp, '${cfg.seasonSlug}', '${cfg.seasonLabel}', 'active', true, '${first}', '${last}')
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
    (v_comp,'round_label','"Matchweek"'::jsonb),
    (v_comp,'round_label_plural','"Matchweeks"'::jsonb),
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
`;
const val = (v) => (v === null ? "null" : String(v));
for (const r of rounds) {
  sql += `
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw${r.n}', 'Matchweek ${r.n}', 'MW${r.n}', ${r.n}, 'matchweek', '${r.status}')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw${r.n}';
`;
  for (const f of fixtures.filter((x) => x.round === r.n)) {
    sql += `  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '${f.idEvent}';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='${f.home}'), (select id from public.teams where competition_id=v_comp and code='${f.away}'), '${f.ko}', '${f.venue}', '${f.status}', ${val(f.hs)}, ${val(f.as)}, '${f.idEvent}');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '${f.ko}', venue = '${f.venue}',
      status = '${f.status}', home_score = coalesce(${val(f.hs)}, home_score), away_score = coalesce(${val(f.as)}, away_score)
    where id = v_fix;
  end if;
`;
  }
}
sql += `  raise notice '${cfg.name}: % fixtures / % matchweeks', v_num, ${rounds.length};\nend $$;\n`;

fs.writeFileSync(outFile, sql);
console.log(`WROTE ${outFile} — ${cfg.name}: ${fixtures.length} fixtures (${playedCount} played), ${rounds.length} matchweeks, ${clubs.length} clubs`);
console.log(`Apply with: node scripts/run-sql.mjs --file ${outFile}`);
