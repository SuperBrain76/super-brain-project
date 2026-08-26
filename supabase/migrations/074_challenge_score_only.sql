-- ============================================================
-- MIGRATION 074 — Matchday Challenges are score-fixtures only
--
-- Challenges score every pick with the uniform challenge-local
-- ladder (exact 3, correct result 1, else 0) computed from
-- home_score/away_score — both the prediction's and the fixture's.
-- An ordering fixture (F1, migration 073) has NEITHER: its result
-- is a ranked classification and its predictions live in payload
-- with scores NULL. Inside a challenge such a fixture could never
-- score, and worse, it could never COMPLETE: get_challenge derives
-- 'ended' from bool_and(home_score+away_score present), so one
-- ordering fixture would pin a challenge on 'live' forever and
-- block settlement of the prize.
--
-- Fix: make ordering fixtures invisible to the challenge surface,
-- at every layer —
--   1. get_fixtures_on_date  — the owner's picker never offers one.
--   2. create_venue_challenge — a crafted API call can't attach one.
--   3. get_challenge          — a challenge that somehow already
--      contains one (pre-074 crafted call) ignores it: it leaves
--      the fixture list, the ends_at/'ended' derivation and the
--      leaderboard picks count, so the challenge still settles.
--   4. get_joined_challenges  — same 'ended' derivation as (3);
--      patched too so the Sports-hub resume list agrees with
--      get_challenge instead of showing the challenge 'live'
--      forever.
--
-- Bodies are otherwise IDENTICAL to the latest declarations
-- (068 for 1–3, 069 for 4); the only change is the
-- `f.prediction_type = 'score'` condition. Grants unchanged.
--
-- DEPENDS ON: 068 (challenge RPCs), 069 (get_joined_challenges),
--             073 (prediction_type = 'ordering' becomes reachable).
-- SAFE TO RE-RUN: yes (create or replace is idempotent).
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 1. get_fixtures_on_date — the owner's fixture picker ─────
-- Only score fixtures are offered; ordering fixtures can't be picked.

create or replace function public.get_fixtures_on_date(p_date date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare j jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.kicks_off_at, x.competition), '[]'::jsonb)
    into j
  from (
    select f.id, f.kicks_off_at, f.status,
           c.name as competition, c.slug as competition_slug,
           ht.name as home, ht.code as home_code, ht.flag_emoji as home_flag,
           at.name as away, at.code as away_code, at.flag_emoji as away_flag
    from public.fixtures f
    join public.competitions c on c.id = f.competition_id
    join public.teams ht on ht.id = f.home_team_id
    join public.teams at on at.id = f.away_team_id
    where c.status = 'active'
      and f.prediction_type = 'score'
      and f.kicks_off_at >= p_date::timestamptz
      and f.kicks_off_at <  (p_date + 1)::timestamptz
  ) x;

  return j;
end;
$$;
grant execute on function public.get_fixtures_on_date(date) to authenticated;


-- ── 2. create_venue_challenge — owner creates a challenge ────
-- The fixture-validity check now also requires a score fixture, so
-- bypassing the picker with a crafted call still can't attach one.

