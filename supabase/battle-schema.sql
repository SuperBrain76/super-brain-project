-- ============================================================
-- SuperBrain Battle System — paste into Supabase SQL editor
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

create table if not exists battle_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Anonymous',
  elo          int  not null default 1000,
  wins         int  not null default 0,
  losses       int  not null default 0,
  win_streak   int  not null default 0,
  best_streak  int  not null default 0,
  country      text,
  updated_at   timestamptz default now()
);

create table if not exists battle_queue (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  elo          int  not null default 1000,
  country      text,
  joined_at    timestamptz default now()
);

create table if not exists battle_matches (
  id               uuid primary key default gen_random_uuid(),
  player1_id       uuid not null references auth.users(id),
  player2_id       uuid not null references auth.users(id),
  player1_name     text not null,
  player2_name     text not null,
  player1_elo      int  not null,
  player2_elo      int  not null,
  player1_score    int  not null default 0,
  player2_score    int  not null default 0,
  status           text not null default 'lobby', -- lobby|active|result|complete
  current_round    int  not null default 0,
  total_rounds     int  not null default 3,
  round_types      text[] not null,
  challenge_data   jsonb,
  round_started_at timestamptz,
  winner_id        uuid references auth.users(id),
  player1_elo_delta int,
  player2_elo_delta int,
  created_at       timestamptz default now(),
  ended_at         timestamptz
);

create table if not exists battle_round_results (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references battle_matches(id) on delete cascade,
  round_number    int  not null,
  round_type      text not null,
  correct_answer  text not null,
  player1_answer  text,
  player1_time_ms int,
  player2_answer  text,
  player2_time_ms int,
  winner_id       uuid,
  unique(match_id, round_number)
);

-- ── RLS ──────────────────────────────────────────────────────

alter table battle_profiles    enable row level security;
alter table battle_queue       enable row level security;
alter table battle_matches     enable row level security;
alter table battle_round_results enable row level security;

-- battle_profiles
create policy "bp_read"   on battle_profiles for select using (true);
create policy "bp_insert" on battle_profiles for insert with check (auth.uid() = user_id);
create policy "bp_update" on battle_profiles for update using (auth.uid() = user_id);

-- battle_queue
create policy "bq_read"   on battle_queue for select using (true);
create policy "bq_insert" on battle_queue for insert with check (auth.uid() = user_id);
create policy "bq_delete" on battle_queue for delete using (auth.uid() = user_id);

-- battle_matches (players can read their own matches)
create policy "bm_read" on battle_matches for select using (
  auth.uid() = player1_id or auth.uid() = player2_id
);

-- battle_round_results
create policy "brr_read" on battle_round_results for select using (
  exists (
    select 1 from battle_matches m
    where m.id = match_id
      and (m.player1_id = auth.uid() or m.player2_id = auth.uid())
  )
);

-- ── Realtime ─────────────────────────────────────────────────

alter publication supabase_realtime add table battle_matches;
alter publication supabase_realtime add table battle_queue;

-- ── Challenge generator ───────────────────────────────────────

create or replace function generate_battle_challenge(p_type text)
returns jsonb language plpgsql as $$
declare
  v_a int; v_b int; v_op text; v_ans int;
  v_w1 int; v_w2 int; v_w3 int;
  v_start int; v_step int;
