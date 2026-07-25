# Migration History Assessment — Phase 0

**Date:** 17 July 2026
**Scope:** assessment only. No repair. Per Phase 0 instructions, remediation is designed here and
executed after the World Cup concludes.

---

## Summary

**Schema management is not under source control in any enforceable sense.** The `supabase/migrations/`
directory is a *collection of SQL files*, not a migration system. Nothing records which of them have
been applied, in what order, or by whom. The repository's claim about production is unverifiable from
inside the repository — which is exactly how `teams.fifa_ranking` came to exist in one and not the
other.

This is the root cause behind the drift report, and it is the thing to fix first after the freeze.

---

## 1. Which migrations have actually been applied to production?

**Unknown, and not currently knowable from this environment.**

There is no evidence of a migration ledger. Specifically:

- No `supabase/config.toml` — the project is **not linked** to the Supabase CLI.
- No Supabase CLI or `psql` available.
- No `supabase/.temp`, no `.branches`, no CLI state of any kind.
- No migration-runner dependency in `package.json` (no `supabase`, no `node-pg-migrate`, no Prisma,
  no Drizzle, no Knex).
- No CI step that applies migrations — `.github/workflows/` contains only cron triggers
  (`ingest-results`, `email-matchday`, `email-standings`, `resend-standings`, `send-social-blast`).
- Vercel builds run `next build` only; deployment does not touch the database.

`scripts/capture-production-schema.sql` block 12 queries `supabase_migrations.schema_migrations`. If
that relation does not exist, the absence of a ledger is confirmed rather than merely inferred.

---

## 2. Are production migrations represented in the repository?

**Partially — and demonstrably not completely.**

Confirmed counter-examples (see `docs/SCHEMA_DRIFT_REPORT.md`):

| Object | In production | In repository |
|---|---|---|
| `teams.fifa_ranking` | Yes (inferred with high confidence) | **No** |
| `get_user_public_predictions` | Unknown | **No** |
| `get_leaderboard_stats` | Unknown | **No** |

One counter-example is enough to establish that the repository is not authoritative. There are three.

The reverse also applies: migrations `032`–`036` exist in the repository but are flagged in handover
notes as still requiring manual application. **Repository presence does not imply production
presence, and production presence does not imply repository presence.** Both directions are broken.

---

## 3. Were changes made manually through Supabase?

**Yes. This is established, not suspected.**

The strongest evidence is in the repository itself — hand-assembled combined files whose only purpose
is manual dashboard execution:

| File | Header |
|---|---|
| `supabase/deploy_economy_021-031.sql` | *"COMBINED DEPLOY (migrations 021–031, in order) … Idempotent & additive. **Paste once, Run.**"* |
| `supabase/deploy_033-034.sql` | same pattern |
| `supabase/deploy_035-036.sql` | same pattern |

Supporting evidence:

- `predictor-schema.sql:5` — *"Run in Supabase Dashboard → SQL Editor after 002_…"*
- Every migration is written defensively idempotent (`create table if not exists`,
  `create or replace function`, `drop policy if exists`). That is the correct style for a system
  where **nobody knows what has already run** — it is a symptom, not a solution.
- Nine `app/api/admin/fix-*` routes exist to repair production data through the application layer,
  with WC UUIDs and bracket corrections baked into code.

The workflow is: write SQL → paste into the dashboard → run → hope. `fifa_ranking` is what happens
when a step is skipped.

---

## 4. Conflicting timestamps or ordering?

**No timestamp conflicts.** Numbering is sequential and unambiguous: `001`–`036`, with one
intentional insert (`005b_get_my_leagues_rpc`). Dependencies are documented in file headers (e.g.
`005b` notes *"Depends on: predictor-schema.sql, 003 (normalized_name), 004 (max_members)"*).

**But ordering is a convention, not a constraint.** Three real ordering hazards exist:

1. **Non-migration files sit outside the sequence.** `predictor-schema.sql`, `schema.sql`,
   `battle-schema.sql` and `matrix-schema.sql` are the actual base schema but carry no number.
   `predictor-schema.sql` says to run it "after `002`" — so the true order is
   `001, 002, predictor-schema, 003, …`, which no tooling encodes and no filename reveals.
2. **Later migrations silently supersede earlier definitions.**
   `get_predictor_leaderboard` is defined in `predictor-schema.sql:410`, then redefined by `014`, then
   again by `019`. Replaying files out of order yields a *working system with the wrong leaderboard* —
   no error, just wrong tie-breaks. Given the grand prize is decided by that ordering, this is the
   most consequential ordering hazard in the repository.
