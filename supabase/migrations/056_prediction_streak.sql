-- ============================================================
-- 056 — Prediction streak (participation)
--
-- Per-round flag of whether the caller predicted that matchweek, ordered by
-- matchweek. The app turns this into a "🔥 N-matchweek streak" — a cheap,
-- powerful retention hook (miss a week and it resets). Read-only, own rows
-- only, so it's safe.
-- ============================================================

create or replace function public.get_my_round_participation(p_competition_id uuid)
returns table(sort_order integer, predicted boolean)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    r.sort_order,
    exists (
      select 1
      from public.predictions p
      join public.fixtures f on f.id = p.fixture_id
      where f.round_id = r.id
        and p.user_id = auth.uid()
    ) as predicted
  from public.rounds r
  join public.seasons s on s.id = r.season_id
  where s.competition_id = p_competition_id
  order by r.sort_order;
$function$;

grant execute on function public.get_my_round_participation(uuid) to authenticated;
