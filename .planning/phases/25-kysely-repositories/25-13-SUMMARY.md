---
phase: 25-kysely-repositories
plan: 13
subsystem: database
tags: [kysely, pickAllowed, postgres, mass-assignment, repositories]

requires:
  - phase: 25-kysely-repositories
    provides: getKysely factory, pickAllowed helper, testKysely harness
provides:
  - projects.repo.ts on getKysely with pickAllowed updateProject
  - activities.repo.ts on getKysely with pickAllowed updateActivity
  - risks.repo.ts on getKysely with pickAllowed updateRisk and RAID sql ordering
affects: [25-14, with-auth UnknownColumnError mapping]

actuals:
  tokens: 14000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "pickAllowed(COLUMNS, fields) before updateTable().set() for mass-assignment guard"
    - "RAID CASE/ORDER fragments preserved via kysely sql tagged templates"

key-files:
  created: []
  modified:
    - modules/projects/backend/repositories/projects.repo.ts
    - modules/projects/backend/repositories/projects.repo.test.ts
    - modules/projects/backend/repositories/activities.repo.ts
    - modules/projects/backend/repositories/activities.repo.test.ts
    - modules/projects/backend/repositories/risks.repo.ts
    - modules/projects/backend/repositories/risks.repo.test.ts

key-decisions:
  - "PROJECT_COLUMNS unchanged — company_id, customer_id, id remain excluded (D-04)"
  - "Delete helpers map Kysely numDeletedRows array element to legacy changes shape"
  - "listHighOpenRaid UNION kept as sql template fragments for parity"

patterns-established:
  - "W9b trio: getKysely reads/writes + pickAllowed on PATCH paths only"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "updateProject rejects company_id via pickAllowed UnknownColumnError"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/projects.repo.test.ts#rejects company_id"
        status: unknown
    human_judgment: true
    rationale: "Integration tests require TEST_DATABASE_URL — skipped in CI-less local run"
  - id: D2
    description: "updateActivity and updateRisk use pickAllowed with project_id excluded from SET"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/activities.repo.test.ts#rejects project_id"
        status: unknown
    human_judgment: true
    rationale: "Integration tests require TEST_DATABASE_URL — skipped in CI-less local run"
  - id: D3
    description: "All three repos route reads and writes through getKysely"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/*.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: true
    rationale: "Integration tests require TEST_DATABASE_URL — skipped in CI-less local run"

duration: 15min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 13: W9b projects/activities/risks pickAllowed Summary

**Three project write repos converted to getKysely with pickAllowed-guarded PATCH paths preserving UnknownColumnError mass-assignment semantics (ENF-02, D-04, W9b).**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-29T01:14:00Z
- **Completed:** 2026-08-29T01:29:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `projects.repo.ts`, `activities.repo.ts`, and `risks.repo.ts` fully on `getKysely` (D-05)
- `updateProject`, `updateActivity`, and `updateRisk` call `pickAllowed(COLUMNS, fields)` then `updateTable().set(picked)` (D-04)
- Test harness mocks `getKysely` → `testKysely`; fixed broken `_helpers` import path in projects tests
- RAID list ordering in risks preserved via `sql` tagged templates

## Task Commits

1. **Task 1 RED:** projects test harness — `3f46bf8` (test)
2. **Task 1 GREEN:** projects repo conversion — `fb565b7` (feat)
3. **Task 2 RED:** activities test harness — `f631985` (test)
4. **Task 2 GREEN:** activities repo conversion — `5a7617f` (feat)
5. **Task 3 RED:** risks test harness — `b274aac` (test)
6. **Task 3 GREEN:** risks repo conversion — `3343f1c` (feat)

## Files Created/Modified

- `modules/projects/backend/repositories/projects.repo.ts` — getKysely + pickAllowed updateProject
- `modules/projects/backend/repositories/projects.repo.test.ts` — testKysely mock, D-07 assertion
- `modules/projects/backend/repositories/activities.repo.ts` — getKysely + pickAllowed updateActivity
- `modules/projects/backend/repositories/activities.repo.test.ts` — testKysely mock
- `modules/projects/backend/repositories/risks.repo.ts` — getKysely + pickAllowed updateRisk + RAID sql
- `modules/projects/backend/repositories/risks.repo.test.ts` — testKysely mock

## Decisions Made

- Added `created_at: new Date()` on project insert to satisfy Kysely Insertable typing (DB default equivalent)
- Delete functions destructure `[result]` from Kysely execute array for `numDeletedRows` compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest integration tests skipped locally (no `TEST_DATABASE_URL`); typecheck clean on all three repo files

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- W9b complete; 25-14 (issues/meetings/escalations/team) can proceed independently
- withAuth UnknownColumnError → 400 mapping unchanged (D-06)

## Self-Check: PASSED

- FOUND: modules/projects/backend/repositories/projects.repo.ts
- FOUND: modules/projects/backend/repositories/activities.repo.ts
- FOUND: modules/projects/backend/repositories/risks.repo.ts
- FOUND: 3f46bf8, fb565b7, f631985, 5a7617f, b274aac, 3343f1c

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
