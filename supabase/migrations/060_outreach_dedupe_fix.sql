-- ============================================================
-- 060 — Fix outreach_messages de-duplication
--
-- 057 created:   unique (venue_id, campaign_id, step)
--
-- In Postgres, NULLs are DISTINCT in a unique index by default. campaign_id
-- is nullable, so every webhook for a message whose campaign we had not yet
-- recorded would insert a NEW row instead of updating the existing one —
-- open and reply rates would silently inflate with every event.
--
-- PG15's NULLS NOT DISTINCT makes the constraint mean what it always should
-- have: one row per venue, per campaign, per step.
-- ============================================================

drop index if exists public.outreach_messages_once;

create unique index outreach_messages_once
  on public.outreach_messages (venue_id, campaign_id, step)
  nulls not distinct;

-- Campaign performance is a first-class question ("top performing sequence"),
-- so make the join cheap.
create index if not exists outreach_messages_campaign_idx
  on public.outreach_messages (campaign_id, step);
