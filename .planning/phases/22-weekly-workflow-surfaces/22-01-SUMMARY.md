---
phase: 22-weekly-workflow-surfaces
plan: 01
subsystem: ui
tags: [weekly, virtual-rows, sidebar, react, vitest, tdd]

requires: []
provides:
  - In-repo VirtualRows fixed-height window (PERF-01, D-08, D-09)
  - Client-safe weekly types and shared fixtures for 22-02 through 22-05
  - CPMO periods list shell at /weekly/periods via module re-export (PERD-04, D-01, D-04)
  - Sidebar Weekly periods and Weekly tracking links gated on cpmo role (D-02)
affects: [22-02, 22-03, 22-04, 22-05]

actuals:
  tokens: 42000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Phase 21 module page + thin app re-export"
    - "GET-only hook with in-page 401/403/5xx panels"
    - "In-repo VirtualRows window (ROW_HEIGHT 40, overscan 5)"

key-files:
  created:
    - modules/weekly/ui/shared/VirtualRows.tsx
    - modules/weekly/ui/shared/types.ts
    - modules/weekly/ui/shared/weekly.fixture.ts
    - modules/weekly/ui/periods/useWeeklyPeriods.ts
    - modules/weekly/ui/periods/WeeklyPeriodsPage.tsx
    - modules/weekly/ui/periods/WeeklyPeriodList.tsx
    - app/weekly/periods/page.tsx
    - components/layout/Sidebar.weekly-nav.component.test.tsx
  modified:
    - components/layout/Sidebar.tsx

key-decisions:
  - "Used UI-SPEC page copy (not portfolio dashboard strings) for 403/5xx errors"
  - "CalendarDays and ListChecks icons for weekly NAV per UI-SPEC"
  - "Period list table extracted to WeeklyPeriodList in task 3 after tracer inline table"

patterns-established:
  - "modules/weekly/ui/ is the weekly UI root with app/weekly/** thin re-exports"
  - "VirtualRows exports ROW_HEIGHT for component tests"

requirements-completed: [PERD-04, PERF-01]

coverage:
  - id: D1
    description: VirtualRows windows 150 items to at most 30 DOM nodes
    requirement: PERF-01
    verification:
      - kind: unit
        ref: modules/weekly/ui/shared/VirtualRows.component.test.tsx#windows 150 items to at most 30 DOM row nodes
        status: pass
    human_judgment: false
  - id: D2
    description: CPMO periods GET page with loading, error, populated, and empty states
    requirement: PERD-04
    verification:
      - kind: unit
        ref: modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx
        status: pass
    human_judgment: false
  - id: D3
    description: Sidebar Weekly periods and Weekly tracking links for cpmo only
    verification:
      - kind: unit
        ref: components/layout/Sidebar.weekly-nav.component.test.tsx
        status: pass
    human_judgment: true
    rationale: NAV link order and visual density require human sign-off per plan human-check

duration: 8min
completed: 2026-08-28
status: complete
---

# Phase 22 Plan 01: Weekly Periods Tracer Summary

**CPMO weekly periods list via module re-export, in-repo VirtualRows window, and role-gated Sidebar NAV links**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-28T09:54:00Z
- **Completed:** 2026-08-28T10:02:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Shipped in-repo `VirtualRows` with 150-row DOM bound proof (≤30 mounted nodes)
- Added shared weekly types/fixtures consumed by later phase 22 plans
- Built CPMO `/weekly/periods` page shell with GET-only hook, loading/error/empty/populated states
- Added CPMO Sidebar links for Weekly periods and Weekly tracking after My dashboard

## Task Commits

Each task followed TDD with RED then GREEN commits:

1. **Task 1: End-to-end weekly periods GET path plus VirtualRows window**
   - RED: `2ad7797` test(22-01): red virtual rows and periods list tracer
   - GREEN: `3af8355` feat(22-01): virtual rows and periods list tracer
2. **Task 2: Sidebar Weekly periods and Weekly tracking links**
   - RED: `4f8147d` test(22-01): red sidebar weekly periods and tracking nav
   - GREEN: `ed0dcd5` feat(22-01): sidebar weekly periods and tracking links
3. **Task 3: Period list empty, overflow, and Track submissions density**
   - RED: `aa27104` test(22-01): red period list empty overflow and 401
   - GREEN: `707df92` feat(22-01): period list empty overflow and 401

## Files Created/Modified

- `modules/weekly/ui/shared/VirtualRows.tsx` — Fixed-height scroll window (ROW_HEIGHT 40, overscan 5)
- `modules/weekly/ui/shared/types.ts` — Client-safe weekly payload types
- `modules/weekly/ui/shared/weekly.fixture.ts` — Shared test fixtures including 150 tracking rows
- `modules/weekly/ui/periods/useWeeklyPeriods.ts` — GET /api/weekly-periods hook with auth error mapping
- `modules/weekly/ui/periods/WeeklyPeriodsPage.tsx` — Page shell with Sidebar, loading/error, list wiring
- `modules/weekly/ui/periods/WeeklyPeriodList.tsx` — Compact period table with empty state and Track submissions links
- `app/weekly/periods/page.tsx` — Thin use-client re-export (D-01)
- `components/layout/Sidebar.tsx` — CPMO weekly NAV links with CalendarDays/ListChecks
- `*.component.test.tsx` — VirtualRows, periods page, and sidebar weekly nav tests

## Decisions Made

- Used UI-SPEC error copy ("this page" not "this dashboard") throughout weekly periods shell
- Inserted weekly NAV after My dashboard and before NAV_SECONDARY per UI-SPEC
- Extracted `WeeklyPeriodList` in task 3 rather than keeping inline table from tracer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 22-02 can add period create/config forms atop `useWeeklyPeriods` and shared fixtures
- 22-03 can consume `VirtualRows`, types, and `trackingRows150` fixture
- Sidebar weekly links published; tracking page route still needed in 22-03

## Self-Check: PASSED

- FOUND: modules/weekly/ui/shared/VirtualRows.tsx
- FOUND: modules/weekly/ui/periods/WeeklyPeriodList.tsx
- FOUND: app/weekly/periods/page.tsx
- FOUND: .planning/phases/22-weekly-workflow-surfaces/22-01-SUMMARY.md
- FOUND: 2ad7797, 3af8355, 4f8147d, ed0dcd5, aa27104, 707df92

---
*Phase: 22-weekly-workflow-surfaces*
*Completed: 2026-08-28*
