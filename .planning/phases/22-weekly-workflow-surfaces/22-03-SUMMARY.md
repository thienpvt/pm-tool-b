---
phase: 22-weekly-workflow-surfaces
plan: 03
subsystem: ui
tags: [react, vitest, virtual-rows, weekly-tracking, nextjs]

requires:
  - phase: 22-01
    provides: VirtualRows primitive, shared types and fixtures
  - phase: 22-02
    provides: periods page patterns and error copy
provides:
  - CPMO /weekly/tracking page with period query, counts, filters, virtualized grid
  - usePeriodTracking hook for GET tracking with filter query params
  - Checkbox selection order preserved for export (22-04)
affects: [22-04-export-pack, 22-05-pm-editor]

actuals:
  tokens: 52000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Suspense + useSearchParams for shareable periodId query (D-10)"
    - "VirtualRows consumption without modifying 22-01 primitive (D-08)"
    - "Selection order as append-only project_ids array (D-12)"

key-files:
  created:
    - app/weekly/tracking/page.tsx
    - modules/weekly/ui/tracking/WeeklyTrackingPage.tsx
    - modules/weekly/ui/tracking/usePeriodTracking.ts
    - modules/weekly/ui/tracking/TrackingCountsBar.tsx
    - modules/weekly/ui/tracking/TrackingFiltersBar.tsx
    - modules/weekly/ui/tracking/TrackingGrid.tsx
    - modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx
  modified: []

key-decisions:
  - "Native HTML checkbox for technology_council filter — shadcn Checkbox not installed in repo"
  - "Selection clears on period or filter change only, not on every data refetch"

patterns-established:
  - "Tracking page mirrors periods page shell: Sidebar, loading spinner, in-page 403/401/5xx panels"
  - "Apply filters updates React state → useEffect refetches GET with URLSearchParams"

requirements-completed: [CPMO-05, PERF-01]

coverage:
  - id: D1
    description: "/weekly/tracking loads with shareable periodId query and latest iso_week fallback"
    requirement: CPMO-05
    verification:
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#falls back to latest iso_week when periodId is invalid"
        status: pass
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#uses periodId from query when valid"
        status: pass
    human_judgment: false
  - id: D2
    description: "Six count chips and Apply filters refetch GET with query params"
    requirement: CPMO-05
    verification:
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#shows six count chips including zeros from fixture"
        status: pass
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#Apply filters refetches GET with selected query keys only"
        status: pass
    human_judgment: false
  - id: D3
    description: "Virtualized grid with checkbox selection order and Open report links"
    requirement: PERF-01
    verification:
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#virtualizes 150 rows to at most 30 DOM nodes"
        status: pass
      - kind: unit
        ref: "modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx#records checkbox selection order as project_ids"
        status: pass
      - kind: unit
        ref: "modules/weekly/ui/shared/VirtualRows.component.test.tsx#windows 150 items to at most 30 DOM row nodes"
        status: pass
    human_judgment: true
    rationale: "Scroll performance and filter layout wrapping require visual verification per plan human-check"

duration: 12min
completed: 2026-08-28
status: complete
---

# Phase 22 Plan 03: CPMO Tracking Grid Summary

**CPMO tracking page with shareable periodId query, six count chips, filter bar, and VirtualRows grid with ordered checkbox selection**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-28T10:06:00Z
- **Completed:** 2026-08-28T10:18:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Thin re-export at `app/weekly/tracking/page.tsx` with Suspense-wrapped WeeklyTrackingPage (D-01)
- Period Select with `?periodId=` query, invalid fallback to latest iso_week, router.replace on change (D-10)
- GET tracking hook with filter query params: status, lateness, pm_user_id, stage, rag, technology_council (D-07)
- Six count chips always rendered including zeros
- TrackingFiltersBar with Apply filters refetch
- TrackingGrid consuming VirtualRows at ROW_HEIGHT 40; submitted-only checkboxes; header selects all filtered eligible rows; selection order preserved (D-08, D-12)
- Open report href `/projects/{project_id}/weekly-reports/{report_id}` (D-13)

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Tracking page period query and GET payload** - `95d18db` (test), `f99b137` (feat)
2. **Task 2: Counts chips and Apply filters bar** - `2982d77` (test), `cd6ccd0` (feat)
3. **Task 3: Virtualized tracking grid and checkbox selection order** - `e4e2918` (test), `85934d0` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `app/weekly/tracking/page.tsx` - Thin client re-export (D-01)
- `modules/weekly/ui/tracking/WeeklyTrackingPage.tsx` - Page shell, period Select, counts, filters, grid
- `modules/weekly/ui/tracking/usePeriodTracking.ts` - GET tracking with filter URLSearchParams
- `modules/weekly/ui/tracking/TrackingCountsBar.tsx` - Six summary chips
- `modules/weekly/ui/tracking/TrackingFiltersBar.tsx` - Filter controls + Apply filters
- `modules/weekly/ui/tracking/TrackingGrid.tsx` - VirtualRows body, badges, selection
- `modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx` - 14 component tests

## Decisions Made

- Used native HTML checkbox for technology_council filter because `@/components/ui/checkbox` is not installed
- Selection state clears on period or filter change, not on every tracking payload refresh

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Native checkbox instead of shadcn Checkbox**
- **Found during:** Task 2 (TrackingFiltersBar)
- **Issue:** `@/components/ui/checkbox` does not exist in repo; import failed tests
- **Fix:** Used native `<input type="checkbox">` with same aria-label and behavior
- **Files modified:** modules/weekly/ui/tracking/TrackingFiltersBar.tsx
- **Committed in:** cd6ccd0

**2. [Rule 1 - Bug] Test timing for deferred tracking fetch**
- **Found during:** Task 1 GREEN
- **Issue:** resolveTracking called before tracking fetch promise created
- **Fix:** await waitFor until resolveTracking is a function before resolving
- **Files modified:** modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx
- **Committed in:** f99b137

**3. [Rule 1 - Bug] Grid test selectors matched filter checkbox**
- **Found during:** Task 3 GREEN
- **Issue:** Selection order test clicked Technology council filter instead of row checkboxes
- **Fix:** Use getByLabelText('Select First Submitted') / getByLabelText('Select Second Submitted')
- **Files modified:** modules/weekly/ui/tracking/WeeklyTrackingPage.component.test.tsx
- **Committed in:** 85934d0

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All necessary for correctness; no scope creep. Export toolbar deferred to 22-04 as planned.

## Issues Encountered

None beyond deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tracking grid and selectedIds ready for 22-04 Export pack POST
- VirtualRows.tsx unchanged (verified empty git diff)
- package.json unchanged

## Self-Check: PASSED

- FOUND: .planning/phases/22-weekly-workflow-surfaces/22-03-SUMMARY.md
- FOUND: app/weekly/tracking/page.tsx
- FOUND: modules/weekly/ui/tracking/TrackingGrid.tsx
- FOUND commits: 95d18db, f99b137, 2982d77, cd6ccd0, e4e2918, 85934d0

---
*Phase: 22-weekly-workflow-surfaces*
*Completed: 2026-08-28*
