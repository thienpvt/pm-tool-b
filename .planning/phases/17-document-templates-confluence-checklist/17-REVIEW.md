---
phase: 17-document-templates-confluence-checklist
reviewed: 2026-08-26T15:11:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - lib/db-documents.ts
  - lib/db.ts
  - lib/repositories/document-catalog.repo.ts
  - lib/repositories/document-templates.repo.ts
  - lib/repositories/project-document-checklist.repo.ts
  - lib/services/document-catalog.service.ts
  - lib/services/document-checklist-generate.ts
  - lib/services/document-templates.service.ts
  - lib/services/project-document-checklist.service.ts
  - lib/services/document-compliance.service.ts
  - lib/services/errors.ts
  - lib/services/projects.service.ts
  - lib/documents/https-url.ts
  - lib/documents/checklist-status.ts
  - lib/documents/compliance.ts
  - lib/api-errors.ts
  - app/api/document-catalog/route.ts
  - app/api/document-catalog/[id]/route.ts
  - app/api/document-templates/route.ts
  - app/api/document-templates/[id]/route.ts
  - app/api/projects/[id]/document-checklist/route.ts
  - app/api/projects/[id]/document-checklist/[itemId]/route.ts
  - app/api/dashboards/document-compliance/route.ts
findings:
  critical: 1
  warning: 3
  info: 0
  total: 4
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-08-26T15:11:00Z  
**Depth:** standard  
**Files Reviewed:** 23  
**Status:** issues_found

## Summary

Phase 17 delivers the parallel document spine (catalog, templates, checklist, compliance) with correct route wrappers (`withCpmo`, `withAuth`, `withProjectAccess`), HTTPS-only URL validation, binary-field rejection, Viewer 403 on catalog/template writes and checklist PATCH, structured 409 for mandatory-incomplete stage changes, and no imports of v1 `documents.service`. No CASL or D-23 leftover flags were found in reviewed source.

Four issues remain: one cross-tenant catalog scoping bug on stage-change checklist generation, and three checklist PATCH edge cases around partial updates and stale metadata.

## Critical Issues

### CR-01: Stage-change checklist generation uses actor company, not project owner company

**File:** `lib/services/projects.service.ts:205-208`  
**Issue:** After a successful stage PATCH, `generateProjectChecklist` is called with `companyId: actor.company_id ?? Number(current.company_id)`. `assertProjectAccess` allows actors whose `company_id` matches either `project.company_id` or `project.customer_company_id`. For cross-tenant projects, a PM/CPMO from the customer company can pass the write gate but pull catalog rows from the **actor's** company instead of the project owner's catalog. That inserts wrong or missing checklist rows and breaks company-scoped catalog isolation (D-02).

**Fix:**
```typescript
const ownerCompanyId = Number(current.company_id);
if (!Number.isFinite(ownerCompanyId)) {
  throw new ValidationError('project has no company_id; cannot generate checklist', 'company_id');
}
await generateProjectChecklist(Number(projectId), {
  companyId: ownerCompanyId,
  stage: String(governed.stage),
});
```

## Warnings

### WR-01: Checklist PATCH rules validate body only, not merged state

**File:** `lib/documents/checklist-status.ts:31-63`, `lib/services/project-document-checklist.service.ts:97-100`  
**Issue:** `assertChecklistPatchRules(body, status)` validates fields present in the PATCH body, not the merged result with the existing row. Examples: (1) transitioning to `pending_approval` or `approved` fails if `confluence_url` is omitted even when the row already has a valid HTTPS URL; (2) patching `notes` on an `approved` item fails because `approved_at` / `approved_by` are not re-sent. Clients must always submit a full field set per status, which is fragile and undocumented at the route boundary.

**Fix:** Merge existing row values before validation, e.g. pass `{ ...existing, ...body }` into `assertChecklistPatchRules`, or split validation into "transition rules" vs "field format rules" that only apply to keys present in `body`.

### WR-02: Status downgrade leaves stale approval metadata in the database

**File:** `lib/services/project-document-checklist.service.ts:17-63`  
**Issue:** `buildUpdateFields` only writes keys explicitly present in the body. A PATCH such as `{ "status": "drafting" }` updates status but leaves prior `approved_at`, `approved_by`, and possibly `confluence_url` unchanged. Downstream compliance rollup and audit consumers can see a drafting row with approval timestamps still set.

**Fix:** When status changes away from `approved`, explicitly null out `approved_at` and `approved_by`. When changing away from `not_applicable`, clear `na_reason`.

### WR-03: Null or empty project stage bypasses mandatory-incomplete guard

**File:** `lib/services/projects.service.ts:165-172`  
**Issue:** The stage guard filters incomplete mandatory rows with `row.catalog_stage === currentStage` where `currentStage = String(current.stage ?? '')`. When `project.stage` is null or unset, `currentStage` is `''`, which never matches catalog stages (`L0`–`L5`, `ALL`). A stage change from null → `L2` proceeds without the D-09 409 warning even when mandatory ALL-stage items are incomplete.

**Fix:** Treat null stage as `'ALL'` for guard purposes, or reject stage changes when `current.stage` is null and mandatory items exist:
```typescript
const currentStage =
  current.stage == null || current.stage === '' ? 'ALL' : String(current.stage);
```
Align the filter logic with product intent for ALL-stage mandatory rows.

---

_Reviewed: 2026-08-26T15:11:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
