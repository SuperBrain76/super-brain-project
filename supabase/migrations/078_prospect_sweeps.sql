-- 078: sweep-state registry for stateful prospect discovery.
--
-- Dylan, 30 Aug 2026: discovery must be neither auto-resweeping (wasted Places
-- calls on cities already covered) nor manual-only (the pool silently dries
-- up). This table is the memory that makes both true: one row per completed
-- (country, city) sweep; the buffer-guard cron advances to the next unswept
-- city only when the eligible pool is low, and never repeats a completed row
-- unless a human forces it.

create table if not exists public.prospect_sweeps (
  id              bigint generated always as identity primary key,
  country         text        not null,
  city            text        not null,
  terms_used      int         not null default 0,
  seen            int         not null default 0,
  prefiltered_out int         not null default 0,
  imported        int         not null default 0,
  forced          boolean     not null default false,
  swept_at        timestamptz not null default now(),
  unique (country, city)
);

-- Service-role only, like every other venue CRM table (057 pattern):
-- RLS on with no policies means the anon key reads and writes nothing.
alter table public.prospect_sweeps enable row level security;

-- Seed with the sweeps that already happened, derived from the venues the
-- scraper actually imported — so the guard never re-sweeps London/Leeds/
-- Liverpool etc. City names come from our own CITIES list at import time,
-- so they match the registry values the guard compares against.
insert into public.prospect_sweeps (country, city, imported, swept_at)
select country, city, count(*), min(created_at)
from public.venues
where source = 'google_maps' and city is not null
group by country, city
on conflict (country, city) do nothing;
