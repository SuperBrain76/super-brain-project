# World Cup 2026 — Closure Checklist

**Final:** fixture 104 · 19 July 2026, 20:00 UTC · MetLife Stadium
**Owner:** _unassigned — fill in before the final_
**Rule:** work top to bottom. Do not mark the competition `completed` until every item above it passes.

> Queries below are read-only unless explicitly labelled. Run them in the Supabase SQL editor.
> `:comp` = the `wc2026` competition UUID:
> ```sql
> select id from public.competitions where slug = 'wc2026';
> ```

---

## Pre-final (do these *before* kickoff — 18 July)

### 0.1 — Verify the leaderboard RPC is the tie-break version 🔴 **highest priority**

| | |
|---|---|
| **Mode** | Manual |
| **System** | Postgres — `get_predictor_leaderboard` |
| **Why** | The base definition (`predictor-schema.sql:410`) returns 6 columns. Migrations 014 and 019 replace it with a 7+ column version adding `user_id`, `match_points`, `bonus_points`, `correct_gd`, `correct_results` and the tie-break ordering. The client coalesces missing columns to `0` (`lib/predictor.ts:993–998`) — **so if 019 was never applied, the leaderboard renders happily with every tie-break at zero and the wrong champion at the top.** Migrations are applied by hand; there is no ledger. Verify, do not assume. |

```sql
-- Expect: user_id, match_points, bonus_points, correct_gd, correct_results all present
select p.proname, pg_get_function_result(p.oid) as returns
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_predictor_leaderboard';
```

| | |
|---|---|
| **Failure** | 019 not applied → **emergency change under `PRODUCTION_FREEZE.md` §3.** Apply `019_leaderboard_tiebreak.sql` (idempotent, `create or replace`, read-path only — it changes no stored data). Re-verify. Do this **before** the final, never after the prize is announced. |
| **Reversible** | Yes — `create or replace` back to the prior definition. No data touched. |

### 0.2 — Verify scoring functions match the repository

| | |
|---|---|
| **Mode** | Manual |
| **System** | Postgres — `score_fixture_predictions`, `rescore_fixture` |
| **Why** | `rescore_fixture` may be needed on fixture 104. Confirm the live 5/3/2/0 matrix matches `predictor-schema.sql` **before** relying on it. |

```sql
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('score_fixture_predictions','rescore_fixture','economy_award_fixture');
```

| | |
|---|---|
| **Failure** | Any divergence → stop. Do not rescore anything until understood. Escalate. |
| **Reversible** | n/a — read-only. |

### 0.3 — Take a pre-final backup

| | |
|---|---|
| **Mode** | Manual · Supabase dashboard |
| **Why** | The last clean restore point before the prize-deciding write. Confirm the plan's backup tier — `docs/MIGRATION_HISTORY_ASSESSMENT.md` §5 flags that no restore has ever been tested. |
| **Failure** | No backup capability → **do not proceed with any manual result entry.** Escalate; a hand-typed score with no restore path is an unacceptable risk. |
| **Reversible** | n/a |

---

## 1 — Confirm final fixture identity

| | |
|---|---|
| **Mode** | Manual |
| **System** | Postgres · `/admin/fixtures` |

```sql
select id, fixture_number, stage, kicks_off_at, venue, status,
       home_team_id, away_team_id, home_score, away_score
from public.fixtures
where competition_id = :comp and fixture_number = 104;
```

Expect exactly one row · `stage = 'final'` · `kicks_off_at = 2026-07-19 20:00:00+00` · both teams
non-null after the semi-finals resolve.

| | |
|---|---|
| **Failure** | Duplicate rows → use `/api/admin/audit-duplicates` (already built). Do **not** delete a fixture with predictions attached without checking `predictions.fixture_id` first. Null teams → `advance-knockout` has not propagated; check the semi-final results. |
| **Reversible** | Read-only. |

## 2 — Confirm kickoff time

| | |
|---|---|
| **Mode** | Manual, cross-checked against the provider |
| **System** | `/api/admin/sync-kickoff-times` (1 API call) |
| **Why** | `kicks_off_at` **is** the prediction lock (`enforce_prediction_deadline`). Wrong time = wrong lock. |
| **Failure** | Mismatch → correct **before** kickoff, never after. Moving it later after kickoff would re-open predictions on a played match. |
| **Reversible** | Yes before kickoff; **effectively not** after. |

