---
phase: 10-users-roles-server-authorization
plan: 07
subsystem: auth
tags: [vitest, access-control, holidays, documents, budget, expenses, assertProjectWriteAccess]

requires:
  - phase: 10-users-roles-server-authorization
    provides: "assertProjectWriteAccess exported by 10-03 (tenant + mutate + PM write)"
provides:
  - "Holiday create/delete call assertProjectWriteAccess (D-15, D-16, AUTH-05)"
  - "upsertDocument, updateDocument, deleteDocument call assertProjectWriteAccess"
  - "Budget createBudgetItem and budget-item update/delete call assertProjectWriteAccess"
  - "createExpense and deleteExpense call assertProjectWriteAccess (D-24)"
  - "List/get paths keep assertProjectAccess only"
affects: [10-08, 10-09, 10-10]

actuals:
  tokens: 3200
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Mutators switch assertProjectAccess → assertProjectWriteAccess; reads unchanged"
    - "Unit test mocks alias assertProjectWriteAccess on mutator describes (same pattern as 10-04/10-06)"

key-files:
  created: []
  modified:
    - lib/services/holidays.service.ts
    - lib/services/holidays.service.unit.test.ts
    - lib/services/documents.service.ts
    - lib/services/documents.service.unit.test.ts
    - lib/services/budget.service.ts
    - lib/services/budget.service.unit.test.ts
    - lib/services/budget-items.service.ts
    - lib/services/budget-items.service.unit.test.ts

key-decisions:
  - "Named mutators explicitly: upsertDocument, updateDocument, deleteDocument, createExpense, deleteExpense (D-24)"
  - "D-23 carve-out unchanged — no role asserts on operations/** or /api/admin/companies"

patterns-established:
  - "Nested project writes for holidays, documents, budget, and expenses use assertProjectWriteAccess from 10-03 seam"

requirements-completed: [AUTH-04, AUTH-05]

coverage:
  - id: D1
    description: "createHoliday and deleteHoliday call assertProjectWriteAccess"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "lib/services/holidays.service.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "upsertDocument, updateDocument, and deleteDocument call assertProjectWriteAccess"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "lib/services/documents.service.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "createBudgetItem and budget-item update/delete call assertProjectWriteAccess"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "lib/services/budget.service.unit.test.ts"
        status: pass
      - kind: unit
        ref: "lib/services/budget-items.service.unit.test.ts#updateBudgetItem"
        status: pass
    human_judgment: false
  - id: D4
    description: "createExpense and deleteExpense call assertProjectWriteAccess (D-24)"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "lib/services/budget-items.service.unit.test.ts#createExpense"
        status: pass
      - kind: unit
        ref: "lib/services/budget-items.service.unit.test.ts#deleteExpense"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-26
status: complete
---

# Phase 10 Plan 07: Holidays/Documents/Budget Write Gate Summary

**Nested project mutators for holidays, documents (upsertDocument/updateDocument/deleteDocument), budget, budget-items, and expenses (createExpense/deleteExpense) now call assertProjectWriteAccess so Viewer and unassigned PM are denied server-side**

## Performance

- **Duration:** 5min
- **Started:** 2026-08-26T01:45:00+07:00
- **Completed:** 2026-08-26T01:50:00+07:00
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `createHoliday` and `deleteHoliday` switched from `assertProjectAccess` to `assertProjectWriteAccess`; `listHolidays` remains read-only
- `upsertDocument`, `updateDocument`, and `deleteDocument` gated as writes; `listDocuments` remains read-only
- `createBudgetItem` gated as write; `getBudgetOverview` remains read-only
- `updateBudgetItem`, `deleteBudgetItem`, `createExpense`, and `deleteExpense` gated as writes; `listExpenses` remains read-only
- All 40 unit tests pass across the four service test files

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 10-07-01: Gate holidays and documents mutators**
   - `abc4466` (test: assertProjectWriteAccess mocks for holidays and documents)
   - `cd05c43` (feat: gate holidays and documents mutators)
2. **Task 10-07-02: Gate budget and budget-items mutators**
   - `64377f5` (test: assertProjectWriteAccess mocks for budget and budget-items including createExpense/deleteExpense)
   - `36b360e` (feat: gate budget and budget-items mutators)

## Files Created/Modified

- `lib/services/holidays.service.ts` — `createHoliday`/`deleteHoliday` use `assertProjectWriteAccess`
- `lib/services/holidays.service.unit.test.ts` — write-access mocks and assertions on mutators
- `lib/services/documents.service.ts` — `upsertDocument`/`updateDocument`/`deleteDocument` use `assertProjectWriteAccess`
- `lib/services/documents.service.unit.test.ts` — write-access mocks and assertions on mutators
- `lib/services/budget.service.ts` — `createBudgetItem` uses `assertProjectWriteAccess`
- `lib/services/budget.service.unit.test.ts` — write-access mocks on createBudgetItem
- `lib/services/budget-items.service.ts` — update/delete budget-item and createExpense/deleteExpense use `assertProjectWriteAccess`
- `lib/services/budget-items.service.unit.test.ts` — write-access mocks on all mutators

## Decisions Made

- Named expense mutators explicitly per D-24: `createExpense` and `deleteExpense` gated same bar as budget-item CRUD
- D-23 carve-out unchanged — no role asserts added to `app/api/operations/**` or `/api/admin/companies`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Holidays, documents, budget, budget-items, and expense writes are server-gated for AUTH-05
- Ready for 10-08+ remaining nested mutators and actor-peel plans

## Self-Check: PASSED

- FOUND: `.planning/phases/10-users-roles-server-authorization/10-07-SUMMARY.md`
- FOUND: `abc4466` (test holidays/documents RED)
- FOUND: `cd05c43` (feat holidays/documents GREEN)
- FOUND: `64377f5` (test budget/budget-items RED)
- FOUND: `36b360e` (feat budget/budget-items GREEN)

---
*Phase: 10-users-roles-server-authorization*
*Completed: 2026-08-26*
