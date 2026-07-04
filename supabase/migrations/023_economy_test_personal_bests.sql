-- ============================================================================
-- MIGRATION 023 — ECONOMY: COGNITIVE TEST PERSONAL BESTS
-- ============================================================================
-- Idempotent. Builds on 021_economy_core.sql.
--
-- Rewards QUALITY: a user earns IQ only when they set a NEW personal best on a
-- cognitive test, scaled by percentile. No client change — a trigger on
-- test_results insert handles every existing and future save path.
--
-- Quality buckets (percentile): elite ≥98 · high ≥85 · mid ≥50 · low otherwise.
-- Amounts + daily_cap live in economy_event_types('test_personal_best').
-- ============================================================================

create or replace function public.award_test_personal_best()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  prev_best integer;
  bucket    text;
begin
  -- Previous best for this (user, test), excluding the row just inserted.
  select max(score) into prev_best
  from public.test_results
  where user_id = new.user_id
    and test_name = new.test_name
    and id <> new.id;

  -- Only reward a genuine new personal best (or first-ever attempt).
  if prev_best is not null and new.score <= prev_best then
    return new;
  end if;

  bucket := case
    when new.percentile >= 98 then 'elite'
    when new.percentile >= 85 then 'high'
    when new.percentile >= 50 then 'mid'
    else 'low'
  end;

  -- Guarded: an economy fault must never block saving a test result.
  begin
    perform public.economy_emit(
      new.user_id,
      'test_personal_best',
      new.id::text,          -- per-result source_ref (per_source=true → once)
      null,
      bucket,                -- quality → amount_map[bucket]
      jsonb_build_object('test_name', new.test_name, 'score', new.score, 'percentile', new.percentile),
      null
    );
  exception when others then
    raise warning 'economy test_personal_best emit failed for result %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists economy_award_test_pb on public.test_results;
create trigger economy_award_test_pb
  after insert on public.test_results
  for each row execute function public.award_test_personal_best();
