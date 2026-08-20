-- 070_venue_dashboard.sql
-- The venue owner's control-center dashboard, in one call.
--
-- Resolves the owner's venue by owner_user_id = auth.uid() (no id in the URL)
-- and returns live, MEASURED activity across ALL of the venue's competitions:
-- players, predictions today, active players today, new sign-ups today, the
-- list of active competitions, and today's fixtures. Nothing here is invented
-- — in keeping with get_venue_page, metrics this database cannot know (QR scans
-- per day, return visits) are deliberately absent: qr_scanned is only logged on
-- the first-ever scan, so a daily scan count would be a lie.
--
-- The owner is excluded from player/activity counts (they auto-join their own
-- league at provisioning), matching migration 067.
--
-- Additive; SECURITY DEFINER because venues + league tables are RLS-locked.

create or replace function public.get_venue_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v            record;
  v_uid        uuid := auth.uid();
  v_owner      uuid;
  comp_ids     uuid[];
  day_start    timestamptz := date_trunc('day', now());
  day_end      timestamptz := date_trunc('day', now()) + interval '1 day';
  players      int;
  new_today    int;
  preds_today  int;
  active_today int;
  j_comps      jsonb;
  j_today      jsonb;
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;

  select id, slug, name, logo_url, colour_primary, colour_ink, status, owner_user_id, onboarded_at
    into v
  from public.venues
  where owner_user_id = v_uid
  order by created_at
  limit 1;

  if v.id is null then return jsonb_build_object('found', false); end if;
  v_owner := v.owner_user_id;

  -- The competitions this venue actually runs (one league per competition).
  select coalesce(array_agg(distinct l.competition_id), '{}')
    into comp_ids
  from public.prediction_leagues l
  where l.venue_id = v.id and coalesce(l.suspended, false) = false;

  -- Distinct players across every venue league (owner excluded).
  select count(distinct m.user_id)
    into players
  from public.prediction_league_members m
  join public.prediction_leagues l on l.id = m.league_id
  where l.venue_id = v.id and m.user_id <> v_owner;

  -- New sign-ups today: members whose FIRST join to any venue league is today.
  select count(*)
    into new_today
  from (
    select m.user_id
    from public.prediction_league_members m
    join public.prediction_leagues l on l.id = m.league_id
    where l.venue_id = v.id and m.user_id <> v_owner
    group by m.user_id
    having min(m.joined_at) >= day_start and min(m.joined_at) < day_end
  ) t;

  -- Today's predictions by venue players on the venue's competitions.
  select count(*), count(distinct p.user_id)
    into preds_today, active_today
  from public.predictions p
  join public.fixtures f on f.id = p.fixture_id and f.competition_id = any(comp_ids)
  where p.submitted_at >= day_start and p.submitted_at < day_end
    and p.user_id <> v_owner
    and exists (
      select 1 from public.prediction_league_members m
      join public.prediction_leagues l on l.id = m.league_id
      where l.venue_id = v.id and m.user_id = p.user_id
    );

  -- Active competitions.
  select coalesce(jsonb_agg(to_jsonb(x) order by x.name), '[]'::jsonb)
    into j_comps
  from (
    select distinct c.name, c.slug
    from public.prediction_leagues l
    join public.competitions c on c.id = l.competition_id
    where l.venue_id = v.id and coalesce(l.suspended, false) = false
  ) x;

  -- Today's fixtures across those competitions.
  select coalesce(jsonb_agg(to_jsonb(x) order by x.kicks_off_at), '[]'::jsonb)
    into j_today
  from (
    select ht.name as home, ht.flag_emoji as home_flag,
           at.name as away, at.flag_emoji as away_flag,
           c.name as competition, f.kicks_off_at,
           (now() >= f.kicks_off_at) as started,
           (f.home_score is not null and f.away_score is not null) as completed,
           f.home_score, f.away_score
    from public.fixtures f
    join public.competitions c on c.id = f.competition_id
    join public.teams ht on ht.id = f.home_team_id
    join public.teams at on at.id = f.away_team_id
    where f.competition_id = any(comp_ids)
      and f.kicks_off_at >= day_start and f.kicks_off_at < day_end
    order by f.kicks_off_at
    limit 12
  ) x;

  return jsonb_build_object(
    'found', true,
    'venue', jsonb_build_object(
      'id', v.id, 'slug', v.slug, 'name', v.name, 'logo_url', v.logo_url,
      'primary', v.colour_primary, 'ink', v.colour_ink,
      'status', v.status, 'onboarded', v.onboarded_at is not null
    ),
    'stats', jsonb_build_object(
      'players', coalesce(players, 0),
      'new_today', coalesce(new_today, 0),
      'predictions_today', coalesce(preds_today, 0),
      'active_today', coalesce(active_today, 0)
    ),
    'competitions', j_comps,
    'today_fixtures', j_today
  );
end;
$$;
grant execute on function public.get_venue_dashboard() to authenticated;
