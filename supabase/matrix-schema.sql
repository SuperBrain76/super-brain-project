-- ============================================================
-- SuperBrain Matrix Intelligence Assessment
-- Paste into Supabase SQL editor
-- ============================================================

-- ── Attempts (one row per completed/abandoned session) ────────

create table if not exists matrix_attempts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete set null,
  session_id          uuid not null unique,
  started_at          timestamptz default now(),
  completed_at        timestamptz,
  questions_answered  int default 0,
  fluid_score         int,                 -- 0–100
  percentile          int,                 -- 0–99
  ability_estimate    float,               -- 1.0–10.0
  speed_score         int,                 -- 0–100
  accuracy_rate       float,               -- 0.0–1.0
  consistency_score   int,                 -- 0–100
  difficulty_reached  int,                 -- 1–10
  avg_response_ms     int,
  focus_violations    int default 0,
  suspicious_times    int default 0,
  flagged             bool default false,
  profile_label       text,
  created_at          timestamptz default now()
);

-- ── Individual responses ──────────────────────────────────────

create table if not exists matrix_responses (
  id               uuid primary key default gen_random_uuid(),
  attempt_id       uuid not null references matrix_attempts(id) on delete cascade,
  question_id      text not null,
  pattern_type     text not null,
  difficulty       int not null,
  correct          bool not null,
  response_ms      int not null,
  selected_index   int not null,          -- -1 = timeout
  created_at       timestamptz default now()
);

-- ── Indexes ───────────────────────────────────────────────────

create index if not exists matrix_attempts_user_id_idx  on matrix_attempts (user_id);
create index if not exists matrix_attempts_score_idx    on matrix_attempts (fluid_score desc) where flagged = false;
create index if not exists matrix_responses_attempt_idx on matrix_responses (attempt_id);

-- ── RLS ──────────────────────────────────────────────────────

alter table matrix_attempts  enable row level security;
alter table matrix_responses enable row level security;

-- Anyone can insert their own attempt
create policy "ma_insert" on matrix_attempts
  for insert with check (
    auth.uid() = user_id or user_id is null
  );

-- Users can read their own attempts
create policy "ma_read" on matrix_attempts
  for select using (
    auth.uid() = user_id
  );

-- Leaderboard: read high scores (non-flagged) for anyone
create policy "ma_leaderboard" on matrix_attempts
  for select using (
    flagged = false and fluid_score is not null
  );

-- Responses: own only
create policy "mr_insert" on matrix_responses
  for insert with check (
    exists (
      select 1 from matrix_attempts a
      where a.id = attempt_id
        and (a.user_id = auth.uid() or a.user_id is null)
    )
  );

create policy "mr_read" on matrix_responses
  for select using (
    exists (
      select 1 from matrix_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  );

-- ── Save attempt RPC (upserts cleanly) ───────────────────────

create or replace function save_matrix_attempt(
  p_session_id        uuid,
  p_user_id           uuid,
  p_fluid_score       int,
  p_percentile        int,
  p_ability_estimate  float,
  p_speed_score       int,
  p_accuracy_rate     float,
  p_consistency_score int,
  p_difficulty_reached int,
  p_questions_answered int,
  p_avg_response_ms   int,
  p_focus_violations  int,
  p_suspicious_times  int,
  p_flagged           bool,
  p_profile_label     text
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into matrix_attempts (
    session_id, user_id, fluid_score, percentile, ability_estimate,
    speed_score, accuracy_rate, consistency_score, difficulty_reached,
    questions_answered, avg_response_ms, focus_violations, suspicious_times,
    flagged, profile_label, completed_at
  ) values (
    p_session_id, p_user_id, p_fluid_score, p_percentile, p_ability_estimate,
    p_speed_score, p_accuracy_rate, p_consistency_score, p_difficulty_reached,
    p_questions_answered, p_avg_response_ms, p_focus_violations, p_suspicious_times,
    p_flagged, p_profile_label, now()
  )
  on conflict (session_id) do update set
    fluid_score         = excluded.fluid_score,
    percentile          = excluded.percentile,
    completed_at        = excluded.completed_at,
    flagged             = excluded.flagged
  returning id into v_id;

  return v_id;
end;
$$;
