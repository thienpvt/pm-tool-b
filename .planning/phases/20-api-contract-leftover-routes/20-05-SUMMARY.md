---
phase: 20-api-contract-leftover-routes
plan: 05
subsystem: api
tags: [operations, thin-routes, vitest, session-auth, D-23]

requires:
  - phase: 20-api-contract-leftover-routes
    provides: operations.service nested helpers from 20-04
provides:
  - Six nested operations routes calling *ForSystem service helpers
  - Route tests for budget-items, expenses, and incidents collection routes
affects: [20-06-admin-services]

actuals:
  tokens: 4200
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Nested operations routes call operations.service *ForSystem helpers; null → 404"
    - "D-23: getSessionFromRequest stays in route; no withCpmo/withRole"

key-files:
  created:
    - app/api/operations/systems/[id]/budget-items/route.test.ts
    - app/api/operations/systems/[id]/expenses/route.test.ts
    - app/api/operations/systems/[id]/incidents/route.test.ts
  modified:
    - app/api/operations/systems/[id]/budget-items/route.ts
    - app/api/operations/systems/[id]/budget-items/[itemId]/route.ts
    - app/api/operations/systems/[id]/expenses/route.ts
    - app/api/operations/systems/[id]/expenses/[expId]/route.ts
    - app/api/operations/systems/[id]/incidents/route.ts
    - app/api/operations/systems/[id]/incidents/[incId]/route.ts

key-decisions:
  - "D-23 preserved: session gate in route only; nested routes do not add withCpmo"
  - "Null service returns map to 404 { error: 'Not found' } for tenant miss and item miss"

patterns-established:
  - "Nested operations routes mock operations.service in tests (not operations.repo)"

requirements-completed: [THIN-01]

coverage:
  - id: D1
    description: Budget-item nested routes use service helpers with D-23 session gate
    requirement: THIN-01
    verification:
      - kind: unit
        ref: app/api/operations/systems/[id]/budget-items/route.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Expense nested routes use service helpers with D-23 session gate
    requirement: THIN-01
    verification:
      - kind: unit
        ref: app/api/operations/systems/[id]/expenses/route.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Incident nested routes use service helpers with D-23 session gate
    requirement: THIN-01
    verification:
      - kind: unit
        ref: app/api/operations/systems/[id]/incidents/route.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: All six nested route.ts files import operations.service not operations.repo
    requirement: THIN-01
    verification:
      - kind: other
        ref: "node import assert for six nested route.ts files"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 05: Nested Operations Routes Summary

**Six nested budget/expense/incident operations routes rewired through 20-04 service helpers with D-23 session gate unchanged**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-28T07:36:00Z
- **Completed:** 2026-08-28T07:39:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Thinned budget-items GET/POST and [itemId] PUT/DELETE to call `*BudgetItemForSystem` helpers
- Thinned expenses GET/POST and [expId] DELETE to call `*ExpenseForSystem` helpers
- Thinned incidents GET/POST and [incId] PUT/DELETE to call `*IncidentForSystem` helpers
- Added collection route tests (401, 404, GET 200 for budget-items) mocking service not repo
- All eight operations route.ts files now call operations.service; no operations.repo imports remain

## Task Commits

Each task was committed atomically:

1. **Task 1: Thin operations budget-item routes** - `2b5f093` (feat)
2. **Task 2: Thin operations expense routes** - `0f9471d` (feat)
3. **Task 3: Thin operations incident routes** - `be8fcb1` (feat)

**Plan metadata:** `405fdcd` (docs: complete plan)

## Files Created/Modified

- `app/api/operations/systems/[id]/budget-items/route.ts` - GET/POST via listBudgetItemsForSystem, createBudgetItemForSystem
- `app/api/operations/systems/[id]/budget-items/[itemId]/route.ts` - PUT/DELETE via updateBudgetItemForSystem, deleteBudgetItemForSystem
- `app/api/operations/systems/[id]/budget-items/route.test.ts` - 401, 404, GET 200 tests
- `app/api/operations/systems/[id]/expenses/route.ts` - GET/POST via listExpensesForSystem, createExpenseForSystem
- `app/api/operations/systems/[id]/expenses/[expId]/route.ts` - DELETE via deleteExpenseForSystem
- `app/api/operations/systems/[id]/expenses/route.test.ts` - 401, 404 tests
- `app/api/operations/systems/[id]/incidents/route.ts` - GET/POST via listIncidentsForSystem, createIncidentForSystem
- `app/api/operations/systems/[id]/incidents/[incId]/route.ts` - PUT/DELETE via updateIncidentForSystem, deleteIncidentForSystem
- `app/api/operations/systems/[id]/incidents/route.test.ts` - 401, 404 tests

## Decisions Made

- D-23 preserved: no withCpmo, withRole, or assertCompanyWrite on nested operations routes
- Null service return maps to 404 for both tenant miss and item-not-found (matches prior behavior)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All eight operations route.ts files are thin and service-backed (THIN-01 complete for operations domain)
- Plan 20-06 can proceed with admin services without operations.repo leakage in nested routes

## Self-Check: PASSED

- FOUND: app/api/operations/systems/[id]/budget-items/route.test.ts
- FOUND: app/api/operations/systems/[id]/expenses/route.test.ts
- FOUND: app/api/operations/systems/[id]/incidents/route.test.ts
- FOUND: commit 2b5f093
- FOUND: commit 0f9471d
- FOUND: commit be8fcb1
- Wave verify: npx vitest run app/api/operations/systems — 17 tests passed

---
*Phase: 20-api-contract-leftover-routes*
*Completed: 2026-08-28*
