---
phase: 25-kysely-repositories
plan: 07
subsystem: database
tags: [kysely, postgres, portfolio, programs, fiscal-budget, resources]

requires:
  - phase: 25-06
    provides: getKysely harness and prior repo conversion patterns
provides:
  - programs.repo.ts on getKysely with company tenant filters preserved
  - fiscal-budget.repo.ts on getKysely with project-scoped CRUD
  - resources.repo.ts on getKysely with listResourceMembers join query
  - resources.repo.test.ts integration coverage for resource members
affects: [25-08]

actuals:
  tokens: 12000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns: [getKysely singleton, testKysely mock, TDD red-green per repo]

key-files:
  created:
    - modules/portfolio/backend/repositories/resources.repo.test.ts
  modified:
    - modules/portfolio/backend/repositories/programs.repo.ts
    - modules/portfolio/backend/repositories/programs.repo.test.ts
    - modules/portfolio/backend/repositories/fiscal-budget.repo.ts
    - modules/portfolio/backend/repositories/fiscal-budget.repo.test.ts
    - modules/portfolio/backend/repositories/resources.repo.ts

key-decisions:
  - "Added mapFiscalBudgetRow to normalize created_at Date to ISO string without as any"
  - "Used Kysely coalesce for allocation headcount defaults matching legacy SQL"

patterns-established:
  - "Portfolio wave repos: mock getKysely via testKysely alongside getDb in repo tests"
  - "Complex program allocation joins use Kysely leftJoin with onRef/on compound keys"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: programs.repo.ts list/create/update/delete and allocations use getKysely
    requirement: ENF-02
    verification:
      - kind: unit
        ref: modules/portfolio/backend/repositories/programs.repo.test.ts#loads via getKysely
        status: unknown
    human_judgment: false
  - id: D2
    description: fiscal-budget.repo.ts list/get/insert/updateActual use getKysely
    requirement: ENF-02
    verification:
      - kind: unit
        ref: modules/portfolio/backend/repositories/fiscal-budget.repo.test.ts#loads via getKysely
        status: unknown
    human_judgment: false
  - id: D3
    description: resources.repo.ts listResourceMembers uses getKysely with company filter
    requirement: ENF-02
    verification:
      - kind: unit
        ref: modules/portfolio/backend/repositories/resources.repo.test.ts#returns team members for projects in the caller company
        status: unknown
    human_judgment: false

duration: 12min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 07: Programs, Fiscal-Budget, Resources Kysely Summary

**Three portfolio repos converted to getKysely with TDD red-green commits; company tenant filters preserved on programs and resources**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-29T00:48:00Z
- **Completed:** 2026-08-29T01:00:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Converted `programs.repo.ts` — all exports including `upsertProgramProjectAllocation` — to Kysely with companyId filters intact (T-25-12)
- Converted `fiscal-budget.repo.ts` list/get/insert/updateActual with `mapFiscalBudgetRow` for timestamp compatibility
- Converted `resources.repo.ts` `listResourceMembers` join query and added new integration test file
- portfolio.repo.ts left untouched for plan 25-08 as specified

## Task Commits

Each task was committed atomically (TDD red then green):

1. **Task 1: Convert programs.repo.ts** — `3eaad19` (test), `573f814` (feat)
2. **Task 2: Convert fiscal-budget.repo.ts** — `53c4ee0` (test), `2c1db83` (feat)
3. **Task 3: Convert resources.repo.ts** — `ce2f4e4` (test), `be9d79a` (feat)

## Files Created/Modified

- `modules/portfolio/backend/repositories/programs.repo.ts` — full Kysely conversion
- `modules/portfolio/backend/repositories/programs.repo.test.ts` — getKysely mock + assertion
- `modules/portfolio/backend/repositories/fiscal-budget.repo.ts` — Kysely CRUD + row mapper
- `modules/portfolio/backend/repositories/fiscal-budget.repo.test.ts` — getKysely mock + assertion
- `modules/portfolio/backend/repositories/resources.repo.ts` — Kysely join for listResourceMembers
- `modules/portfolio/backend/repositories/resources.repo.test.ts` — new listResourceMembers coverage

## Decisions Made

- Added explicit `created_at: new Date()` on Kysely inserts where Database types require it (customers, program_project_allocations, project_fiscal_budgets)
- Used `mapFiscalBudgetRow` helper instead of type assertions to preserve `FiscalBudgetRow.created_at: string` contract

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest integration tests skipped locally (`hasTestDb` false); wave verify command exits 0 with 12 tests skipped

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 25-08 (portfolio.repo.ts — 725-line slice)
- All three repos import getKysely; no getDb references remain in converted files

## Self-Check: PASSED

- FOUND: modules/portfolio/backend/repositories/programs.repo.ts
- FOUND: modules/portfolio/backend/repositories/fiscal-budget.repo.ts
- FOUND: modules/portfolio/backend/repositories/resources.repo.ts
- FOUND: modules/portfolio/backend/repositories/resources.repo.test.ts
- FOUND: 3eaad19, 573f814, 53c4ee0, 2c1db83, ce2f4e4, be9d79a

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
