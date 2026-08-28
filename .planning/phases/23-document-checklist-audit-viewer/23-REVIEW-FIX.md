---
phase: 23-document-checklist-audit-viewer
fixed_at: 2026-08-28T11:52:00Z
review_path: .planning/phases/23-document-checklist-audit-viewer/23-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 23: Code Review Fix Report

**Fixed at:** 2026-08-28T11:52:00Z
**Source review:** `.planning/phases/23-document-checklist-audit-viewer/23-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### BL-01: Catalog template list has no stale-GET guard

**Files modified:** `modules/documents/ui/catalog/useDocumentCatalog.ts`, `modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx`
**Commit:** b9ec40b
**Applied fix:** Added `templatesSeqRef` increment/check in `loadTemplates()` so stale template responses cannot overwrite state after catalog selection changes.

### BL-02: Checklist hook allows stale project GET to overwrite state

**Files modified:** `modules/documents/ui/checklist/useProjectChecklist.ts`, `modules/documents/ui/checklist/ProjectChecklistPage.component.test.tsx`
**Commit:** fcd67d7
**Applied fix:** Added `loadSeqRef` guard around checklist and project-name fetches, mirroring `usePeriodTracking.ts`.

### WR-01: Audit filter GET has no stale-response guard

**Files modified:** `modules/audit/ui/useAuditLog.ts`, `modules/audit/ui/useAuditLog.test.ts`
**Commit:** 42e674d
**Applied fix:** Added `loadSeqRef` around audit fetch and all state updates; hook-level test verifies stale responses are ignored.

### WR-02: Compliance filter GET has no stale-response guard

**Files modified:** `modules/documents/ui/compliance/useDocumentCompliance.ts`, `modules/documents/ui/compliance/useDocumentCompliance.test.ts`
**Commit:** 76f4a0e
**Applied fix:** Added `loadSeqRef` guard to compliance `load()`; hook-level test verifies filter race safety.

### WR-03: Successful checklist PATCH triggers full-page loading spinner

**Files modified:** `modules/documents/ui/checklist/useProjectChecklist.ts`, `modules/documents/ui/checklist/ProjectChecklistPage.component.test.tsx`
**Commit:** 8e75f93
**Applied fix:** `load({ silent: true })` skips `setLoading(true)` on PATCH refresh; component test confirms table stays visible during silent reload.

### WR-04: Template and Confluence links rendered without https guard

**Files modified:** `lib/documents/https-url.ts`, `modules/documents/ui/catalog/TemplatePanel.tsx`, `modules/documents/ui/checklist/ChecklistItemRow.tsx`, component tests
**Commit:** c623b80
**Applied fix:** Added `safeHttpsHref()` helper; list/table views render anchors only for `https://` URLs, otherwise plain text.

### WR-05: Compliance 400 leaves previous grid visible

**Files modified:** `modules/documents/ui/compliance/useDocumentCompliance.ts`, `DocumentCompliancePage.tsx`, `ComplianceFiltersBar.tsx`, component test
**Commit:** 495c3f2
**Applied fix:** On HTTP 400, sets `filterError` inline message (alongside toast) while keeping last successful data; inline error clears on next successful load.

## Verification

**Environment:** main checkout (`workflow.use_worktrees` honored via user-specified Isolation: NONE)

**Commands run:**
```bash
npx vitest run --project jsdom modules/documents modules/audit components/layout/Sidebar.documents-nav.component.test.tsx
npx vitest run modules/audit/ui/useAuditLog.test.ts modules/documents/ui/compliance/useDocumentCompliance.test.ts
npx vitest run --project node app/projects/[id]/page.checklist-card.test.ts
```

**Results:** All 62 tests passed (59 jsdom component + 2 hook stale-fetch + 1 project hub).

**Supplementary commit:** f6c06ee — hook-level stale-fetch tests and PATCH spinner test repair.

---

_Fixed: 2026-08-28T11:52:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