## 3 — Confirm prediction lock

| | |
|---|---|
| **Mode** | Automated (trigger) — verify manually |
| **System** | `enforce_prediction_deadline` |

```sql
-- After kickoff: expect 0 rows
select count(*) from public.predictions p
join public.fixtures f on f.id = p.fixture_id
where f.fixture_number = 104 and f.competition_id = :comp
  and p.updated_at >= f.kicks_off_at;
```

| | |
|---|---|
| **Failure** | Any row → the trigger is not firing. **Critical.** Verify it exists (`pg_trigger`), escalate, quarantine affected rows before scoring. |
| **Reversible** | Offending predictions can be deleted, but doing so is a judgement call with prize implications — escalate, do not act alone. |

## 4 — Confirm the official result

| | |
|---|---|
| **Mode** | Automated (ingestion) with manual fallback |
| **System** | `ingest-results` → `admin_set_fixture_result` |
| **Rule** | **The 90-minute score only.** `extractScore()` writes `score.fulltime`, so AET and penalties are excluded by design (`lib/ingestion.ts:166–171`). A 1–1 draw settled on penalties is stored **1–1**. Verify against the 90-minute score, not the trophy. |

```sql
select fixture_number, home_score, away_score, status, updated_at
from public.fixtures where competition_id = :comp and fixture_number = 104;
```

| | |
|---|---|
| **Failure** | Ingestion missed it → enter via `/admin/fixtures` (`admin_set_fixture_result`, which fires the trigger). Wrong score entered → correct the score, then `rescore_fixture`. |
| **Reversible** | Yes — re-entering the correct score and rescoring fully converges. |

## 5 — Confirm scoring completed

| | |
|---|---|
| **Mode** | Automated (`auto_score_predictions`) — verify manually |

```sql
-- Expect: unscored = 0
select count(*) filter (where p.points_awarded is null) as unscored,
       count(*) as total,
       count(*) filter (where p.points_awarded = 5) as exact_scores
from public.predictions p
join public.fixtures f on f.id = p.fixture_id
where f.competition_id = :comp and f.fixture_number = 104;
```

| | |
|---|---|
| **Failure** | `unscored > 0` → `select public.rescore_fixture('<fixture-104-uuid>');` |
| **Reversible** | Yes — idempotent. |

## 6 — Re-run scoring safely if required

| | |
|---|---|
| **Mode** | Manual |
| **System** | `rescore_fixture(uuid)` — **not** `rescore_competition` |
| **Why** | `rescore_fixture` recomputes from the stored result and reconciles IQ idempotently. `rescore_competition` loops all 104 and is a last resort. |
| **Failure** | Errors → check `economy_award_fixture` exists. Note the economy call is wrapped in an exception guard (`predictor-schema.sql:283–287`), so an economy failure raises a **warning**, not an error — scoring still succeeds. Check the Postgres logs for warnings; they are easy to miss. |
| **Reversible** | Yes — idempotent by design. |

## 7 — Verify no duplicate scoring or IQ

| | |
|---|---|
| **Mode** | Manual |

```sql
-- 7a — one prediction per user per fixture (unique constraint should guarantee this)
select user_id, fixture_id, count(*)
from public.predictions where fixture_id = '<fixture-104-uuid>'
group by user_id, fixture_id having count(*) > 1;

-- 7b — no duplicate IQ mints for the same fixture
select user_id, event_code, reference_id, count(*)
from public.economy_ledger
where reference_id = '<fixture-104-uuid>'
group by user_id, event_code, reference_id having count(*) > 1;
```

| | |
|---|---|
| **Failure** | 7a rows → the unique constraint is missing in production. Escalate. 7b rows → inspect before correcting; the ledger is append-only, so corrections are **compensating entries**, never deletions. |
| **Reversible** | 🔴 **The ledger is append-only. IQ cannot be un-minted, only offset.** Verify before announcing anything. |

## 8 — Verify the global leaderboard