begin
  if p_type = 'reaction' then
    return jsonb_build_object(
      'type', 'reaction',
      'delay_ms', 1200 + floor(random() * 3000)::int,
      'correct_answer', 'TAP'
    );

  elsif p_type = 'math' then
    case floor(random() * 3)::int
      when 0 then
        v_a := 11 + floor(random()*50)::int;
        v_b := 11 + floor(random()*50)::int;
        v_op := '+'; v_ans := v_a + v_b;
      when 1 then
        v_a := 40 + floor(random()*50)::int;
        v_b := 10 + floor(random()*29)::int;
        v_op := '−'; v_ans := v_a - v_b;
      else
        v_a := 3 + floor(random()*9)::int;
        v_b := 3 + floor(random()*9)::int;
        v_op := '×'; v_ans := v_a * v_b;
    end case;
    v_w1 := v_ans + 1 + floor(random()*4)::int;
    v_w2 := v_ans - 1 - floor(random()*4)::int;
    v_w3 := v_ans + 7 + floor(random()*5)::int;
    return jsonb_build_object(
      'type', 'math',
      'a', v_a, 'op', v_op, 'b', v_b,
      'options', jsonb_build_array(v_ans, v_w1, v_w2, v_w3),
      'correct_answer', v_ans::text
    );

  elsif p_type = 'sequence' then
    v_start := 1 + floor(random()*15)::int;
    v_step  := 2 + floor(random()*9)::int;
    v_ans   := v_start + v_step * 4;
    v_w1    := v_ans + v_step;
    v_w2    := v_ans - v_step;
    v_w3    := v_ans + 2;
    return jsonb_build_object(
      'type', 'sequence',
      'nums', jsonb_build_array(
        v_start, v_start+v_step, v_start+v_step*2, v_start+v_step*3
      ),
      'options', jsonb_build_array(v_ans, v_w1, v_w2, v_w3),
      'correct_answer', v_ans::text
    );
  end if;

  return '{}'::jsonb;
end;
$$;

-- ── Matchmaking RPC ───────────────────────────────────────────

