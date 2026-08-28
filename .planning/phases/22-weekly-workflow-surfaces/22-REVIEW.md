---
phase: 22-weekly-workflow-surfaces
reviewed: 2026-08-28T10:22:00Z
depth: deep
files_reviewed: 25
files_reviewed_list:
  - modules/weekly/ui/tracking/ExportToolbar.tsx
  - modules/weekly/ui/shared/VirtualRows.tsx
  - modules/weekly/ui/shared/types.ts
  - modules/weekly/ui/tracking/TrackingCountsBar.tsx
  - modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx
  - modules/weekly/ui/periods/WeeklyPeriodList.tsx
  - modules/weekly/ui/periods/WeeklyConfigForm.tsx
  - modules/weekly/ui/shared/weekly.fixture.ts
  - modules/weekly/ui/periods/useWeeklyPeriods.ts
  - modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx
  - modules/weekly/ui/report/useWeeklyReportEditor.ts
  - modules/weekly/ui/shared/VirtualRows.component.test.tsx
  - modules/weekly/ui/tracking/TrackingFiltersBar.tsx
  - modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx
  - modules/weekly/ui/periods/WeeklyPeriodsPage.tsx
  - modules/weekly/ui/tracking/TrackingGrid.tsx
  - modules/weekly/ui/report/WeeklyReportEditorPage.tsx
  - modules/weekly/ui/report/WeeklyReportForm.tsx
  - modules/weekly/ui/tracking/usePeriodTracking.ts
  - modules/weekly/ui/tracking/WeeklyTrackingPage.tsx
  - app/weekly/tracking/page.tsx
  - app/weekly/periods/page.tsx
  - app/weekly/reports/[projectId]/[reportId]/page.tsx
  - app/projects/[id]/weekly-reports/[reportId]/page.tsx
  - components/layout/Sidebar.tsx
findings:
  critical: 2
  warning: 4
  info: 0
  total: 6
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-08-28T10:22:00Z  
**Depth:** deep  
**Files Reviewed:** 25  
**Status:** issues_found

## Summary

Deep review of Phase 22 weekly workflow surfaces (CPMO periods/tracking, PM report editor, thin app re-exports, Sidebar NAV). The implementation aligns well with Phase 21 patterns: fetch/JSON failures map to `load_failed`, 401/403 render in-page panels (no redirects), PATCH allowlist omits `prev_week_rag`, 409 shows the specified toast, export preserves checkbox order, VirtualRows windows correctly, and no preview route or new npm packages were added.

Two **BLOCKER** race conditions remain — debounced PATCH can target the wrong report after param change, and tracking GET responses are not sequenced — plus four **WARNING**-level UX/contract gaps (typography weight, stale filter draft, redundant correction CTA, optimistic PATCH rollback).

## Narrative Findings (AI reviewer)

### Verified (no issue)

| Focus area | Verdict |
|------------|---------|
| Fetch/JSON catch → `load_failed` | Pass — all three hooks (`useWeeklyPeriods`, `usePeriodTracking`, `useWeeklyReportEditor`) and inline `loadPeriods` set `load_failed` in `catch` and on non-OK responses |
| 401/403 in-page | Pass — no `window.location` usage in weekly module |
| VirtualRows window math | Pass — fixed 40px row height, overscan 5, 150-row test asserts ≤30 DOM nodes |
| Header checkbox vs window | Pass — `toggleAll` iterates full `eligibleRows` in memory, not the virtual slice |
| Export `project_ids` order | Pass — append-on-check preserves order; `uniqueProjectIds` dedupes without reordering |
| No preview route | Pass — UI calls POST export only |
| PATCH allowlist / no `prev_week_rag` | Pass — `PatchKey` union excludes `prev_week_rag`; component test asserts omission |
| 409 toast | Pass — exact copy on PATCH 409 |
| RAG Title Case (editor) | Pass — `RAG_OPTIONS` uses `Green`, `Amber`, `Red`, `Not applicable` |
| No new npm | Pass — in-repo `VirtualRows` only |
| XSS | Pass — no `dangerouslySetInnerHTML` / `innerHTML` |
| Sidebar weekly NAV | Pass — CPMO-only links after My dashboard, before `NAV_SECONDARY` |