| | |
|---|---|
| **Mode** | Manual |
| **System** | `get_predictor_leaderboard` · `/predict/leaderboard` |

```sql
select * from public.get_predictor_leaderboard(:comp) limit 20;
```

Confirm: `total_points = match_points + bonus_points` on every row · ranks are dense and ordered ·
the top rows are stable across two consecutive runs.

| | |
|---|---|
| **Failure** | Tie-break columns all zero → **item 0.1 failed**; 019 is not applied. Stop. Do not announce. |
| **Reversible** | Read-only. |

## 9 — Verify private league leaderboards

```sql
select l.id, l.name, count(m.user_id) as members
from public.prediction_leagues l
left join public.prediction_league_members m on m.league_id = l.id
where l.competition_id = :comp and l.visibility = 'private'
group by l.id, l.name order by members desc limit 10;
-- then spot-check the largest:
select * from public.get_league_leaderboard('<league-uuid>');
```

| | |
|---|---|
| **Failure** | Member with no row → `get_league_leaderboard` LEFT JOINs predictions, so a non-predicting member should appear with 0. Absent entirely = investigate. |
| **Reversible** | Read-only. |

## 10 — Verify public / featured league leaderboards

Same as item 9 with `visibility = 'public' or is_featured = true`. Check `suspended = false` for any
league whose result is being published.

## 11 — Verify bonus-question scoring

| | |
|---|---|
| **Mode** | Manual — `/admin/bonus` |
| **Why** | Bonus points are part of `total_points` and therefore of the champion. Six seeded questions (`winner`, `runner_up`, `golden_boot`, `most_goals`, `best_defence`, `surprise_team`) worth 75 points total — **more than 15 exact-score predictions.** These decide the prize. |

```sql
select question_key, status, points_value,
       correct_team_id is not null or correct_answer_text is not null as has_answer
from public.bonus_questions where competition_id = :comp
order by points_value desc;

-- expect 0 unscored answers on answered questions
select q.question_key, count(*) filter (where bp.points_awarded is null) as unscored
from public.bonus_questions q
left join public.bonus_predictions bp on bp.question_id = q.id
where q.competition_id = :comp and q.status = 'answered'
group by q.question_key;
```

| | |
|---|---|
| **Failure** | Question not `answered` → set the answer via `/admin/bonus` (`admin_set_bonus_answer` scores on write). Unscored rows → re-run `admin_set_bonus_answer` with the same answer. |
| **Reversible** | Yes — re-setting the answer rescores. |

## 12 — Verify tie-breaking

| | |
|---|---|
| **Mode** | Manual |
| **Why** | Migration 019 orders: `total_points` → `exact_scores` → `correct_gd` → `correct_results` → `bonus_points`. If the top two are level on points, the prize turns on this. |

```sql
with lb as (select * from public.get_predictor_leaderboard(:comp) limit 10)
select rank, display_name, total_points, exact_scores, correct_gd, correct_results, bonus_points
from lb order by rank;
```

| | |
|---|---|
| **Failure** | Top two identical on **every** column → the schema has no further tie-break. **This is a product decision, not a bug.** Escalate; do not invent a rule silently. |
| **Reversible** | Read-only. |

## 13 — Confirm the grand-prize winner

| | |
|---|---|
| **Mode** | Manual |
| **Why** | **No rewards table exists.** Prizes are static marketing copy (`app/predict/prize/`). The winner is a human decision recorded outside the system. |
| **Failure** | Winner has no valid contact → resolve through support. Do not query `auth.users` casually; treat PII with care and record the decision, not the data. |
| **Reversible** | 🔴 **No.** Once announced, it is announced. Items 1–12 must all pass first. |

## 14 — Export the final leaderboard 🔴 **the Phase 0 reference snapshot**

| | |
|---|---|
| **Mode** | Manual |
| **Why** | **This is the artifact every Competition Engine phase is verified against.** Without it, "we did not change scoring" is an assertion. With it, it is a diff. |

