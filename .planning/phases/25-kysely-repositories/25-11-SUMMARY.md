---
phase: 25-kysely-repositories
plan: 11
subsystem: database
tags: [kysely, projects, repository, postgres, tdd, w9a]

requires:
  - phase: 25-10
    provides: weekly-reports.repo on getKysely with tx ALS bridge
provides:
  - Six W9a project read repos on getKysely (budget, bugs, documents, holidays, financial-benefits, milestones)
  - milestone_epics link/unlink via onConflict doNothing
  - All six repo tests mock testKysely with getKysely called assertions
affects: [25-12, 25-13, 25-14]

actuals:
  tokens: 16000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Non-allowlist repos: getKysely selectFrom/insertInto/updateTable/deleteFrom"
    - "Complex dashboard lists: sql template for COALESCE joins (milestones upcoming/overdue)"
    - "milestone_epics: onConflict columns doNothing replaces INSERT OR IGNORE"
    - "TDD RED test(25-11) then GREEN feat(25-11) per task pair"

key-files:
  created: []
  modified:
    - modules/projects/backend/repositories/budget.repo.ts
    - modules/projects/backend/repositories/budget.repo.test.ts
    - modules/projects/backend/repositories/bugs.repo.ts
    - modules/projects/backend/repositories/bugs.repo.test.ts
    - modules/projects/backend/repositories/documents.repo.ts
    - modules/projects/backend/repositories/documents.repo.test.ts
    - modules/projects/backend/repositories/holidays.repo.ts
    - modules/projects/backend/repositories/holidays.repo.test.ts
    - modules/projects/backend/repositories/financial-benefits.repo.ts
    - modules/projects/backend/repositories/financial-benefits.repo.test.ts
    - modules/projects/backend/repositories/milestones.repo.ts
    - modules/projects/backend/repositories/milestones.repo.test.ts

key-decisions:
  - "budget _syncActualAmount uses sql subquery in updateTable.set for expense sum"
  - "milestones listUpcoming/listOverdue kept as sql templates for COALESCE ordering"
  - "linkEpic uses onConflict doNothing on (milestone_id, activity_id)"

patterns-established:
  - "W9a batch A: six non-allowlist project repos fully on getKysely"
  - "Test harness: vi.mock getKysely + loads-via-getKysely assertion per repo file"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "budget.repo.ts uses getKysely for items, expenses, and actual_amount sync"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/budget.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false
  - id: D2
    description: "bugs.repo.ts uses getKysely for snapshot CRUD and replaceSnapshot"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/bugs.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false
  - id: D3
    description: "documents.repo.ts and holidays.repo.ts use getKysely"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/documents.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false
  - id: D4
    description: "financial-benefits.repo.ts preserves NUMERIC coercion via getKysely"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/financial-benefits.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false
  - id: D5
    description: "milestones.repo.ts including milestone_epics link/unlink uses getKysely"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/milestones.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false

duration: 2min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 11: W9a Project Reads Batch A Summary

**Six non-allowlist project repositories (budget, bugs, documents, holidays, financial-benefits, milestones) query through getKysely with testKysely mocks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-29T01:06:00Z
- **Completed:** 2026-08-29T01:08:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Converted budget.repo.ts and bugs.repo.ts to getKysely (items, expenses, snapshot replace)
- Converted documents.repo.ts and holidays.repo.ts to getKysely (CRUD with project_id scoping)
- Converted financial-benefits.repo.ts and milestones.repo.ts to getKysely (NUMERIC benefits, milestone_epics)
- All six test files mock getKysely via testKysely with loads-via-getKysely assertions

## Task Commits

Each task followed TDD RED then GREEN:

1. **Task 1: Convert budget.repo and bugs.repo**
   - RED: `dcb602b` test(25-11): red budget and bugs kysely
   - GREEN: `9a46a92` feat(25-11): budget and bugs kysely
2. **Task 2: Convert documents.repo and holidays.repo**
   - RED: `a82fe16` test(25-11): red documents and holidays kysely
   - GREEN: `f341059` feat(25-11): documents and holidays kysely
3. **Task 3: Convert financial-benefits.repo and milestones.repo**
   - RED: `5e05f01` test(25-11): red financial-benefits and milestones kysely
   - GREEN: `40c5ebc` feat(25-11): financial-benefits and milestones kysely

## Files Created/Modified

- `modules/projects/backend/repositories/budget.repo.ts` — Kysely budget_items/expenses with actual_amount sync
- `modules/projects/backend/repositories/bugs.repo.ts` — Kysely snapshot CRUD and replaceSnapshot
- `modules/projects/backend/repositories/documents.repo.ts` — Kysely documents CRUD
- `modules/projects/backend/repositories/holidays.repo.ts` — Kysely project_holidays CRUD
- `modules/projects/backend/repositories/financial-benefits.repo.ts` — Kysely financial_benefits with coerceVndSafe
- `modules/projects/backend/repositories/milestones.repo.ts` — Kysely milestones and milestone_epics
- Six matching `*.repo.test.ts` files — getKysely mock + called assertions

## Decisions Made

- Complex milestone dashboard queries kept as `sql` templates to preserve COALESCE ordering
- linkEpic uses Kysely onConflict doNothing instead of INSERT OR IGNORE rewrite
- budget expense sync uses sql subquery in updateTable.set

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Integration tests skipped locally (hasTestDb=false); code compiles with no linter errors

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- W9a batch A complete; ready for 25-12 remaining project reads
- W9b allowlist write repos (25-13/25-14) untouched as required

## TDD Gate Compliance

- RED commits: dcb602b, a82fe16, 5e05f01
- GREEN commits: 9a46a92, f341059, 40c5ebc
- Gate sequence valid

## Self-Check: PASSED

- FOUND: modules/projects/backend/repositories/budget.repo.ts
- FOUND: modules/projects/backend/repositories/bugs.repo.ts
- FOUND: modules/projects/backend/repositories/documents.repo.ts
- FOUND: modules/projects/backend/repositories/holidays.repo.ts
- FOUND: modules/projects/backend/repositories/financial-benefits.repo.ts
- FOUND: modules/projects/backend/repositories/milestones.repo.ts
- FOUND: .planning/phases/25-kysely-repositories/25-11-SUMMARY.md
- FOUND: dcb602b, 9a46a92, a82fe16, f341059, 5e05f01, 40c5ebc

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
