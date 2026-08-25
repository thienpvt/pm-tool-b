---
phase: 07-ui-decomposition
plan: 06
subsystem: ui
tags: [react, nextjs, vitest, portfolio-roadmap, hook-extraction]

requires:
  - phase: 07-ui-decomposition
    provides: "07-02 portfolio report hook pattern; wave 2 route decompositions complete"
provides:
  - "Decomposed portfolio roadmap route with useRoadmapPage hook"
  - "Sub-400-line roadmap grid and toolbar modules under _components/"
  - "page.component.test.tsx with render + program filter interaction"
affects: [07-ui-decomposition, 07-07, 07-08]

actuals:
  tokens: 72000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "useRoadmapPage hook with container-owned viewMode and program/project filters"
    - "Banner-split _components/ with RoadmapPhaseGrid and RoadmapMilestoneView sub-splits"
    - "EpicDetailDialog extracted from page shell"

key-files:
  created:
    - app/portfolio/roadmap/useRoadmapPage.ts
    - app/portfolio/roadmap/types.ts
    - app/portfolio/roadmap/_components/PhaseColours.ts
    - app/portfolio/roadmap/_components/EpicColours.ts
    - app/portfolio/roadmap/_components/helpers.ts
    - app/portfolio/roadmap/_components/QuickViewPresets.ts
    - app/portfolio/roadmap/_components/ProjectInYearCheck.ts
    - app/portfolio/roadmap/_components/RoadmapToolbar.tsx
    - app/portfolio/roadmap/_components/RoadmapGrid.tsx
    - app/portfolio/roadmap/_components/RoadmapPhaseGrid.tsx
    - app/portfolio/roadmap/_components/RoadmapMilestoneView.tsx
    - app/portfolio/roadmap/_components/EpicDetailDialog.tsx
    - app/portfolio/roadmap/page.component.test.tsx
  modified:
    - app/portfolio/roadmap/page.tsx

key-decisions:
  - "View mode and program/project filter state stay in page container; hook owns all API fetches"
  - "RoadmapPhaseGrid and RoadmapMilestoneView sub-split from RoadmapGrid to satisfy 400-line cap"
  - "Component test uses dynamic year in fixture so projectInYear filter matches jsdom clock"

patterns-established:
  - "Portfolio roadmap mirrors 07-02: hook owns fetch, container owns filters and viewMode toggle"
  - "UI-09 grep clean on app/portfolio/roadmap/**"

requirements-completed: [UI-01, UI-06, UI-09, UI-10, UI-11, HYG-01, HYG-02, HYG-03]

coverage:
  - id: D1
    description: "Portfolio roadmap decomposed with useRoadmapPage hook and all files under 400 lines"
    requirement: UI-06
    verification:
      - kind: other
        ref: "powershell line-count gate (all files < 400)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Roadmap renders after /api/portfolio/roadmap load"
    requirement: UI-10
    verification:
      - kind: unit
        ref: "app/portfolio/roadmap/page.component.test.tsx#renders after load with roadmap fixture"
        status: pass
    human_judgment: false
  - id: D3
    description: "Program filter interaction changes visible projects"
    requirement: UI-10
    verification:
      - kind: unit
        ref: "app/portfolio/roadmap/page.component.test.tsx#program filter changes visible projects"
        status: pass
    human_judgment: false
  - id: D4
    description: "No server-layer imports in client roadmap tree"
    requirement: UI-09
    verification:
      - kind: other
        ref: "rg lib/db|lib/auth|@/server app/portfolio/roadmap/ (0 matches)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase vs milestone view modes preserved without visual redesign"
    requirement: UI-11
    verification: []
    human_judgment: true
    rationale: "Visual identity and milestone-mode layout require human UAT; component tests cover load and program filter only"

duration: 45min
completed: 2026-08-25
status: complete
---

# Phase 7 Plan 6: Portfolio Roadmap Decomposition Summary

