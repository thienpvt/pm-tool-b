---
phase: 20-api-contract-leftover-routes
reviewed: 2026-08-28T07:53:00Z
re_reviewed: 2026-08-28T07:53:00Z
depth: deep
files_reviewed: 42
files_reviewed_list:
  - .github/workflows/test.yml
  - app/api/admin/companies/route.test.ts
  - app/api/admin/companies/route.ts
  - app/api/admin/demo-requests/route.test.ts
  - app/api/admin/demo-requests/route.ts
  - app/api/admin/jira-config/[companyId]/route.ts
  - app/api/admin/rag-config/[companyId]/route.test.ts
  - app/api/admin/rag-config/[companyId]/route.ts
  - app/api/admin/resource-audit/route.access.test.ts
  - app/api/admin/resource-audit/route.ts
  - app/api/config/route.test.ts
  - app/api/config/route.ts
  - app/api/jira/search/route.test.ts
  - app/api/jira/search/route.ts
  - app/api/jira/search/schema.ts
  - app/api/operations/systems/[id]/budget-items/[itemId]/route.ts
  - app/api/operations/systems/[id]/budget-items/route.test.ts
  - app/api/operations/systems/[id]/budget-items/route.ts
  - app/api/operations/systems/[id]/expenses/[expId]/route.ts
  - app/api/operations/systems/[id]/expenses/route.test.ts
  - app/api/operations/systems/[id]/expenses/route.ts
  - app/api/operations/systems/[id]/incidents/[incId]/route.ts
  - app/api/operations/systems/[id]/incidents/route.test.ts
  - app/api/operations/systems/[id]/incidents/route.ts
  - app/api/operations/systems/[id]/route.test.ts
  - app/api/operations/systems/[id]/route.ts
  - app/api/operations/systems/route.test.ts
  - app/api/operations/systems/route.ts
  - eslint.config.mjs
  - eslint/plugin.mjs
  - eslint/route-wrapper-allowlist.json
  - eslint/rules/require-auth-wrapper.mjs
  - eslint/rules/require-auth-wrapper.test.ts
  - lib/http/proxy.auth.test.ts
  - lib/services/admin-platform.service.ts
  - lib/services/admin-platform.service.unit.test.ts
  - lib/services/jira-config.service.ts
  - lib/services/operations.service.ts
  - lib/services/operations.service.unit.test.ts
  - lib/services/rag-config.service.ts
  - lib/services/settings.service.ts
  - package.json
  - proxy.ts
  - vitest.config.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 20: Code Review Report

**Reviewed:** 2026-08-28T07:45:00Z
**Re-reviewed:** 2026-08-28T07:53:00Z
**Depth:** deep
**Files Reviewed:** 42
**Status:** clean

## Re-review Summary (post --fix)

Quick re-review confirmed all in-scope Critical and Warning findings are fixed in source (not merely claimed in `20-REVIEW-FIX.md`):

| ID | Verified in source |
|----|-------------------|
| CR-01 | `deleteBudgetItemForSystem` / `deleteExpenseForSystem` / `deleteIncidentForSystem` return `(result.changes ?? 0) > 0`; nested DELETE routes return 404 when `!deleted` |
| CR-02 | `deleteOperationsSystemForUser` checks tenant guard + row count; `[id]/route.ts` DELETE returns 404 when `!deleted` |
| WR-01 | `isUniqueViolation` gates `ConflictError`; other errors rethrow in `createCompanyPlatform` |
| WR-02 | Shared `parseRequestJson` helper; no bare `req.json()` in D-23 session-gated operations/admin routes |
| WR-03 | `parsePositiveIntRouteParam` rejects invalid ids; jira/rag config routes return 400 `{ error: 'Invalid company id' }` |
| WR-04 | RAG config POST rejects `NaN` thresholds with 400 `{ error: 'Invalid threshold values' }` |
| WR-05 | Resource audit GET returns 400 `{ error: 'Company context required' }` when `user.company_id === null` |

Targeted Vitest (8 files, 34 tests) passed in main checkout.

IN-01 (allowlist maintenance noise) remains informational and was out of fix scope.

## Summary

Deep review of Phase 20 API contract work: proxy edge auth (D-01/D-02), Jira search `withAuth` migration, ESLint ENF-01 wrapper gate, operations/admin/config service extractions, and CI lint wiring. Auth layering (proxy 401, D-23 session gates, D-24 `assertCompanyWrite`) is generally consistent with locked decisions.

All Critical and Warning findings from the initial review have been remediated and verified.

## Narrative Findings (AI reviewer)

## Critical Issues

_None — CR-01 and CR-02 fixed and verified._

### CR-01: Nested DELETE always returns 200 when parent system exists *(resolved)*

**File:** `lib/services/operations.service.ts:100-108`, `127-135`, `165-173`
**Issue:** ~~Nested delete helpers returned `true` whenever parent system passed tenant guard.~~ Fixed: helpers now return `(result.changes ?? 0) > 0`; routes return 404 when `!deleted`.

### CR-02: System DELETE ignores repository row count *(resolved)*

**File:** `app/api/operations/systems/[id]/route.ts:51-52`, `lib/services/operations.service.ts:66-70`
**Issue:** ~~Route always responded `{ ok: true }`.~~ Fixed: service checks row count; route returns 404 when `!deleted`.

## Warnings

_None — WR-01 through WR-05 fixed and verified._

### WR-01: `createCompanyPlatform` maps every failure to 409 Conflict *(resolved)*

**File:** `lib/services/admin-platform.service.ts:14-35`
**Issue:** ~~Bare catch mapped all errors to ConflictError.~~ Fixed: `isUniqueViolation` gates 409; other errors rethrow.

### WR-02: D-23 session routes lack standardized Invalid JSON handling *(resolved)*

**File:** `lib/http/parse-request-json.ts`, D-23 session-gated POST/PUT routes
**Issue:** ~~Bare `req.json()` caused unhandled 500 on malformed JSON.~~ Fixed: shared `parseRequestJson` returns 400 `{ error: 'Invalid JSON' }`.

### WR-03: Non-numeric `companyId` path coerced to `NaN` *(resolved)*

**File:** `lib/http/parse-route-param.ts`, jira/rag config routes
**Issue:** ~~`Number(companyId)` accepted NaN.~~ Fixed: `parsePositiveIntRouteParam` + 400 on invalid id.

### WR-04: RAG config POST can persist `NaN` thresholds *(resolved)*

**File:** `app/api/admin/rag-config/[companyId]/route.ts:61-63`
**Issue:** ~~Non-numeric strings persisted as NaN.~~ Fixed: rejects configs with NaN values via 400.

### WR-05: Resource audit unusable for sessions with `company_id: null` *(resolved)*

**File:** `app/api/admin/resource-audit/route.ts:14-16`
**Issue:** ~~GET queried with null company_id.~~ Fixed: returns 400 `{ error: 'Company context required' }`.

## Info

### IN-01: Allowlist entries for non-project-scoped operations paths

**File:** `eslint/route-wrapper-allowlist.json:3-11`
**Issue:** Operations routes are listed in the allowlist, but `isProjectScoped()` in `require-auth-wrapper.mjs` never matches `/api/operations/**`, so these entries are inert. Harmless but adds maintenance noise.
**Fix:** Remove operations paths from the allowlist unless the path gate expands to cover them.

---

_Reviewed: 2026-08-28T07:45:00Z_
_Re-reviewed: 2026-08-28T07:53:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
