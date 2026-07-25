-- ============================================================
-- MIGRATION 054 — Community stats (the crowd)
--
-- Emotion pass, not engine work. Two READ-ONLY aggregate RPCs that let the
-- prediction sheet feel populated and alive:
--
--   get_round_prediction_stats(round)  — per fixture: how the crowd is calling
--                                        it (home/draw/away %) + total.
--   get_competition_predictor_count(c) — how many people are playing.
--
-- Both return ONLY aggregates — never an individual prediction — so they are
-- safe to expose to anon/authenticated even though predictions are private.
--
-- DEPENDS ON: predictor schema, 042 (rounds)
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: drop the two functions.
-- ============================================================

create or replace function public.get_round_prediction_stats(p_round_id uuid)
returns table (
  fixture_id uuid,
  total      bigint,
  home_pct   int,
  draw_pct   int,
  away_pct   int
)
language sql
security definer stable
set search_path = public
as $$
  select
    f.id,
    count(p.id) as total,
    coalesce(round(100.0 * count(*) filter (where p.home_score > p.away_score) / nullif(count(p.id), 0)), 0)::int,
    coalesce(round(100.0 * count(*) filter (where p.home_score = p.away_score) / nullif(count(p.id), 0)), 0)::int,
    coalesce(round(100.0 * count(*) filter (where p.home_score < p.away_score) / nullif(count(p.id), 0)), 0)::int
  from public.fixtures f
  left join public.predictions p on p.fixture_id = f.id
  where f.round_id = p_round_id
  group by f.id;
$$;

grant execute on function public.get_round_prediction_stats(uuid) to anon, authenticated;

create or replace function public.get_competition_predictor_count(p_competition_id uuid)
returns bigint
language sql
security definer stable
set search_path = public
as $$
  select count(distinct p.user_id)
  from public.predictions p
  join public.fixtures f on f.id = p.fixture_id
  where f.competition_id = p_competition_id;
$$;

grant execute on function public.get_competition_predictor_count(uuid) to anon, authenticated;

insert into public.schema_migrations (version, name, notes)
values ('054', 'community_stats',
        'get_round_prediction_stats + get_competition_predictor_count — safe '
        'aggregate RPCs for the crowd bar and player counts.')
on conflict (version) do nothing;
