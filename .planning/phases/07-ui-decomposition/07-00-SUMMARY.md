---
phase: 07-ui-decomposition
plan: 00
subsystem: testing
tags: [vitest, jsdom, component-tests, ui-decomposition]

requires:
  - phase: 01-test-harness
    provides: Vitest 4 node + jsdom projects, badge.test.tsx harness
provides:
  - jsdom project discovers *.component.test.tsx under components/ and app/
  - Wave 0 gate cleared for downstream page component tests (07-01+)
affects: [07-01, 07-02, 07-03, 07-04, 07-05, 07-06, 07-07, 07-08]

actuals:
  tokens: 120
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Phase 7 component tests use *.component.test.tsx naming; jsdom include must list both *.test.tsx and *.component.test.tsx"

key-files:
  created: []
  modified:
    - vitest.config.ts

key-decisions:
  - "Keep existing {components,app}/**/*.test.tsx include alongside new *.component.test.tsx glob — badge.test.tsx and future page tests coexist without rename"

patterns-established:
  - "Wave 0 vitest include: jsdom project lists both *.test.tsx and *.component.test.tsx globs"

requirements-completed: [UI-10, HYG-03]

coverage:
  - id: D1
    description: "Vitest jsdom project discovers *.component.test.tsx files under components/ and app/"
    requirement: UI-10
    verification:
      - kind: unit
        ref: "node -e vitest.config.ts glob inspection"
        status: pass
    human_judgment: false
  - id: D2
    description: "Existing badge.test.tsx still passes via jsdom project after include change"
    requirement: HYG-03
    verification:
      - kind: unit
        ref: "vitest run --project jsdom components/ui/badge.test.tsx --reporter=json (4 passed, 0 failed)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-25
status: complete
---

# Phase 07 Plan 00: Vitest jsdom Include Extension Summary

**Extended Vitest jsdom project to discover Phase 7 `*.component.test.tsx` files while preserving existing `*.test.tsx` coverage**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-25T11:44:00Z
- **Completed:** 2026-08-25T11:49:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `{components,app}/**/*.component.test.tsx` to jsdom project `include` array in `vitest.config.ts`
- Preserved existing `{components,app}/**/*.test.tsx` glob so `components/ui/badge.test.tsx` remains discoverable
- Smoke-verified jsdom harness: badge test suite passes (4 passed, 0 failed)
- Wave 0 complete — downstream plans (07-01+) may add page-level component tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend jsdom include for component tests** - `f608a46` (chore)
2. **Task 2: Smoke-verify jsdom harness still green** - `256c949` (test)

**Plan metadata:** pending (docs commit)

## Self-Check: PASSED

- FOUND: vitest.config.ts
- FOUND: .planning/phases/07-ui-decomposition/07-00-SUMMARY.md
- FOUND: f608a46 (Task 1 commit)
- FOUND: 256c949 (Task 2 commit)

## Files Created/Modified

- `vitest.config.ts` - jsdom project include now lists both `*.test.tsx` and `*.component.test.tsx` globs

## Decisions Made

- Kept both include globs rather than migrating badge.test.tsx to `.component.test.tsx` naming — Phase 1 harness unchanged, Phase 7 naming convention applies to new page tests only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 gate cleared; plan 07-01 may add `app/page.component.test.tsx`
- No blockers for downstream UI decomposition plans

---
*Phase: 07-ui-decomposition*
*Completed: 2026-08-25*
