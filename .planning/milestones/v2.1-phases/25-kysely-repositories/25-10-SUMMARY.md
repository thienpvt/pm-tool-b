---
phase: 25-kysely-repositories
plan: 10
subsystem: database
tags: [kysely, weekly, repository, postgres, tdd, transaction, als]

requires:
  - phase: 25-09
    provides: weekly-periods.repo on getKysely with runInTransaction ALS bridge
provides:
  - weekly-reports.repo.ts fully on getKysely (reads, writes, insertShell)
  - insertShell joins ALS inside createPeriodWithShells (no PoolClient param)
affects: [25-11, weekly-reports.service]

actuals:
  tokens: 12000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "insertShell: getKysely onConflict doNothing; explicit shell defaults for Kysely InsertExpression"
    - "listPeriodShellsRepo: Kysely joins with sql<boolean> for CURRENT_DATE PM assignment filter"
    - "Dynamic draft updates via buildDraftSet + updateTable returning FULL_SHELL_RETURNING"

key-files:
  created: []
  modified:
    - modules/weekly/backend/repositories/weekly-reports.repo.ts
    - modules/weekly/backend/repositories/weekly-reports.repo.test.ts
    - modules/weekly/backend/repositories/weekly-periods.repo.ts

key-decisions:
  - "insertShell drops PoolClient; ALS from withPgTransaction supplies tx Kysely for period+shell atomicity"
  - "Explicit status/latest_version/correction_open on shell insert to satisfy Kysely InsertExpression"
  - "Slice B write functions converted in same file as slice A (single-file repo); TDD gate commits preserved"

patterns-established:
  - "Weekly reports: all exports use getKysely; lockWeeklyReportShell uses forUpdate()"
  - "TDD RED test(25-10) then GREEN feat(25-10) per slice"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "Slice A reads and insertShell use getKysely including ALS in createPeriodWithShells"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/weekly/backend/repositories/weekly-reports.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false
  - id: D2
    description: "insertShell ON CONFLICT prevents duplicate shells per period/project"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/weekly/backend/repositories/weekly-reports.repo.test.ts#UNIQUE (period_id, project_id) prevents duplicate shells"
        status: unknown
    human_judgment: false
  - id: D3
    description: "Slice B draft/version/submit/correction helpers use getKysely"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/weekly/backend/repositories/weekly-reports.repo.test.ts#writes via getKysely"
        status: unknown
    human_judgment: false
  - id: D4
    description: "listPeriodShellsRepo company scoping and PM columns preserved"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/weekly/backend/repositories/weekly-reports.repo.test.ts#listPeriodShellsRepo includes project identity"
        status: unknown
    human_judgment: false

duration: 5min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 10: Weekly Reports Kysely Summary

**weekly-reports.repo.ts fully on getKysely with insertShell joining ALS inside createPeriodWithShells**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-29T01:01:00Z
- **Completed:** 2026-08-29T01:06:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Converted all 16 weekly-reports.repo exports from getDb raw SQL to getKysely query builder
- insertShell no longer takes PoolClient; uses onConflict doNothing on the ALS connection inside createPeriodWithShells
- lockWeeklyReportShell uses Kysely forUpdate(); listPeriodShellsRepo preserves PM assignment join with CURRENT_DATE filter
- weekly-reports.service.ts untouched per D-06

## Task Commits

1. **Task 1 RED: reads kysely mock** - `7d4da0a` (test)
2. **Task 1 GREEN: reads + insertShell** - `2bb6b42` (feat)
3. **Task 2 RED: writes kysely test** - `c75a807` (test)
4. **Task 2 GREEN: writes kysely** - `dccacef` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `modules/weekly/backend/repositories/weekly-reports.repo.ts` - Full Kysely conversion with row mappers
- `modules/weekly/backend/repositories/weekly-reports.repo.test.ts` - testKysely mock, getKysely assertions, draft round-trip
- `modules/weekly/backend/repositories/weekly-periods.repo.ts` - insertShell(periodId, projectId) inside withPgTransaction

## Decisions Made

- Provided explicit shell defaults (status, latest_version, correction_open) on insert because Kysely InsertExpression requires non-defaulted NOT NULL columns
- Slice B write functions shipped in the slice A feat commit (single-file repo); separate TDD test commits preserved gate sequence

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kysely InsertExpression required shell defaults**
- **Found during:** Task 1 GREEN
- **Issue:** insertInto weekly_reports with only period_id/project_id failed TS2345
- **Fix:** Added status 'not_submitted', latest_version 0, correction_open false matching DB defaults
- **Files modified:** modules/weekly/backend/repositories/weekly-reports.repo.ts
- **Committed in:** 2bb6b42

**2. [Rule 3 - Blocking] PM join raw SQL needed boolean generic**
- **Found during:** Task 1 GREEN
- **Issue:** sql\`...\` in leftJoin on clauses failed SqlBool type check
- **Fix:** Used sql<boolean>\`...\` for CURRENT_DATE assignment filters
- **Files modified:** modules/weekly/backend/repositories/weekly-reports.repo.ts
- **Committed in:** 2bb6b42

---

**Total deviations:** 2 auto-fixed (2 blocking type fixes)
**Impact on plan:** Required for compile-time correctness; no behavior change vs SQL defaults.

## Issues Encountered

- Vitest integration tests skipped in CI shell (no TEST_DATABASE_URL); verification status unknown

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- weekly-reports.repo.ts complete on getKysely; ready for 25-11 and downstream repo conversions
- createPeriodWithShells now fully Kysely inside single ALS transaction (period + shells)

## Self-Check: PASSED

- FOUND: modules/weekly/backend/repositories/weekly-reports.repo.ts
- FOUND: modules/weekly/backend/repositories/weekly-reports.repo.test.ts
- FOUND: modules/weekly/backend/repositories/weekly-periods.repo.ts
- FOUND: .planning/phases/25-kysely-repositories/25-10-SUMMARY.md
- FOUND: 7d4da0a
- FOUND: 2bb6b42
- FOUND: c75a807
- FOUND: dccacef

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
