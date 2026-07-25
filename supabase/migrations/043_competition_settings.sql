-- ============================================================
-- MIGRATION 043 — Competition settings
--
-- Competition Engine V2, Phase 1.4.
--
-- ────────────────────────────────────────────────────────────
-- WHY
-- ────────────────────────────────────────────────────────────
-- Approved requirement: "Every competition must be fully configurable
-- through Competition settings rather than hardcoded logic."
--
-- Today the competition-specific logic lives in constants:
--   lib/ingestion.ts:225   const WC2026 = "league=1&season=2026"
--   lib/ingestion.ts:27-33 TOURNAMENT_START_MS / END_MS / isTournamentWindow()
--   app/api/cron/advance-knockout  runs unconditionally
--   ~22 call sites               getCompetition("wc2026") / .eq("slug","wc2026")
--
-- Every one of those becomes a row here.
--
-- ────────────────────────────────────────────────────────────
-- TWO TABLES, ON PURPOSE
-- ────────────────────────────────────────────────────────────
-- `competition_setting_defs` — the KNOWN KEYS: type, default, description,
--   whether it is secret, which group it belongs to in the admin UI.
-- `competition_settings`     — per-competition OVERRIDES only.
--
-- A plain key/value bag would work today and rot immediately: nothing would
-- describe what keys exist, no default would be discoverable, and the
-- "Create Competition" wizard would have to hardcode the very list this
-- table exists to hold. With defs, the wizard RENDERS ITSELF from the
-- database — which is precisely what "add a competition without touching
-- code" requires.
--
-- Resolution is: override → default → null.
--
-- DEPENDS ON: 037
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 1. Known setting definitions ─────────────────────────────

create table if not exists public.competition_setting_defs (
  key           text primary key,
  value_type    text not null check (value_type in ('string','number','boolean','json','array')),
  default_value jsonb,
  label         text not null,
  description   text,
  group_name    text not null default 'general',   -- admin UI grouping
  sort_order    integer not null default 0,
  is_secret     boolean not null default false,    -- never send to the client
  required      boolean not null default false
);

alter table public.competition_setting_defs enable row level security;

drop policy if exists "public read setting defs" on public.competition_setting_defs;
create policy "public read setting defs"
  on public.competition_setting_defs for select using (true);


-- ── 2. Per-competition overrides ─────────────────────────────

create table if not exists public.competition_settings (
  competition_id uuid  not null references public.competitions(id) on delete cascade,
  key            text  not null references public.competition_setting_defs(key) on update cascade,
  value          jsonb not null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null,
  primary key (competition_id, key)
);

create index if not exists competition_settings_comp_idx on public.competition_settings (competition_id);

alter table public.competition_settings enable row level security;

-- Public read EXCLUDING secrets. Provider API keys and similar must never
-- reach the browser, and the anon key is in the client bundle — so this is
-- enforced in the policy, not in the query.
drop policy if exists "public read non-secret settings" on public.competition_settings;
create policy "public read non-secret settings"
  on public.competition_settings for select
  using (
    exists (
      select 1 from public.competition_setting_defs d
      where d.key = competition_settings.key and d.is_secret = false
    )
  );

-- Writes are admin-only, via app_admins (migration 005).
drop policy if exists "admins write settings" on public.competition_settings;
create policy "admins write settings"
  on public.competition_settings for all
  using    (exists (select 1 from public.app_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins where user_id = auth.uid()));


-- ── 3. Seed the known keys ───────────────────────────────────

insert into public.competition_setting_defs
  (key, value_type, default_value, label, description, group_name, sort_order, is_secret, required)
