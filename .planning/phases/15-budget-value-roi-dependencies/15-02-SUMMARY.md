---
phase: 15-budget-value-roi-dependencies
plan: 02
subsystem: api
tags: [benefits, roi, fiscal, vitest, tdd]

requires:
  - phase: 15-01
    provides: migrateFiscalBudget tables, listFiscalBudgets, sumAdjustmentsVnd, parseNonNegativeVnd
provides:
  - GET/POST/PATCH /api/projects/[id]/benefits (financial + nonfinancial)
  - GET /api/projects/[id]/roi?fiscal_year=
  - computeExpectedRoi / computeActualRoi pure helpers
  - getProjectRoi year-level aggregator
affects: [16-dashboards]

actuals:
  tokens: 28000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Single /benefits route with kind financial | nonfinancial discriminator"
    - "SQL NULL actual_vnd distinct from zero; PATCH JSON null clears actual"
    - "ROI insufficient vs ok contract; never fake 0% for missing data"

key-files:
  created:
    - lib/fiscal/roi.ts
    - lib/repositories/financial-benefits.repo.ts
    - lib/repositories/nonfinancial-benefits.repo.ts
    - lib/services/benefits.service.ts
    - lib/services/roi.service.ts
    - app/api/projects/[id]/benefits/route.ts
    - app/api/projects/[id]/roi/route.ts
  modified: []

key-decisions:
  - "Nonfinancial repo + PATCH shipped in task-1 GREEN commit (e6f7f55) to keep benefits.service cohesive; task-2 GREEN commit omitted (no delta)"
  - "ROI aggregates approved_net and actual spend across all cost types for the fiscal year"

patterns-established:
  - "Stakeholders/fiscal-budget analog: repo + service auditLog + 23505→ConflictError + withProjectAccess routes"
  - "Repo tests skipIf(!hasTestDb) with migrateFiscalBudget(testPool()) after setupRepoTables"

requirements-completed: [BUDG-04, BUDG-05, BUDG-06]

coverage:
  - id: D1
    description: "Financial benefits POST with null vs zero actual_vnd and duplicate 409"
    requirement: BUDG-04
    verification:
      - kind: unit
        ref: "lib/repositories/financial-benefits.repo.test.ts"
        status: pass
      - kind: unit
        ref: "lib/services/benefits.service.unit.test.ts"
        status: pass
      - kind: integration
        ref: "app/api/projects/[id]/benefits/route.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nonfinancial benefits create/list/PATCH with text fields not coerced to zero"
    requirement: BUDG-05
    verification:
      - kind: unit
        ref: "lib/repositories/nonfinancial-benefits.repo.test.ts"
        status: pass
      - kind: unit
        ref: "lib/services/benefits.service.unit.test.ts"
        status: pass
      - kind: integration
        ref: "app/api/projects/[id]/benefits/route.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /roi returns honest percent or insufficient across all cost types"
    requirement: BUDG-06
    verification:
      - kind: unit
        ref: "lib/fiscal/roi.unit.test.ts"
        status: pass
      - kind: unit
        ref: "lib/services/roi.service.unit.test.ts"
        status: pass
      - kind: integration
        ref: "app/api/projects/[id]/roi/route.test.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 15 Plan 02: Benefits & Honest ROI Summary

**Financial/nonfinancial benefits API with NULL-vs-zero actual contract and year-level ROI GET that returns insufficient instead of fake 0%**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-26T13:23:00Z
- **Completed:** 2026-08-26T13:48:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Financial benefits repo/service/route with distinct null vs 0 `actual_vnd`, unique (project, year, type) → 409, viewer 403 on mutators
- Nonfinancial benefits with group/measure/target text fields; GET returns `{ financial, nonfinancial }`; PATCH updates actual fields
- Pure `computeExpectedRoi` / `computeActualRoi` helpers and `getProjectRoi` aggregating CAPEX+OPEX for a fiscal year
- GET `/api/projects/[id]/roi?fiscal_year=` with validation and read access for viewers

## Task Commits

1. **Task 15-02-01: Financial benefits null vs zero** — RED `ff6e10a`, GREEN `e6f7f55`
2. **Task 15-02-02: Nonfinancial benefits** — RED `8431501`, GREEN included in `e6f7f55` (see Deviations)
3. **Task 15-02-03: Year-level ROI GET** — RED `0e5e135`, GREEN `9d967c0`

## Files Created/Modified

- `lib/repositories/financial-benefits.repo.ts` — list/insert/update with nullable actual_vnd
- `lib/repositories/nonfinancial-benefits.repo.ts` — text-only benefit rows
- `lib/services/benefits.service.ts` — list/create/patch with write gate and auditLog
- `lib/fiscal/roi.ts` — insufficient vs ok ROI pure functions
- `lib/services/roi.service.ts` — year-level aggregation across cost types
- `app/api/projects/[id]/benefits/route.ts` — GET/POST/PATCH
- `app/api/projects/[id]/roi/route.ts` — GET with fiscal_year query param
- Matching `*.test.ts` files for repo, service, and route layers

## Decisions Made

- Shipped nonfinancial repo and PATCH handlers in the task-1 GREEN commit to avoid splitting a single cohesive benefits service
- Service passes explicit `actual_vnd: null` when JSON field omitted so repo always stores SQL NULL

## Deviations from Plan

### Execution note (not a code defect)

**Task 15-02-02 GREEN commit omitted** — nonfinancial repo, PATCH route, and extended `benefits.service` were implemented in `e6f7f55` (task-1 GREEN) because the service layer is shared. RED tests in `8431501` passed immediately against that commit. No additional source delta for a separate `feat(15-02): nonfinancial benefits API` commit.

Otherwise: plan executed as written; all wave verification tests pass (37 tests across benefits + ROI).

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- Phase 16 may import `computeExpectedRoi`, `computeActualRoi`, and `getProjectRoi`
- Plan 15-03 (dependencies) remains unstarted

## Self-Check: PASSED

- SUMMARY path exists
- Commits ff6e10a, e6f7f55, 8431501, 0e5e135, 9d967c0 verified in git log
- All created source and test files present on disk

---
*Phase: 15-budget-value-roi-dependencies*
*Completed: 2026-08-26*
