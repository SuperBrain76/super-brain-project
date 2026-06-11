-- Add email_notifications opt-out column to user_profiles
-- Default true — existing users are opted in unless they unsubscribe

alter table public.user_profiles
  add column if not exists email_notifications boolean not null default true;

comment on column public.user_profiles.email_notifications is
  'false = user has unsubscribed from all SuperBrain notification emails';