values
  -- ── Provider / ingestion ──
  ('provider',              'string',  '"api-football"'::jsonb, 'Result provider',
   'Which external service supplies fixtures and results.', 'provider', 10, false, true),
  ('provider_league_id',    'number',  'null'::jsonb, 'Provider league ID',
   'The provider''s own id for this competition. API-Football: World Cup = 1, Premier League = 39.',
   'provider', 20, false, true),
  ('provider_season',       'number',  'null'::jsonb, 'Provider season',
   'Season year as the provider labels it. A 2026/27 season is usually 2026.',
   'provider', 30, false, true),
  ('ingest_enabled',        'boolean', 'true'::jsonb, 'Automatic result ingestion',
   'Master switch. False stops all automated result writes for this competition immediately.',
   'provider', 40, false, false),
  ('ingest_poll_minutes',   'number',  '5'::jsonb, 'Poll interval (minutes)',
   'How often to check for results while a match is in progress.', 'provider', 50, false, false),

  -- ── Format ──
  ('has_knockout',          'boolean', 'false'::jsonb, 'Has a knockout bracket',
   'Gates the bracket UI and the advance-knockout cron. MUST be false for league competitions.',
   'format', 10, false, false),
  ('has_group_stage',       'boolean', 'false'::jsonb, 'Has group stages',
   'Multiple parallel standings tables rather than one.', 'format', 20, false, false),
  ('has_standings_table',   'boolean', 'true'::jsonb, 'Show a standings table',
   'Renders GroupStandings. True for leagues and for group tournaments.', 'format', 30, false, false),
  ('has_challenges',        'boolean', 'false'::jsonb, 'Matchday Challenges enabled',
   'Per-round bonus questions that lock at the round''s first kickoff.', 'format', 40, false, false),
  ('has_legacy_bonus',      'boolean', 'false'::jsonb, 'Season-long bonus questions (legacy)',
   'The World Cup''s tournament-wide bonus questions. Not used by new competitions.',
   'format', 50, false, false),
  ('round_label',           'string',  '"Round"'::jsonb, 'Round noun',
   'What one round is called: Matchweek, Gameweek, Round, Race Weekend.', 'format', 60, false, false),
  ('round_label_plural',    'string',  '"Rounds"'::jsonb, 'Round noun (plural)',
   null, 'format', 70, false, false),

  -- ── Leaderboards ──
  ('leaderboard_windows',   'array',   '["round","month","season"]'::jsonb, 'Leaderboard windows',
   'Which time windows are offered. "round" is the approved meaning of "weekly".',
   'leaderboard', 10, false, false),
  ('leaderboard_page_size', 'number',  '100'::jsonb, 'Leaderboard page size',
   null, 'leaderboard', 20, false, false),

  -- ── Economy ──
  ('economy_multiplier',    'number',  '1'::jsonb, 'IQ multiplier',
   'Scales IQ minted per scored prediction in this competition. With several '
   'competitions running at once, 1.0 everywhere multiplies total minting by the '
   'number of competitions — see docs/COMPETITION_ENGINE_V2.md §3.9.',
   'economy', 10, false, false),
  ('economy_enabled',       'boolean', 'true'::jsonb, 'Mint IQ for this competition',
   null, 'economy', 20, false, false),

  -- ── Visibility ──
  ('visible',               'boolean', 'false'::jsonb, 'Visible to users',
   'False renders the competition end-to-end for admins while hiding it from '
   'everyone else. This is the launch flag — no feature-flag system needed.',
   'visibility', 10, false, false),
  ('is_default',            'boolean', 'false'::jsonb, 'Default competition',
   'The competition shown when none is specified in the URL. Exactly one should be true.',
   'visibility', 20, false, false),
  ('display_order',         'number',  '100'::jsonb, 'Display order',
   'Order in the competition switcher. Lower first.', 'visibility', 30, false, false),
  ('timezone',              'string',  '"UTC"'::jsonb, 'Display timezone',
   'Timezone for monthly leaderboard boundaries and matchday emails.',
   'visibility', 40, false, false)
on conflict (key) do update set
  value_type    = excluded.value_type,
  default_value = excluded.default_value,
  label         = excluded.label,
  description   = excluded.description,
  group_name    = excluded.group_name,
  sort_order    = excluded.sort_order,
  is_secret     = excluded.is_secret,
  required      = excluded.required;


