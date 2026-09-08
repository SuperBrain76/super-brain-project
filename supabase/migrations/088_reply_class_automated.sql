-- 088 — allow the `automated` reply classification.
--
-- lib/replyClassifier.ts gained an `automated` class on 8 Sep 2026 so a robot
-- stops counting as a human reply and stops ending the sequence. The CHECK
-- constraint here still listed only the original five, so every automated reply
-- would have failed to insert: the poller would have logged
-- "violates check constraint" into its errors array and moved on, and the reply
-- would never have been stored at all. Caught before it shipped, but only by
-- running the real write rather than the unit tests — the classifier is pure,
-- so nothing in the suite touches this constraint.
--
-- `neutral` is deliberately kept. It now means what its name always implied: a
-- human said something we could not read. `automated` means a machine answered.
-- The two need opposite handling, which is the whole reason for the split.

alter table public.venue_replies
  drop constraint if exists venue_replies_classification_chk;

alter table public.venue_replies
  add constraint venue_replies_classification_chk
  check (classification = any (array[
    'positive_interested',
    'automated',
    'neutral',
    'negative',
    'negative_unsubscribe',
    'needs_review'
  ]));

-- Reclassify the one reply this campaign has ever received. It is an
-- out-of-office from Brigadiers and it has been standing as the entire
-- response rate of 28 contacted venues.
update public.venue_replies
   set classification = 'automated',
       classifier     = 'rules-v2-auto',
       reason         = 'Subject line declares an automated reply. No human has responded.'
 where lower(reply_subject) like 'automatic reply:%'
   and classification = 'neutral';

select classification, count(*) from public.venue_replies group by 1 order by 1;
