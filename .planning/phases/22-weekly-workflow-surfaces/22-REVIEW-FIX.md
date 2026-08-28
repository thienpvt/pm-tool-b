---
phase: 22-weekly-workflow-surfaces
fixed_at: 2026-08-28T10:27:00Z
review_path: .planning/phases/22-weekly-workflow-surfaces/22-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 22: Code Review Fix Report

**Fixed at:** 2026-08-28T10:27:00Z
**Source review:** `.planning/phases/22-weekly-workflow-surfaces/22-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Verification

- **Gates:** `npx vitest run --project jsdom modules/weekly components/layout/Sidebar.weekly-nav.component.test.tsx`
- **Result:** 5 files, 59 tests passed
- **Environment:** main checkout (`workflow.use_worktrees=false` / isolation NONE)

## Fixed Issues

### BL-01: Debounced PATCH can write to the wrong report after navigation

**Files modified:** `modules/weekly/ui/report/useWeeklyReportEditor.ts`, `modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx`
**Commit:** `2f05ebe`
**Applied fix:** Clear debounce timer and `pendingPatchRef` on `projectId`/`reportId` change; guard `flushPatch` with `patchGenRef` to ignore stale in-flight responses. Added test that types into report 10, switches to report 11 before debounce fires, and asserts no PATCH is sent.

### BL-02: Stale tracking GET can overwrite the active period/filter view

**Files modified:** `modules/weekly/ui/tracking/usePeriodTracking.ts`, `modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx`
**Commit:** `f78a163`
**Applied fix:** Added `loadSeqRef` sequence token to `load()`; stale responses no longer update `data` or `loading`. Added test resolving period 2 before period 1 and asserting UI stays on period 2 counts.

### WR-01: Export button uses `font-medium` (third weight)

**Files modified:** `modules/weekly/ui/tracking/ExportToolbar.tsx`
**Commit:** `141ba5a`
**Applied fix:** Removed `font-medium` from Export pack button (default body weight).

### WR-02: Filter bar draft persists after period change

**Files modified:** `modules/weekly/ui/tracking/WeeklyTrackingPage.tsx`, `modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx`
**Commit:** `f7e9c8c`, `ca890e8` (test correction)
**Applied fix:** Added `key={selectedPeriodId}` on `TrackingFiltersBar` to remount and reset draft on period change. Added test verifying Status filter resets when period changes.

### WR-03: "Open correction" shown when correction is already open

**Files modified:** `modules/weekly/ui/report/WeeklyReportEditorPage.tsx`, `modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx`
**Commit:** `910105d`
**Applied fix:** Render Open correction only when `status === 'submitted' && !correction_open`. Added test for submitted shell with `correction_open: true`.

### WR-04: Optimistic PATCH shell not reverted on 409/500

**Files modified:** `modules/weekly/ui/report/useWeeklyReportEditor.ts`, `modules/weekly/ui/report/WeeklyReportEditorPage.component.test.tsx`
**Commit:** `85adb01`
**Applied fix:** On PATCH 409, non-OK, or catch, call `load()` to reload server snapshot and revert optimistic edits. Extended 409/500 tests to assert highlights revert to fixture value.

---

_Fixed: 2026-08-28T10:27:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
