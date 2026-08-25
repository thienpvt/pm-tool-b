---
phase: 02-repository-layer
plan: 01
subsystem: data
status: complete
requirements: [REPO-02, REPO-03, REPO-04, REPO-05, REPO-06]
provides:
  - repository-substrate
  - column-allowlist-guard
  - allowlist-diff-record
  - repo-test-pattern
tech-stack:
  patterns:
    - "buildUpdate(table, allowlist, fields) throws UnknownColumnError instead of interpolating caller keys"
    - "repositories take projectId as an argument and import only @/lib/db + ./_helpers"
    - "repo tests vi.mock('@/lib/db') to a TestDbClient over the Phase 1 pool — never getDb()"
key-files:
  created:
    - lib/repositories/_helpers.ts
    - lib/repositories/_helpers.test.ts
    - lib/repositories/projects.repo.ts
    - lib/repositories/activities.repo.ts
    - lib/repositories/risks.repo.ts
    - lib/repositories/issues.repo.ts
    - lib/repositories/meetings.repo.ts
    - lib/repositories/team.repo.ts
    - lib/repositories/escalations.repo.ts
    - lib/repositories/ALLOWLIST-DIFF.md
    - lib/api-errors.ts
    - test/repo-db.ts
    - app/api/projects/[id]/route.test.ts
  modified:
    - app/api/projects/[id]/route.ts
    - app/api/projects/[id]/activities/route.ts
    - app/api/projects/[id]/risks/route.ts
    - app/api/projects/[id]/issues/route.ts
    - app/api/projects/[id]/meetings/route.ts
    - app/api/projects/[id]/team/route.ts
    - app/api/projects/[id]/escalations/route.ts
metrics:
  completed: 2026-08-07
  tasks: 4
  commits: 2
---

# Phase 2 Plan 01: Kill Mass Assignment — Summary

The seven `UPDATE ... SET ${Object.keys(body)}` sites are gone. Each of those
resources now has a repository module whose write path is gated by an explicit
column allowlist, and a rejected column returns 400 naming the column instead of
being silently persisted.

## What Was Built

| Requirement | Artifact | Result |
|---|---|---|
| REPO-02 explicit scoping | 7 `*.repo.ts` modules | Every function takes `projectId` as an argument; no session or request type reachable |
| REPO-03 reject unknown columns | `_helpers.ts` `buildUpdate` | Throws `UnknownColumnError` listing *every* offending key; empty field set also rejected (an empty `SET` is invalid SQL) |
| REPO-04 allowlist diff recorded | `ALLOWLIST-DIFF.md` | Per-resource table: column, in CREATE TABLE, added by migration, allowlisted, reason for each exclusion |
| REPO-05 tests | 8 suites, 80 tests | Read, write, and rejected-column cases per resource |
| REPO-06 import discipline | `lib/repositories/` | Only `@/lib/db` and `./_helpers` — verified by grep |

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | exit 0 |
| `npm test` with `TEST_DATABASE_URL` | exit 0 — 80/80 pass, 29/29 suites |
| `npm test` with it unset | exit 0 — 23 pass, 57 skipped cleanly |
| `grep -rn "Object.keys" ` on the 7 routes | no matches |
| `grep -rn "SELECT\|INSERT\|UPDATE\|DELETE FROM"` on the 7 routes | no matches |
| `grep -rln "next/server\|@/lib/auth"` in `lib/repositories/` | no matches |

The tenancy claim is proven at the route level, not just in the repository:
`app/api/projects/[id]/route.test.ts` asserts `PATCH {company_id: 99}` returns
400 **and** re-reads the row to confirm `company_id` is unchanged. Same for
`customer_id`, and for a mixed valid/invalid body (the whole write is refused —
no partial application).

## The REPO-04 Finding That Mattered

Deriving allowlists from `CREATE TABLE` alone would have silently broken saves.
`lib/db.ts` adds columns in `migratePostgresSchema` that are absent from the
create block but *are* written by current handlers:

- `activities`: `project_status`, `parent_id` — both persisted by the current POST
- `projects`: `headcount_quota`, `budget_status`, `objective`, `project_owner`, `budget`, `budget_currency`
- `risks` / `issues`: `priority`, `impact`, `affected_activity_id`
- `team_members`: `email`

All are on the allowlists. `test/repo-db.ts` DDL includes them deliberately, so
an allowlist regression fails a test rather than passing unseen.

## Deviations from Plan

**1. [Rule 1 — Adjustment] `escalation_levels` has no POST or DELETE route**
- The plan specified `createEscalation`/`deleteEscalation`. The route file exports only `GET` and `PUT`.
- Built `listEscalations` + `updateEscalation` only. Writing unused create/delete functions would have been speculative code with no caller.
- Its suite seeds rows directly instead of via a create function.

**2. [Rule 2 — Missing functionality] `lib/api-errors.ts` added**
- The plan said to map `UnknownColumnError` to 400 but named no home for that logic. Putting it in `lib/repositories/` would have broken REPO-06 (`next/server` import).
- One `repoErrorResponse(e)` helper outside the repository directory, used by all 7 routes. Non-`UnknownColumnError` throws keep the existing `String(e)` 500 shape.

**3. [Rule 2 — Missing functionality] `test/repo-db.ts` added**
- Repositories call `getDb()` internally, which runs schema init, the migration loop, and `seedAuthData`. Phase 1 threat #4 forbids that in tests.
- Tests `vi.mock('@/lib/db')` and return a `TestDbClient` over the Phase 1 pool — real Postgres, real SQL, same `?` → `$n` rewrite, no seeding.
- `setupRepoTables()` deliberately does not TRUNCATE: vitest runs files in parallel workers, so each suite isolates itself inside its own `seedProject()` id instead.

**4. [Rule 1 — Adjustment] `buildUpdate` takes the table name but does not use it**
- Kept in the signature for call-site readability and future error messages. Flagged as a latent lint warning rather than dropped, since removing it would churn 7 call sites.

## Bugs Found and Fixed During Execution

- `seedProject` hardcoded `status`, so the activities suite passing `status` in `extra` produced `column "status" specified more than once` — the whole file failed at setup, which surfaced as 8 *skipped* tests and a green-looking 0-failure summary. Fixed by merging rather than concatenating. Worth noting: a suite that fails in `beforeAll` reports as skipped, so "0 failed" alone is not proof.
- `projectAccessRow` LEFT JOINs `customers`, which the test DDL lacked.
- One `buildUpdate` call in `projects.repo.ts` passed 2 of 3 arguments.

## Known Stubs

None. Every function has a caller; every test asserts real behavior against real Postgres.

## Threat Flags

The `company_id`/`customer_id` mass-assignment vector (CONCERNS.md "PATCH project
can rewrite protected columns") is closed for these 7 resources and covered by a
route-level test.

**Still open, by design:** six of these seven routes have no auth check at all
(`activities`, `risks`, `issues`, `meetings`, `team`, `escalations`). This plan
moved SQL and closed mass assignment; it did not add authorization. Any
authenticated caller can still read and write these resources by guessing a
`project_id`. That is Phase 5/6 scope and remains a live IDOR until then.

## Commits

| Task | Commit | Description |
|---|---|---|
| 1–3 | `1cd4921` | allowlist-gated repository substrate for the 7 mass-assignment resources |
| 4 | `5377f45` | rewire 7 routes to repositories, reject unknown columns with 400 |

## Self-Check: PASSED

All 13 created files present on disk; both commit hashes in `git log`.
