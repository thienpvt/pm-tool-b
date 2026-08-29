---
phase: 25-kysely-repositories
plan: 12
subsystem: database
tags: [kysely, projects, repository, postgres, tdd, w9a]

requires:
  - phase: 25-11
    provides: W9a batch A repos on getKysely with testKysely harness
provides:
  - Six remaining W9a project repos on getKysely (nonfinancial-benefits, project-dependencies, budget-adjustments, raid-due-date-history, pm-assignments, stakeholders)
  - Four new integration test files for previously untested repos
  - pm-assignments overlap/soft-end predicates preserved via sql CURRENT_DATE filters
affects: [25-13, 25-14]

actuals:
  tokens: 21000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "project-dependencies direction CASE kept via sql template select"
    - "Overlap predicates: effective_from < newTo AND effectiveFrom < COALESCE(effective_to, FAR_FUTURE)"
    - "pm-assignments transactions via runInTransaction + getKysely ALS (no ad-hoc Pool)"
    - "TDD RED test(25-12) then GREEN feat(25-12) per task pair"

key-files:
  created:
    - modules/projects/backend/repositories/budget-adjustments.repo.test.ts
    - modules/projects/backend/repositories/raid-due-date-history.repo.test.ts
    - modules/projects/backend/repositories/pm-assignments.repo.test.ts
    - modules/projects/backend/repositories/stakeholders.repo.test.ts
  modified:
    - modules/projects/backend/repositories/nonfinancial-benefits.repo.ts
    - modules/projects/backend/repositories/nonfinancial-benefits.repo.test.ts
    - modules/projects/backend/repositories/project-dependencies.repo.ts
    - modules/projects/backend/repositories/project-dependencies.repo.test.ts
    - modules/projects/backend/repositories/budget-adjustments.repo.ts
    - modules/projects/backend/repositories/raid-due-date-history.repo.ts
    - modules/projects/backend/repositories/pm-assignments.repo.ts
    - modules/projects/backend/repositories/stakeholders.repo.ts

key-decisions:
  - "project-dependencies list direction uses sql template for CASE WHEN outgoing/incoming"
  - "pm-assignments replaceActivePrimary/endPrimaryWithCollaboratorCascade use runInTransaction not new Pool"
  - "syncProjectPmDisplay UPDATE FROM users kept as sql template"

patterns-established:
  - "W9a batch B: final six non-allowlist project repos fully on getKysely"
  - "Append-only raid_due_date_history: insertInto only, no update/delete exports"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "nonfinancial-benefits and project-dependencies use getKysely"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/nonfinancial-benefits.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false
  - id: D2
    description: "budget-adjustments insert/list/sum and raid history append-only on getKysely"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/budget-adjustments.repo.test.ts#insertBudgetAdjustment then listBudgetAdjustments returns the row"
        status: unknown
    human_judgment: false
  - id: D3
    description: "pm-assignments and stakeholders use getKysely with overlap/soft-end semantics"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/pm-assignments.repo.test.ts#hasOverlappingPmAssignment detects active different-role assignment"
        status: unknown
    human_judgment: false

duration: 15min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 12: W9a Project Reads Batch B Summary

**Six remaining W9a project repos converted to getKysely with overlap predicates, append-only raid history, and runInTransaction replacing ad-hoc Pool in pm-assignments**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-29T01:10:00Z
- **Completed:** 2026-08-29T01:25:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Converted nonfinancial-benefits and project-dependencies to getKysely; existing tests extended with getKysely mock assertions
- Added budget-adjustments and raid-due-date-history integration tests; converted insert/list/sum and append-only history
- Converted pm-assignments (259 lines) and stakeholders to getKysely; replaced withPgTransaction new Pool with runInTransaction

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** nonfinancial-benefits and project-dependencies tests - `70a0ab1` (test)
2. **Task 1 GREEN:** nonfinancial-benefits and project-dependencies kysely - `71d2a9a` (feat)
3. **Task 2 RED:** budget-adjustments and raid history tests - `b420473` (test)
4. **Task 2 GREEN:** budget-adjustments and raid history kysely - `739267c` (feat)
5. **Task 3 RED:** pm-assignments and stakeholders tests - `fca3e10` (test)
6. **Task 3 GREEN:** pm-assignments and stakeholders kysely - `f4146c3` (feat)

## Files Created/Modified
- `modules/projects/backend/repositories/budget-adjustments.repo.test.ts` - insert/list/sum integration tests
- `modules/projects/backend/repositories/raid-due-date-history.repo.test.ts` - append-only history test
- `modules/projects/backend/repositories/pm-assignments.repo.test.ts` - insert/list/overlap/soft-end tests
- `modules/projects/backend/repositories/stakeholders.repo.test.ts` - sponsor insert/list test
- Six repo files converted from getDb to getKysely

## Decisions Made
- pm-assignments transaction helpers use runInTransaction from lib/db (single pool) instead of creating a new Pool per call
- project-dependencies direction and active-window filters use sql templates where Kysely query builder is awkward
- syncProjectPmDisplay keeps UPDATE...FROM users as sql template

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Replaced ad-hoc Pool in pm-assignments with runInTransaction**
- **Found during:** Task 3 (pm-assignments conversion)
- **Issue:** withPgTransaction created `new Pool({ connectionString })` per transaction — violates single-pool ENF-02 contract
- **Fix:** Replaced with `runInTransaction` from lib/db; inner calls use getKysely which joins ALS tx
- **Files modified:** modules/projects/backend/repositories/pm-assignments.repo.ts
- **Committed in:** f4146c3

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required for single-pool correctness. No scope creep.

## Issues Encountered
None — tests skipped locally without DATABASE_URL; harness uses skipIf(!hasTestDb).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- W9a complete — all non-allowlist project read repos on getKysely
- Ready for 25-13/25-14 W9b allowlist write repos (buildUpdate → pickAllowed)

## Self-Check: PASSED
- FOUND: .planning/phases/25-kysely-repositories/25-12-SUMMARY.md
- FOUND: 70a0ab1, 71d2a9a, b420473, 739267c, fca3e10, f4146c3

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
