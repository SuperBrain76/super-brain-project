-- 069_joined_challenges.sql
-- Player-facing entry into Matchday Challenges.
--
-- A regular who is in the bar but hasn't scanned the QR (or scanned it last
-- week and wants back in) had no way to reach a challenge from inside the app.
-- This adds get_joined_challenges(): the list of challenges the signed-in user
-- has already joined, so the Sports hub can show "resume" links. Joining by
-- code still goes through the existing join_challenge()/get_challenge() path.
--
-- Additive only. No table or column changes; SECURITY DEFINER like its peers.

create or replace function public.get_joined_challenges()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare j jsonb; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'authentication required' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by (x.status = 'ended'), x.ends_at desc nulls last), '[]'::jsonb)
    into j
  from (
    select ch.code, ch.name, ch.prize,
           v.name as venue_name, v.slug as venue_slug,
           coalesce(v.colour_primary, '#E8C15A') as accent,
           (select count(*) from public.challenge_fixtures cf where cf.challenge_id = ch.id)    as fixtures,
           (select count(*) from public.challenge_participants cp2 where cp2.challenge_id = ch.id) as participants,
           agg.ends_at,
           case when coalesce(agg.all_done, false) then 'ended' else 'live' end as status
    from public.challenge_participants cp
    join public.venue_challenges ch on ch.id = cp.challenge_id
    join public.venues v on v.id = ch.venue_id
    left join lateral (
      select max(f.kicks_off_at) as ends_at,
             bool_and(f.home_score is not null and f.away_score is not null) as all_done
      from public.challenge_fixtures cx
      join public.fixtures f on f.id = cx.fixture_id
      where cx.challenge_id = ch.id
    ) agg on true
    where cp.user_id = v_uid
  ) x;

  return j;
end;
$$;
grant execute on function public.get_joined_challenges() to authenticated;
