---
phase: 25-kysely-repositories
plan: 02
subsystem: database
tags: [kysely, postgres, allowlist, async-local-storage, transactions]

requires:
  - phase: 25-01
    provides: getKysely factory, txKyselyTarget ALS stub, testKysely harness
provides:
  - pickAllowed runtime allowlist with UnknownColumnError semantics
  - txKyselyStore populated in runInTransactionOnPool
  - Rollback proof test for Kysely inside existing BEGIN block
affects: [25-03, 25-13, 25-14, weekly-repos]

actuals:
  tokens: 2100
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns: [pickAllowed runtime bridge, ephemeral Kysely on PoolClient ALS]

key-files:
  created: [lib/repositories/_kysely-helpers.ts, lib/repositories/_kysely-helpers.test.ts, lib/db-tx.kysely.test.ts]
  modified: [lib/db-tx.ts]

key-decisions:
  - "pickAllowed mirrors buildUpdate UnknownColumnError semantics without duplicating the error class"
  - "Ephemeral Kysely uses transactionalPool adapter with no-op release on the active PoolClient"

patterns-established:
  - "Write repos will call pickAllowed(COLUMNS, fields) before Kysely updateTable.set()"
  - "getKysely() inside runInTransactionOnPool returns ALS-bound Kysely sharing BEGIN with PostgresClient"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "pickAllowed throws UnknownColumnError for unknown keys and returns allowlisted keys in order"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: lib/repositories/_kysely-helpers.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Kysely insert inside runInTransactionOnPool rolls back when callback throws"
    requirement: ENF-02
    verification:
      - kind: integration
        ref: lib/db-tx.kysely.test.ts
        status: unknown
    human_judgment: true
    rationale: "Integration test skipped — TEST_DATABASE_URL not set in executor environment"

duration: 10min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 02: pickAllowed and Transactional Kysely ALS Summary

**Runtime pickAllowed allowlist mirroring UnknownColumnError plus ALS-bound Kysely joining runInTransactionOnPool BEGIN/ROLLBACK**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-29T00:27:00Z
- **Completed:** 2026-08-29T00:29:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `pickAllowed` in `_kysely-helpers.ts` with identical UnknownColumnError semantics to `buildUpdate`
- Mirrored all seven `_helpers.test.ts` cases in `_kysely-helpers.test.ts`
- Populated `txKyselyStore` in `runInTransactionOnPool` via ephemeral Kysely on the active PoolClient
- Added rollback integration test for Kysely insert inside a thrown transaction callback

## Task Commits

Each task followed TDD RED then GREEN:

1. **Task 1: pickAllowed mirrors UnknownColumnError semantics**
   - `b8ab95d` test(25-02): red pickAllowed allowlist
   - `300b5e9` feat(25-02): pickAllowed runtime allowlist
2. **Task 2: Transactional Kysely joins runInTransactionOnPool**
   - `1b878b5` test(25-02): red kysely transaction rollback
   - `c5a2d19` feat(25-02): kysely ALS transaction bridge

## Files Created/Modified

- `lib/repositories/_kysely-helpers.ts` — pickAllowed runtime allowlist for Kysely writes
- `lib/repositories/_kysely-helpers.test.ts` — UnknownColumnError parity tests
- `lib/db-tx.ts` — transactionalPool adapter + txKyselyStore.run nested in txStore.run
- `lib/db-tx.kysely.test.ts` — rollback proof for Kysely inside runInTransactionOnPool

## Decisions Made

- Reused `UnknownColumnError` from `_helpers.ts` rather than duplicating the class
- No-op `release()` on wrapped PoolClient so outer `finally` owns the real release

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `lib/db-tx.kysely.test.ts` skips without `TEST_DATABASE_URL` (same pattern as 25-01 audit integration tests)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- pickAllowed ready for W9b project write repos (25-13, 25-14)
- txKyselyTarget populated — weekly repos can join existing runInTransaction callbacks in Wave 8
- Operator should run `lib/db-tx.kysely.test.ts` with `TEST_DATABASE_URL` ending in `_test` before treating rollback proof as fully verified

## Self-Check: PASSED

- FOUND: lib/repositories/_kysely-helpers.ts
- FOUND: lib/repositories/_kysely-helpers.test.ts
- FOUND: lib/db-tx.kysely.test.ts
- FOUND: b8ab95d
- FOUND: 300b5e9
- FOUND: 1b878b5
- FOUND: c5a2d19

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