create or replace function public.create_venue_challenge(
  p_name text, p_prize text, p_fixture_ids uuid[]
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid; v_id uuid; v_code text; n int;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;

  -- Caller must own a venue (the challenge belongs to it).
  select id into v_venue from public.venues
   where owner_user_id = auth.uid() order by created_at limit 1;
  if v_venue is null then raise exception 'no venue for this account' using errcode = '42501'; end if;

  if p_name is null or length(trim(p_name)) = 0 then raise exception 'name required'; end if;
  if p_fixture_ids is null or array_length(p_fixture_ids, 1) is null then
    raise exception 'pick at least one fixture';
  end if;

  insert into public.venue_challenges (venue_id, name, prize, created_by)
  values (v_venue, trim(p_name), nullif(trim(coalesce(p_prize, '')), ''), auth.uid())
  returning id, code into v_id, v_code;

  -- Only accept SCORE fixtures that exist in an ACTIVE competition.
  insert into public.challenge_fixtures (challenge_id, fixture_id)
  select v_id, fid
  from unnest(p_fixture_ids) as fid
  where exists (
    select 1 from public.fixtures f
    join public.competitions c on c.id = f.competition_id
    where f.id = fid and c.status = 'active'
      and f.prediction_type = 'score'
  )
  on conflict do nothing;

  select count(*) into n from public.challenge_fixtures where challenge_id = v_id;
  if n = 0 then
    delete from public.venue_challenges where id = v_id;
    raise exception 'none of the selected fixtures are valid';
  end if;

  insert into public.challenge_participants (challenge_id, user_id)
  values (v_id, auth.uid()) on conflict do nothing;

  return jsonb_build_object('id', v_id, 'code', v_code, 'fixtures', n);
end;
$$;
grant execute on function public.create_venue_challenge(text, text, uuid[]) to authenticated;


-- ── 3. get_challenge(code) — the customer view + leaderboard ─
-- Uniform scoring computed live: exact 3, correct result 1, else 0.
-- Ordering fixtures are ignored everywhere: the fixture list, the
-- ends_at/bool_and(completed) derivation (so 'ended' is reachable
-- again) and the leaderboard join (so `picks` counts only picks on
-- fixtures the challenge actually shows).

create or replace function public.get_challenge(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  ch record; v record;
  j_fixtures jsonb; j_board jsonb;
  v_ends timestamptz; v_all_done boolean;
  v_uid uuid := auth.uid(); v_participants int; v_is_owner boolean; v_is_member boolean;
begin
  select * into ch from public.venue_challenges where code = upper(trim(p_code));
  if not found then return jsonb_build_object('found', false); end if;

  select id, name, slug, city, country, logo_url, colour_primary, colour_ink, owner_user_id
    into v from public.venues where id = ch.venue_id;

  v_is_owner  := v_uid is not null and v_uid = v.owner_user_id;
  v_is_member := v_uid is not null and exists (
    select 1 from public.challenge_participants cp where cp.challenge_id = ch.id and cp.user_id = v_uid);
  select count(*) into v_participants from public.challenge_participants where challenge_id = ch.id;

  -- Fixtures + the caller's own prediction (if any).
  select coalesce(jsonb_agg(to_jsonb(x) order by x.kicks_off_at), '[]'::jsonb),
         max(x.kicks_off_at), bool_and(x.completed)
    into j_fixtures, v_ends, v_all_done
  from (
    select f.id, f.kicks_off_at, f.status,
           (f.home_score is not null and f.away_score is not null) as completed,
           f.home_score as actual_home, f.away_score as actual_away,
           (now() >= f.kicks_off_at) as locked,
           c.name as competition, c.slug as competition_slug,
           ht.name as home, ht.code as home_code, ht.flag_emoji as home_flag,
           at.name as away, at.code as away_code, at.flag_emoji as away_flag,
           mp.home_score as my_home, mp.away_score as my_away
    from public.challenge_fixtures cx
    join public.fixtures f on f.id = cx.fixture_id
    join public.competitions c on c.id = f.competition_id
    join public.teams ht on ht.id = f.home_team_id
    join public.teams at on at.id = f.away_team_id
    left join public.predictions mp on mp.fixture_id = f.id and mp.user_id = v_uid
    where cx.challenge_id = ch.id
      and f.prediction_type = 'score'
  ) x;

  -- Live leaderboard: uniform 3/1/0 over participants.
  select coalesce(jsonb_agg(to_jsonb(b) order by b.points desc, b.picks desc, b.display_name), '[]'::jsonb)
    into j_board
  from (
    select cp.user_id,
      coalesce(nullif(trim(pr.display_name), ''), 'Anonymous') as display_name,
      pr.avatar_url,
      coalesce(sum(case
        when f.home_score is null or f.away_score is null or p.id is null then 0
        when p.home_score = f.home_score and p.away_score = f.away_score then 3
        when (case when p.home_score > p.away_score then 1 when p.home_score < p.away_score then -1 else 0 end)
           = (case when f.home_score > f.away_score then 1 when f.home_score < f.away_score then -1 else 0 end)
             then 1
        else 0 end), 0) as points,
      count(p.id) as picks
    from public.challenge_participants cp
    join public.user_profiles pr on pr.id = cp.user_id
    left join public.challenge_fixtures cx on cx.challenge_id = cp.challenge_id
    left join public.fixtures f on f.id = cx.fixture_id and f.prediction_type = 'score'
    left join public.predictions p on p.fixture_id = f.id and p.user_id = cp.user_id
    where cp.challenge_id = ch.id
    group by cp.user_id, pr.display_name, pr.avatar_url
  ) b;

  return jsonb_build_object(
    'found', true,
    'code', ch.code, 'name', ch.name, 'prize', ch.prize, 'created_at', ch.created_at,
    'ends_at', v_ends,
    'status', case when coalesce(v_all_done, false) then 'ended' else 'live' end,
    'is_owner', v_is_owner, 'is_member', v_is_member, 'participants', v_participants,
    'venue', jsonb_build_object('name', v.name, 'slug', v.slug, 'city', v.city,
             'logo_url', v.logo_url, 'primary', v.colour_primary, 'ink', v.colour_ink),
    'fixtures', j_fixtures,
    'leaderboard', j_board
  );
end;
$$;
grant execute on function public.get_challenge(text) to anon, authenticated;


-- ── 4. get_joined_challenges — the player's resume list (069) ─
-- Same all_done derivation as get_challenge, filtered the same way,
-- so both surfaces agree on 'ended'. (The `fixtures` count is left
-- as-is: it is display-only and never blocks settlement.)

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
        and f.prediction_type = 'score'
    ) agg on true
    where cp.user_id = v_uid
  ) x;

  return j;
end;
$$;
grant execute on function public.get_joined_challenges() to authenticated;


insert into public.schema_migrations (version, name, notes)
values ('074', 'challenge_score_only',
        'Matchday Challenges see only prediction_type = ''score'' fixtures: '
        'picker, creation check, get_challenge fixture set + leaderboard, '
        'get_joined_challenges status. Ordering fixtures (073/F1) have no '
        'home/away scores, so one inside a challenge could never score and '
        'would pin the bool_and(completed) status on ''live'' forever.')
on conflict (version) do nothing;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- Re-run the prior declarations:
--   068 §get_fixtures_on_date, §create_venue_challenge, §get_challenge
--   069 (get_joined_challenges)
-- ============================================================
