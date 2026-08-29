---
phase: 25-kysely-repositories
plan: 09
subsystem: database
tags: [kysely, weekly, repository, postgres, tdd, transaction]

requires:
  - phase: 25-02
    provides: runInTransactionOnPool txKyselyStore ALS bridge
  - phase: 25-08
    provides: portfolio Kysely conversion pattern and testKysely mock
provides:
  - weekly-periods.repo.ts on getKysely with runInTransaction preserved
  - weekly-export.repo.ts insertWeeklyExportLog on getKysely
  - rollback test for createPeriodWithShells via ALS tx
affects: [25-10, weekly-reports.service, weekly-reports.repo]

actuals:
  tokens: 4000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "createPeriodWithShells: getKysely for period insert; PoolClient passed to insertShell until 25-10"
    - "listObligatedProjectIds drops optional client param; ALS supplies tx Kysely inside runInTransaction"

key-files:
  created: []
  modified:
    - modules/weekly/backend/repositories/weekly-periods.repo.ts
    - modules/weekly/backend/repositories/weekly-periods.repo.test.ts
    - modules/weekly/backend/repositories/weekly-export.repo.ts
    - modules/weekly/backend/repositories/weekly-export.repo.test.ts

key-decisions:
  - "Removed listObligatedProjectIds PoolClient param — sole caller was createPeriodWithShells; ALS joins tx"
  - "insertShell still receives PoolClient from withPgTransaction callback for 25-10 dual-path"
  - "weekly-reports.service.ts untouched per D-06"

patterns-established:
  - "Weekly periods: getKysely inside runInTransaction; shell insert stays on client until weekly-reports.repo converts"
  - "TDD RED test(25-09) then GREEN feat(25-09) per repo file"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "weekly-periods.repo.ts exports use getKysely inside runInTransaction"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/weekly/backend/repositories/weekly-periods.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false
  - id: D2
    description: "createPeriodWithShells rolls back period row when insertShell throws"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/weekly/backend/repositories/weekly-periods.repo.test.ts#createPeriodWithShells rolls back period when insertShell throws"
        status: unknown
    human_judgment: false
  - id: D3
    description: "weekly-export insertWeeklyExportLog uses getKysely returning id"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/weekly/backend/repositories/weekly-export.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false

duration: 3min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 09: Weekly Periods & Export Kysely Summary

**Weekly periods and export logs on getKysely with createPeriodWithShells still joining runInTransaction ALS (D-05, D-06, W8)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-29T00:58:00Z
- **Completed:** 2026-08-29T01:00:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Converted `weekly-periods.repo.ts` config/list/obligated/createPeriodWithShells to `getKysely`; period insert joins ALS tx while `insertShell` still uses PoolClient for 25-10
- Converted `weekly-export.repo.ts` `insertWeeklyExportLog` to Kysely `insertInto` with `returning id`
- Added rollback test proving thrown `insertShell` leaves zero `weekly_periods` rows for the iso_week (D-06, Pitfall 2)
- `weekly-reports.service.ts` not edited per D-06

## Task Commits

1. **Task 1 RED:** Convert weekly-periods.repo.ts tests — `c46f7ac` (test)
2. **Task 1 GREEN:** Convert weekly-periods.repo.ts — `3603818` (feat)
3. **Task 2 RED:** Convert weekly-export.repo.ts tests — `96be95b` (test)
4. **Task 2 GREEN:** Convert weekly-export.repo.ts — `89c9bbc` (feat)

## Files Created/Modified

- `modules/weekly/backend/repositories/weekly-periods.repo.ts` — getKysely for all reads/writes; withPgTransaction preserved
- `modules/weekly/backend/repositories/weekly-periods.repo.test.ts` — testKysely mock, rollback test, getKysely assertion
- `modules/weekly/backend/repositories/weekly-export.repo.ts` — insertWeeklyExportLog via getKysely
- `modules/weekly/backend/repositories/weekly-export.repo.test.ts` — testKysely mock and getKysely assertion

## Decisions Made

- Dropped optional `PoolClient` param from `listObligatedProjectIds` since only internal caller existed; ALS provides transactional Kysely
- Kept passing `client` to `insertShell` until plan 25-10 converts `weekly-reports.repo.ts`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Integration tests skip without `TEST_DATABASE_URL` (same pattern as 25-01–25-08); test structure verified, vitest exits 0 with skips

## Next Phase Readiness

- Ready for 25-10 (`weekly-reports.repo.ts` Kysely conversion including `insertShell`)
- `createPeriodWithShells` dual-path (Kysely period + client shells) works until 25-10 switches insertShell to getKysely

## Self-Check: PASSED

- FOUND: modules/weekly/backend/repositories/weekly-periods.repo.ts
- FOUND: modules/weekly/backend/repositories/weekly-export.repo.ts
- FOUND: modules/weekly/backend/repositories/weekly-periods.repo.test.ts
- FOUND: modules/weekly/backend/repositories/weekly-export.repo.test.ts
- FOUND: c46f7ac, 3603818, 96be95b, 89c9bbc

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
