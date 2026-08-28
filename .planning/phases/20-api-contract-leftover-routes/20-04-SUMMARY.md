---
phase: 20-api-contract-leftover-routes
plan: 04
subsystem: api
tags: [operations, service-layer, thin-routes, vitest, session-auth]

requires:
  - phase: 20-api-contract-leftover-routes
    provides: Phase 20 THIN-01 pattern and D-23 break-glass semantics
provides:
  - operations.service.ts with collection, detail, and nested repo wrappers
  - Thin GET/POST /api/operations/systems route
  - Thin GET/PUT/DELETE /api/operations/systems/[id] route
  - Route and service unit tests mocking service (not repo)
affects: [20-05-operations-nested-routes, 20-06-admin-services]

actuals:
  tokens: 4000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Route → operations.service → operations.repo with SessionUser pass-through"
    - "D-23: getSessionFromRequest stays in route; no withCpmo/withRole"
    - "Nested helpers guard via findOperationsSystemForUser before repo calls"

key-files:
  created:
    - lib/services/operations.service.ts
    - lib/services/operations.service.unit.test.ts
    - app/api/operations/systems/route.test.ts
    - app/api/operations/systems/[id]/route.test.ts
  modified:
    - app/api/operations/systems/route.ts
    - app/api/operations/systems/[id]/route.ts

key-decisions:
  - "D-23 preserved: session gate in route only; service receives SessionUser without HTTP or role wrappers"
  - "Nested budget/expense/incident helpers exported now for 20-05 without route changes in this plan"

patterns-established:
  - "operations.service mirrors holidays/import-mapping import-rename Repo suffix pattern"
  - "findOperationsSystemForUser is shared tenant predicate for nested routes (20-05)"

requirements-completed: [THIN-01]

coverage:
  - id: D1
    description: operations.service pass-through with nested helpers for 20-05
    requirement: THIN-01
    verification:
      - kind: unit
        ref: lib/services/operations.service.unit.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: GET/POST /api/operations/systems thin route with D-23 session gate
    requirement: THIN-01
    verification:
      - kind: unit
        ref: app/api/operations/systems/route.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: GET/PUT/DELETE /api/operations/systems/[id] thin route with 404 tenant guard
    requirement: THIN-01
    verification:
      - kind: unit
        ref: app/api/operations/systems/[id]/route.test.ts
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 04: Operations Service & Systems Routes Summary

**Operations systems collection and [id] routes rewired through operations.service with D-23 session+tenant break-glass unchanged**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-28T07:26:00Z
- **Completed:** 2026-08-28T07:28:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Created `operations.service.ts` with SessionUser pass-through to `operations.repo` and full nested helper surface for plan 20-05
- Thinned `GET/POST /api/operations/systems` to call service; kept `getSessionFromRequest` 401 and Zod validation in route
- Thinned `GET/PUT/DELETE /api/operations/systems/[id]` to call service; preserved 404 `{ error: 'Not found' }` and PUT schema passthrough
- Added route tests mocking service (not repo) plus service unit tests for tenant args and find-miss guards

## Task Commits

Each task was committed atomically:

1. **Task 1: operations.service pass-through including nested helpers** - `7679a0e` (feat)
2. **Task 2: Thin GET/POST /api/operations/systems** - `5dd4413` (feat)
3. **Task 3: Thin GET/PUT/DELETE /api/operations/systems/[id]** - `6cbd4ef` (feat)

**Plan metadata:** pending (docs commit follows)

## Files Created/Modified

- `lib/services/operations.service.ts` - SessionUser pass-through to repo; nested helpers for budget/expense/incident
- `lib/services/operations.service.unit.test.ts` - Repo mock tests for list tenant args and null guards
- `app/api/operations/systems/route.ts` - Imports service instead of repo
- `app/api/operations/systems/route.test.ts` - 401, GET 200, POST 201 with service mock
- `app/api/operations/systems/[id]/route.ts` - Uses getOperationsSystemDetail, updateOperationsSystemForUser, deleteOperationsSystemForUser
- `app/api/operations/systems/[id]/route.test.ts` - 401, GET 200 bundle, GET 404

## Decisions Made

- D-23 preserved: no `withCpmo`, `withRole`, or `assertCompanyWrite` on operations routes; auth stays in route via `getSessionFromRequest`
- Nested helpers implemented in service now so 20-05 can rewire nested routes without editing this module

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 20-05 can rewire nested budget-items, expenses, and incidents routes using exported service helpers
- Collection and [id] routes verified; no `operations.repo` imports remain on those two route files

## Self-Check: PASSED

- FOUND: lib/services/operations.service.ts
- FOUND: lib/services/operations.service.unit.test.ts
- FOUND: app/api/operations/systems/route.test.ts
- FOUND: app/api/operations/systems/[id]/route.test.ts
- FOUND: commit 7679a0e
- FOUND: commit 5dd4413
- FOUND: commit 6cbd4ef

---
*Phase: 20-api-contract-leftover-routes*
*Completed: 2026-08-28*
