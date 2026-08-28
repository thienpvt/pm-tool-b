---
phase: 23-document-checklist-audit-viewer
reviewed: 2026-08-28T11:40:00Z
depth: deep
files_reviewed: 28
files_reviewed_list:
  - modules/documents/ui/shared/types.ts
  - modules/documents/ui/shared/documents.fixture.ts
  - modules/documents/ui/catalog/useDocumentCatalog.ts
  - modules/documents/ui/catalog/DocumentCatalogPage.tsx
  - modules/documents/ui/catalog/CatalogList.tsx
  - modules/documents/ui/catalog/CatalogForm.tsx
  - modules/documents/ui/catalog/TemplatePanel.tsx
  - modules/documents/ui/catalog/DocumentCatalogPage.component.test.tsx
  - modules/documents/ui/checklist/useProjectChecklist.ts
  - modules/documents/ui/checklist/ProjectChecklistPage.tsx
  - modules/documents/ui/checklist/ChecklistItemRow.tsx
  - modules/documents/ui/checklist/ProjectChecklistPage.component.test.tsx
  - modules/documents/ui/compliance/useDocumentCompliance.ts
  - modules/documents/ui/compliance/DocumentCompliancePage.tsx
  - modules/documents/ui/compliance/ComplianceFiltersBar.tsx
  - modules/documents/ui/compliance/ComplianceTable.tsx
  - modules/documents/ui/compliance/DocumentCompliancePage.component.test.tsx
  - modules/audit/ui/useAuditLog.ts
  - modules/audit/ui/AuditLogPage.tsx
  - modules/audit/ui/AuditFiltersBar.tsx
  - modules/audit/ui/AuditTable.tsx
  - modules/audit/ui/AuditLogPage.component.test.tsx
  - app/documents/catalog/page.tsx
  - app/documents/compliance/page.tsx
  - app/audit/page.tsx
  - app/projects/[id]/document-checklist/page.tsx
  - app/projects/[id]/page.tsx
  - components/layout/Sidebar.tsx
findings:
  critical: 2
  warning: 5
  info: 0
  total: 7
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-08-28T11:40:00Z
**Depth:** deep
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Deep review of Phase 23 document checklist, catalog/compliance surfaces, audit viewer, project hub card, and CPMO sidebar NAV. The implementation correctly follows Phase 21/22 patterns for module layout, thin `app/` re-exports, in-page 401/403 handling, singular `field` on checklist 400 bodies, `load_failed` on fetch catch, pretty-printed audit JSON in `<pre>` (no `dangerouslySetInnerHTML`), no new npm packages, and no overwrite of v1 `/projects/[id]/documents`.

Two **BLOCKER** stale-fetch races can show or mutate the wrong entity's data. Five **WARNING** items cover read-only stale GET races, PATCH reload UX, compliance 400 handling, and unvalidated link hrefs on render.

## Critical Issues

### BL-01: Catalog template list has no stale-GET guard

**File:** `modules/documents/ui/catalog/useDocumentCatalog.ts:56-83`
**Issue:** `loadTemplates(catalogId)` has no request sequence guard. If the user selects catalog A then quickly selects catalog B, a slow response for A can overwrite `templates` while `selectedId` is B. The retire action calls `onRetireTemplate(row.id, catalogId)` where `catalogId` is the current selection but `row.id` may belong to the previous catalog — CPMO can retire the wrong template.
**Fix:**
```typescript
const templatesSeqRef = useRef(0);

const loadTemplates = useCallback(async (catalogId: number) => {
  const requestId = ++templatesSeqRef.current;
  setTemplatesLoading(true);
  try {
    const res = await fetch(`/api/document-templates?catalog_id=${catalogId}`);
    if (requestId !== templatesSeqRef.current) return;
    if (!res.ok) {
      setTemplates([]);
      return;
    }
    setTemplates((await res.json()) as TemplateRow[]);
  } catch {
    if (requestId !== templatesSeqRef.current) return;
    setTemplates([]);
  } finally {
    if (requestId === templatesSeqRef.current) setTemplatesLoading(false);
  }
}, []);
```

