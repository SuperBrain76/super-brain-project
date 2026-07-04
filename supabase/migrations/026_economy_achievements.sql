-- ============================================================================
-- MIGRATION 026 — ECONOMY: ACHIEVEMENT ENGINE
-- ============================================================================
-- Idempotent. Builds on 021 (+022 streaks, 023 tests, 025 referrals).
--
-- Achievements are DATA. Each row in `achievements` declares a reward and a
-- JSONB `criteria`. A generic evaluator (economy_meets_criteria) checks the
-- criteria against the ledger / streaks / test_results / referrals. New badges
-- ship by INSERTing a row — no code deploy.
--
-- Supported criteria types (extend the evaluator to add more):
--   {"type":"iq_earned","gte":N}                       total positive IQ earned
--   {"type":"iq_total","gte":N}                         current IQ balance
--   {"type":"event_count","event":"prediction_score","gte":N}   # positive rows
--   {"type":"streak","gte":N}                           longest login streak
--   {"type":"tests_completed","gte":N}                  distinct cognitive tests
--   {"type":"test_best","test":"reaction","score_gte":N}
--   {"type":"referrals_qualified","gte":N}              active referrals made
-- ============================================================================

-- ── TABLES ──────────────────────────────────────────────────────────────────
create table if not exists public.achievements (
  code          text        primary key,
  name          text        not null,
  description   text        not null default '',
  icon          text        not null default '🏆',
  currency_code text        not null default 'IQ' references public.economy_currencies(code),
  reward_amount bigint      not null default 0,
  criteria      jsonb       not null default '{}'::jsonb,
  sort          integer     not null default 0,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.user_achievements (
  user_id          uuid        not null references auth.users(id) on delete cascade,
  achievement_code text        not null references public.achievements(code) on delete cascade,
  unlocked_at      timestamptz not null default now(),
  primary key (user_id, achievement_code)
);

create index if not exists user_achievements_user_idx on public.user_achievements (user_id);

alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "achievements public read" on public.achievements;
create policy "achievements public read"
  on public.achievements for select to anon, authenticated using (true);

drop policy if exists "user achievements read own" on public.user_achievements;
create policy "user achievements read own"
  on public.user_achievements for select to authenticated using (auth.uid() = user_id);
-- unlocks written only by economy_check_achievements (SECURITY DEFINER)

-- Reward event: amount comes from the achievement row (override).
insert into public.economy_event_types
  (code, currency_code, description, base_amount, amount_map, cooldown_seconds, daily_cap, per_source, active)
values
  ('achievement_unlocked', 'IQ', 'Unlocked an achievement', 0, '{}'::jsonb, 0, null, false, true)
on conflict (code) do nothing;


-- ── EVALUATOR (data-driven) ─────────────────────────────────────────────────
create or replace function public.economy_meets_criteria(p_user_id uuid, p_criteria jsonb)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  ctype text := p_criteria ->> 'type';
  gte   numeric := coalesce((p_criteria ->> 'gte')::numeric, 0);
  val   numeric := 0;
begin
  if ctype is null then return false; end if;

  case ctype
    when 'iq_earned' then
      select coalesce(sum(delta),0) into val from public.economy_ledger
        where user_id = p_user_id and delta > 0;
    when 'iq_total' then
      select coalesce(sum(delta),0) into val from public.economy_ledger
        where user_id = p_user_id and currency_code = coalesce(p_criteria->>'currency','IQ');
    when 'event_count' then
      select count(*) into val from public.economy_ledger
        where user_id = p_user_id and delta > 0
          and event_code = (p_criteria ->> 'event');
    when 'streak' then
      select coalesce(longest_streak,0) into val from public.user_streaks
        where user_id = p_user_id;
    when 'tests_completed' then
      select count(distinct test_name) into val from public.test_results
        where user_id = p_user_id;
    when 'test_best' then
      return exists (
        select 1 from public.test_results
        where user_id = p_user_id
          and test_name = (p_criteria ->> 'test')
          and score >= coalesce((p_criteria ->> 'score_gte')::numeric, 0)
      );
    when 'referrals_qualified' then
      select count(*) into val from public.referrals
        where referrer_id = p_user_id and status = 'qualified';
    else
      return false;                     -- unknown criteria type
  end case;

  return val >= gte;
end;
$$;
revoke all on function public.economy_meets_criteria(uuid, jsonb) from public, anon, authenticated;


-- ── CHECK + UNLOCK (internal; called by the activity orchestrator) ──────────
create or replace function public.economy_check_achievements(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a record;
begin
  if p_user_id is null then return; end if;

  for a in
    select ach.* from public.achievements ach
    where ach.active
      and not exists (
        select 1 from public.user_achievements ua
        where ua.user_id = p_user_id and ua.achievement_code = ach.code
      )
  loop
    if public.economy_meets_criteria(p_user_id, a.criteria) then
      insert into public.user_achievements (user_id, achievement_code)
      values (p_user_id, a.code)
      on conflict do nothing;

      if a.reward_amount > 0 then
        perform public.economy_emit(
          p_user_id, 'achievement_unlocked', a.code, a.reward_amount, null,
          jsonb_build_object('achievement', a.code, 'name', a.name),
          'achievement:' || p_user_id::text || ':' || a.code
        );
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.economy_check_achievements(uuid) from public, anon, authenticated;


-- ── READ RPC: get_my_achievements (all badges + unlocked flag) ──────────────
create or replace function public.get_my_achievements()
returns table (
  code text, name text, description text, icon text,
  reward_amount bigint, unlocked boolean, unlocked_at timestamptz, sort integer
)
language sql stable security definer set search_path = public
as $$
  select a.code, a.name, a.description, a.icon, a.reward_amount,
         (ua.user_id is not null) as unlocked, ua.unlocked_at, a.sort
  from public.achievements a
  left join public.user_achievements ua
    on ua.achievement_code = a.code and ua.user_id = auth.uid()
  where a.active
  order by a.sort, a.name;
$$;
grant execute on function public.get_my_achievements() to anon, authenticated;


-- ── SEED: starter achievement set (all tunable/removable via data) ──────────
insert into public.achievements (code, name, description, icon, reward_amount, criteria, sort) values
  ('first_steps',    'First Steps',     'Earn your first IQ on SuperBrain.',                '👣', 10,  '{"type":"iq_earned","gte":1}', 10),
  ('first_prediction','On the Board',   'Get your first match prediction scored.',         '⚽', 20,  '{"type":"event_count","event":"prediction_score","gte":1}', 20),
  ('sharp_shooter',  'Sharp Shooter',   'Have 10 predictions scored.',                     '🎯', 60,  '{"type":"event_count","event":"prediction_score","gte":10}', 30),
  ('quick_mind',     'Quick Mind',      'Complete 5 different cognitive tests.',           '🧠', 40,  '{"type":"tests_completed","gte":5}', 40),
  ('week_warrior',   'Week Warrior',    'Reach a 7-day login streak.',                     '🔥', 60,  '{"type":"streak","gte":7}', 50),
  ('unstoppable',    'Unstoppable',     'Reach a 30-day login streak.',                    '⚡', 250, '{"type":"streak","gte":30}', 60),
  ('century',        'Century',         'Earn 100 IQ.',                                    '💯', 25,  '{"type":"iq_earned","gte":100}', 70),
  ('iq_1000',        'Big Brain',       'Earn 1,000 IQ.',                                  '🌟', 150, '{"type":"iq_earned","gte":1000}', 80),
  ('connector',      'Connector',       'Bring in your first active referral.',            '🤝', 50,  '{"type":"referrals_qualified","gte":1}', 90),
  ('influencer',     'Influencer',      'Bring in 5 active referrals.',                    '📣', 300, '{"type":"referrals_qualified","gte":5}', 100)
on conflict (code) do nothing;
