-- ============================================================================
-- MIGRATION 027 — ECONOMY: ACTIVITY ORCHESTRATOR
-- ============================================================================
-- Idempotent. Requires 025 (referrals) + 026 (achievements).
--
-- The single, reusable hook that reacts to EVERY earning event: whenever IQ is
-- minted, we (a) check whether the earner now qualifies a pending referral, and
-- (b) check whether they've unlocked any achievements. Modules plug in here
-- rather than each pillar knowing about the others.
--
-- Recursion safety: the orchestrator only itself emits "reward" events
-- (referral_qualified, achievement_unlocked). The ledger trigger IGNORES those
-- event codes (and non-positive deltas), so an orchestrated reward cannot
-- re-trigger orchestration. Exactly one pass per genuine earning event.
-- ============================================================================

create or replace function public.economy_on_activity(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_user_id is null then return; end if;

  begin
    perform public.economy_qualify_referrals(p_user_id);
  exception when others then
    raise warning 'economy_qualify_referrals failed for %: %', p_user_id, sqlerrm;
  end;

  begin
    perform public.economy_check_achievements(p_user_id);
  exception when others then
    raise warning 'economy_check_achievements failed for %: %', p_user_id, sqlerrm;
  end;
end;
$$;
revoke all on function public.economy_on_activity(uuid) from public, anon, authenticated;


create or replace function public.economy_ledger_after_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Only genuine EARNING events drive orchestration. Skip spends (delta<=0) and
  -- the orchestrator's own reward payouts to prevent recursion.
  if new.delta <= 0
     or coalesce(new.event_code, '') in ('referral_qualified', 'achievement_unlocked') then
    return new;
  end if;

  perform public.economy_on_activity(new.user_id);
  return new;
end;
$$;

drop trigger if exists economy_ledger_activity on public.economy_ledger;
create trigger economy_ledger_activity
  after insert on public.economy_ledger
  for each row execute function public.economy_ledger_after_insert();


-- ── BACKFILL ────────────────────────────────────────────────────────────────
-- Retroactively evaluate referrals + achievements for everyone who has already
-- earned IQ (e.g. from the prediction backfill in migration 021). Idempotent.
do $$
declare uid uuid;
begin
  for uid in
    select distinct user_id from public.economy_ledger where delta > 0
  loop
    perform public.economy_on_activity(uid);
  end loop;
end $$;
