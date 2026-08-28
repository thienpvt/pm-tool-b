---
phase: 20-api-contract-leftover-routes
reviewed: 2026-08-28T07:45:00Z
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
  critical: 2
  warning: 5
  info: 1
  total: 8
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-08-28T07:45:00Z
**Depth:** deep
**Files Reviewed:** 42
**Status:** issues_found

## Summary

Deep review of Phase 20 API contract work: proxy edge auth (D-01/D-02), Jira search `withAuth` migration, ESLint ENF-01 wrapper gate, operations/admin/config service extractions, and CI lint wiring. Auth layering (proxy 401, D-23 session gates, D-24 `assertCompanyWrite`) is generally consistent with locked decisions.

Two critical API-contract defects remain in operations delete paths: nested deletes and system delete return `{ ok: true }` even when zero rows are affected. Several D-23 session-gated routes still lack the standardized malformed-JSON 400 handling that `withAuth` routes received in this phase.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Nested DELETE always returns 200 when parent system exists

**File:** `lib/services/operations.service.ts:97-105`, `124-132`, `162-170`
**Issue:** `deleteBudgetItemForSystem`, `deleteExpenseForSystem`, and `deleteIncidentForSystem` return `true` whenever the parent system passes the tenant guard, without checking whether the nested row was actually deleted. Routes map only `null` (system miss) to 404; a wrong `itemId`/`expId`/`incId` still yields `200 { ok: true }`, violating the phase’s null→404 contract for misses.
**Fix:**
```typescript
export async function deleteBudgetItemForSystem(
  user: SessionUser,
  id: number | string,
  itemId: number | string,
) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return null;
  const result = await deleteOperationsBudgetItemRepo(id, itemId);
  return (result.changes ?? 0) > 0;
}
```
Apply the same row-count check to expense and incident delete helpers; keep route `if (deleted === null)` for system miss and `if (!deleted)` for item miss.

### CR-02: System DELETE ignores repository row count

**File:** `app/api/operations/systems/[id]/route.ts:43-49`, `lib/services/operations.service.ts:66-68`
**Issue:** `deleteOperationsSystemForUser` returns the raw `db.run` result, but the route discards it and always responds `{ ok: true }`. A cross-tenant or unknown `id` deletes zero rows (SQL guards `company_id`) yet still returns 200, so clients cannot distinguish success from not-found.
**Fix:**
```typescript
// operations.service.ts
export async function deleteOperationsSystemForUser(user: SessionUser, id: number | string) {
  const existing = await findOperationsSystemForUser(user, id);
  if (!existing) return false;
  const result = await deleteOperationsSystemRepo(id, user.company_id, Boolean(user.is_admin));
  return (result.changes ?? 0) > 0;
}

// route.ts DELETE handler
const deleted = await deleteOperationsSystemForUser(user, id);
if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
return NextResponse.json({ ok: true });
```

## Warnings

### WR-01: `createCompanyPlatform` maps every failure to 409 Conflict

**File:** `lib/services/admin-platform.service.ts:18-23`
**Issue:** The bare `catch` converts any `createCompany` failure (connection loss, constraint other than unique name, driver errors) into `ConflictError('Company name already exists')`, surfacing 409 instead of 500 and hiding root causes.
**Fix:** Catch only the unique-violation signal (e.g. Postgres `23505` / SQLite `SQLITE_CONSTRAINT`) and rethrow or wrap other errors for `serviceErrorResponse` to map to 500.

### WR-02: D-23 session routes lack standardized Invalid JSON handling

**File:** `app/api/operations/systems/route.ts:21`, `app/api/admin/companies/route.ts:27`, `app/api/admin/jira-config/[companyId]/route.ts:32` (and other operations/admin session-gated POST/PUT handlers)
**Issue:** Phase 20 standardized malformed JSON as `400 { error: 'Invalid JSON' }` via `withAuth`, but D-23 carve-out routes still call bare `await req.json()`. Invalid JSON throws and becomes an unhandled 500, inconsistent with Jira search and `/api/config`.
**Fix:** Wrap `req.json()` in try/catch returning `NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })`, or extract a small shared helper used by session-gated routes.

### WR-03: Non-numeric `companyId` path coerced to `NaN`

**File:** `app/api/admin/jira-config/[companyId]/route.ts:22-23`, `app/api/admin/rag-config/[companyId]/route.ts:23-24`
**Issue:** `Number(companyId)` on values like `"abc"` yields `NaN`. GET returns empty defaults; POST attempts `setCompanyJiraConfig`/`setCompanyRagConfig` with `NaN`, risking driver/DB errors or silent no-ops instead of a 400.
**Fix:** Validate with `Number.isFinite(Number(companyId))` (or Zod `z.coerce.number().int().positive()`) and return `400 { error: 'Invalid company id' }` before service calls.

### WR-04: RAG config POST can persist `NaN` thresholds

**File:** `app/api/admin/rag-config/[companyId]/route.ts:38-47`
**Issue:** `Number(body.spi_red_threshold ?? …)` accepts non-numeric strings (`Number('x') === NaN`) and persists them through `setCompanyRagConfigValues`, corrupting threshold config without validation feedback.
**Fix:** After coercion, reject configs where any field is `Number.isNaN(...)`, or parse with `z.coerce.number()` in the schema and return 400 on failure.

### WR-05: Resource audit unusable for sessions with `company_id: null`

**File:** `app/api/admin/resource-audit/route.ts:14-15`, `lib/repositories/admin.repo.ts:112-116`
**Issue:** GET uses `user.company_id` directly. Platform admins (or any user with `company_id: null`) query `WHERE id = NULL`, returning `company: null` and empty diff lists with 200 instead of a clear 400/403. POST is guarded by `assertCompanyWrite` (requires non-null company), but GET has no equivalent guard.
**Fix:** If `user.company_id === null`, return `400 { error: 'Company context required' }` (or require admin + explicit `?companyId=` for break-glass admins).

## Info

### IN-01: Allowlist entries for non-project-scoped operations paths

**File:** `eslint/route-wrapper-allowlist.json:3-11`
**Issue:** Operations routes are listed in the allowlist, but `isProjectScoped()` in `require-auth-wrapper.mjs` never matches `/api/operations/**`, so these entries are inert. Harmless but adds maintenance noise.
**Fix:** Remove operations paths from the allowlist unless the path gate expands to cover them.

---

_Reviewed: 2026-08-28T07:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
