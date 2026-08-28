---
phase: 10-users-roles-server-authorization
plan: 04
subsystem: auth
tags: [vitest, access-control, risks, issues, milestones, activities, assertProjectWriteAccess]

requires:
  - phase: 10-users-roles-server-authorization
    provides: "assertProjectWriteAccess exported by 10-03 (tenant + mutate + PM write)"
provides:
  - "Risk/issue/milestone/activity mutators call assertProjectWriteAccess (D-15, D-16, AUTH-05)"
  - "linkEpic/unlinkEpic and importActivities gated as writes"
  - "Read paths (list/get/listEpics) keep assertProjectAccess only"
affects: [10-06, 10-07, 10-08, 10-09, 10-10]

actuals:
  tokens: 3200
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Mutators switch assertProjectAccess → assertProjectWriteAccess; reads unchanged"
    - "Unit test mocks alias assertProjectWriteAccess same as prior assertProjectAccess on mutator describes"

key-files:
  created: []
  modified:
    - lib/services/risks.service.ts
    - lib/services/risks.service.unit.test.ts
    - lib/services/issues.service.ts
    - lib/services/issues.service.unit.test.ts
    - lib/services/milestones.service.ts
    - lib/services/milestones.service.unit.test.ts
    - lib/services/activities.service.ts
    - lib/services/activities.service.unit.test.ts

key-decisions:
  - "Removed redundant assertCanMutate from createRisk; assertProjectWriteAccess composes it (D-16)"
  - "linkEpic already-linked ignore preserved; only access assert changed"

patterns-established:
  - "RAID/timeline write surface uses assertProjectWriteAccess from 10-03 seam"

requirements-completed: [AUTH-04, AUTH-05]

coverage:
  - id: D1
    description: "Risk and issue create/update/delete call assertProjectWriteAccess"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "lib/services/risks.service.unit.test.ts"
        status: pass
      - kind: unit
        ref: "lib/services/issues.service.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Milestone CRUD plus linkEpic/unlinkEpic call assertProjectWriteAccess"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "lib/services/milestones.service.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Activity create/update/delete and importActivities call assertProjectWriteAccess"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "lib/services/activities.service.unit.test.ts"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-26
status: complete
---

# Phase 10 Plan 04: RAID/Timeline Write Gate Summary

**Nested project mutators for risks, issues, milestones (including epic link/unlink), and activities (including import) now call assertProjectWriteAccess so Viewer and unassigned PM are denied server-side**

## Performance

- **Duration:** 3min
- **Started:** 2026-08-26T01:37:00+07:00
- **Completed:** 2026-08-26T01:39:00+07:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Risk and issue create/update/delete switched from `assertProjectAccess` to `assertProjectWriteAccess`; removed redundant `assertCanMutate` on `createRisk`
- Milestone CRUD plus `linkEpic`/`unlinkEpic` gated as writes; `listEpics` remains read-only access
- Activity create/update/delete and `importActivities` gated as writes; list/get paths unchanged
- All 47 unit tests pass across the four service test files

## Task Commits

Each task followed TDD RED→GREEN:

1. **Task 1: Gate risks and issues mutators** — `0c1e0ba` (test RED), `1657da0` (feat)
2. **Task 2: Gate milestone writes including linkEpic and unlinkEpic** — `f89a994` (test RED), `df1a0af` (feat)
3. **Task 3: Gate activity writes including importActivities** — `644b6ad` (test RED), `41d4475` (feat)

## Files Created/Modified

- `lib/services/risks.service.ts` — mutators use `assertProjectWriteAccess`
- `lib/services/issues.service.ts` — mutators use `assertProjectWriteAccess`
- `lib/services/milestones.service.ts` — five write functions gated
- `lib/services/activities.service.ts` — four write functions gated including import
- Matching `*.service.unit.test.ts` — mocks and expectations updated per D-19

## Decisions Made

None beyond plan — followed 10-03 `assertProjectWriteAccess` seam exactly. D-23 carve-out respected (no changes to operations/** or /api/admin/companies).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Vitest 4 does not support the `-x` bail flag referenced in PLAN.md verify blocks; tests run without it and all pass.

## Next Phase Readiness

10-04 slice A complete. Remaining AUTH-05 product mutators: 10-06 (meetings, team, bugs, escalations), 10-07 (holidays, documents, budget), 10-08 (reports), 10-09 (programs/portfolio/import-mapping), 10-10 (actor peel).

## Self-Check: PASSED

- FOUND: lib/services/risks.service.ts
- FOUND: lib/services/issues.service.ts
- FOUND: lib/services/milestones.service.ts
- FOUND: lib/services/activities.service.ts
- FOUND: 0c1e0ba, 1657da0, f89a994, df1a0af, 644b6ad, 41d4475

---
*Phase: 10-users-roles-server-authorization*
*Completed: 2026-08-26*
