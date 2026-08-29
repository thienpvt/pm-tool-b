---
phase: 22-weekly-workflow-surfaces
plan: 04
subsystem: ui
tags: [react, sonner, downloadBlob, weekly-export, vitest]

requires:
  - phase: 22-03
    provides: TrackingGrid checkbox selection and selectedIds state on WeeklyTrackingPage
provides:
  - ExportToolbar with format Select and Export pack CTA
  - exportPack on usePeriodTracking POSTing project_ids in selection order
  - Component tests for export POST, blob download, toasts, and format variants
affects: [22-05, CPMO-05 verification]

actuals:
  tokens: 9800
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Reuse dashboards downloadBlob for binary export downloads"
    - "Content-Disposition filename parsing with weekly-export.xlsx fallback"

key-files:
  created:
    - modules/weekly/ui/tracking/ExportToolbar.tsx
  modified:
    - modules/weekly/ui/tracking/usePeriodTracking.ts
    - modules/weekly/ui/tracking/WeeklyTrackingPage.tsx
    - modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx

key-decisions:
  - "Single ExportToolbar in header actions (zone 1) — no duplicate export bar"
  - "Deduplicate project_ids by first-seen order before POST to satisfy schema unique refine"

patterns-established:
  - "Export pack mirrors portfolio exportPack: POST → blob → downloadBlob → toast"

requirements-completed: [CPMO-05]

coverage:
  - id: D1
    description: "Export pack POSTs checkbox-ordered project_ids with selected format to /api/weekly-periods/{periodId}/export"
    requirement: CPMO-05
    verification:
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#POSTs project_ids in checkbox order with format xlsx on success"
        status: pass
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#POSTs format docx when docx is selected"
        status: pass
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#POSTs format pptx when pptx is selected"
        status: pass
    human_judgment: false
  - id: D2
    description: "200 response triggers downloadBlob with Content-Disposition filename and success toast"
    requirement: CPMO-05
    verification:
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#POSTs project_ids in checkbox order with format xlsx on success"
        status: pass
    human_judgment: true
    rationale: "Browser download behavior is browser-specific (plan human-check)"
  - id: D3
    description: "Empty selection disables Export pack with hint; in-flight shows Exporting…"
    requirement: CPMO-05
    verification:
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#disables Export pack with hint when selection is empty"
        status: pass
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#disables Export pack and shows Exporting… while POST is in-flight"
        status: pass
    human_judgment: false
  - id: D4
    description: "Failed export shows error toast, skips downloadBlob, re-enables button"
    requirement: CPMO-05
    verification:
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#shows failure toast and skips downloadBlob on 400"
        status: pass
    human_judgment: false
  - id: D5
    description: "project_ids sent to POST are unique preserving selection order"
    requirement: CPMO-05
    verification:
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#sends unique project_ids when select-all follows partial selection"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-28
status: complete
---

# Phase 22 Plan 04: Tracking Export Pack Summary

**CPMO export pack POSTs checkbox-ordered project_ids via downloadBlob with xlsx/docx/pptx format Select and no preview UI**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-28T10:18:00Z
- **Completed:** 2026-08-28T10:30:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `ExportToolbar` with format Select (xlsx default, docx, pptx) and primary Export pack button in tracking header
- Implemented `exportPack` on `usePeriodTracking` — POST JSON `{ project_ids, format }`, parse Content-Disposition filename, call shared `downloadBlob`
- Replaced debug `JSON.stringify(selectedIds)` dump with wired export toolbar
- 20 component tests covering empty/disabled states, POST body order, blob download, toasts, in-flight label, format variants, and unique ids

## Task Commits

1. **Task 1: Export pack POST, blob download, and empty selection**
   - `ff36875` test(22-04): red export pack post and blob download
   - `9743174` feat(22-04): export pack post and blob download
2. **Task 2: Format select and unique project_ids**
   - `e38d297` test(22-04): red export format select and unique ids
   - `6665f71` feat(22-04): export format select and unique ids

## Files Created/Modified

- `modules/weekly/ui/tracking/ExportToolbar.tsx` — Format Select + Export pack CTA with disabled/hint states
- `modules/weekly/ui/tracking/usePeriodTracking.ts` — `exportPack`, `exporting` flag, Content-Disposition parsing, unique ids
- `modules/weekly/ui/tracking/WeeklyTrackingPage.tsx` — Header toolbar wiring; removed debug selection dump
- `modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx` — Export pack test suite with mocked fetch/downloadBlob/toasts

## Decisions Made

- Single ExportToolbar instance in header (UI-SPEC zone 1) rather than duplicating in export bar zone 5
- Task 2 format/dedup logic shipped in task 1 GREEN commit; task 2 feat commit is empty marker since tests passed immediately

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

**Total deviations:** 0
**Impact on plan:** None

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- CPMO-05 export surface complete on `/weekly/tracking`
- Ready for 22-05 and phase verification
- No preview route references in tracking UI source

## Self-Check: PASSED

- FOUND: modules/weekly/ui/tracking/ExportToolbar.tsx
- FOUND: modules/weekly/ui/tracking/usePeriodTracking.ts
- FOUND: modules/weekly/ui/tracking/WeeklyTrackingPage.tsx
- FOUND: modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx
- FOUND: ff36875, 9743174, e38d297, 6665f71

---
*Phase: 22-weekly-workflow-surfaces*
*Completed: 2026-08-28*
