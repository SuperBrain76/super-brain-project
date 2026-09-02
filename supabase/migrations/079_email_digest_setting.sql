-- Register email_digest_sent, and record the digest that already went out.
--
-- competition_settings.key carries a foreign key to competition_setting_defs.
-- The weekly digest writes email_digest_sent as its once-a-week guarantee, but
-- the key was never registered, so every upsert was rejected and the route's
-- setSetting swallowed the error. The digest of 2 Sep 2026 sent correctly and
-- then left no record of having sent, which would have repeated it on every
-- three-hourly run.
--
-- The backfill below stamps the week that already went out (2026-W36) onto
-- every active competition, so the send is recorded retrospectively.

insert into competition_setting_defs
  (key, value_type, default_value, label, description, group_name, sort_order, is_secret, required)
values
  ('email_digest_sent', 'string', null,
   'Last weekly digest sent',
   'ISO week key (e.g. 2026-W36) of the last weekly digest. One digest per week is enforced on this value.',
   'email', 140, false, false)
on conflict (key) do nothing;

insert into competition_settings (competition_id, key, value)
select c.id, 'email_digest_sent', to_jsonb('2026-W36'::text)
from competitions c
where c.status = 'active'
on conflict (competition_id, key) do nothing;
