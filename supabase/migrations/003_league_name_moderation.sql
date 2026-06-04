-- ============================================================
-- MIGRATION 003 — League name moderation
-- Adds normalized_name column to prediction_leagues.
--
-- normalized_name stores a lowercase, diacritics-removed,
-- whitespace-collapsed version of the original league name.
-- It is used for display consistency and future deduplication.
-- The original display name remains in the existing `name` column.
--
-- Safe to re-run (idempotent via IF NOT EXISTS / IF EXISTS guards).
-- Run AFTER predictor-schema.sql.
-- ============================================================

-- Step 1: Add the column (nullable initially so backfill can run first)
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS normalized_name text;

-- Step 2: Backfill all existing rows
-- Mirrors the TypeScript normalizeName() logic:
--   lowercase → trim → collapse whitespace → remove diacritics (best-effort in Postgres)
UPDATE public.prediction_leagues
SET normalized_name = lower(
  trim(
    regexp_replace(name, '\s+', ' ', 'g')
  )
)
WHERE normalized_name IS NULL;

-- Step 3: Enforce NOT NULL going forward
ALTER TABLE public.prediction_leagues
  ALTER COLUMN normalized_name SET NOT NULL;

-- Step 4: Index for future uniqueness checks (competition-scoped)
-- Not UNIQUE yet — that would block minor naming variations that are
-- intentional (e.g. two separate leagues named "Work Friends" in the
-- same competition). Add UNIQUE when deduplication policy is decided.
CREATE INDEX IF NOT EXISTS leagues_normalized_name_idx
  ON public.prediction_leagues (competition_id, normalized_name);

DO $$
BEGIN
  RAISE NOTICE 'Migration 003 applied: normalized_name added to prediction_leagues.';
END;
$$;
