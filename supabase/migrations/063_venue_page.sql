-- ============================================================
-- 063 — VENUE PAGE + OWNER CONTROL ROOM
--
-- One RPC behind /v/<slug>. Returns the public branded-league page to anyone,
-- and additionally an `owner` block when the caller IS the venue owner.
--
-- Everything here is MEASURED. The /venues sales demo showed "avg visits per
-- member", which nothing in this database can know — it is not reproduced.
-- What a venue actually gets is: who joined, who is playing this matchweek,
-- how many predictions they made, and whether that is holding up week to week.
--
-- SECURITY DEFINER because venues is RLS-locked; the owner gate is an explicit
-- auth.uid() comparison, not a policy, so the public half stays public.
-- ============================================================

create or replace function public.get_venue_page(p_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v          record;
  lg         record;
  comp       record;
  is_owner   boolean;
  cur_round  record;
  out        jsonb;
begin
  select id, slug, name, city, country, language, logo_url, banner_url,
         colour_primary, colour_ink, owner_user_id, website, status
    into v
  from public.venues where slug = p_slug;

  if v.id is null then
    return jsonb_build_object('found', false);
  end if;

  select l.id, l.name, l.invite_code, l.competition_id, l.suspended
    into lg
  from public.prediction_leagues l
  where l.venue_id = v.id
  order by l.created_at
  limit 1;

  if lg.id is null then
    return jsonb_build_object('found', false, 'reason', 'no league');
  end if;

  select c.id, c.name, c.slug into comp
  from public.competitions c where c.id = lg.competition_id;

  is_owner := (auth.uid() is not null and auth.uid() = v.owner_user_id);

  -- Current round = the latest one that has already started.
  select r.id, r.label, r.sort_order, r.starts_at into cur_round
  from public.rounds r
  join public.seasons s on s.id = r.season_id
  where s.competition_id = comp.id
    and r.starts_at <= now()
  order by r.sort_order desc
  limit 1;

  out := jsonb_build_object(
    'found', true,
    'suspended', lg.suspended,
    'is_owner', is_owner,

    'venue', jsonb_build_object(
      'name', v.name, 'slug', v.slug, 'city', v.city, 'country', v.country,
      'language', v.language, 'website', v.website,
      'logo_url', v.logo_url, 'banner_url', v.banner_url,
      'colour_primary', v.colour_primary, 'colour_ink', v.colour_ink
    ),

    'league', jsonb_build_object(
      'id', lg.id, 'name', lg.name, 'invite_code', lg.invite_code,
      'member_count', (select count(*) from public.prediction_league_members
                       where league_id = lg.id)
    ),

    'competition', jsonb_build_object('name', comp.name, 'slug', comp.slug),

    'round', case when cur_round.id is null then null else
      jsonb_build_object('label', cur_round.label, 'sort_order', cur_round.sort_order) end,

    -- Public leaderboard: league members ranked on points won in this
    -- competition. Ties broken by who got there on fewer predictions.
    'leaderboard', (
      select coalesce(jsonb_agg(x order by x.rank), '[]'::jsonb)
      from (
        select
          -- Points and prediction counts are filtered to THIS competition.
          -- The fixtures join is a LEFT join, so a member who has only ever
          -- predicted in another competition still appears here on 0 rather
          -- than vanishing, and their other-competition points are excluded.
          row_number() over (
            order by coalesce(sum(p.points_awarded) filter (where f.id is not null), 0) desc,
                     count(f.id) asc) as rank,
          coalesce(up.display_name, 'Player') as name,
          up.avatar_url,
          coalesce(sum(p.points_awarded) filter (where f.id is not null), 0)::int as points,
          count(f.id)::int                                                        as predictions
        from public.prediction_league_members m
        left join public.user_profiles up on up.id = m.user_id
        left join public.predictions p     on p.user_id = m.user_id
        left join public.fixtures f        on f.id = p.fixture_id
                                          and f.competition_id = comp.id
        where m.league_id = lg.id
        group by m.user_id, up.display_name, up.avatar_url
        order by points desc
        limit 25
      ) x
    ),

    -- Next three fixtures the venue's crowd will be predicting.
    'next_fixtures', (
      select coalesce(jsonb_agg(x order by x.kicks_off_at), '[]'::jsonb)
      from (
        select ht.name as home, at.name as away, f.kicks_off_at
        from public.fixtures f
        join public.teams ht on ht.id = f.home_team_id
        join public.teams at on at.id = f.away_team_id
        where f.competition_id = comp.id
          and f.kicks_off_at > now()
        order by f.kicks_off_at
        limit 3
      ) x
    )
  );

  -- ── Owner-only block ──────────────────────────────────────
  if is_owner then
    out := out || jsonb_build_object('owner', jsonb_build_object(

      'members_total', (select count(*) from public.prediction_league_members
                        where league_id = lg.id),

      'joined_this_week', (select count(*) from public.prediction_league_members
                           where league_id = lg.id
                             and joined_at > now() - interval '7 days'),

      -- Playing this matchweek = predicted at least one fixture in the round.
      'playing_this_round', case when cur_round.id is null then 0 else (
        select count(distinct p.user_id)
        from public.predictions p
        join public.fixtures f on f.id = p.fixture_id
        join public.prediction_league_members m
          on m.user_id = p.user_id and m.league_id = lg.id
        where f.round_id = cur_round.id
      ) end,

      'predictions_this_round', case when cur_round.id is null then 0 else (
        select count(*)
        from public.predictions p
        join public.fixtures f on f.id = p.fixture_id
        join public.prediction_league_members m
          on m.user_id = p.user_id and m.league_id = lg.id
        where f.round_id = cur_round.id
      ) end,

      -- Week-by-week active count over the last 8 started rounds. This is the
      -- number that tells a venue whether the league is holding its crowd.
      'weekly_active', (
        select coalesce(jsonb_agg(w order by w.sort_order), '[]'::jsonb)
        from (
          select r.sort_order, r.short_label as label,
            (select count(distinct p.user_id)
             from public.predictions p
             join public.fixtures f on f.id = p.fixture_id
             join public.prediction_league_members m
               on m.user_id = p.user_id and m.league_id = lg.id
             where f.round_id = r.id)::int as active
          from public.rounds r
          join public.seasons s on s.id = r.season_id
          where s.competition_id = comp.id and r.starts_at <= now()
          order by r.sort_order desc
          limit 8
        ) w
      ),

      'members', (
        select coalesce(jsonb_agg(x order by x.points desc), '[]'::jsonb)
        from (
          select
            coalesce(up.display_name, 'Player') as name,
            m.joined_at,
            coalesce(sum(p.points_awarded) filter (where f.id is not null), 0)::int as points,
            count(f.id)::int as predictions
          from public.prediction_league_members m
          left join public.user_profiles up on up.id = m.user_id
          left join public.predictions p     on p.user_id = m.user_id
          left join public.fixtures f        on f.id = p.fixture_id
                                            and f.competition_id = comp.id
          where m.league_id = lg.id
          group by m.user_id, up.display_name, m.joined_at
          limit 200
        ) x
      )
    ));
  end if;

  return out;
end;
$function$;

grant execute on function public.get_venue_page(text) to anon, authenticated;
