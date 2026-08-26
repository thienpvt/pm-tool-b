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
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 17: Code Review Report

**Reviewed:** 2026-08-26T15:11:00Z  
**Depth:** standard  
**Files Reviewed:** 23  
**Status:** clean (CR-01, WR-01, WR-02, WR-03 resolved 2026-08-26)

## Summary

Phase 17 delivers the parallel document spine (catalog, templates, checklist, compliance) with correct route wrappers (`withCpmo`, `withAuth`, `withProjectAccess`), HTTPS-only URL validation, binary-field rejection, Viewer 403 on catalog/template writes and checklist PATCH, structured 409 for mandatory-incomplete stage changes, and no imports of v1 `documents.service`. No CASL or D-23 leftover flags were found in reviewed source.

All four review findings were fixed: cross-tenant checklist generation now uses the project owner's `company_id`; checklist PATCH validates merged state and clears stale metadata on status downgrade; null/empty project stage is treated as `ALL` for the mandatory-incomplete guard.

## Resolved Issues

### CR-01: Stage-change checklist generation uses actor company, not project owner company — **FIXED**

**File:** `lib/services/projects.service.ts`  
**Resolution:** `generateProjectChecklist` on stage change now passes `Number(current.company_id)` with validation, not `actor.company_id`.

### WR-01: Checklist PATCH rules validate body only, not merged state — **FIXED**

**File:** `lib/services/project-document-checklist.service.ts`  
**Resolution:** Existing row values are merged with the PATCH body before `assertChecklistPatchRules`.

### WR-02: Status downgrade leaves stale approval metadata — **FIXED**

**File:** `lib/services/project-document-checklist.service.ts`  
**Resolution:** `buildUpdateFields` clears `approved_at`/`approved_by` when leaving `approved`, and `na_reason` when leaving `not_applicable`.

### WR-03: Null or empty project stage bypasses mandatory-incomplete guard — **FIXED**

**File:** `lib/services/projects.service.ts`  
**Resolution:** Null/empty `project.stage` is treated as `'ALL'` for the mandatory-incomplete filter.

## Critical Issues

_None — see Resolved Issues above._

## Warnings

_None — see Resolved Issues above._

---

_Reviewed: 2026-08-26T15:11:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
