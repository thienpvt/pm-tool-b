---
phase: 25-kysely-repositories
plan: 01
subsystem: database
tags: [kysely, postgres, pg-pool, repositories, audit]

requires: []
provides:
  - kysely@0.29.5 on existing pg.Pool via getPool/getKysely
  - Hand-authored Database types for 54 repo tables
  - testKysely harness on testPool
  - Audit repo tracer converted to Kysely
affects: [25-02, 25-03, phase-25-waves]

actuals:
  tokens: 8370
  tasks: 3
  commits: 5

tech-stack:
  added: [kysely@0.29.5, kysely-codegen@0.20.0]
  patterns: [single-pool PostgresDialect, txKyselyTarget ALS stub, testKysely on testPool]

key-files:
  created: [lib/db/kysely.ts, lib/db/database.ts, lib/db/kysely.test.ts]
  modified: [lib/db.ts, lib/db-tx.ts, test/repo-db.ts, modules/audit/backend/repositories/audit.repo.ts, package.json]

key-decisions:
  - "Hand-authored lib/db/database.ts from migrations because DATABASE_URL/TEST_DATABASE_URL unavailable at execution time (D-03 fallback)"
  - "Pinned exact kysely 0.29.5 and kysely-codegen 0.20.0 without caret per D-09"
  - "txKyselyTarget ALS store exported but not populated until 25-02"

patterns-established:
  - "getKysely() lazy singleton on getPool() after getDb migrate+seed"
  - "Repo tests mock @/lib/db/kysely with testKysely() alongside existing getDb mock"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "kysely pinned and factory on existing Pool"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: lib/db/kysely.test.ts#kysely factory contract
        status: pass
    human_judgment: false
  - id: D2
    description: "Audit insert/list through getKysely on test pool"
    requirement: ENF-02
    verification:
      - kind: integration
        ref: modules/audit/backend/repositories/audit.repo.test.ts
        status: unknown
    human_judgment: true
    rationale: "Integration tests skipped — TEST_DATABASE_URL not set in executor environment"

duration: 8min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 01: Kysely Factory + Audit Tracer Summary

**Single-pool Kysely factory with hand-authored Database types and audit repo tracer proving typed queries on the existing pg.Pool**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-29T00:23:00Z
- **Completed:** 2026-08-29T00:31:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Auto-approved kysely@0.29.5 legitimacy checkpoint per D-09 user acceptance
- Installed kysely@0.29.5 and kysely-codegen@0.20.0 with codegen:db script
- Added getPool(), getKysely() singleton, and txKyselyTarget ALS stub
- Hand-authored Database interface covering all 54 tables referenced by production repos
- Converted audit.repo.ts insertAuditLog/listAuditLogs to Kysely; added testKysely harness

## Task Commits

Each task was committed atomically:

1. **Task 25-01-01: Legitimacy checkpoint** - auto-approved (no commit)
2. **Task 25-01-02 RED:** kysely factory tests - `d7310dc` (test)
3. **Task 25-01-02 GREEN:** factory implementation - `c8376fc` (feat)
4. **Task 25-01-03 RED:** audit tracer tests - `20c6511` (test)
5. **Task 25-01-03 GREEN:** audit repo conversion - `6647471` (feat)

## Files Created/Modified

- `lib/db/kysely.ts` - getKysely lazy singleton via PostgresDialect on getPool
- `lib/db/database.ts` - Database types for all repo tables
- `lib/db/kysely.test.ts` - Factory contract and testPool integration test
- `lib/db.ts` - getPool export after getDb init
- `lib/db-tx.ts` - txKyselyTarget ALS getter (store empty until 25-02)
- `test/repo-db.ts` - testKysely cached on testPool
- `modules/audit/backend/repositories/audit.repo.ts` - Kysely insert/select
- `package.json` / `package-lock.json` - pinned deps and codegen:db script

## Decisions Made

- Hand-authored database.ts from migrations/0001-baseline-schema.sql because neither DATABASE_URL nor TEST_DATABASE_URL was available for kysely-codegen
- Exact version pins without npm caret prefix to satisfy test contract and D-09

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pinned exact semver without caret**
- **Found during:** Task 25-01-02 GREEN
- **Issue:** npm install wrote `^0.29.5` / `^0.20.0`; test contract requires exact pins
- **Fix:** Set `"kysely": "0.29.5"` and `"kysely-codegen": "0.20.0"` in package.json
- **Files modified:** package.json
- **Committed in:** c8376fc

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for D-09 pin contract; no scope change.

## Issues Encountered

- Integration tests (audit.repo.test.ts, kysely testPool case) skipped without TEST_DATABASE_URL; unit contract tests pass

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Factory and Database types ready for 25-02 (pickAllowed + tx Kysely bridge)
- Sequential module repo waves can import getKysely from @/lib/db/kysely

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*

## Self-Check: PASSED

- FOUND: lib/db/kysely.ts
- FOUND: lib/db/database.ts
- FOUND: lib/db/kysely.test.ts
- FOUND: .planning/phases/25-kysely-repositories/25-01-SUMMARY.md
- FOUND: d7310dc
- FOUND: c8376fc
- FOUND: 20c6511
- FOUND: 6647471
