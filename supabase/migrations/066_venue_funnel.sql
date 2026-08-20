-- ============================================================================
-- MIGRATION 066 — FOUNDER CONVERSION FUNNEL
-- ============================================================================
-- Founder analytics before scaling outreach. Adds:
--   1. event_kinds labels for the full funnel (incl. the raw logEvent kinds and
--      the new top-of-funnel / product-engagement kinds), so the event log and
--      timeline render human labels + categories instead of raw strings.
--   2. A trigger that emits a `player_joined` venue_event whenever someone joins
--      a VENUE-branded league (prediction_leagues.venue_id set) — the only
--      reliable signal for "first player registered".
--   3. get_venue_funnel()   — one-row funnel: emailed → clicked → signups →
--      trials → onboarded → active, plus product activation.
--   4. find_venues(q)       — name/id search for the timeline picker.
--   5. get_venue_timeline(q) — a single venue's full chronological event stream
--      + derived milestones + product engagement (players, predictions).
--
-- All RPCs are admin-gated (assert_admin) + security definer, matching
-- get_growth_dashboard. Additive + idempotent. Safe to re-run.
-- ============================================================================

-- ── 1. Event-kind labels ────────────────────────────────────────────────────
insert into public.event_kinds (kind, label, category, severity, sort_order) values
  -- top of funnel (web beacons)
  ('landing_viewed',        'Landing viewed',        'acquisition', 'info', 100),
  ('start_clicked',         'Start-trial clicked',   'acquisition', 'info', 101),
  ('signup_started',        'Signup started',        'acquisition', 'info', 102),
  ('checkout_opened',       'Stripe checkout opened','acquisition', 'info', 103),
  -- trial + provisioning
  ('trial_created',         'Trial created',         'billing',     'info', 110),
  ('provisioned',           'Venue provisioned',     'provisioning','info', 111),
  ('paid',                  'Payment received',      'billing',     'info', 112),
  -- onboarding
  ('branding_saved',        'Branding saved',        'onboarding',  'info', 120),
  ('branding_logo_uploaded','Logo uploaded',         'onboarding',  'info', 121),
  ('leagues_added',         'Competitions activated','onboarding',  'info', 122),
  ('league_activation_failed','League activation failed','onboarding','warn',123),
  ('staff_saved',           'Staff added',           'onboarding',  'info', 124),
  ('launch_pack_generated', 'Launch Pack generated', 'onboarding',  'info', 125),
  ('onboarding_completed',  'Onboarding completed',  'onboarding',  'info', 126),
  -- product engagement
  ('qr_scanned',            'QR scanned',            'product',     'info', 130),
  ('player_joined',         'Player joined',         'product',     'info', 131)
on conflict (kind) do update set
  label = excluded.label, category = excluded.category, sort_order = excluded.sort_order;


-- ── 2. player_joined trigger ────────────────────────────────────────────────
-- Fires when anyone joins a league. Emits a venue_event ONLY for venue-branded
-- leagues. Security definer so it can write the RLS-locked venue_events from
-- the joining user's (anon/authenticated) context.
create or replace function public.venue_player_joined()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_venue uuid;
begin
  select venue_id into v_venue from public.prediction_leagues where id = new.league_id;
  if v_venue is not null then
    insert into public.venue_events (venue_id, kind, detail, source)
    values (v_venue, 'player_joined',
            jsonb_build_object('league_id', new.league_id, 'user_id', new.user_id),
            'app');
  end if;
  return new;
end;
$$;

drop trigger if exists on_venue_player_joined on public.prediction_league_members;
create trigger on_venue_player_joined
  after insert on public.prediction_league_members
  for each row execute function public.venue_player_joined();


-- ── 3. get_venue_funnel() ───────────────────────────────────────────────────
-- One jsonb row: the acquisition funnel (distinct venues reaching each stage) +
-- top-of-funnel event volumes + product activation. Drop-offs are computed
-- client-side from the stage counts.
create or replace function public.get_venue_funnel()
returns jsonb
language plpgsql
stable security definer set search_path = public
as $$
declare j jsonb;
begin
  perform public.assert_admin();

  with ev as (
    select venue_id, kind from public.venue_events where venue_id is not null
  ),
  stages as (
    select
      count(*)                                                              as prospects,
      count(*) filter (where v.first_emailed_at is not null)                as emailed,
      count(*) filter (
        where v.first_clicked_at is not null
           or v.id in (select venue_id from ev where kind = 'landing_viewed')
      )                                                                     as clicked,
      count(*) filter (
        where v.status in ('signed_up','trialing','active','past_due','churned')
           or v.id in (select venue_id from ev where kind in ('signup_started','checkout_opened'))
      )                                                                     as signups,
      count(*) filter (
        where v.trial_started_at is not null
           or v.status in ('trialing','active','past_due','churned')
      )                                                                     as trials,
      count(*) filter (where v.onboarded_at is not null)                    as onboarded,
      count(*) filter (where v.status = 'active')                           as paying
    from public.venues v
  ),
  evol as (
    select
      count(*) filter (where kind = 'landing_viewed')        as landing_views,
      count(*) filter (where kind = 'start_clicked')         as start_clicks,
      count(*) filter (where kind = 'signup_started')        as signup_starts,
      count(*) filter (where kind = 'checkout_opened')       as checkouts_opened,
      count(*) filter (where kind = 'launch_pack_generated') as launch_packs,
      count(*) filter (where kind = 'qr_scanned')            as qr_scans
    from public.venue_events
  ),
  players as (
    select count(distinct pl.venue_id) as venues_with_players
    from public.prediction_leagues pl
    join public.prediction_league_members m on m.league_id = pl.id
    where pl.venue_id is not null
  ),
  preds as (
    select count(distinct pl.venue_id) as venues_with_predictions
    from public.prediction_leagues pl
    join public.prediction_league_members m on m.league_id = pl.id
    join public.fixtures f on f.competition_id = pl.competition_id
    join public.predictions p on p.fixture_id = f.id and p.user_id = m.user_id
    where pl.venue_id is not null
  )
  select jsonb_build_object(
    'prospects',   s.prospects,
    'emailed',     s.emailed,
    'clicked',     s.clicked,
    'signups',     s.signups,
    'trials',      s.trials,
    'onboarded',   s.onboarded,
    'paying',      s.paying,
    'active_venues', pl.venues_with_players,
    'venues_with_predictions', pr.venues_with_predictions,
    'events', jsonb_build_object(
      'landing_views',    ev.landing_views,
      'start_clicks',     ev.start_clicks,
      'signup_starts',    ev.signup_starts,
      'checkouts_opened', ev.checkouts_opened,
      'launch_packs',     ev.launch_packs,
      'qr_scans',         ev.qr_scans
    ),
    'generated_at', now()
  ) into j
  from stages s, evol ev, players pl, preds pr;

  return j;
