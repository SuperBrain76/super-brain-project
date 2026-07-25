# Email Cron Investigation — Phase 0

**Date:** 17 July 2026
**Question:** are the same email jobs running twice?
**Answer:** **`email-matchday` — yes, almost certainly. `email-standings` — no, saved by an accidental guard.**
**Action taken: none.** Evidence first, per Phase 0 instructions.

---

## Summary

Both email endpoints are registered in **two independent schedulers**. Each endpoint is a single `GET`
handler gated only by a shared bearer token, and Vercel Cron supplies exactly that token
automatically. Neither endpoint has idempotency or send-deduplication.

`email-standings` escapes duplicate sending — not by design, but because a guard intended to prevent
late retries also happens to reject its own GitHub Actions run. That same guard means **the GitHub
Actions standings job has never sent an email**, which is a second, quieter bug.

`email-matchday` has no such guard and no protection of any kind.

---

## Job inventory

### `email-matchday`

| | |
|---|---|
| **Job name** | Email — Match Day Reminder |
| **Handler** | `app/api/cron/email-matchday/route.ts` — `GET`, line 46 |
| **Trigger source 1** | `vercel.json` → `"path": "/api/cron/email-matchday"`, `"schedule": "0 14 * * *"` |
| **Trigger source 2** | `.github/workflows/email-matchday.yml` → `cron: "0 15 * * *"` |
| **Timezone** | Both UTC. Vercel Cron and GitHub Actions are both UTC-only. |
| **Endpoint called** | Identical for both: `GET /api/cron/email-matchday` |
| **Auth** | `if (auth !== "Bearer " + process.env.CRON_SECRET) → 401` (line 47–48) |
| **Idempotency** | **None.** No send ledger, no per-day key, no `force` param, no schedule guard. |
| **Duplicate protection** | **None.** |
| **Effect** | Sends to every user with `email_notifications = true` (line 126–187) |
| **Verdict** | 🔴 **Duplicate send: 14:00 UTC and 15:00 UTC, one hour apart, every day.** |

### `email-standings`

| | |
|---|---|
| **Job name** | Email — Daily Standings |
| **Handler** | `app/api/cron/email-standings/route.ts` — `GET`, line 58 |
| **Trigger source 1** | `vercel.json` → `"schedule": "0 10 * * *"` |
| **Trigger source 2** | `.github/workflows/email-standings.yml` → `cron: "0 23 * * *"` |
| **Trigger source 3** | `.github/workflows/resend-standings.yml` → `workflow_dispatch` only, calls `?force=true` |
| **Timezone** | UTC throughout. Guard comment notes 10:00 UTC = 14:00 UAE (project TZ is Asia/Dubai). |
| **Auth** | Same bearer check (line 61–62) |
| **Idempotency** | None — but see the guard below |
| **Duplicate protection** | **Accidental**, via the send-window guard at line 196–202 |
| **Verdict** | 🟡 **No duplicate. But the 23:00 GHA job is dead code — it always skips.** |

---

## Why `email-standings` does not duplicate

`app/api/cron/email-standings/route.ts:196–202`:

```ts
// Guard: standings cron runs at 10:00 UTC (2pm UAE). Allow up to 45 minutes late to handle
// Vercel delays. Blocks same-day retries that fire outside this narrow window.
const minutesPastSchedule = (now.getUTCHours() * 60 + now.getUTCMinutes()) - (10 * 60);
if (!force && minutesPastSchedule > 45) {
  return NextResponse.json({ skipped: true, reason: "outside send window" });
}
```

Evaluated against each trigger:

| Trigger | Time | `minutesPastSchedule` | `> 45`? | Outcome |
|---|---|---|---|---|
| Vercel Cron | 10:00 UTC | `600 − 600 = 0` | no | ✅ **sends** |
| GitHub Actions | 23:00 UTC | `1380 − 600 = 780` | yes | ⏭️ **skips** |
| `resend-standings` (manual) | any | n/a — `force=true` | bypassed | ✅ sends |

The guard hardcodes 10:00 UTC as *the* schedule. The GitHub Actions job is scheduled at 23:00 with the
comment *"after the last matches of the day finish"* — a deliberate intent that the guard silently
overrides. **The standings email users receive is the 10:00 one, reporting the previous day; the
post-match summary the GHA job was written to send has never gone out.**

Two further notes on the guard:

- It is **one-sided**. A run *before* 10:00 UTC yields a negative value, which is not `> 45`, so it
  sends. Any scheduler firing between 00:00 and 10:45 UTC would duplicate. Nothing currently does.
- It computes wall-clock minutes, so it cannot distinguish "late retry" from "different job".

---

## Do the Vercel crons actually fire?

This is the crux — a duplicate only exists if Vercel's schedule executes and authenticates.
Evidence that it does:

1. **Plan.** `.vercel/project.json` shows `"orgId": "team_R3ucBV5zK0tYabrTO7n3l69S"` — a Team
   account, i.e. Pro. Cron jobs are available. (Even Hobby permits two daily crons; there are exactly
   two, both daily.)