## Critical Issues

### BL-01: Debounced PATCH can write to the wrong report after navigation

**File:** `modules/weekly/ui/report/useWeeklyReportEditor.ts:28-128`  
**Issue:** `pendingPatchRef` and the debounce timer are not cleared when `projectId` or `reportId` changes. App Router reuses the same client component instance across `/projects/:id/weekly-reports/:reportId` navigations, so a pending edit from report A can flush against report B's URL after the user follows another dashboard link.

**Fix:**
```typescript
useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  pendingPatchRef.current = {};
  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };
}, [projectId, reportId]);
```

Also guard `flushPatch` with a request-generation ref and ignore responses when the generation has moved on.

### BL-02: Stale tracking GET can overwrite the active period/filter view

**File:** `modules/weekly/ui/tracking/usePeriodTracking.ts:47-74`, `modules/weekly/ui/tracking/WeeklyTrackingPage.tsx:88-92`  
**Issue:** `load()` has no abort or sequence token. Rapid period switching or filter applies can resolve out-of-order: an older fetch for period 1 may complete after period 2 and replace `data`, showing the wrong grid and counts.

**Fix:**
```typescript
const load = useCallback(async (periodId: number, filters?: PeriodTrackingFilters) => {
  const requestId = ++loadSeqRef.current;
  setLoading(true);
  try {
    const res = await fetch(buildTrackingUrl(periodId, filters));
    if (requestId !== loadSeqRef.current) return;
    // ... existing status handling ...
  } finally {
    if (requestId === loadSeqRef.current) setLoading(false);
  }
}, []);
```

Prefer `AbortController` tied to `selectedPeriodId` + serialized filters for cancellation.

## Warnings

### WR-01: Export button uses `font-medium` (third weight)

**File:** `modules/weekly/ui/tracking/ExportToolbar.tsx:41`  
**Issue:** UI-SPEC allows only 400 (body) and 600 (`font-semibold`). Export pack button uses `font-medium` (500).

**Fix:** Remove `font-medium` or replace with `font-semibold` to match Phase 21 typography contract.

### WR-02: Filter bar draft persists after period change

**File:** `modules/weekly/ui/tracking/TrackingFiltersBar.tsx:45`, `modules/weekly/ui/tracking/WeeklyTrackingPage.tsx:98-101`  
**Issue:** `handlePeriodChange` resets parent `filters` to `{}` and clears selection, but `TrackingFiltersBar`'s internal `draft` state is untouched. Controls still display the previous period's filter values while the grid refetches unfiltered data — misleading CPMO UX.

**Fix:** Reset draft when period changes — e.g. pass `key={selectedPeriodId}` on `TrackingFiltersBar`, or lift draft state to the page and reset alongside `setFilters({})`.

### WR-03: "Open correction" shown when correction is already open

**File:** `modules/weekly/ui/report/WeeklyReportEditorPage.tsx:170-179`  
**Issue:** Button renders for any `status === 'submitted'` without checking `correction_open`. When correction is already open (fields editable), the CTA remains and may POST `/correct` again.

**Fix:**
```tsx
{shell.status === 'submitted' && !shell.correction_open && (
  <Button ...>Open correction</Button>
)}
```

### WR-04: Optimistic PATCH shell not reverted on 409/500

**File:** `modules/weekly/ui/report/useWeeklyReportEditor.ts:115-112`  
**Issue:** `patchField` optimistically merges into `shell` before the debounced flush. On PATCH 409 or 500, only a toast is shown; local fields retain unsaved edits that the server rejected, so the UI implies a saved draft.

**Fix:** On failed PATCH, reload the report (`await load()`) or revert `shell` from the last successful server snapshot stored in a ref.

---

_Reviewed: 2026-08-28T10:22:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
