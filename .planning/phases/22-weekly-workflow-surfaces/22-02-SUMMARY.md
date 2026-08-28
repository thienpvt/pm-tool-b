---
phase: 22-weekly-workflow-surfaces
plan: 02
subsystem: ui
tags: [weekly, periods, config, sonner, react, vitest, tdd]

requires:
  - phase: 22-01
    provides: GET periods list shell, useWeeklyPeriods hook, viewer 403 panel
provides:
  - Company weekly config form with GET/PUT /api/weekly-periods/config (PERD-04, D-03, D-04)
  - Create period card with POST /api/weekly-periods and duplicate-week toast
  - Hook mutations saveConfig and createPeriod with in-flight disable states
affects: [22-03, 22-04, 22-05]

actuals:
  tokens: 5800
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Parallel GET periods + config on mount via Promise.all"
    - "Mutation toasts via sonner; 409 conflict as toast not page error"
    - "TDD RED/GREEN commits per task"

key-files:
  created:
    - modules/weekly/ui/periods/WeeklyConfigForm.tsx
  modified:
    - modules/weekly/ui/periods/useWeeklyPeriods.ts
    - modules/weekly/ui/periods/WeeklyPeriodsPage.tsx
    - modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx

key-decisions:
  - "SelectValue renders explicit weekday label for jsdom test compatibility"
  - "createPeriod reloads full page data via load() after 201; no optimistic append"
  - "409 POST maps to toast only; page shell error keys unchanged from 22-01"

patterns-established:
  - "Config card (weekly-config-form) then create card (weekly-create-form) then list (weekly-period-list)"
  - "Primary CTAs bg-blue-600 with disabled + aria-busy while mutation in flight"

requirements-completed: [PERD-04]

coverage:
  - id: D1
    description: "Company weekly config loads from GET and saves via PUT with Copywriting toasts"
    requirement: PERD-04
    verification:
      - kind: unit
        ref: "modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx#company weekly config"
        status: pass
    human_judgment: false
  - id: D2
    description: "Create period POSTs iso_week; 201 refreshes list; 409 shows conflict toast"
    requirement: PERD-04
    verification:
      - kind: unit
        ref: "modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx#create period"
        status: pass
    human_judgment: false
  - id: D3
    description: "Page zone order config → create → list; primary buttons disabled in-flight"
    requirement: PERD-04
    verification:
      - kind: unit
        ref: "modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx#page zone order and in-flight buttons"
        status: pass
    human_judgment: true
    rationale: "Toast timing and button disable during live interaction — auto-approved per executor instruction; unit tests cover disabled state"

duration: 4min
completed: 2026-08-28
status: complete
---

# Phase 22 Plan 02: Period Create and Config Summary

**CPMO can save company weekly due schedule and create ISO-week periods from /weekly/periods using existing config and POST APIs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-28T09:59:43Z
- **Completed:** 2026-08-28T10:03:21Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- WeeklyConfigForm with weekday Select (0–6 Sun–Sat) and UTC time input; Save schedule PUTs config
- Create period card POSTs `{ iso_week }`; 201 reloads list with Period created toast; 409 shows conflict toast
- Page zones: header → config → create → list; primary buttons disabled and aria-busy during mutations
- 15 component tests green; package.json unchanged

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1: Load and save company weekly config** — `4ad03ef` (test), `f80c330` (feat)
2. **Task 2: Create period POST and duplicate-week toast** — `3ca819b` (test), `c0570a1` (feat)
3. **Task 3: Periods page zone order and in-flight buttons** — `c2ace23` (test), `e1507de` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `modules/weekly/ui/periods/WeeklyConfigForm.tsx` — Due weekday/time form with Save schedule
- `modules/weekly/ui/periods/useWeeklyPeriods.ts` — Parallel GET config, saveConfig PUT, createPeriod POST
- `modules/weekly/ui/periods/WeeklyPeriodsPage.tsx` — Config and create cards above period list
- `modules/weekly/ui/periods/WeeklyPeriodsPage.component.test.tsx` — Config, create, zone-order tests

## Decisions Made

- SelectValue renders explicit weekday label because base-ui SelectValue shows raw value in jsdom
- After 201 create, full `load()` refetch (shows loading spinner briefly) rather than optimistic append
- 409 on POST is toast-only; does not set page-shell error state (viewer 403 from 22-01 unchanged)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test] Fixed PUT success test fetch mock overwrite**
- **Found during:** Task 1 (GREEN)
- **Issue:** Test called `setupStatusFetch` after custom `fetchMock`, overwriting the PUT handler
- **Fix:** Removed redundant `setupStatusFetch` call in PUT success test
- **Files modified:** WeeklyPeriodsPage.component.test.tsx
- **Committed in:** f80c330

**2. [Rule 1 - Test] Create-period success mock returns updated list after POST**
- **Found during:** Task 2 (GREEN)
- **Issue:** Reload GET still returned original fixture without new period row
- **Fix:** Mock tracks `posted` flag and includes newPeriod in subsequent GET
- **Files modified:** WeeklyPeriodsPage.component.test.tsx
- **Committed in:** c0570a1

---

**Total deviations:** 2 auto-fixed (both test correctness)
**Impact on plan:** No production scope change; tests accurately verify reload behavior.

## TDD Gate Compliance

- RED commits: 4ad03ef, 3ca819b, c2ace23
- GREEN commits: f80c330, c0570a1, e1507de
- All gates satisfied

## Issues Encountered

None — human-check auto-approved per executor instruction.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Periods page PERD-04 create + config complete; ready for 22-03 tracking surfaces
- Existing GET list tracer from 22-01 preserved; no new API routes added

## Self-Check: PASSED

- FOUND: modules/weekly/ui/periods/WeeklyConfigForm.tsx
- FOUND: 4ad03ef, f80c330, 3ca819b, c0570a1, c2ace23, e1507de

---
*Phase: 22-weekly-workflow-surfaces*
*Completed: 2026-08-28*
