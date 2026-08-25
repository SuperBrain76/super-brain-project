-- ============================================================
-- 072 — Per-sport prediction score bounds (unblocks rugby)
--
-- The predictions CHECKs capped scores at 0–20 — right for football and
-- hockey, impossible for rugby (24–17 is a normal result; RWC blowouts
-- pass 90). Fixtures never had an upper bound, so results would ingest
-- while users couldn't predict them: a quiet, confusing failure.
--
-- Design: the hard per-sport limit lives in sports.max_score and is
-- enforced by a BEFORE trigger (predictions are written straight from
-- the client under RLS, so the database is the only server-side gate —
-- same reasoning as the kickoff-deadline trigger). The table CHECKs stay
-- as a wide sanity backstop (0–250) that no sport should ever reach.
-- Football and ice hockey keep max_score 20: behaviour is unchanged for
-- every existing competition.
-- ============================================================

alter table public.sports
  add column if not exists max_score integer not null default 20
  check (max_score between 1 and 250);

update public.sports set max_score = 100 where code = 'rugby';
update public.sports set max_score = 200 where code = 'basketball';

-- Widen the backstop CHECKs (constraint names from predictor-schema.sql).
alter table public.predictions drop constraint if exists predictions_home_score_check;
alter table public.predictions drop constraint if exists predictions_away_score_check;
alter table public.predictions
  add constraint predictions_home_score_check check (home_score >= 0 and home_score <= 250),
  add constraint predictions_away_score_check check (away_score >= 0 and away_score <= 250);

-- The real per-sport gate.
create or replace function public.enforce_prediction_score_bounds()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_max integer;
begin
  select s.max_score into v_max
  from public.fixtures f
  join public.competitions c on c.id = f.competition_id
  join public.sports s       on s.code = c.sport_code
  where f.id = new.fixture_id;

  -- No sport resolved (orphan fixture in a test db): fall back to 20.
  v_max := coalesce(v_max, 20);

  if new.home_score > v_max or new.away_score > v_max then
    raise exception 'score out of range: this sport accepts 0-% per team', v_max;
  end if;
  return new;
end;
$$;

drop trigger if exists prediction_score_bounds_check on public.predictions;
create trigger prediction_score_bounds_check
  before insert or update of home_score, away_score on public.predictions
  for each row execute function public.enforce_prediction_score_bounds();

-- ── Ledger ───────────────────────────────────────────────────
-- 055–071 stopped recording themselves in schema_migrations (the ledger
-- ends at 054 while the objects all exist in production — verified
-- 25 Aug 2026). Backfill them so the ledger is trustworthy again, and
-- record this migration.
insert into public.schema_migrations (version, name) values
  ('055','banker'),
  ('056','prediction_streak'),
  ('057','venue_crm'),
  ('058','venue_owner_lookup'),
  ('059','event_log'),
  ('060','outreach_dedupe_fix'),
  ('061','prospecting'),
  ('062','growth_dashboard'),
  ('063','venue_page'),
  ('064','venue_prefill'),
  ('065','venue_branding'),
  ('066','venue_funnel'),
  ('067','funnel_exclude_owner'),
  ('068','matchday_challenge'),
  ('069','joined_challenges'),
  ('070','venue_dashboard'),
  ('071','venue_reply_classification'),
  ('072','sport_max_score')
on conflict (version) do nothing;
