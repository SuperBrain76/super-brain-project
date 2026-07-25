# Bonus Question Settlement — Rules Audit & Required Decisions

**Date:** 17 July 2026
**Status:** read-only audit. Nothing created, published, edited or scored.
**Sources:** `app/predict/rules/page.tsx` (the published contract with users) ·
`supabase/migrations/006_bonus_questions.sql` (the scoring function) ·
`supabase/migrations/017_golden_glove_question.sql`

---

## The headline

**The scoring function accepts exactly one answer per question. It has no concept of a tie.**

`admin_set_bonus_answer(p_question_id, p_team_id, p_answer_text)` — one team UUID *or* one text
string (`006:255-275`). Predictions matching it get full points; everything else gets **0**.

Three of your five unresolved questions can plausibly end in a tie, and **one of them is close to a
coin flip**: Spain and Colombia have both conceded 1, and Spain still has the final to play. If Spain
keeps a clean sheet, they finish level — and there is no rule, published or coded, to separate them.

This is a product decision that cannot be deferred past the final.

---

## Part 1 — What IS published (binding on you)

The rules page is the contract users accepted. Anything here is already promised.

| Rule | Published text | Where |
|---|---|---|
| **90-minute result only** | *"Scoring is based on the 90-minute result only (including injury time). Goals scored in extra time or determined by a penalty shootout are not counted when calculating your prediction score."* | `rules/page.tsx:216-218` |
| **Surprise Team definition** | *"The highest finishing team that was ranked outside the Top 20 in the official Men's World Rankings immediately before the tournament begins."* | `rules/page.tsx:389-393` |
| **Surprise Team tie-break** ✅ | *"Final position is determined by official tournament standings. In the event of a tie, the team with the lower pre-tournament world ranking is selected."* | `rules/page.tsx:395` |
| **Exact-match answers** | *"Team questions require an exact team match. The Golden Boot question requires an exact [player name] match."* | `rules/page.tsx:404` |
| **Automatic scoring** | *"All scoring is automatic once the admin enters the correct answer."* | `rules/page.tsx:406` |
| **Leaderboard tie-break** | exact scores → correct GD → correct results → bonus points → predictions completed. *"If still tied, the prize is shared or settled by a final tie-break question. Sign-up date is not used."* | `rules/page.tsx:454` |
| **Seven questions, 90 points** ⚠️ | *"Seven tournament-wide questions worth up to 90 bonus points"* — table lists Golden Glove at 15 | `rules/page.tsx:336, 348` |

**Surprise Team is the only bonus question with a published tie-break.** It is also the only one
already resolved (Norway). The five that matter have none.

> ⚠️ **The published leaderboard tie-break is migration 019's ordering — which production may not be
> running.** If `scripts/verify-leaderboard-rpc.sql` shows 014 is live, the system is contradicting its
> own published rules on the mechanism that decides the prize. These two investigations are the same
> investigation.

---

## Part 2 — What is NOT published (open decisions)

### 🔴 G1 — Tie handling. No rule. No code support. **Decide before the final.**

| Question | Live risk (your figures) | Tie likelihood |
|---|---|---|
| **Fewest conceded** | Spain 1, Colombia 1 — **Spain still plays the final** | 🔴 **High.** Spain concedes 0 → dead level. |
| **Most goals** | Argentina 19, France 16 — both have one match left | 🟡 Moderate. France needs +3 to level. |
| **Golden Boot** | Messi or Mbappé | 🟡 Moderate. Level top-scorers are common. |

The code cannot express "both". Your options:

1. **Split by a published sub-rule** — e.g. fewest conceded → fewer goals conceded, then fewer matches
   played, then better GD. Golden Boot → FIFA's official criteria (goals, then assists, then fewer
   minutes). **No code change.** You enter one answer and can justify it.
2. **Award both** — run `admin_set_bonus_answer` twice? **This does not work.** The second call
   overwrites the first, setting everyone who picked the first team to 0. **There is no supported way
   to award a tie.** It would need a code change under freeze. Not recommended.
