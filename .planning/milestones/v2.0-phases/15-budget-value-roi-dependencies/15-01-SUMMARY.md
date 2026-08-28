---
phase: 15-budget-value-roi-dependencies
plan: 01
subsystem: api
tags: [fiscal-budget, vnd, postgres, vitest, tdd]

requires:
  - phase: 14-weekly-reports
    provides: migrateWeeklyReports in getDb, assertProjectWriteAccess, withProjectAccess, auditLog
provides:
  - Parallel fiscal tables (project_fiscal_budgets, budget_adjustments) with settings-flag migrate
  - Integer VND parsers and computeFiscalBudgetMetrics export for Phase 16
  - GET/POST/PATCH /api/projects/[id]/fiscal-budget and POST adjustments nested route
  - Append-only budget_adjustments with auditLog on create and adjustment insert
affects:
  - 15-02 benefits/ROI HTTP
  - 15-03 dependency HTTP
  - 16 dashboard metrics import

actuals:
  tokens: 12750
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - settings-flag DDL migrate after weekly reports (lib/db-fiscal-budget.ts)
    - computed fiscal metrics not stored columns
    - INSERT-only approval changes via budget_adjustments

key-files:
  created:
    - lib/db-fiscal-budget.ts
    - lib/fiscal/vnd.ts
    - lib/fiscal/budget-metrics.ts
    - lib/repositories/fiscal-budget.repo.ts
    - lib/repositories/budget-adjustments.repo.ts
    - lib/services/fiscal-budget.service.ts
    - app/api/projects/[id]/fiscal-budget/route.ts
    - app/api/projects/[id]/fiscal-budget/[budgetId]/adjustments/route.ts
  modified:
    - lib/db.ts

key-decisions:
  - "Zod schemas inline at top of each fiscal route.ts (no separate schema.ts)"
  - "budget-adjustments.repo shipped in task 1 GREEN because GET overview needs sumAdjustmentsVnd"

patterns-established:
  - "Fiscal ledger parallel to budget_items: project_fiscal_budgets + budget_adjustments, never line-item budget.repo imports"
  - "Approved baseline immutable after insert; spend via PATCH actual; approval deltas via signed adjustment rows"

requirements-completed: [BUDG-01, BUDG-02, BUDG-03]

coverage:
  - id: D1
    description: POST fiscal year/cost-type row in integer VND with duplicate 409
    requirement: BUDG-01
    verification:
      - kind: unit
        ref: lib/services/fiscal-budget.service.unit.test.ts#createFiscalBudget
        status: pass
      - kind: unit
        ref: app/api/projects/[id]/fiscal-budget/route.test.ts#POST
        status: pass
    human_judgment: false
  - id: D2
    description: GET computed remaining/utilization/over_budget/fully_used flags
    requirement: BUDG-02
    verification:
      - kind: unit
        ref: lib/fiscal/budget-metrics.unit.test.ts
        status: pass
      - kind: unit
        ref: lib/services/fiscal-budget.service.unit.test.ts#GET overview
        status: pass
    human_judgment: false
  - id: D3
    description: Append-only signed adjustments with auditLog; approved baseline unchanged
    requirement: BUDG-03
    verification:
      - kind: unit
        ref: lib/repositories/fiscal-budget.repo.test.ts#insertBudgetAdjustment
        status: pass
      - kind: unit
        ref: lib/services/fiscal-budget.service.unit.test.ts#addBudgetAdjustment
        status: pass
      - kind: unit
        ref: app/api/projects/[id]/fiscal-budget/route.test.ts#adjustments
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 15 Plan 01: Fiscal Budget Tracer Summary

**Parallel fiscal ledger spine: integer-VND POST/GET/PATCH with computed metrics and append-only adjustments, wired after weekly migrate**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `migrateFiscalBudget` creates all five fiscal/benefit/dependency tables via `fiscal_budget_ddl_v1` flag, invoked from `getDb` after `migrateWeeklyReports`
- `parseNonNegativeVnd`, `parseSignedNonZeroVnd`, and `computeFiscalBudgetMetrics` with exported metrics helper for Phase 16
- Fiscal budget repo/service and `/api/projects/[id]/fiscal-budget` GET/POST/PATCH with Viewer 403 on mutators
- Nested POST `/fiscal-budget/[budgetId]/adjustments` for signed non-zero approval deltas with auditLog

## Task Commits

1. **Task 15-01-01 RED** - `eaccfe7` (test)
2. **Task 15-01-01 GREEN** - `838b866` (feat)
3. **Task 15-01-02 RED** - `d68d63c` (test)
4. **Task 15-01-02 GREEN** - `accfe16` (feat)

## Files Created/Modified

- `lib/db-fiscal-budget.ts` - Settings-flag DDL for five tables
- `lib/fiscal/vnd.ts` - VND and fiscal year/cost_type parsers
- `lib/fiscal/budget-metrics.ts` - Computed remaining/utilization/status
- `lib/repositories/fiscal-budget.repo.ts` - CRUD without approval overwrite
- `lib/repositories/budget-adjustments.repo.ts` - INSERT-only adjustments + sum
- `lib/services/fiscal-budget.service.ts` - Access-gated service with auditLog
- `app/api/projects/[id]/fiscal-budget/route.ts` - GET/POST/PATCH handlers
- `app/api/projects/[id]/fiscal-budget/[budgetId]/adjustments/route.ts` - POST-only nested route
- `lib/db.ts` - Wire migrateFiscalBudget after weekly migrate

## Decisions Made

- Import-guard unit test targets `@/lib/repositories/budget.repo` specifically so fiscal-budget.repo imports do not false-positive
- `budget-adjustments.repo.ts` included in task 1 GREEN because GET overview requires adjustment sum/list

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import guard regex matched fiscal-budget.repo**
- **Found during:** Task 15-01-01 GREEN
- **Issue:** `/budget\.repo/` matched `fiscal-budget.repo` and `budget-adjustments.repo`
- **Fix:** Narrowed assertion to `@/lib/repositories/budget.repo`
- **Files modified:** lib/services/fiscal-budget.service.unit.test.ts
- **Committed in:** 838b866

**2. [Rule 3 - Blocking] Route test helper out of scope in nested describe**
- **Found during:** Task 15-01-02 GREEN
- **Issue:** Adjustments describe block referenced outer `req()` helper
- **Fix:** Inline NextRequest construction in nested test
- **Files modified:** app/api/projects/[id]/fiscal-budget/route.test.ts
- **Committed in:** accfe16

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Test-only fixes; no scope change.

## Issues Encountered

None

## User Setup Required

None - uses existing PostgreSQL test database (`TEST_DATABASE_URL` ending in `_test`).

## Next Phase Readiness

- 15-02 can add benefits/ROI routes against `financial_benefits` / `nonfinancial_benefits` tables already created
- 15-03 can add dependency routes against `project_dependencies` table
- Phase 16 may import `computeFiscalBudgetMetrics` from `lib/fiscal/budget-metrics.ts`

## Self-Check: PASSED

- FOUND: lib/db-fiscal-budget.ts
- FOUND: lib/services/fiscal-budget.service.ts
- FOUND: app/api/projects/[id]/fiscal-budget/[budgetId]/adjustments/route.ts
- FOUND: .planning/phases/15-budget-value-roi-dependencies/15-01-SUMMARY.md
- FOUND: eaccfe7, 838b866, d68d63c, accfe16

---
*Phase: 15-budget-value-roi-dependencies*
*Completed: 2026-08-26*
