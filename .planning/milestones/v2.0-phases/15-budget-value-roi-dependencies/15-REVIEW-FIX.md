---
phase: 15-budget-value-roi-dependencies
fixed_at: 2026-08-26T13:45:00Z
review_path: .planning/phases/15-budget-value-roi-dependencies/15-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-08-26T13:45:00Z  
**Source review:** `.planning/phases/15-budget-value-roi-dependencies/15-REVIEW.md`  
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

**Verification:** Unit tests run in main checkout (`workflow.use_worktrees=false`).

## Fixed Issues

### WR-01: Dependency end accepts unvalidated `effective_to`

**Files modified:** `lib/fiscal/iso-date.ts`, `lib/services/project-dependencies.service.ts`, `lib/services/project-dependencies.service.unit.test.ts`
**Applied fix:** Extracted shared `parseIsoDate`; end path validates optional `effective_to` and rejects inverted windows.

### WR-02: Budget adjustment `effective_date` not validated as ISO date

**Files modified:** `lib/services/fiscal-budget.service.ts`, `lib/services/fiscal-budget.service.unit.test.ts`
**Applied fix:** `addBudgetAdjustment` uses `parseIsoDate` for `effective_date`.

### WR-03: BIGINT read path uses unchecked `Number()` coercion

**Files modified:** `lib/fiscal/vnd.ts`, `lib/fiscal/vnd.unit.test.ts`, `lib/services/fiscal-budget.service.ts`, `lib/services/roi.service.ts`, `lib/repositories/financial-benefits.repo.ts`, `lib/repositories/budget-adjustments.repo.ts`
**Applied fix:** Added `coerceVndSafe` and replaced bare `Number()` on read paths.

---

_Fixed: 2026-08-26T13:45:00Z_  
_Fixer: Claude (gsd-code-fixer)_  
_Iteration: 1_
