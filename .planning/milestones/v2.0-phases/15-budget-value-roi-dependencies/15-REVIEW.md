---
phase: 15-budget-value-roi-dependencies
reviewed: 2026-08-26T13:35:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - app/api/projects/[id]/benefits/route.ts
  - app/api/projects/[id]/benefits/schema.ts
  - app/api/projects/[id]/dependencies/route.ts
  - app/api/projects/[id]/dependencies/schema.ts
  - app/api/projects/[id]/fiscal-budget/route.ts
  - app/api/projects/[id]/fiscal-budget/[budgetId]/adjustments/route.ts
  - app/api/projects/[id]/roi/route.ts
  - lib/db-fiscal-budget.ts
  - lib/db.ts
  - lib/fiscal/budget-metrics.ts
  - lib/fiscal/roi.ts
  - lib/fiscal/vnd.ts
  - lib/repositories/budget-adjustments.repo.ts
  - lib/repositories/fiscal-budget.repo.ts
  - lib/repositories/financial-benefits.repo.ts
  - lib/repositories/nonfinancial-benefits.repo.ts
  - lib/repositories/project-dependencies.repo.ts
  - lib/services/benefits.service.ts
  - lib/services/fiscal-budget.service.ts
  - lib/services/project-dependencies.service.ts
  - lib/services/roi.service.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 15: Code Review Report

**Reviewed:** 2026-08-26T13:35:00Z  
**Depth:** standard  
**Files Reviewed:** 21  
**Status:** clean

## Summary

Phase 15 delivers a coherent parallel fiscal/benefits/ROI/dependencies surface with the core invariants largely satisfied: mutators call `assertProjectWriteAccess` (viewer 403), `approved_amount_vnd` is insert-only, no physical DELETE on Phase 15 tables, financial `actual_vnd` preserves SQL NULL vs 0, ROI helpers return `{ status: 'insufficient' }` instead of faking 0%, dependencies enforce write-on-from plus access-on-to with self-link and overlap guards, fiscal services do not import v1 `budget.repo`, and repository SQL consistently scopes by `project_id` (or `from_project_id` for dependency writes).

Three warnings around input validation gaps on dependency end dates and adjustment effective dates, and unchecked `Number()` coercion on BIGINT read paths were fixed in follow-up. No blockers remain in the reviewed scope.

## Critical Issues

None.

## Warnings

### WR-01: Dependency end accepts unvalidated `effective_to` — **Resolved**

**File:** `lib/services/project-dependencies.service.ts:150-155`  
**Issue:** `endProjectDependency` passed optional `body.effective_to` straight to `softEndDependency` without `parseIsoDate` or a check that `effective_to >= before.effective_from`.  
**Resolution:** Shared `parseIsoDate` from `lib/fiscal/iso-date.ts`; end path validates optional `effective_to` and rejects inverted windows with `ValidationError`.

### WR-02: Budget adjustment `effective_date` not validated as ISO date — **Resolved**

**File:** `lib/services/fiscal-budget.service.ts:166-169`  
**Issue:** `addBudgetAdjustment` only checked that `effective_date` is a non-empty trimmed string.  
**Resolution:** Uses shared `parseIsoDate(body.effective_date.trim(), 'effective_date')`.

### WR-03: BIGINT read path uses unchecked `Number()` coercion — **Resolved**

**File:** `lib/services/fiscal-budget.service.ts:33-35`, `lib/services/roi.service.ts:21-22`, `lib/repositories/financial-benefits.repo.ts:17-18`, `lib/repositories/budget-adjustments.repo.ts:52`  
**Issue:** Writes validated with `Number.isSafeInteger` via `parseNonNegativeVnd`, but reads aggregated with bare `Number()`.  
**Resolution:** Added `coerceVndSafe` in `lib/fiscal/vnd.ts` and applied in fiscal-budget service mapper, roi.service aggregations, financial-benefits repo snapshot, and budget-adjustments repo sum.

## Info

### IN-01: Fiscal budget overview mixes string BIGINT columns with numeric metrics

**File:** `lib/services/fiscal-budget.service.ts:106`  
**Issue:** `getFiscalBudgetOverview` spreads the raw DB row (BIGINT columns often arrive as strings) alongside `metrics` objects containing JavaScript numbers. Clients may see `approved_amount_vnd: "1000000"` next to `metrics.approved_net_vnd: 1000000`. Not a correctness bug, but inconsistent API shape.  
**Fix:** Normalize numeric columns in the overview mapper (same pattern as `financialBenefitSnapshot`) before returning.

---

_Reviewed: 2026-08-26T13:35:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
