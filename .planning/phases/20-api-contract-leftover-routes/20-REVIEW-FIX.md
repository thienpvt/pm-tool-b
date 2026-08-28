---
phase: 20-api-contract-leftover-routes
fixed_at: 2026-08-28T07:50:00Z
review_path: .planning/phases/20-api-contract-leftover-routes/20-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 20: Code Review Fix Report

**Fixed at:** 2026-08-28T07:50:00Z
**Source review:** `.planning/phases/20-api-contract-leftover-routes/20-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, WR-01..WR-05; Info skipped)
- Fixed: 7
- Skipped: 0

**Verification:** Tier-1 re-read plus targeted Vitest runs in the **main checkout** (`workflow.use_worktrees=false` — no isolated worktree).

## Fixed Issues

### CR-01: Nested DELETE always returns 200 when parent system exists

**Files modified:** `lib/services/operations.service.ts`, `lib/services/operations.service.unit.test.ts`
**Commit:** `3568d74`
**Applied fix:** Nested delete helpers now return `(result.changes ?? 0) > 0` after repo delete; `null` still signals missing parent system.

### CR-02: System DELETE ignores repository row count

**Files modified:** `lib/services/operations.service.ts`, `app/api/operations/systems/[id]/route.ts`, `lib/services/operations.service.unit.test.ts`, `app/api/operations/systems/[id]/route.test.ts`
**Commit:** `c77dc20`
**Applied fix:** `deleteOperationsSystemForUser` checks tenant guard and row count; route returns 404 when delete is false.

### WR-01: `createCompanyPlatform` maps every failure to 409 Conflict

**Files modified:** `lib/services/admin-platform.service.ts`, `lib/services/admin-platform.service.unit.test.ts`
**Commit:** `44e4a09`
**Applied fix:** Added `isUniqueViolation` (Postgres `23505`, SQLite constraint codes/message); only unique violations become `ConflictError`; other errors rethrow for 500 mapping.

### WR-02: D-23 session routes lack standardized Invalid JSON handling

**Files modified:** `lib/http/parse-request-json.ts`, `lib/http/parse-request-json.test.ts`, all D-23 session-gated POST/PUT routes under `app/api/operations/**` and `app/api/admin/{companies,demo-requests,jira-config,rag-config}/**`, plus route tests on operations systems and admin companies
**Commit:** `9d1da1a`
**Applied fix:** Shared `parseRequestJson` helper returns `400 { error: 'Invalid JSON' }`; routes keep session+tenant/`requireAdmin` gates (no `withAuth` wrapper per D-23 lock).

### WR-03: Non-numeric `companyId` path coerced to `NaN`

**Files modified:** `lib/http/parse-route-param.ts`, `lib/http/parse-route-param.test.ts`, `app/api/admin/jira-config/[companyId]/route.ts`, `app/api/admin/jira-config/[companyId]/route.test.ts`, `app/api/admin/rag-config/[companyId]/route.ts`, `app/api/admin/rag-config/[companyId]/route.test.ts`
**Commit:** `08f4edf`
**Applied fix:** `parsePositiveIntRouteParam` rejects invalid ids with `400 { error: 'Invalid company id' }` before service calls.

### WR-04: RAG config POST can persist `NaN` thresholds

**Files modified:** `app/api/admin/rag-config/[companyId]/route.ts`, `app/api/admin/rag-config/[companyId]/route.test.ts`
**Commit:** `6eb96d9`
**Applied fix:** After numeric coercion, reject configs containing `NaN` with `400 { error: 'Invalid threshold values' }`.

### WR-05: Resource audit unusable for sessions with `company_id: null`

**Files modified:** `app/api/admin/resource-audit/route.ts`, `app/api/admin/resource-audit/route.access.test.ts`
**Commit:** `3a5eba0`
**Applied fix:** GET returns `400 { error: 'Company context required' }` when `user.company_id === null` before calling `getResourceAudit`.

## Skipped Issues

None — all in-scope findings were fixed. IN-01 (allowlist maintenance noise) was out of scope per fixer instructions.

---

_Fixed: 2026-08-28T07:50:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