2. **Auth.** Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET`
   is set on the project. It must be set — the same secret gates the ingestion endpoint the GitHub
   Actions workflow calls in production. So Vercel's request **passes** the bearer check.
3. **Method.** Vercel Cron issues `GET`; both handlers export `GET`. Match.
4. **Corroboration.** The standings guard is hardcoded to 10:00 UTC — the *Vercel* schedule, not the
   GHA one. Someone tuned that guard around a Vercel run they observed happening.

Point 4 is the strongest: the codebase contains a workaround shaped around live Vercel cron
behaviour.

**Counter-evidence:** `app/api/cron/ingest-results/route.ts:4` says *"Also accepts Vercel cron format
(GET) if Vercel Pro is ever enabled"* — suggesting the author believed Vercel Cron was unavailable.
That comment predates the `vercel.json` crons and is contradicted by the Team org and by the tuned
guard.

**Conclusion:** duplicate `email-matchday` sends are **highly likely but not directly confirmed.**
Confirmation requires runtime evidence, which is not reachable from the repository.

---

## Evidence needed to confirm (5 minutes, no code)

1. **Vercel → Project → Cron Jobs** — are the two jobs listed and showing recent executions?
2. **Vercel → Logs**, filter `/api/cron/email-matchday` — count invocations in a 24h window.
   Two per day (14:00 and 15:00) with `200 {ok:true, sent:N}` confirms it outright.
3. **Resend dashboard** — two batches of match-day emails per day, one hour apart, same recipients.
   This is the user-visible proof.
4. **Cross-check standings**: expect exactly one send at ~10:00 and a `{skipped:true}` at 23:00.
   That pattern also confirms Vercel crons are live.

---

## Recommendation

### During the freeze: change nothing

Per Phase 0: *"Do not disable a production cron unless duplicate execution is confirmed and the change
is low-risk."* Duplicate execution is **not yet confirmed**, and — more importantly — the impact does
not justify touching production configuration two days before the final.

Worst case if left alone: users receive one redundant match-day email per day, an hour apart, for the
remaining ~2 days. Embarrassing; harmless. It cannot corrupt a result, a leaderboard or the prize.

Worst case if changed now: a scheduler edit during a live final. `vercel.json` changes require a
redeploy, which re-runs the build and re-points the cron registration. A mistake means **no**
match-day email on final day.

**The asymmetry is decisive. Leave it.**

### After the freeze: consolidate onto GitHub Actions

Smallest safe correction, in order:

1. **Confirm** with the runtime evidence above.
2. **Delete the `crons` block from `vercel.json`.** One file, one deploy, trivially revertible.
3. **Fix the standings guard** — it exists only to compensate for double scheduling. With a single
   scheduler, either remove it or drive it from the actual schedule rather than a hardcoded `10 * 60`.
   Note this **changes** which standings email goes out: the 23:00 post-match summary starts working
   for the first time. That is the original intent, but it is a behavioural change and should ship
   deliberately, not as a side effect.
4. **Add real idempotency** before the Premier League. A `sent_emails(job, period_key, sent_at)` table
   with `unique(job, period_key)` makes duplicate sends structurally impossible regardless of how many
   schedulers exist. The pattern already exists in this codebase — `mission_claims` uses exactly this
   shape (`unique(user, mission, period_key)`).

**Why GitHub Actions rather than Vercel:** it already hosts the ingestion job and the manual-dispatch
workflows, it carries a secrets-validation step, its schedules are commented with intent, and it is
visible in source control. `vercel.json` schedules are invisible unless you open the file.

**Why not now:** see above.

---

## Target state — agreed 17 Jul 2026 (Dylan)

To be implemented **immediately after World Cup closure**, before the Premier League.

| Requirement | Implementation |
|---|---|
| **One scheduling system only** | GitHub Actions. Delete the `crons` block from `vercel.json`. |
| **Idempotency key per competition, email type and scheduled period** | `period_key` composed as `{competition_id}:{email_type}:{period}` where `period` is `YYYY-MM-DD` for daily sends. Mirrors the existing `mission_claims` pattern (`unique(user, mission, period_key)`) — proven in this codebase. |
| **Send log with uniqueness constraint** | New `email_sends(id, competition_id, email_type, period_key, user_id, sent_at)` with `unique(competition_id, email_type, period_key, user_id)`. Insert **before** dispatch; a conflict means already sent → skip. Duplicate sends become **structurally impossible** regardless of how many schedulers exist. |
| **No time-of-day guard conflicting with its scheduler** | Delete the hardcoded `10 * 60` guard at `email-standings/route.ts:196–202`. The send log replaces it — and does the job properly, since it keys on identity rather than wall-clock proximity. |
| **Manual resend capability** | Keep `resend-standings.yml` (`workflow_dispatch` + `?force=true`). `force=true` bypasses the send-log check for a deliberate re-send. |

Two consequences worth stating before it ships:

- **The 23:00 post-match standings email starts working** for the first time. That is the original
  intent, but it is a user-visible behavioural change and should ship deliberately.
- **`competition_id` in the key is what makes this survive the Premier League.** Without it, a
  World Cup standings email and a Premier League standings email on the same date collide on
  `period_key` and one gets suppressed. This is the same "only one competition exists" assumption the
  audit found in analytics — worth fixing here before it ships, not after.

---

## Premier League relevance

A 10-month season multiplies this. The World Cup ran ~39 days; the PL runs ~300. At one duplicate per
day that is ~300 unwanted emails per user per season — well past the threshold where recipients mark
mail as spam and the sending domain's reputation suffers. Fixing the scheduler is Phase 1 hygiene;
**adding the idempotency table is the durable fix**, and it is cheap.
