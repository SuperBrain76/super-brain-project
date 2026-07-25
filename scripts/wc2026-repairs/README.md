# World Cup 2026 — archived repair endpoints

These were `app/api/admin/*` routes during the World Cup. Each one fixed a
specific, one-off data problem in the `wc2026` competition:

| Route | What it fixed |
|---|---|
| `fix-fixture-96` | A single mis-seeded fixture |
| `fix-sf-direct` | Semi-final team assignments (FRA/ESP, ARG/ENG) |
| `fix-bracket-direct` | Bracket propagation with hardcoded UUIDs |
| `fix-r16-team` | One Round-of-16 team slot |
| `fix-penalty-winners` | SUI 0-0 COL penalty winner, extended to QF |
| `fix-stuck-fixture` | A fixture stuck on `live` after full time |
| `audit-duplicates` | Detected duplicate fixture rows |
| `bracket-status` | Read-only bracket debugging |

## Why they were archived

They were **live HTTP endpoints against production data**, several with
hardcoded UUIDs and narrow authentication, and they have no purpose after
the tournament closed. Leaving them deployed was an unnecessary attack
surface — a security tidy-up, not a refactor.

They are kept rather than deleted because they document exactly what was
repaired and when, which the closure record depends on.

## Do not run these

They target `wc2026` by slug and assume the World Cup's 104-fixture,
`fixture_number`-keyed bracket. Against any other competition they would
assign teams to matches essentially at random.

They also predate the Competition Engine and call `lib/ingestion.ts`
functions whose signatures changed in migration 039 — `fetchFixturesByDate`
and `fetchAllFixtures` now take a competition config, and
`findDbFixtureByKickoff` no longer exists. **They will not compile if moved
back into `app/`**, which is intentional.

If a similar repair is ever needed, write a new competition-aware route.