### BL-02: Checklist hook allows stale project GET to overwrite state

**File:** `modules/documents/ui/checklist/useProjectChecklist.ts:20-65`
**Issue:** `load()` lacks the `loadSeqRef` pattern used in `modules/weekly/ui/tracking/usePeriodTracking.ts`. When navigating between projects or when an earlier fetch settles after a later one, checklist rows from project A can render on project B's page. PATCH uses the current URL `projectId` with stale row ids, risking edits to the wrong project's checklist items.
**Fix:**
```typescript
const loadSeqRef = useRef(0);

const load = useCallback(async () => {
  const requestId = ++loadSeqRef.current;
  setLoading(true);
  try {
    const res = await fetch(`/api/projects/${projectId}/document-checklist`);
    if (requestId !== loadSeqRef.current) return;
    // ... existing status handling ...
    const loaded = (await res.json()) as ChecklistItem[];
    if (requestId !== loadSeqRef.current) return;
    setItems(loaded);
    setError(null);
    // project name fetch should also check requestId before setState
  } catch {
    if (requestId !== loadSeqRef.current) return;
    setError('load_failed');
    setItems(null);
  } finally {
    if (requestId === loadSeqRef.current) setLoading(false);
  }
}, [projectId]);
```

## Warnings

### WR-01: Audit filter GET has no stale-response guard

**File:** `modules/audit/ui/useAuditLog.ts:29-68`
**Issue:** Rapid filter changes (entity type, date range, limit) can let an older `/api/audit` response overwrite a newer one. CPMO may briefly see the wrong audit slice. Phase 22 weekly tracking explicitly guards this with `loadSeqRef`.
**Fix:** Add `loadSeqRef` increment/check around fetch and all `setData`/`setError` calls, mirroring `usePeriodTracking.ts`.

### WR-02: Compliance filter GET has no stale-response guard

**File:** `modules/documents/ui/compliance/useDocumentCompliance.ts:27-67`
**Issue:** Same race as WR-01 when applying or clearing compliance filters quickly; stale project compliance rows can flash on screen.
**Fix:** Add `loadSeqRef` guard to `load()`, matching the weekly tracking hook pattern.

### WR-03: Successful checklist PATCH triggers full-page loading spinner

**File:** `modules/documents/ui/checklist/useProjectChecklist.ts:93`
**Issue:** `patchItem` calls `await load()` on success, and `load()` always sets `loading=true`, replacing the entire checklist table with the loading shell. Users lose expanded editor context and see a flash spinner after every save.
**Fix:** Either pass `{ silent: true }` to skip `setLoading(true)` on refresh, or merge the PATCH response into local state instead of full reload.

### WR-04: Template and Confluence links rendered without https guard

**File:** `modules/documents/ui/catalog/TemplatePanel.tsx:132-141`, `modules/documents/ui/checklist/ChecklistItemRow.tsx:137-145`
**Issue:** Display `<a href={url}>` anchors do not verify `url.startsWith('https://')` before render. API write paths enforce HTTPS via `parseHttpsUrl`, but legacy or compromised DB rows with `javascript:` or `data:` URLs would still render clickable links. Publish form validates client-side; list/table views do not.
**Fix:**
```typescript
function safeHttpsHref(url: string | null | undefined): string | null {
  return url?.startsWith('https://') ? url : null;
}
// Render link only when safeHttpsHref(url) is non-null; otherwise show em dash or plain text.
```

### WR-05: Compliance 400 leaves previous grid visible

**File:** `modules/documents/ui/compliance/useDocumentCompliance.ts:45-47`
**Issue:** On HTTP 400 the hook shows a toast but returns early without clearing `data` or surfacing an inline error. The grid continues showing the previous filter results while the toast claims filters are invalid — misleading CPMO compliance view.
**Fix:** On 400, either clear `data` and set a dedicated validation error state, or keep prior data but show inline filter error copy instead of toast-only feedback.

---

_Reviewed: 2026-08-28T11:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