create or replace function find_or_create_battle(
  p_user_id    uuid,
  p_name       text,
  p_elo        int,
  p_country    text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_opp    record;
  v_mid    uuid;
  v_types  text[];
begin
  -- Evict stale entries
  delete from battle_queue where joined_at < now() - interval '3 minutes';

  -- Look for opponent (±300 Elo, not self)
  select * into v_opp
  from battle_queue
  where user_id != p_user_id and abs(elo - p_elo) <= 300
  order by abs(elo - p_elo), joined_at
  limit 1;

  if v_opp is null then
    insert into battle_queue (user_id, display_name, elo, country)
    values (p_user_id, p_name, p_elo, p_country)
    on conflict (user_id) do update set elo = p_elo, joined_at = now();
    return jsonb_build_object('status','queued');
  end if;

  -- Randomly pick 3 round types from available pool
  select array_agg(t order by random()) into v_types
  from unnest(array['reaction','math','sequence']) t
  limit 3;

  insert into battle_matches (
    player1_id, player2_id, player1_name, player2_name,
    player1_elo, player2_elo, round_types
  ) values (
    v_opp.user_id, p_user_id, v_opp.display_name, p_name,
    v_opp.elo, p_elo, v_types
  ) returning id into v_mid;

  delete from battle_queue where user_id in (v_opp.user_id, p_user_id);

  return jsonb_build_object('status','matched','match_id',v_mid);
end;
$$;

-- ── Start round RPC ───────────────────────────────────────────

create or replace function start_battle_round(
  p_match_id  uuid,
  p_from_round int   -- current round before advancing (optimistic lock)
) returns jsonb language plpgsql security definer as $$
declare
  v_match   record;
  v_next    int;
  v_type    text;
  v_ch      jsonb;
begin
  select * into v_match from battle_matches where id = p_match_id for update;
  if not found then return jsonb_build_object('error','not found'); end if;
  -- Idempotent: already advanced
  if v_match.current_round != p_from_round then
    return jsonb_build_object('status','already_advanced');
  end if;

  v_next := p_from_round + 1;
  if v_next > v_match.total_rounds then
    return jsonb_build_object('error','match complete');
  end if;

  v_type := v_match.round_types[v_next];
  v_ch   := generate_battle_challenge(v_type);

  update battle_matches set
    current_round    = v_next,
    status           = 'active',
    challenge_data   = v_ch,
    round_started_at = now() + interval '3.2 seconds'
  where id = p_match_id;

  return jsonb_build_object('status','ok','round',v_next,'type',v_type);
end;
$$;

-- ── Submit answer RPC ─────────────────────────────────────────

create or replace function submit_battle_answer(
  p_match_id uuid,
  p_user_id  uuid,
  p_answer   text,
  p_time_ms  int
) returns jsonb language plpgsql security definer as $$
declare
  v_match        record;
  v_row          record;
  v_is_p1        bool;
  v_correct      bool;
  v_correct_ans  text;
  v_round_winner uuid;
  v_p1_correct   bool;
  v_p2_correct   bool;
  v_p1_score     int;
  v_p2_score     int;
  v_match_winner uuid;
  v_exp          float;
  v_k            int := 32;
  v_d1           int; v_d2 int;
  v_new_status   text;
begin
  select * into v_match from battle_matches where id = p_match_id for update;
  if not found or v_match.status != 'active' then
    return jsonb_build_object('error','not active');
  end if;

  v_is_p1       := v_match.player1_id = p_user_id;
  v_correct_ans := v_match.challenge_data->>'correct_answer';
  v_correct     := (v_match.challenge_data->>'type' = 'reaction') or
                   (lower(p_answer) = lower(v_correct_ans));

  -- Ensure round result row exists
  insert into battle_round_results (match_id, round_number, round_type, correct_answer)
  values (p_match_id, v_match.current_round, v_match.challenge_data->>'type', v_correct_ans)
  on conflict (match_id, round_number) do nothing;

  -- Record this player's answer (only once)
  if v_is_p1 then
    update battle_round_results
    set player1_answer = p_answer, player1_time_ms = p_time_ms
    where match_id = p_match_id
      and round_number = v_match.current_round
      and player1_answer is null;
  else
    update battle_round_results
    set player2_answer = p_answer, player2_time_ms = p_time_ms
    where match_id = p_match_id
      and round_number = v_match.current_round
      and player2_answer is null;
  end if;

  select * into v_row from battle_round_results
  where match_id = p_match_id and round_number = v_match.current_round;

  -- If both answered, resolve the round
  if v_row.player1_answer is not null and v_row.player2_answer is not null
     and v_row.winner_id is null then

    v_p1_correct := (v_match.challenge_data->>'type' = 'reaction') or
                    (lower(v_row.player1_answer) = lower(v_correct_ans));
    v_p2_correct := (v_match.challenge_data->>'type' = 'reaction') or
                    (lower(v_row.player2_answer) = lower(v_correct_ans));

    if v_p1_correct and not v_p2_correct then
      v_round_winner := v_match.player1_id;
    elsif v_p2_correct and not v_p1_correct then
      v_round_winner := v_match.player2_id;
    elsif v_p1_correct and v_p2_correct then
      -- Both correct — fastest wins
      if v_row.player1_time_ms <= v_row.player2_time_ms then
        v_round_winner := v_match.player1_id;
      else
        v_round_winner := v_match.player2_id;
      end if;
    -- Both wrong: no round winner (v_round_winner stays null)
    end if;

    update battle_round_results set winner_id = v_round_winner
    where match_id = p_match_id and round_number = v_match.current_round;

    v_p1_score := v_match.player1_score + case when v_round_winner = v_match.player1_id then 1 else 0 end;
    v_p2_score := v_match.player2_score + case when v_round_winner = v_match.player2_id then 1 else 0 end;

    -- Check if match is over
    if v_match.current_round >= v_match.total_rounds then
      v_new_status := 'complete';

      if v_p1_score > v_p2_score then
        v_match_winner := v_match.player1_id;
      elsif v_p2_score > v_p1_score then
        v_match_winner := v_match.player2_id;
      end if;

      -- Elo delta
      v_exp := 1.0 / (1 + power(10, (v_match.player2_elo - v_match.player1_elo)::float / 400));
      if v_match_winner = v_match.player1_id then
        v_d1 :=  round(v_k * (1 - v_exp));
        v_d2 :=  round(v_k * (0 - (1 - v_exp)));
      elsif v_match_winner = v_match.player2_id then
        v_d1 :=  round(v_k * (0 - v_exp));
        v_d2 :=  round(v_k * (1 - (1 - v_exp)));
      else  -- draw
        v_d1 :=  round(v_k * (0.5 - v_exp));
        v_d2 :=  round(v_k * (0.5 - (1 - v_exp)));
      end if;

      update battle_matches set
        player1_score   = v_p1_score,
        player2_score   = v_p2_score,
        status          = 'complete',
        winner_id       = v_match_winner,
        player1_elo_delta = v_d1,
        player2_elo_delta = v_d2,
        ended_at        = now()
      where id = p_match_id;

      -- Update battle_profiles (upsert in case first match)
      insert into battle_profiles (user_id, display_name, elo, wins, losses, win_streak, best_streak)
      values (v_match.player1_id, v_match.player1_name, greatest(100, v_match.player1_elo + v_d1),
              case when v_match_winner = v_match.player1_id then 1 else 0 end,
              case when v_match_winner = v_match.player2_id then 1 else 0 end,
              case when v_match_winner = v_match.player1_id then 1 else 0 end,
              case when v_match_winner = v_match.player1_id then 1 else 0 end)
      on conflict (user_id) do update set
        elo        = greatest(100, battle_profiles.elo + v_d1),
        wins       = battle_profiles.wins + case when v_match_winner = battle_profiles.user_id then 1 else 0 end,
        losses     = battle_profiles.losses + case when v_match_winner != battle_profiles.user_id and v_match_winner is not null then 1 else 0 end,
        win_streak = case when v_match_winner = battle_profiles.user_id then battle_profiles.win_streak + 1 else 0 end,
        best_streak= greatest(battle_profiles.best_streak, case when v_match_winner = battle_profiles.user_id then battle_profiles.win_streak + 1 else 0 end),
        updated_at = now();

      insert into battle_profiles (user_id, display_name, elo, wins, losses, win_streak, best_streak)
      values (v_match.player2_id, v_match.player2_name, greatest(100, v_match.player2_elo + v_d2),
              case when v_match_winner = v_match.player2_id then 1 else 0 end,
              case when v_match_winner = v_match.player1_id then 1 else 0 end,
              case when v_match_winner = v_match.player2_id then 1 else 0 end,
              case when v_match_winner = v_match.player2_id then 1 else 0 end)
      on conflict (user_id) do update set
        elo        = greatest(100, battle_profiles.elo + v_d2),
        wins       = battle_profiles.wins + case when v_match_winner = battle_profiles.user_id then 1 else 0 end,
        losses     = battle_profiles.losses + case when v_match_winner != battle_profiles.user_id and v_match_winner is not null then 1 else 0 end,
        win_streak = case when v_match_winner = battle_profiles.user_id then battle_profiles.win_streak + 1 else 0 end,
        best_streak= greatest(battle_profiles.best_streak, case when v_match_winner = battle_profiles.user_id then battle_profiles.win_streak + 1 else 0 end),
        updated_at = now();

    else
      -- Between rounds
      update battle_matches set
        player1_score = v_p1_score,
        player2_score = v_p2_score,
        status = 'result'
      where id = p_match_id;
    end if;

    return jsonb_build_object(
      'both_answered', true,
      'round_winner',  v_round_winner,
      'complete',      v_new_status = 'complete'
    );
  end if;

  return jsonb_build_object('both_answered', false, 'correct', v_correct);
end;
$$;

-- ── Ensure battle profiles init ───────────────────────────────

create or replace function ensure_battle_profile(
  p_user_id uuid,
  p_name    text,
  p_country text default null
) returns jsonb language plpgsql security definer as $$
declare v_row record;
begin
  insert into battle_profiles (user_id, display_name, country)
  values (p_user_id, p_name, p_country)
  on conflict (user_id) do nothing;

  select * into v_row from battle_profiles where user_id = p_user_id;
  return row_to_json(v_row)::jsonb;
end;
$$;
