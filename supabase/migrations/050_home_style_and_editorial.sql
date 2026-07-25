-- ============================================================
-- MIGRATION 050 — home_style setting + round editorial
--
-- Premier League experience, Phase 3a.
--
--   1. A `home_style` competition setting so a competition can choose the
--      living matchweek dashboard (PL) vs the classic hub (World Cup).
--      Defaults to 'classic' — the World Cup is untouched.
--   2. A `round_editorial` table for the admin-curated "star players to
--      watch" and biggest-match headline (docs/PREMIER_LEAGUE_UX.md §7).
--      We have no player feed; a text box writes better copy than a feed
--      would, and it ships now instead of after a data project.
--
-- DEPENDS ON: 042 (rounds), 043 (settings)
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 1. home_style setting ────────────────────────────────────

insert into public.competition_setting_defs
  (key, value_type, default_value, label, description, group_name, sort_order, is_secret, required)
values
  ('home_style', 'string', '"classic"'::jsonb, 'Home screen style',
   'classic = fixture-list hub (World Cup). matchweek = the living '
   'Competition Home dashboard that changes state through the week (Premier League).',
   'format', 5, false, false)
on conflict (key) do update set
  default_value = excluded.default_value,
  label         = excluded.label,
  description   = excluded.description,
  group_name    = excluded.group_name,
  sort_order    = excluded.sort_order;

-- The World Cup stays 'classic' by default — assert it, don't assume it.
do $$
declare v_comp uuid;
begin
  select id into v_comp from public.competitions where slug = 'wc2026';
  if v_comp is not null then
    insert into public.competition_settings (competition_id, key, value)
    values (v_comp, 'home_style', '"classic"'::jsonb)
    on conflict (competition_id, key) do nothing;
    raise notice '050: wc2026 home_style pinned to classic (unchanged).';
  end if;
end;
$$;


-- ── 2. round_editorial ───────────────────────────────────────
-- One optional row per round. Admin-written on the Thursday before a
-- matchweek. Everything nullable — a round with no editorial simply shows
-- none, and the dashboard hides the block.

create table if not exists public.round_editorial (
  round_id   uuid primary key references public.rounds(id) on delete cascade,
  headline   text,                       -- "Title race heats up at the Emirates"
  body       text,                        -- optional longer preview
  players    jsonb not null default '[]'::jsonb,  -- ["Saka","Haaland","Palmer"]
  -- Optional explicit biggest-match override; otherwise the app derives it.
  biggest_fixture_id uuid references public.fixtures(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.round_editorial enable row level security;

drop policy if exists "public read round editorial" on public.round_editorial;
create policy "public read round editorial"
  on public.round_editorial for select using (true);

drop policy if exists "admins write round editorial" on public.round_editorial;
create policy "admins write round editorial"
  on public.round_editorial for all
  using    (exists (select 1 from public.app_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins where user_id = auth.uid()));

comment on table public.round_editorial is
  'Admin-curated preview per round: headline, star players, optional biggest-'
  'match override. Written Thursday. No player feed required — see '
  'docs/PREMIER_LEAGUE_UX.md §7.';


insert into public.schema_migrations (version, name, notes)
values ('050', 'home_style_and_editorial',
        'home_style setting (default classic) + round_editorial table. '
        'World Cup pinned to classic.')
on conflict (version) do nothing;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop table if exists public.round_editorial;
-- delete from public.competition_setting_defs where key = 'home_style';
-- delete from public.competition_settings     where key = 'home_style';
-- ============================================================
