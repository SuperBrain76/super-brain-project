// import-f1-season.mjs — generate a full seed for a Formula 1 season from
// Jolpica (the Ergast successor; free, no key). F1 is the first ORDERING
// sport: every Grand Prix weekend becomes ONE round holding TWO fixtures —
// Qualifying (predict grid top 5) and Race (predict finish top 5) — each
// with prediction_type 'ordering', NULL team columns and a constructed
// provider_fixture_id "f1-<season>-<round>-<q|r>" that lib/jolpica.ts parses
// back at ingest time. Entrant "teams" are the drivers from
// lib/f1/drivers2026.ts, with the constructor carried in group_name.
//
// Requires migration 073 to be applied BEFORE any prediction is written;
// the seed itself only needs 045 (prediction_type / sport rows).
// Lands as lifecycle "draft" / visible false — verify, then flip to public.
// check-league-readiness.mjs is TheSportsDB-specific and does not apply.
//
// Usage: node scripts/import-f1-season.mjs [fromRound]     # default 13 (first unraced)
//        node scripts/import-f1-season.mjs 13 <outFile>
// Then apply:  node scripts/run-sql.mjs --file <outFile>
import fs from "node:fs";

const SEASON = "2026";
const SLUG = "formula-1";
const NAME = "Formula 1";
const SPORT = "motorsport";
const SEASON_SLUG = `f1-${SEASON}`;
const SEASON_LABEL = SEASON;
const TZ = "Europe/London";
const DISPLAY_ORDER = 13;

const fromRound = Number(process.argv[2] || 13);
const outFile = process.argv[3] || `supabase/seeds/${SLUG}-${SEASON}.sql`;