**1141-line portfolio roadmap god page split into useRoadmapPage hook, 12 sub-400-line modules, 233-line container, and passing jsdom component tests**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-25T19:00:00Z
- **Completed:** 2026-08-25T19:45:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Extracted `useRoadmapPage` owning `/api/portfolio/roadmap`, milestones, milestone epics, and lazy epic fetches; container keeps viewMode, year range, and program/project filters
- Split phase colours, epic colours, timeline helpers, presets, and year filter into `_components/` modules; largest file is RoadmapPhaseGrid at 327 lines
- Thin `page.tsx` (233 lines) composes RoadmapToolbar, RoadmapGrid, and EpicDetailDialog
- Added `page.component.test.tsx` with render-after-load and program-filter interaction (2 passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, colour maps, helpers, hook** - `be61175` (feat)
2. **Task 2: Roadmap grid/page UI + thin container** - `6a8e440` (feat)
3. **Task 3: Component test + UI-09** - `1719b99` (test)

## Files Created/Modified

- `app/portfolio/roadmap/useRoadmapPage.ts` - Data hook for roadmap, milestones, epics
- `app/portfolio/roadmap/types.ts` - Shared roadmap types
- `app/portfolio/roadmap/page.tsx` - Thin container (233 lines)
- `app/portfolio/roadmap/_components/*` - Helpers, grid, toolbar, milestone view, epic dialog
- `app/portfolio/roadmap/page.component.test.tsx` - Component tests

## Decisions Made

- Sub-split RoadmapGrid into RoadmapPhaseGrid + RoadmapMilestoneView when combined module would exceed 400 lines
- EpicDetailDialog extracted as standalone dialog module (shared between phase and milestone modes)
- Test fixture uses `new Date().getFullYear()` for project dates so year filter matches jsdom environment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Sub-split RoadmapGrid into phase and milestone modules**
- **Found during:** Task 2 (line-count verify)
- **Issue:** Combined grid + milestone view would exceed 400 lines in a single RoadmapGrid.tsx
- **Fix:** Added RoadmapPhaseGrid.tsx (327 lines), RoadmapMilestoneView.tsx (201 lines), EpicDetailDialog.tsx (82 lines); RoadmapGrid.tsx is a 56-line router
- **Files modified:** app/portfolio/roadmap/_components/RoadmapPhaseGrid.tsx, RoadmapMilestoneView.tsx, EpicDetailDialog.tsx, RoadmapGrid.tsx
- **Committed in:** 6a8e440

**2. [Rule 1 - Bug] Component test fixture year alignment**
- **Found during:** Task 3 (test RED)
- **Issue:** Static 2026 dates failed when selectedYear filtered projects out of view in test environment
- **Fix:** Dynamic `${year}` dates in fixture; use getAllByText for names appearing in grid and filter dropdown
- **Files modified:** app/portfolio/roadmap/page.component.test.tsx
- **Committed in:** 1719b99

---

**Total deviations:** 2 auto-fixed (1 line-count gate, 1 test fixture)
**Impact on plan:** Necessary for UI-01 compliance and passing tests. No API or visual changes.

## Issues Encountered

None beyond test assertion fixes for duplicate project names in grid vs filter dropdown

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Portfolio roadmap route fully decomposed; ready for 07-07 (ImportMappingDialog) and 07-08 (home dashboard if remaining)
- Wave 3 portfolio roadmap complete with program-filter component test

## Self-Check: PASSED

- FOUND: app/portfolio/roadmap/useRoadmapPage.ts
- FOUND: app/portfolio/roadmap/page.component.test.tsx
- FOUND: app/portfolio/roadmap/_components/RoadmapGrid.tsx
- FOUND: app/portfolio/roadmap/page.tsx (233 lines)
- FOUND: be61175
- FOUND: 6a8e440
- FOUND: 1719b99

---
*Phase: 07-ui-decomposition*
*Completed: 2026-08-25*
