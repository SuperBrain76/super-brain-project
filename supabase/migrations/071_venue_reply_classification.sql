-- 071 — Venue reply capture and rule-based classification.
--
-- Replies were previously recorded only as a timestamp on outreach_messages, so
-- an interested venue was indistinguishable from a rejection. This stores the
-- reply itself alongside a classification, in its own table: the source message
-- is never overwritten and a re-classification never destroys the original.

create table if not exists public.venue_replies (
  id              uuid        primary key default gen_random_uuid(),
  venue_id        uuid        not null references public.venues(id) on delete cascade,
  message_id      uuid        references public.outreach_messages(id) on delete set null,
  campaign_id     uuid        references public.outreach_campaigns(id) on delete set null,

  -- the reply exactly as received; never mutated by classification
  from_email      text        not null,
  reply_subject   text,
  reply_text      text,
  received_at     timestamptz not null default now(),

  -- classification result
  classification  text        not null default 'needs_review',
  -- positive_interested | neutral | negative | negative_unsubscribe | needs_review
  reason          text,                       -- human-readable why
  rule_matched    text,                       -- which rule fired
  confidence      text        not null default 'low',   -- high | medium | low
  classified_at   timestamptz,
  classifier      text        not null default 'rules-v1',

  -- set when a human has looked at it; keeps escalations from repeating
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),

  constraint venue_replies_classification_chk check (classification in
    ('positive_interested','neutral','negative','negative_unsubscribe','needs_review')),
  constraint venue_replies_confidence_chk check (confidence in ('high','medium','low'))
);

-- One row per inbound reply per venue per campaign step. Instantly can redeliver
-- a webhook, so this keeps retries idempotent.
create unique index if not exists venue_replies_dedupe_idx
  on public.venue_replies (venue_id, from_email, received_at);

-- The Daily Brief asks "what needs me?" — this is the index that answers it.
create index if not exists venue_replies_attention_idx
  on public.venue_replies (classification, reviewed_at, received_at desc)
  where classification in ('positive_interested','neutral','needs_review');

create index if not exists venue_replies_venue_idx
  on public.venue_replies (venue_id, received_at desc);

comment on table public.venue_replies is
  'Inbound venue replies with rule-based classification. Source text is immutable; '
  'classification fails toward needs_review rather than suppressing a live lead.';
