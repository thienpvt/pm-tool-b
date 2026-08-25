---
phase: 07-ui-decomposition
plan: 05
subsystem: ui
tags: [react, nextjs, vitest, milestones, hook-extraction]

requires:
  - phase: 07-ui-decomposition
    provides: "07-01 tracer pattern (colocated hook, page.component.test.tsx mock pattern)"
provides:
  - "Decomposed milestones route with useMilestonesPage hook"
  - "Sub-400-line milestones modules under _components/"
  - "page.component.test.tsx with render + milestone select interaction"
affects: [07-ui-decomposition, 07-06, 07-07, 07-08]

actuals:
  tokens: 54000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "useMilestonesPage hook owns fetch; container owns selection/dialog UI state"
    - "useMilestonesActions for CRUD/export handlers keeping page.tsx thin"
    - "ActivityDetail extracted as natural banner module per 07-PATTERNS"

key-files:
  created:
    - app/projects/[id]/milestones/useMilestonesPage.ts
    - app/projects/[id]/milestones/useMilestonesActions.ts
    - app/projects/[id]/milestones/types.ts
    - app/projects/[id]/milestones/_components/
    - app/projects/[id]/milestones/page.component.test.tsx
  modified:
    - app/projects/[id]/milestones/page.tsx

key-decisions:
  - "Handlers moved to useMilestonesActions.ts to keep page.tsx at 284 lines"
  - "MilestoneDialogs bundles edit/picker/detail/epic confirm dialogs; MilestoneList includes page header"
  - "Component test asserts milestone toolbar + item tree after list selection"

patterns-established:
  - "Milestones mirrors 07-01/07-03: hook owns fetch, actions hook for handlers, banner-split _components/"
  - "UI-09 grep gate clean on milestones decomposition tree"

requirements-completed: [UI-01, UI-05, UI-09, UI-10, UI-11, HYG-01, HYG-02, HYG-03]

coverage:
  - id: D1
    description: "Milestones page decomposed with useMilestonesPage hook wired from thin container"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "app/projects/[id]/milestones/page.component.test.tsx#renders after load with mocked milestones"
        status: pass
    human_judgment: false
  - id: D2
    description: "Milestone select interaction shows detail toolbar and items"
    requirement: UI-10
    verification:
      - kind: unit
        ref: "app/projects/[id]/milestones/page.component.test.tsx#selects milestone row and shows milestone detail toolbar"
        status: pass
    human_judgment: false
  - id: D3
    description: "All app/projects/[id]/milestones/** files under 400 lines"
    requirement: UI-01
    verification:
      - kind: other
        ref: "node line-count gate (max 358 MilestoneDialogs.tsx)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No server-layer imports in client milestones tree"
    requirement: UI-09
    verification:
      - kind: other
        ref: "rg forbidden imports app/projects/[id]/milestones/ (0 matches)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Screens remain visually recognizable (no redesign verification)"
    requirement: UI-11
    verification: []
    human_judgment: true
    rationale: "Visual identity requires human UAT checklist; component tests cover interaction only"

duration: 45min
completed: 2026-08-25
status: complete
---

# Phase 7 Plan 05: Milestones Decomposition Summary

**1182-line milestones god page split into useMilestonesPage hook, 8 sub-400-line modules, and passing vitest component tests**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-25T19:36:00Z
- **Completed:** 2026-08-25T20:21:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Extracted `useMilestonesPage` hook owning `/api/projects/{id}`, milestones, activities, and team fetch; selection/dialog state stays in container
- Split Types, Helpers, ActivityDetail, MilestoneList, MilestoneToolbar, MilestoneTree, and MilestoneDialogs into `_components/`
- Thin `page.tsx` (284 lines) composes hook, actions, and modules; `@/lib/status-weights` preserved
- Added `page.component.test.tsx` with render-after-load and milestone-select interaction (2 passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, helpers, ActivityDetail, hook** - `ddaf59c` (feat)
2. **Task 2: Milestone tree/toolbar + thin page** - `af48f37` (feat)
3. **Task 3: Component test + UI-09 grep** - `d4be2ec` (test)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `app/projects/[id]/milestones/useMilestonesPage.ts` - Data hook for project-scoped fetch
- `app/projects/[id]/milestones/useMilestonesActions.ts` - CRUD, picker, export handlers
- `app/projects/[id]/milestones/types.ts` - Shared types and PickerPhase
- `app/projects/[id]/milestones/page.tsx` - Thin container (284 lines)
- `app/projects/[id]/milestones/_components/*` - Helpers and UI modules
- `app/projects/[id]/milestones/page.component.test.tsx` - Component tests

## Decisions Made

- Extracted `useMilestonesActions.ts` to satisfy the 400-line cap without behavior change
- Renamed `helpers.ts` → `helpers.tsx` because LagBadge renders JSX
- Milestone select test asserts toolbar heading + tree item (reliable jsdom selection state)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added useMilestonesActions.ts**
- **Found during:** Task 2
- **Issue:** Inline CRUD/export handlers would keep page.tsx over 400 lines
- **Fix:** Extracted handlers to `useMilestonesActions.ts` (232 lines)
- **Files modified:** useMilestonesActions.ts, page.tsx
- **Committed in:** af48f37

**2. [Rule 3 - Blocking] helpers.tsx instead of helpers.ts**
- **Found during:** Task 1 TypeScript check
- **Issue:** LagBadge contains JSX; `.ts` extension caused parse errors
- **Fix:** Renamed to `helpers.tsx` with Milestone type import for `blank()`
- **Files modified:** _components/helpers.tsx
- **Committed in:** ddaf59c

**3. [Rule 2 - Missing Critical] MilestoneDialogs + MilestonePageHeader beyond plan artifact table**
- **Found during:** Task 2
- **Issue:** Four dialogs and page header inline would exceed line limits
- **Fix:** `MilestoneDialogs.tsx` bundles edit/picker/detail/epic dialogs; header in `MilestoneList.tsx`
- **Files modified:** MilestoneDialogs.tsx, MilestoneList.tsx
- **Committed in:** af48f37

---

**Total deviations:** 3 auto-fixed (2 Rule 2, 1 Rule 3)
**Impact on plan:** Necessary for line-count gate and UI-01. No API or visual changes.

## Issues Encountered

None blocking after helpers.tsx rename and TypeScript dispatch type fixes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Milestones route fully decomposed; wave 2 complete — ready for 07-06 roadmap or 07-07 import dialog
- Pattern proven: hook + actions + banner-split _components/ + component test

## Self-Check: PASSED

- FOUND: app/projects/[id]/milestones/useMilestonesPage.ts
- FOUND: app/projects/[id]/milestones/page.component.test.tsx
- FOUND: app/projects/[id]/milestones/page.tsx (284 lines)
- FOUND: ddaf59c, af48f37, d4be2ec

---
*Phase: 07-ui-decomposition*
*Completed: 2026-08-25*
