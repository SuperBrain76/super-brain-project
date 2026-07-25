-- ============================================================
-- MIGRATION 052 — Competition History (profile)
--
-- One RPC behind the profile's "Competition History" section — the
-- foundation for a future Hall of Fame. Per competition the caller has
-- played: final rank, total points, IQ earned, and best private-league
-- finish.
--
-- Read-only. Reuses existing leaderboard logic; adds no tables.
--
-- DEPENDS ON: 038 (scoped leaderboards), 021 (economy ledger)
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: drop the function.
-- ============================================================

create or replace function public.get_my_competition_history()
returns table (
  competition_id   uuid,
  slug             text,
  name             text,
  lifecycle        text,
  total_points     bigint,
  final_rank       bigint,
  iq_earned        bigint,
  predictions      bigint,
  best_league_name text,
  best_league_rank bigint,
  best_league_size bigint
)
language plpgsql
security definer stable
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;

  return query
  with my_comps as (
    -- Every competition the user has predicted in.
    select distinct f.competition_id as cid
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where p.user_id = v_user
  ),
  points as (
    select f.competition_id as cid,
           coalesce(sum(p.points_awarded), 0) as pts,
           count(p.id) as preds
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where p.user_id = v_user
    group by f.competition_id
  ),
  ranks as (
    -- The user's rank = how many players scored strictly more in that comp.
    select mc.cid,
      (select count(*) + 1
         from (
           select p2.user_id, coalesce(sum(p2.points_awarded), 0) as tot
           from public.predictions p2
           join public.fixtures f2 on f2.id = p2.fixture_id
           where f2.competition_id = mc.cid and p2.points_awarded is not null
           group by p2.user_id
         ) allp
        where allp.tot > (select pts from points where points.cid = mc.cid)
      ) as rnk
    from my_comps mc
  ),
  iq as (
    -- IQ earned from predictions in this competition (per-fixture meta).
    select (l.meta ->> 'competition_id')::uuid as cid,
           sum(l.delta) as iq
    from public.economy_ledger l
    where l.user_id = v_user
      and l.event_code = 'prediction_score'
      and l.meta ? 'competition_id'
    group by (l.meta ->> 'competition_id')::uuid
  ),
  my_leagues as (
    select league_id from public.prediction_league_members where user_id = v_user
  ),
  league_standings as (
    -- Every member's point total in every league the user belongs to.
    select l.competition_id as cid, l.id as lid, l.name as lname,
           m.user_id as uid,
           coalesce(sum(p.points_awarded), 0) as pts
    from public.prediction_league_members m
    join public.prediction_leagues l on l.id = m.league_id
    left join public.predictions p on p.user_id = m.user_id
    left join public.fixtures f
           on f.id = p.fixture_id
          and f.competition_id = l.competition_id
          and p.points_awarded is not null
    where l.id in (select league_id from my_leagues)
    group by l.competition_id, l.id, l.name, m.user_id
  ),
  best_league as (
    select distinct on (cid) cid, lname, rnk, sz
    from (
      select ls.cid, ls.lid, ls.lname,
             (select count(*) + 1 from league_standings x
               where x.lid = ls.lid and x.pts > ls.pts) as rnk,
             (select count(*) from public.prediction_league_members mm
               where mm.league_id = ls.lid) as sz
      from league_standings ls
      where ls.uid = v_user
    ) r
    order by cid, rnk asc
  )
  select
    c.id, c.slug, c.name,
    public.competition_lifecycle(c.id),
    coalesce(pt.pts, 0),
    coalesce(rk.rnk, 0),
    coalesce(iq.iq, 0),
    coalesce(pt.preds, 0),
    bl.lname,
    bl.lrank,
    bl.lsize
  from my_comps mc
  join public.competitions c on c.id = mc.cid
  left join points pt on pt.cid = mc.cid
  left join ranks  rk on rk.cid = mc.cid
  left join iq        on iq.cid = mc.cid
  left join best_league bl on bl.cid = mc.cid
  order by c.created_at desc;
end;
$$;

grant execute on function public.get_my_competition_history() to authenticated;

insert into public.schema_migrations (version, name, notes)
values ('052', 'competition_history',
        'get_my_competition_history() — per-competition rank/points/IQ/best league '
        'for the profile Competition History section.')
on conflict (version) do nothing;

-- ROLLBACK: drop function if exists public.get_my_competition_history();