3. **Void the question** — nobody scores, and the points vanish from everyone's ceiling equally.
   Defensible and fair, but it contradicts *"worth up to 90 bonus points"*.

**Recommendation: option 1, using FIFA's own published tie-break criteria**, announced before the
final so it cannot look retrofitted to a result. It needs no code, and it is the rule users would
expect from a football competition.

### 🔴 G2 — Official FIFA statistics, or the app's own data?

**This changes the answers.** The app stores **90-minute scores only** — `extractScore()` writes
`score.fulltime` and never extra-time or shootout goals (`lib/ingestion.ts:166-171`). Official FIFA
team statistics **include extra-time goals**.

So "Argentina 19 goals" may mean two different numbers depending on the source. The published
90-minute rule (`rules/page.tsx:216`) is explicitly scoped to *"calculating your prediction score"* —
it says nothing about bonus questions.

- **Own data (90-min)** — internally consistent, verifiable in SQL, matches the match-scoring rule.
- **Official FIFA** — matches what users see on TV and will compare against.

**Recommendation: official FIFA statistics**, because these questions name FIFA awards ("Golden Boot",
"Golden Glove") and users will settle the argument with a FIFA page, not your database. **But publish
the choice before the final**, and be aware it may contradict your own standings page.

### 🟡 G3 — Do own goals count?

Not published. FIFA convention: own goals count toward the **team's** goals scored, never toward a
player. Affects *most goals* and *fewest conceded*. **Recommendation: follow FIFA convention** — it
falls out of G2 automatically if you adopt official stats.

### 🟡 G4 — Does the third-place play-off count?

Not published. **This is live**: France's remaining match is the play-off, and it is their only route
to catching Argentina's 19. **Recommendation: yes — it is a tournament match**, and excluding it would
be a silent retrofit that decides the question. Falls out of G2 if you adopt official stats.

### 🟡 G5 — Golden Glove selection criteria

Not published beyond *"Best goalkeeper"* (`rules/page.tsx:348`). The real FIFA award is voted by the
Technical Study Group — **not** a clean-sheet count. **Moot if migration 017 was never applied** (see
below) — but decide it before any future competition reuses the question.

### 🟢 G6 — Extra time and abandoned matches

Already covered. ET/shootout goals are excluded from **prediction scoring** by published rule and by
`extractScore()`. For **bonus stats**, this collapses into G2. No abandoned matches remain — only the
play-off and the final are outstanding.

---

## Part 3 — Golden Glove diagnosis

**A question exists in the repo (`017_golden_glove_question.sql`) and is almost certainly absent from
production.**

Answering each of your eight questions:

| # | Question | Answer |
|---|---|---|
| 1 | Does it exist in production? | **Almost certainly not.** Run `scripts/audit-bonus-questions.sql` Block 2 to confirm. |
| 2 | If yes, why not visible? | **It cannot be hidden.** RLS is `USING (true)` (`006:47-49`); `getBonusQuestions()` applies no status filter (`lib/predictor.ts:1057-1073`); the page maps every returned row and falls back to a `❓` icon for unknown keys (`bonus/page.tsx:106`). And `golden_glove` **is** already registered in `BONUS_META` (`bonus/page.tsx:35`). **If the row existed, it would render.** It is not rendering, so the row is not there. |
| 3 | Visible earlier, then hidden? | **No mechanism exists to hide it.** There is no `published`/`hidden` column — see below. |
| 4 | Did users submit predictions? | **Cannot have.** `bonus_predictions.question_id` is an FK to `bonus_questions`; with no question row, no prediction can exist. Block 3 confirms. |
| 5 | Is it in the scoring function? | **Yes, generically.** `admin_set_bonus_answer` is key-agnostic — it would score `golden_glove` the moment the row and an answer existed. No code change needed. |
| 6 | Would publishing now allow late predictions? | **No.** `locks_at = competitions.starts_at = 2026-06-11 20:00 UTC` — five weeks past. `upsert_bonus_prediction` rejects at the DB level once `now() >= locks_at`, regardless of status (`006:31-34`). Nobody could answer it, including you. |
| 7 | Has its lock deadline passed? | **Yes** — 11 June 2026, at the tournament's first kick-off. |
| 8 | Duplicated as "Best Goalkeeper"? | **No sign of it.** `UNIQUE(competition_id, question_key)` prevents a `golden_glove` duplicate; Block 2 searches text and key for glove/keeper/goalie variants. |