3. **Idempotency masks skipping.** `create table if not exists` cannot tell "already applied" from
   "applied wrong". A skipped `alter table` is invisible forever.

---

## 5. Is there a reliable backup and restore method?

**Unconfirmed — and this is a genuine operational gap.**

- Supabase provides automated daily backups on Pro; PITR requires an add-on. **The project's plan tier
  is not visible from the repository.** `.vercel/project.json` shows a Team org (`team_R3ucBV5zK0…`),
  which implies Vercel Pro; it says nothing about Supabase.
- No backup script, no export tooling, no documented restore procedure anywhere in the repo.
- `docs/DEPLOYMENT.md` describes Vercel deployment and preview builds. It does not mention database
  backup or restore at all.
- **No evidence that a restore has ever been tested.**

Application rollback is solid: Vercel one-click, previously exercised. **Database rollback has no
tested path.** That asymmetry is the core justification for the freeze — the app can be reverted in
seconds; the database cannot be reverted at all.

> **Blocking action before the freeze lifts:** confirm the Supabase plan and backup retention, take a
> manual backup, and **restore it somewhere to prove it works.** An untested backup is not a backup.

---

## 6. Does a staging database exist? Does it match production?

**No evidence of one, and indirect evidence against.**

- Exactly one Supabase URL variable exists in the codebase: `NEXT_PUBLIC_SUPABASE_URL`. There is no
  `_STAGING`, `_DEV`, `_PREVIEW`, or environment-switching logic anywhere.
- `lib/supabase.ts` reads that single variable unconditionally.
- `docs/DEPLOYMENT.md:190` describes Vercel preview deployments for every PR — *"a temporary URL where
  you can test changes without affecting the live site."* **That claim is true of the frontend and
  false of the database.** With one Supabase URL, previews share production.

**Implication, if confirmed:** every preview deployment is a fully functional admin console pointed at
live data. `app/api/admin/set-fixture-result`, `fix-bracket-direct`, `fix-penalty-winners` and the
other repair routes exist on every preview URL. They are protected by the `app_admins` check and
`CRON_SECRET`, so this is not an open door — but it does mean a PR preview can write real results.

**Cannot be confirmed from the repository** (environment variables are configured in the Vercel
dashboard). It is the first question to answer, because it determines whether Phase 1 has any safe
rehearsal target at all.

---

## 7. Recommended remediation — after the World Cup only

Ordered, each step independently safe. **None of this runs during the freeze.**

### Step 1 — Capture the truth
Run `scripts/capture-production-schema.sql` (read-only; safe even during the freeze). Commit the
result as `supabase/schema-production-baseline-2026-07.sql`. This is documentation, never applied.

### Step 2 — Reconcile the repository to reality
Write **one** additive migration (`037_schema_reconciliation.sql`) that declares every object found in
production but missing from the repo — `fifa_ranking`, any undocumented functions — using
`if not exists` / `or replace` so it is a **no-op against production** and a **correction against a
fresh database**. It changes nothing live; it makes the repo true.

### Step 3 — Prove the repo reproduces production
Apply the repository, in documented order, to an empty database. Diff its schema against the captured
baseline. **Iterate until the diff is empty.** This is the acceptance test for the whole exercise —
and the moment the repo becomes trustworthy.

### Step 4 — Adopt the Supabase CLI
`supabase link` the project and adopt `supabase/migrations/` as the CLI's directory. Use
`supabase migration repair` to mark `001`–`036` as already applied, so the ledger reflects history
without re-running anything. From then on, `supabase db push` is the only way schema changes reach
production.

### Step 5 — Fix the ordering hazard
Renumber the unnumbered base files (`predictor-schema.sql` → `000_predictor_schema.sql`, etc.) **or**
document the canonical order explicitly in `supabase/README.md`. Renumbering is cleaner; document-only
is lower-risk. Either is acceptable — leaving it implicit is not.

### Step 6 — Stand up staging
A second Supabase project restored from a production backup. This is the prerequisite for rehearsing
Phase 1's `fixtures` constraint work, which is the riskiest migration in the plan.

### Step 7 — Close the loop
Add a CI check that fails if `supabase/migrations/` changes without a corresponding
`supabase db diff` artifact. Cheap, and it prevents the next `fifa_ranking`.

---

## Risk if not remediated

Phase 1 alters constraints on `fixtures` — the table holding every prediction and the prize-deciding
results. Doing that against a schema nobody has verified, with no tested restore, no staging, and no
record of what has been applied, is not a calculated risk. It is an uncalculated one.

Steps 1–3 are cheap, entirely additive, and change nothing in production. They should complete before
the first Phase 1 migration is written.