const esc = (s) => (s ?? "").replace(/'/g, "''");

// Drivers from the registry — regex parse like import-rugby-league.mjs does
// for clubs, so the seed and the UI can never disagree on the grid.
const src = fs.readFileSync("lib/f1/drivers2026.ts", "utf8");
const drivers = [];
const re = /code:\s*"([A-Z0-9]{2,4})",\s*name:\s*"([^"]+)"[^}]*constructorName:\s*"([^"]+)"/g;
let m;
while ((m = re.exec(src))) drivers.push({ code: m[1], name: m[2], constructor: m[3] });
if (drivers.length < 20) throw new Error(`Parsed only ${drivers.length} drivers from lib/f1/drivers2026.ts`);
process.stderr.write(`${drivers.length} drivers\n`);

const res = await fetch(`https://api.jolpi.ca/ergast/f1/${SEASON}.json?limit=30`, {
  headers: { "User-Agent": "SuperBrain/1.0 (+https://superbrain.social)" },
});
if (!res.ok) throw new Error(`Jolpica HTTP ${res.status}`);
const races = (await res.json())?.MRData?.RaceTable?.Races ?? [];
const gps = races
  .filter((r) => Number(r.round) >= fromRound)
  .map((r) => {
    const quali = r.Qualifying;
    if (!quali?.date) throw new Error(`Round ${r.round} (${r.raceName}) has no qualifying time — refusing to guess.`);
    return {
      round:   Number(r.round),
      name:    r.raceName,                       // "Italian Grand Prix"
      circuit: r.Circuit?.circuitName ?? "",
      qualiKo: `${quali.date}T${quali.time || "12:00:00Z"}`,
      raceKo:  `${r.date}T${r.time || "13:00:00Z"}`,
    };
  })
  .sort((a, b) => a.round - b.round);
if (gps.length === 0) throw new Error(`No rounds >= ${fromRound} in the ${SEASON} schedule.`);
process.stderr.write(`${gps.length} Grands Prix (R${gps[0].round}–R${gps.at(-1).round})\n`);

const first = gps[0].qualiKo;
const last = gps.at(-1).raceKo;

let sql = `-- AUTO-GENERATED seed — ${NAME} ${SEASON}, rounds ${gps[0].round}-${gps.at(-1).round} (${gps.length * 2} fixtures / ${gps.length} GP rounds) from Jolpica
-- Ordering sport: 2 fixtures per GP (qualifying + race), NULL team columns,
-- prediction_type 'ordering', provider ids f1-${SEASON}-<round>-<q|r>.
-- Requires migration 073 before predictions open. Lands draft/hidden.

do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_num integer := 0;
begin
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('${NAME}', '${SLUG}', '${SPORT}', 'active', '${first}', '${last}')
  on conflict (slug) do update set name = excluded.name, sport_code = excluded.sport_code, status = excluded.status returning id into v_comp;
  if v_comp is null then select id into v_comp from public.competitions where slug='${SLUG}'; end if;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'regular', 'Grand Prix', 1, true, false) on conflict (competition_id, code) do nothing;

  insert into public.seasons (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_comp, '${SEASON_SLUG}', '${SEASON_LABEL}', 'upcoming', true, '${first}', '${last}')
  on conflict (slug) do nothing;
  select id into v_season from public.seasons where slug='${SEASON_SLUG}';

  -- Standard values on purpose: apply_ordering_scoring maps hit counts onto
  -- these same rows (5 hits->exact, 3-4->gd, 1-2->result), which keeps the
  -- IQ amount_map keys aligned — the economy needs no F1 configuration.
  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_comp,'exact',5,1),(v_comp,'gd',3,2),(v_comp,'result',2,3),(v_comp,'wrong',0,4)
  on conflict (competition_id, rule_code) do nothing;

  insert into public.competition_settings (competition_id, key, value) values
    (v_comp,'home_style','"matchweek"'::jsonb),
    (v_comp,'has_knockout','false'::jsonb),
    (v_comp,'has_group_stage','false'::jsonb),
    (v_comp,'has_standings_table','true'::jsonb),
    (v_comp,'has_challenges','false'::jsonb),
    (v_comp,'round_label','"Grand Prix"'::jsonb),
    (v_comp,'round_label_plural','"Grands Prix"'::jsonb),
    (v_comp,'provider','"jolpica"'::jsonb),
    (v_comp,'provider_league_id','${SEASON}'::jsonb),
    (v_comp,'provider_season','"${SEASON}"'::jsonb),
    (v_comp,'ingest_enabled','true'::jsonb),
    (v_comp,'lifecycle','"draft"'::jsonb),
    (v_comp,'visible','false'::jsonb),
    (v_comp,'timezone','"${TZ}"'::jsonb),
    (v_comp,'display_order','${DISPLAY_ORDER}'::jsonb)
  on conflict (competition_id, key) do nothing;

`;
for (const d of drivers) {
  sql += `  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, '${esc(d.name)}', '${d.code}', '${esc(d.constructor)}') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;\n`;
}
sql += `
  insert into public.season_teams (season_id, team_id)
    select v_season, id from public.teams where competition_id = v_comp on conflict do nothing;

  -- 🔴 RE-SEED GUARD (pre-production audit, 26 Aug 2026): deleting fixtures
  -- CASCADES to predictions. Re-running this seed after anyone has predicted
  -- would silently wipe their entries. Schedule changes on a live season are
  -- made with targeted UPDATEs (see docs/F1_LAUNCH_RUNBOOK.md), never by
  -- re-seeding.
  if exists (
    select 1 from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where f.season_id = v_season
  ) then
    raise exception 'REFUSING to re-seed: predictions exist for this season. Use targeted UPDATEs for schedule changes (docs/F1_LAUNCH_RUNBOOK.md).';
  end if;

  delete from public.fixtures where season_id = v_season;
`;
for (const gp of gps) {
  sql += `  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r${gp.round}', '${esc(gp.name)}', 'R${gp.round}', ${gp.round}, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r${gp.round}';
`;
  for (const [session, ko, label] of [["q", gp.qualiKo, "Qualifying"], ["r", gp.raceKo, "Race"]]) {
    sql += `  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '${ko}', '${esc(`${gp.circuit} — ${label}`)}', 'scheduled', 'f1-${SEASON}-${gp.round}-${session}');
`;
  }
}
sql += `  raise notice '${NAME}: % fixtures / % GP rounds', v_num, ${gps.length};\nend $$;\n`;

fs.writeFileSync(outFile, sql);
console.log(`WROTE ${outFile} — ${NAME} ${SEASON}: ${gps.length * 2} fixtures across ${gps.length} Grands Prix, ${drivers.length} drivers`);
console.log(`Apply with: node scripts/run-sql.mjs --file ${outFile}   (AFTER migration 073)`);