### Root cause

**Migration 017 was never applied to production** — the same failure mode as `teams.fifa_ranking` and
the leaderboard RPCs. This is now the **third confirmed instance**: migrations pasted into the SQL
editor by hand, no ledger, and a silent gap between the repo and reality.

The arithmetic corroborates it exactly:

- Migration 006 seeds **6** questions: 20 + 15 + 10 + 10 + 10 + 10 = **75 points**
- Migration 017 adds Golden Glove at **15**
- 75 + 15 = **90** — precisely what the rules page advertises

You are seeing 6 questions because production has 6 questions.

### Fairness assessment — the important part

**No user was advantaged or disadvantaged.** Golden Glove never appeared for anyone, so nobody could
answer it. Every player competed for the same 75 points. **The leaderboard is not distorted and the
prize is not tainted.**

The defect is a **published-rules discrepancy**: users were told 90 points across 7 questions and only
75 across 6 were ever available.

### Recommendation: **do not apply migration 017.**

Applying it now would insert a question that:

- appears immediately (nothing can hide it),
- is permanently locked (deadline passed five weeks ago),
- has **zero** predictions and can never have any,
- is worth 15 points **nobody can win**,
- and changes not a single leaderboard position.

It converts an invisible discrepancy into a visible, unanswerable question on the prize page, two days
before the final. **Strictly worse.**

**Do instead:** after closure, correct the rules page to 6 questions / 75 points, and decide whether to
tell users. My recommendation is to say something brief — the discrepancy is discoverable, nobody lost
out, and explaining it costs far less than being asked about it later.

---

## ⚠️ Fields in your request that do not exist

Three of the attributes you asked me to confirm are not in the schema. `bonus_questions` has exactly
(`006:22-40`): `id`, `competition_id`, `question_key`, `question_text`, `points_value`, `answer_type`,
`status`, `locks_at`, `correct_team_id`, `correct_answer_text`, `created_at`.

| You asked for | Reality |
|---|---|
| **Published/hidden status** | **Does not exist.** No publish concept anywhere. RLS `USING (true)`, no client filter. Every row is public, always. **This is why "why is it hidden?" has no answer — nothing can be hidden.** |
| **Display order** | **Does not exist.** Order is derived: `points_value DESC` (`lib/predictor.ts:1070`). |
| **Active/inactive status** | Closest is `status` (`open`/`locked`/`answered`) — but it does **not** gate visibility, only `locks_at` gates submission. |

Worth registering for the Competition Engine: **"admin-configurable bonus questions" implies a
publish/hide flag and a display order that do not exist today.** Both belong in Phase 1's
`competition_settings` work, not here.

---

## Part 4 — Deliverable F: exact settlement order

Order is forced by data dependencies. **Do not reorder.** Every step is in
`docs/WORLD_CUP_CLOSURE_CHECKLIST.md`.

### Before the final

| # | Step | Why |
|---|---|---|
| 0 | **Run `scripts/verify-leaderboard-rpc.sql`** | If 014 is live, tie-breaks are not applied and the published rule is not being honoured. **Fix this before the prize is decided, not after.** |
| 1 | **Decide G1 and G2. Publish them.** | Announcing a tie-break *after* seeing a tie is indefensible. Announcing it before is just rules. |
| 2 | **Run `scripts/audit-bonus-questions.sql` Blocks 1–3** | Confirm the Golden Glove diagnosis. Confirm 6 questions / 75 points. |
| 3 | **Pre-final backup** | Checklist item 0.3. |

