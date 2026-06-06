-- ============================================================
-- MIGRATION 017 — Golden Glove Bonus Question
--
-- Inserts the 7th bonus question (Golden Glove Winner) for
-- FIFA World Cup 2026. The question_key 'golden_glove' is
-- already registered in the UI (BONUS_META in bonus/page.tsx
-- and the rules/page.tsx scoring table).
--
-- answer_type: 'player'  (goalkeeper's name, case-insensitive match)
-- points_value: 15
-- locks_at: competition.starts_at (same as all other bonus questions)
--
-- Depends on: 006_bonus_questions.sql, wc2026 competition record
-- Safe to re-run (ON CONFLICT DO NOTHING).
-- ============================================================

DO $$
DECLARE
  v_comp record;
BEGIN
  SELECT id, starts_at INTO v_comp
  FROM public.competitions WHERE slug = 'wc2026';

  IF v_comp.id IS NULL THEN
    RAISE NOTICE 'wc2026 competition not found — skipping golden_glove seed.';
    RETURN;
  END IF;

  IF v_comp.starts_at IS NULL THEN
    RAISE EXCEPTION 'competitions.starts_at is NULL for wc2026. Set it before seeding bonus questions.';
  END IF;

  INSERT INTO public.bonus_questions
    (competition_id, question_key, question_text, points_value, answer_type, locks_at)
  VALUES
    (v_comp.id,
     'golden_glove',
     'Golden Glove Winner',
     15,
     'player',
     v_comp.starts_at)
  ON CONFLICT (competition_id, question_key) DO NOTHING;

  RAISE NOTICE 'Golden Glove question seeded for wc2026 (question_key=golden_glove, 15pts, locks at %).',
    v_comp.starts_at;
END;
$$;


DO $$
BEGIN
  RAISE NOTICE 'Migration 017 applied:';
  RAISE NOTICE '  - golden_glove bonus question inserted for wc2026';
  RAISE NOTICE '  - answer_type: player (goalkeeper name, case-insensitive)';
  RAISE NOTICE '  - points_value: 15';
  RAISE NOTICE '  - Auto-scores via existing admin_set_bonus_answer() function';
  RAISE NOTICE '  - Appears on /predict/bonus and /admin/bonus automatically';
END;
$$;
