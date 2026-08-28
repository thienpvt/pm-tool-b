---
phase: 11-project-master-pm-assignment-stakeholders
plan: 04
subsystem: api
tags: [vitest, stakeholders, soft-end, withProjectAccess, audit]

requires:
  - phase: 11-01
    provides: project_stakeholders table and DDL spine
provides:
  - listProjectStakeholders exported list helper (STKH-03)
  - createProjectStakeholder / endProjectStakeholder with D-18 singletons and soft-end history
  - Nested GET/POST/PATCH /api/projects/[id]/stakeholders with assertProjectWriteAccess
affects: [11-05, phase-16-dashboards]

actuals:
  tokens: 6100
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Stakeholder history: INSERT + PATCH effective_to only; no physical DELETE (D-16)"
    - "Singleton active sponsor/chair/director enforced before insert (D-18)"
    - "auditLog entity_type project_stakeholder with limited snapshot fields (D-19)"

key-files:
  created:
    - lib/repositories/stakeholders.repo.ts
    - lib/services/stakeholders.service.ts
    - lib/services/stakeholders.service.unit.test.ts
    - app/api/projects/[id]/stakeholders/route.ts
    - app/api/projects/[id]/stakeholders/schema.ts
    - app/api/projects/[id]/stakeholders/route.test.ts
  modified: []

key-decisions:
  - "Singleton role check lives in service layer; repo exposes hasActiveStakeholderForRole query"
  - "PATCH end accepts body.id plus optional effective_to; no DELETE route export"

patterns-established:
  - "listProjectStakeholders: assertProjectAccess then repo list including ended rows"
  - "Nested stakeholders route mirrors milestones withProjectAccess thin handlers"

requirements-completed: [STKH-01, STKH-02, STKH-03]

coverage:
  - id: D1
    description: listProjectStakeholders returns full history after assertProjectAccess
    requirement: STKH-03
    verification:
      - kind: unit
        ref: lib/services/stakeholders.service.unit.test.ts#listProjectStakeholders asserts access then returns history including ended rows
        status: pass
    human_judgment: false
  - id: D2
    description: Create user or external stakeholder with write access
    requirement: STKH-01
    verification:
      - kind: unit
        ref: lib/services/stakeholders.service.unit.test.ts#create with in-company user_id succeeds for key_stakeholder
        status: pass
      - kind: unit
        ref: lib/services/stakeholders.service.unit.test.ts#create with external_name and external_email and no user_id succeeds
        status: pass
    human_judgment: false
  - id: D3
    description: Singleton sponsor/chair/director ValidationError when active window exists
    requirement: STKH-01
    verification:
      - kind: unit
        ref: lib/services/stakeholders.service.unit.test.ts#create sponsor while another sponsor window is active throws ValidationError
        status: pass
    human_judgment: false
  - id: D4
    description: End stakeholder sets effective_to without DELETE
    requirement: STKH-02
    verification:
      - kind: unit
        ref: lib/services/stakeholders.service.unit.test.ts#end sets effective_to via repo soft-end and does not delete
        status: pass
    human_judgment: false
  - id: D5
    description: Viewer cannot mutate stakeholders (403 on POST)
    requirement: STKH-01
    verification:
      - kind: unit
        ref: app/api/projects/[id]/stakeholders/route.test.ts#POST as viewer-only returns 403
        status: pass
    human_judgment: false
  - id: D6
    description: Nested stakeholders HTTP GET/POST/PATCH wired through withProjectAccess
    requirement: STKH-03
    verification:
      - kind: unit
        ref: app/api/projects/[id]/stakeholders/route.test.ts
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-08-26
status: complete
---

# Phase 11 Plan 04: Stakeholder History API Summary

**Nested stakeholders API with exported listProjectStakeholders, soft-end history, D-18 singleton roles, and write-access-gated mutations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-25T19:49:00Z
- **Completed:** 2026-08-25T19:53:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `listProjectStakeholders` is the single list source for dashboards/reports (STKH-03)
- Create accepts in-company `user_id` or external name/email; singleton sponsor/chair/director guarded (D-18)
- End role via PATCH sets `effective_to`; no physical DELETE (D-16, STKH-02)
- Nested `/api/projects/[id]/stakeholders` GET/POST/PATCH with viewer 403 on writes (D-17, AUTH-05)
- Incremental `auditLog` on create/end with limited snapshot fields (D-19)

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 11-04-01: Stakeholder service list helper and invariants**
   - `f32d73e` test(11-04): add failing stakeholder service tests (RED)
   - `3d4fcea` feat(11-04): stakeholder service list helper and invariants
2. **Task 11-04-02: Nested stakeholders HTTP routes**
   - `aa01f04` test(11-04): add failing stakeholders route tests (RED)
   - `daf6fe0` feat(11-04): nested stakeholders HTTP routes

## Files Created/Modified

- `lib/repositories/stakeholders.repo.ts` — list/insert/soft-end/get SQL for project_stakeholders
- `lib/services/stakeholders.service.ts` — listProjectStakeholders, create/end with access + audit
- `lib/services/stakeholders.service.unit.test.ts` — service behavior gate (7 tests)
- `app/api/projects/[id]/stakeholders/route.ts` — GET list, POST create 201, PATCH end
- `app/api/projects/[id]/stakeholders/schema.ts` — passthrough Zod schemas
- `app/api/projects/[id]/stakeholders/route.test.ts` — route wiring + viewer 403 (5 tests)

## Decisions Made

- Singleton role predicate kept in service; repo exposes `hasActiveStakeholderForRole` SQL only
- PATCH body uses `id` for stakeholder to end (matches 11-05 UI contract)
- Added `getStakeholder` repo helper for before-snapshot on end (no list scan)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest 4 rejects `-x` flag used in plan verify commands; ran tests without `-x` (all green)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 11-05 can wire project detail UI to GET/POST/PATCH stakeholders endpoints
- Phase 16 dashboards should call `listProjectStakeholders` — no duplicate columns on projects

## Self-Check: PASSED

- FOUND: lib/repositories/stakeholders.repo.ts
- FOUND: lib/services/stakeholders.service.ts
- FOUND: lib/services/stakeholders.service.unit.test.ts
- FOUND: app/api/projects/[id]/stakeholders/route.ts
- FOUND: app/api/projects/[id]/stakeholders/schema.ts
- FOUND: app/api/projects/[id]/stakeholders/route.test.ts
- FOUND: f32d73e, 3d4fcea, aa01f04, daf6fe0

---
*Phase: 11-project-master-pm-assignment-stakeholders*
*Completed: 2026-08-26*