end;
$$;

grant execute on function public.get_venue_funnel() to authenticated;


-- ── 4. find_venues(q) ───────────────────────────────────────────────────────
create or replace function public.find_venues(p_query text)
returns jsonb
language plpgsql
stable security definer set search_path = public
as $$
declare j jsonb;
begin
  perform public.assert_admin();
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into j from (
    select id, name, slug, status, city, country, contact_email
    from public.venues
    where p_query is null or p_query = ''
       or name ilike '%' || p_query || '%'
       or contact_email ilike '%' || p_query || '%'
    order by
      (name ilike p_query) desc,             -- exact-ish first
      greatest(coalesce(trial_started_at, 'epoch'::timestamptz),
               coalesce(first_emailed_at,  'epoch'::timestamptz),
               created_at) desc
    limit 25
  ) x;
  return j;
end;
$$;

grant execute on function public.find_venues(text) to authenticated;


-- ── 5. get_venue_timeline(q) ────────────────────────────────────────────────
-- Resolve a venue by id (uuid) or name search, then return its full event
-- stream (chronological), derived lifecycle milestones, and product engagement.
create or replace function public.get_venue_timeline(p_query text)
returns jsonb
language plpgsql
stable security definer set search_path = public
as $$
declare
  v            public.venues%rowtype;
  vid          uuid;
  j_events     jsonb;
  players_ct   int;
  first_player timestamptz;
  preds_ct     int;
  first_pred   timestamptz;
begin
  perform public.assert_admin();

  begin vid := p_query::uuid; exception when others then vid := null; end;

  select * into v from public.venues
  where (vid is not null and id = vid)
     or (vid is null and (name ilike '%' || p_query || '%'
                          or contact_email ilike '%' || p_query || '%'))
  order by (name ilike coalesce(p_query,'')) desc, created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  -- Full event stream, oldest first, with human labels.
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc), '[]'::jsonb)
    into j_events
  from (
    select e.created_at, e.kind,
           coalesce(k.label, e.kind)      as label,
           coalesce(k.category, 'system') as category,
           e.severity, e.source, e.detail
    from public.venue_events e
    left join public.event_kinds k on k.kind = e.kind
    where e.venue_id = v.id
  ) x;

  -- Product engagement across this venue's leagues.
  select count(distinct m.user_id), min(m.joined_at)
    into players_ct, first_player
  from public.prediction_leagues pl
  join public.prediction_league_members m on m.league_id = pl.id
  where pl.venue_id = v.id;

  select count(*), min(p.submitted_at)
    into preds_ct, first_pred
  from public.prediction_leagues pl
  join public.prediction_league_members m on m.league_id = pl.id
  join public.fixtures f on f.competition_id = pl.competition_id
  join public.predictions p on p.fixture_id = f.id and p.user_id = m.user_id
  where pl.venue_id = v.id;

  return jsonb_build_object(
    'found', true,
    'venue', jsonb_build_object(
      'id', v.id, 'name', v.name, 'slug', v.slug, 'status', v.status,
      'city', v.city, 'country', v.country, 'contact_email', v.contact_email,
      'source', v.source, 'created_at', v.created_at
    ),
    'milestones', jsonb_build_object(
      'created_at',       v.created_at,
      'first_emailed_at', v.first_emailed_at,
      'first_opened_at',  v.first_opened_at,
      'first_clicked_at', v.first_clicked_at,
      'replied_at',       v.replied_at,
      'trial_started_at', v.trial_started_at,
      'onboarded_at',     v.onboarded_at,
      'paid_at',          v.paid_at,
      'churned_at',       v.churned_at
    ),
    'product', jsonb_build_object(
      'players',            coalesce(players_ct, 0),
      'first_player_at',    first_player,
      'predictions',        coalesce(preds_ct, 0),
      'first_prediction_at', first_pred
    ),
    'events', j_events
  );
end;
$$;

grant execute on function public.get_venue_timeline(text) to authenticated;