-- ── 4. Seed World Cup values ─────────────────────────────────
-- These reproduce today's hardcoded behaviour EXACTLY. Nothing about the
-- World Cup changes; the constants simply move from code into rows.

do $$
declare
  v_comp uuid;
begin
  select id into v_comp from public.competitions where slug = 'wc2026';
  if v_comp is null then
    raise notice '043: wc2026 not found — skipping settings seed.';
    return;
  end if;

  insert into public.competition_settings (competition_id, key, value) values
    (v_comp, 'provider',            '"api-football"'::jsonb),
    (v_comp, 'provider_league_id',  '1'::jsonb),      -- from lib/ingestion.ts:225
    (v_comp, 'provider_season',     '2026'::jsonb),   -- from lib/ingestion.ts:225
    (v_comp, 'ingest_enabled',      'false'::jsonb),  -- tournament complete
    (v_comp, 'has_knockout',        'true'::jsonb),
    (v_comp, 'has_group_stage',     'true'::jsonb),
    (v_comp, 'has_standings_table', 'true'::jsonb),
    (v_comp, 'has_challenges',      'false'::jsonb),  -- WC used season-long bonuses
    (v_comp, 'has_legacy_bonus',    'true'::jsonb),
    (v_comp, 'round_label',         '"Stage"'::jsonb),
    (v_comp, 'round_label_plural',  '"Stages"'::jsonb),
    (v_comp, 'visible',             'true'::jsonb),
    (v_comp, 'is_default',          'true'::jsonb),   -- only competition today
    (v_comp, 'display_order',       '10'::jsonb),
    (v_comp, 'timezone',            '"UTC"'::jsonb)
  on conflict (competition_id, key) do nothing;

  raise notice '043: seeded World Cup settings (ingest_enabled = FALSE — tournament complete).';
end;
$$;


-- ── 5. Resolver ──────────────────────────────────────────────
-- One jsonb object per competition: defaults overlaid with overrides.
-- Secrets excluded — this is safe to call from the browser.

create or replace function public.get_competition_settings(p_competition_id uuid)
returns jsonb
language sql
security definer stable
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(
      d.key,
      coalesce(cs.value, d.default_value)
    ) filter (where d.is_secret = false),
    '{}'::jsonb
  )
  from public.competition_setting_defs d
  left join public.competition_settings cs
         on cs.key = d.key and cs.competition_id = p_competition_id;
$$;

grant execute on function public.get_competition_settings(uuid) to anon, authenticated;

comment on function public.get_competition_settings(uuid) is
  'All non-secret settings for a competition: defaults overlaid with overrides. '
  'Missing competition returns every default rather than an error, so a new '
  'competition works before anything has been configured.';


-- Single typed value, for server code that needs one key.
create or replace function public.get_competition_setting(
  p_competition_id uuid,
  p_key            text
)
returns jsonb
language sql
security definer stable
set search_path = public
as $$
  select coalesce(
    (select cs.value from public.competition_settings cs
      where cs.competition_id = p_competition_id and cs.key = p_key),
    (select d.default_value from public.competition_setting_defs d where d.key = p_key)
  );
$$;

grant execute on function public.get_competition_setting(uuid, text) to anon, authenticated;


-- ── 6. Exactly one default competition ───────────────────────
-- Enforced rather than trusted: two defaults would make "which competition
-- does /predict show?" nondeterministic.

create unique index if not exists competition_settings_one_default_idx
  on public.competition_settings (key)
  where key = 'is_default' and value = 'true'::jsonb;


insert into public.schema_migrations (version, name, notes)
values ('043', 'competition_settings',
        'competition_setting_defs + competition_settings + resolver RPCs. '
        'WC seeded to reproduce current behaviour exactly; ingest_enabled=false.')
on conflict (version) do nothing;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop function if exists public.get_competition_setting(uuid, text);
-- drop function if exists public.get_competition_settings(uuid);
-- drop table if exists public.competition_settings;
-- drop table if exists public.competition_setting_defs;
-- …and restore the constants in lib/ingestion.ts.
-- ============================================================