### Match scoring — matches first, always

| # | Step | Why |
|---|---|---|
| 4 | **Third-place play-off (#103)** — result → verify scored | France's goal total depends on it (G4). |
| 5 | **Final (#104)** — result → verify scored | Decides winner, runner-up, and Spain's conceded total. |
| 6 | **Verify no duplicate scoring or IQ** | Checklist items 5–7. Do this before bonus, so any anomaly is isolated to matches. |
| 7 | **Confirm zero pending fixtures** | Checklist item 18. **Bonus totals are wrong if any match is unscored.** |

### Bonus scoring — only once every match is final

| # | Question | Depends on |
|---|---|---|
| 8 | `winner` (20) | Final result |
| 9 | `runner_up` (10) | Final result |
| 10 | `most_goals` (10) | **Both** #103 and #104 — apply G2, G3, G4 |
| 11 | `best_defence` (10) | **Both** #103 and #104 — apply G1 (**tie likely**), G2, G3 |
| 12 | `golden_boot` (15) | Tournament complete — apply G1, G2 |
| 13 | `surprise_team` (10) | ✅ Already resolved (Norway) |

> **Steps 8–12 must not begin before step 7 passes.** `most_goals` and `best_defence` are computed
> from goal totals that the final itself changes. Scoring them early bakes in a wrong answer — and
> although `admin_set_bonus_answer` is re-runnable, a visibly changing leaderboard between the final
> whistle and the announcement is exactly the kind of thing that erodes trust in a prize.

### Determination

| # | Step |
|---|---|
| 14 | Verify global leaderboard — **`total_points = match_points + bonus_points`** on every row |
| 15 | Verify tie-breaks resolve the top — if fully tied, that is decision **G7** below |
| 16 | Verify league leaderboards |
| 17 | **Confirm the champion** — irreversible once announced |
| 18 | Export the snapshot (checklist item 14) — the Phase 1 reference |
| 19 | Backup + restore test · mark competition `completed` |

---

## Part 5 — SETTLEMENT POLICY (DECIDED — Dylan, 17 Jul 2026)

**Governing principle: official FIFA sources, not our database.** Where FIFA publishes an award or a
statistic, that is the answer. We do not independently calculate.

| Q | Source | Rule |
|---|---|---|
| **winner** (20) | Official FIFA tournament winner | — |
| **runner_up** (10) | Official FIFA runner-up | — |
| **golden_boot** (15) | **Official FIFA Golden Boot award**, including FIFA's own tie-break criteria | **Do not calculate from our DB.** FIFA's criteria (goals → assists → fewer minutes) resolve it. |
| **most_goals** (10) | **Official FIFA tournament statistics** | Count **all** goals in official matches: group, knockout, **third-place play-off**, **extra time**, and **own goals credited to the team score**. **Penalty shootout kicks do NOT count.** |
| **best_defence** (10) | **Official FIFA tournament statistics** | Goals conceded across all official matches incl. **play-off** and **extra time**. **Shootout kicks do NOT count.** **If tied → do not select an answer.** First establish whether FIFA publishes an official statistical ranking. If not → stop, report, recommend (Part 6). |
| **surprise_team** (10) | Published rule (`rules/page.tsx:395`) | Highest finisher ranked outside pre-tournament Top 20; tie → lower pre-tournament ranking. **Confirm Norway against the underlying data before scoring.** |
| **golden_glove** | ❌ **Excluded** | Not available for users to predict. Not introduced, not awarded. Final prize uses **only questions users could predict**. |

### Consequences to note

- **This policy diverges from our own stored data — deliberately.** `extractScore()` stores
  90-minute scores only (`lib/ingestion.ts:166-171`), so `fixtures.home_score`/`away_score` **exclude
  extra-time goals**. Official FIFA totals include them. **Our standings page and the bonus answers may
  therefore disagree**, and that is expected. Do not "fix" one to match the other.
- **Maximum achievable bonus is 75, not the advertised 90.** Golden Glove was never available. Record
  this; do not change the advertised maximum silently (`G8`).
- **No retroactive rules.** Any tie-break must be published *before* the final. A rule announced after
  the tie is not a rule.

---

## Part 6 — Tied-answer options (assessment only — nothing implemented)

**Applies when:** multiple answers are objectively correct **and** FIFA publishes no official
resolution **and** no published tie-break exists. **Live risk: `best_defence` — Spain 1, Colombia 1,
Spain still plays the final.**

> **Stop condition (agreed):** if this triggers, report the tied teams and the affected users
> **before** scoring. Do not choose the answer that produces a preferred winner.

### ✅ Finding that de-risks all three options: **bonus scoring mints no IQ**

`bonus_score` exists in `economy_event_types` (`021:425`) but **nothing emits it**.
`admin_set_bonus_answer` contains zero economy references; there is **no trigger on
`bonus_predictions`**. Bonus points affect the **leaderboard only**.

**IQ implication for every option below: none.** The append-only ledger — the one truly irreversible
system — is not involved.

| | **Option 1 — multi-answer support** | **Option 2 — manual award** | **Option 3 — void question** |
|---|---|---|---|
| **DB changes** | Add `bonus_questions.correct_team_ids uuid[]` (nullable, additive). Modify `admin_set_bonus_answer` to score `answer_team_id = ANY(...)`. Keep `correct_team_id` populated with one value for client display → **no client change needed.** | **None.** Direct `UPDATE bonus_predictions SET points_awarded = 10 WHERE question_id = X AND answer_team_id = <second team>`. | **None.** `UPDATE bonus_questions SET status='answered', correct_team_id=NULL` + `UPDATE bonus_predictions SET points_awarded=0 WHERE question_id=X`. |
| **Double-scoring risk** | 🟢 **None.** `points_awarded` is SET, not incremented, by one UPDATE per question. Idempotent. | 🔴 **High — and silent.** `admin_set_bonus_answer` overwrites **all** predictions for the question. **Any future re-run, including an innocent "set answer" click, reverts the manual award to 0.** | 🟢 None. Everyone gets 0. |
| **IQ** | 🟢 None | 🟢 None | 🟢 None |
| **Leaderboard** | Both answer groups gain 10. Correct and fair. | Correct **until** something rescores. | 10 removed from every ceiling equally. No user advantaged. |
| **Auditability** | 🟢 **High.** The answer set is stored. The DB explains itself. | 🔴 **Low.** DB says `correct_team_id = A`, yet B's pickers hold points. Nothing records why. A later rescore silently "corrects" it back to wrong. | 🟡 Legible **if documented** — `status='answered'` + `correct_team_id IS NULL` reads as void. |
| **Rollback** | Re-run with a single-element array; drop the column. Additive → reversible. | Re-run `admin_set_bonus_answer`. | Re-run with a real answer. |
| **Compatibility** | 🟡 One RPC + one additive column. Client untouched (displays one of the tied teams). | 🟢 Works today — 🔴 **and is undone by the existing code.** | 🟢 Fully compatible. |
| **Verdict** | **Fairest. Moderate risk.** | **Do not use.** Works now, lands a landmine. | **Safest. Least fair** — punishes users who correctly picked a genuinely joint-best team. |

### Recommendation

**First, try to make the tie disappear.** FIFA publishes official tournament statistics with rankings.
If FIFA resolves it, there is no tie and no option is needed. **That is the outcome to pursue.**

**If FIFA gives no resolution** (likely for `best_defence` — FIFA awards no "best defence" trophy):

> **Option 1**, scoped to the additive column + the one RPC. It is the only option that is
> simultaneously **fair** (both correct answers score), **auditable** (the DB records the tie), and
> **idempotent** (immune to re-scoring). With no IQ involved and no client change, its true blast
> radius is one function on the read/scoring path — and it can be rehearsed before the final because
> the tie is predictable *now*.

**Option 2 is disqualified**, not merely discouraged: it is silently reverted by the system's own admin
tooling. That is a defect waiting to surface after the prize is announced.

**Option 3 is the fallback** if you judge any code change unacceptable during the freeze. It is
defensible and provably fair-to-all, but it contradicts the advertised points and penalises correct
predictions.

---

## Part 7 — Post-final settlement checklist (agreed order)

Every step is read-only unless marked **WRITE**. Do not reorder.

| # | Step | Instrument |
|---|---|---|
| 1 | Complete and verify **third-place play-off (#103)** scoring | `/admin/fixtures` **WRITE** → checklist items 4–5 |
| 2 | Complete and verify **final (#104)** scoring | `/admin/fixtures` **WRITE** → checklist items 4–5 |
| 3 | Confirm all fixture scoring jobs completed **exactly once** | Closure checklist item 5 |
| 4 | Confirm **no duplicate IQ awards** | Closure checklist item 7b |
| 5 | Confirm **no unresolved or pending fixtures** | Closure checklist item 18 |
| 6 | **Obtain official FIFA awards + team statistics** | External. Screenshot/archive the source — it is the settlement evidence. |
| 7 | Resolve every bonus question against Part 5 | Desk work, no DB |
| 8 | 🔴 **Identify any tied-answer problem BEFORE scoring** | Part 6 stop condition. **If tied → stop and report.** |
| 9 | Score bonus questions | `/admin/bonus` **WRITE** |
| 10 | Verify bonus points by user | `audit-bonus-questions.sql` Block 1 |
| 11 | Calculate final leaderboard using the **published** tie-break order | `verify-leaderboard-rpc.sql` Block 4 |
| 12 | Compare **current production** ordering vs **intended** ordering | Blocks 3 vs 4 |
| 13 | Correct the leaderboard RPC **only if required** | `PROPOSED-019b` **WRITE** — approval required |
| 14 | Verify global, public-league and private-league rankings | Closure items 8–10 |
| 15 | **Freeze and export** the final leaderboard | Closure item 14 — the Phase 1 reference |
| 16 | **Confirm prize winner** | Irreversible |
| 17 | Back up the database **+ test the restore** | Closure item 16 |
| 18 | **Record the settlement methodology** | This document + the FIFA sources from step 6 |

> **Steps 1–5 must fully pass before step 7.** `most_goals` and `best_defence` depend on goal totals
> that the play-off and final change. Step 8 is a **hard stop**, not a checkpoint.

---

## Part 8 — Decisions still required

| # | Decision | Deadline | Blocks |
|---|---|---|---|
| **G1** | **Tie rule for fewest-conceded, most-goals, Golden Boot.** No published rule, no code support. **Fewest conceded is close to a coin flip.** | **Before the final** | Steps 10–12 |
| **G2** | **Official FIFA statistics or the app's 90-minute data?** They give different answers. | **Before the final** | Steps 10–12 |
| **G3** | Own goals count? (Falls out of G2.) | Before the final | Step 10, 11 |
| **G4** | Third-place play-off counts? **Live — it is France's only route.** (Falls out of G2.) | **Before the final** | Step 10 |
| **G5** | Golden Glove criteria | Moot if 017 unapplied | Future competitions |
| **G6** | **Apply migration 017?** My recommendation: **no.** | Before the final | — |
| **G7** | **If the top two are fully tied on all six tie-break columns** — the rules say *"shared or settled by a final tie-break question"*. **Which?** There is no tie-break question in the database. | Before announcing | Step 17 |
| **G8** | Correct the rules page 90 → 75, and do you tell users? | After closure | — |

**G1, G2 and G4 are the urgent three.** All three are announcements, not code — no freeze exception is
needed for any of them. But they must be published **before** the final, because a tie-break rule
announced after the tie is not a rule, it is a choice.
