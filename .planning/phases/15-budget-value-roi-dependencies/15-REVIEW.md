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
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-08-26T13:35:00Z  
**Depth:** standard  
**Files Reviewed:** 21  
**Status:** issues_found

## Summary

Phase 15 delivers a coherent parallel fiscal/benefits/ROI/dependencies surface with the core invariants largely satisfied: mutators call `assertProjectWriteAccess` (viewer 403), `approved_amount_vnd` is insert-only, no physical DELETE on Phase 15 tables, financial `actual_vnd` preserves SQL NULL vs 0, ROI helpers return `{ status: 'insufficient' }` instead of faking 0%, dependencies enforce write-on-from plus access-on-to with self-link and overlap guards, fiscal services do not import v1 `budget.repo`, and repository SQL consistently scopes by `project_id` (or `from_project_id` for dependency writes).

Three warnings remain around input validation gaps on dependency end dates and adjustment effective dates, and unchecked `Number()` coercion on BIGINT read paths. No blockers were found in the reviewed scope.

## Critical Issues

None.

## Warnings

### WR-01: Dependency end accepts unvalidated `effective_to`

**File:** `lib/services/project-dependencies.service.ts:150-155`  
**Issue:** `endProjectDependency` passes optional `body.effective_to` straight to `softEndDependency` without `parseIsoDate` or a check that `effective_to >= before.effective_from`. Create path validates both (lines 86-94); end path does not. A client can persist `effective_to` before `effective_from` or a non-`YYYY-MM-DD` string (likely a 500 from PostgreSQL).  
**Fix:** Reuse `parseIsoDate` and mirror create validation:

```typescript
const effectiveTo =
  typeof body?.effective_to === 'string' && body.effective_to.trim()
    ? parseIsoDate(body.effective_to.trim(), 'effective_to')
    : undefined;

if (effectiveTo !== undefined && effectiveTo < before.effective_from) {
  throw new ValidationError('effective_to must be on or after effective_from', 'effective_to');
}
```

### WR-02: Budget adjustment `effective_date` not validated as ISO date

**File:** `lib/services/fiscal-budget.service.ts:166-169`  
**Issue:** `addBudgetAdjustment` only checks that `effective_date` is a non-empty trimmed string. Invalid values (e.g. `"not-a-date"`, `"2026-13-40"`) reach the repository and may surface as unhandled DB errors (500) instead of a field-level 400.  
**Fix:**

```typescript
const effectiveDate = parseIsoDate(body.effective_date, 'effective_date');
// add parseIsoDate to this module or import from project-dependencies.service / shared util
```

### WR-03: BIGINT read path uses unchecked `Number()` coercion

**File:** `lib/services/fiscal-budget.service.ts:33-35`, `lib/services/roi.service.ts:21-22`, `lib/repositories/financial-benefits.repo.ts:17-18`, `lib/repositories/budget-adjustments.repo.ts:52`  
**Issue:** Writes validate with `Number.isSafeInteger` via `parseNonNegativeVnd`, but reads aggregate with bare `Number(value)`. PostgreSQL BIGINT values above `Number.MAX_SAFE_INTEGER` (9_007_199_254_740_991) silently lose precision, corrupting `approved_net`, spend totals, adjustment sums, and ROI percentages. Unlikely for typical VND amounts but inconsistent with the stated BIGINT safety goal.  
**Fix:** Centralize a `coerceVndSafe(value: string | number): number` that throws or returns `{ status: 'insufficient' }` when `!Number.isSafeInteger(Number(value))`, and use it in services/repos instead of raw `Number()`.

## Info

### IN-01: Fiscal budget overview mixes string BIGINT columns with numeric metrics

**File:** `lib/services/fiscal-budget.service.ts:106`  
**Issue:** `getFiscalBudgetOverview` spreads the raw DB row (BIGINT columns often arrive as strings) alongside `metrics` objects containing JavaScript numbers. Clients may see `approved_amount_vnd: "1000000"` next to `metrics.approved_net_vnd: 1000000`. Not a correctness bug, but inconsistent API shape.  
**Fix:** Normalize numeric columns in the overview mapper (same pattern as `financialBenefitSnapshot`) before returning.

---

_Reviewed: 2026-08-26T13:35:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