```sql
-- Export to CSV and store outside the database
select * from public.get_predictor_leaderboard(:comp);

-- Per-prediction snapshot — the real reference (no PII: user_id is a UUID)
select p.user_id, f.fixture_number, p.home_score, p.away_score, p.points_awarded
from public.predictions p
join public.fixtures f on f.id = p.fixture_id
where f.competition_id = :comp
order by p.user_id, f.fixture_number;
```

Store as `supabase/snapshots/wc2026-final-leaderboard-2026-07-19.csv` and
`…-predictions-2026-07-19.csv`. **Contains no names, emails or PII** — UUIDs and scores only.

| | |
|---|---|
| **Failure** | Export incomplete → **the freeze does not lift.** This is a hard gate. |
| **Reversible** | n/a — additive. |

## 15 — Record the final result snapshot

```sql
select fixture_number, stage, home_team_id, away_team_id, home_score, away_score, status, kicks_off_at
from public.fixtures where competition_id = :comp order by fixture_number;
```

Store alongside item 14.

## 16 — Back up production

| | |
|---|---|
| **Mode** | Manual |
| **Why** | The pre-Phase-1 restore point. |
| **Failure** | 🔴 **Restore it somewhere and confirm it works.** An untested backup is not a backup — and nothing in this project has ever tested one (`docs/MIGRATION_HISTORY_ASSESSMENT.md` §5). |
| **Reversible** | n/a |

## 17 — Preserve analytics

| | |
|---|---|
| **Mode** | Manual — PostHog |
| **Why** | WC events carry **no competition property** (`lib/analytics.ts` — the Phase 1 gap). Once the Premier League emits the same event names, the two are **indistinguishable forever**. Export or annotate the WC period now. |
| **Failure** | Not exported → WC baselines are permanently unrecoverable. Cheap to do; impossible to undo. |
| **Reversible** | 🔴 No. |

## 18 — Confirm no pending fixtures

```sql
-- expect 0 rows
select fixture_number, stage, status, kicks_off_at
from public.fixtures
where competition_id = :comp and status in ('scheduled','live')
order by fixture_number;
```

| | |
|---|---|
| **Failure** | Rows remain → a match was never ingested (see `docs/FIXTURE_IDENTITY_RISK.md` §4 — an unmatched fixture silently stays `scheduled`). Enter the result manually and rescore. |
| **Reversible** | Yes. |

## 19 — Mark the competition complete — **last**

| | |
|---|---|
| **Mode** | Manual |
| **System** | `competitions.status` |
| **Precondition** | **Every item above passes.** |

```sql
-- WRITE — the only write in this checklist. Items 1–18 first.
update public.competitions set status = 'completed' where slug = 'wc2026';
```

| | |
|---|---|
| **Effect** | Cosmetic only — no trigger, no cascade, no scoring impact. |
| **Failure** | Set too early → set it back. Harmless, but it signals "verified" to everyone downstream, so treat it as the sign-off it is. |
| **Reversible** | Yes — `update … set status = 'active'`. |

## 20 — Disable World Cup ingestion

| | |
|---|---|
| **Mode** | Manual — GitHub Actions UI |
| **Action** | Disable the `ingest-results.yml` workflow |
| **Why** | `isTournamentWindow()` already gates it after `2026-07-20 03:00 UTC` (`lib/ingestion.ts:28`), so it becomes a no-op regardless. Disabling makes it explicit and removes any chance of a stray write during Phase 1. |
| **Reversible** | Yes — re-enable in the UI. |

---

## Sign-off

| Item | Verified by | Date | Notes |
|---|---|---|---|
| 0.1 Leaderboard RPC | | | |
| 0.2 Scoring functions | | | |
| 0.3 Pre-final backup | | | |
| 1–4 Fixture & result | | | |
| 5–7 Scoring & IQ | | | |
| 8–10 Leaderboards | | | |
| 11–12 Bonus & tie-breaks | | | |
| 13 Prize winner | | | |
| 14–15 Snapshots | | | |
| 16 Backup **+ restore tested** | | | |
| 17 Analytics | | | |
| 18 No pending fixtures | | | |
| 19 Marked complete | | | |
| 20 Ingestion disabled | | | |

**Freeze lifts only when this table is fully signed and the conditions in `PRODUCTION_FREEZE.md` §5 are met.**
