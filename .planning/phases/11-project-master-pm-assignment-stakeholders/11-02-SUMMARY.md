---
phase: 11-project-master-pm-assignment-stakeholders
plan: 02
subsystem: api
tags: [vitest, governance, project-master, warnings, audit]

requires:
  - phase: 11-01
    provides: project_code, portfolio_year, stage columns and CPMO create validation
provides:
  - applyProjectGovernance pure helper with L5/terminal defaults and D-06 hard validation
  - updateProject/createProject return { ...row, warnings } with CPMO code_change audit
  - PM project_code strip on PATCH (D-03)
affects: [11-03, 11-04, 11-05, phase-13-weekly-reports]

actuals:
  tokens: 8200
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Warning-not-block: L5/terminal overrides persist server defaults and return warnings[] on 200 JSON"
    - "CPMO project_code change: in-place UPDATE + auditLog action code_change (D-19)"

key-files:
  created:
    - lib/services/project-governance.ts
    - lib/services/project-governance.unit.test.ts
  modified:
    - lib/services/projects.service.ts
    - lib/services/projects.service.unit.test.ts

key-decisions:
  - "Extended governance prior type with status_reason for merged Other validation on PATCH"
  - "findProjectByCompanyCode clash filtered by excluding current project id in service layer"

patterns-established:
  - "applyProjectGovernance: pure function, no DB; projects.service wires prior from getProjectRepo"
  - "Phase 13 progress_pct contract documented in project-governance.ts header (D-09)"

requirements-completed: [PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06, PROJ-07, PROJ-08]

coverage:
  - id: D1
    description: applyProjectGovernance L5 defaults and warning-not-block overrides
    requirement: PROJ-05
    verification:
      - kind: unit
        ref: lib/services/project-governance.unit.test.ts#L5 yields status Completed
        status: pass
    human_judgment: false
  - id: D2
    description: D-06 hard ValidationError for Other without reason and weekly without period
    requirement: PROJ-04
    verification:
      - kind: unit
        ref: lib/services/project-governance.unit.test.ts#status Other without status_reason
        status: pass
    human_judgment: false
  - id: D3
    description: Terminal status RAG Not applicable with warnings (D-08)
    requirement: PROJ-06
    verification:
      - kind: unit
        ref: lib/services/project-governance.unit.test.ts#status Paused with client RAG Green
        status: pass
    human_judgment: false
  - id: D4
    description: CPMO in-place project_code UPDATE with auditLog code_change
    requirement: PROJ-02
    verification:
      - kind: unit
        ref: lib/services/projects.service.unit.test.ts#CPMO in-place project_code change
        status: pass
    human_judgment: false
  - id: D5
    description: PM PATCH strips project_code from persisted fields
    requirement: PROJ-03
    verification:
      - kind: unit
        ref: lib/services/projects.service.unit.test.ts#strips project_code from PM update
        status: pass
    human_judgment: false
  - id: D6
    description: updateProject/createProject return warnings array on 200-shaped row
    requirement: PROJ-05
    verification:
      - kind: unit
        ref: lib/services/projects.service.unit.test.ts#stage L5 returns id and warnings
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-26
status: complete
---

# Phase 11 Plan 02: Governance & CPMO Code Change Summary

**Pure governance helper with L5/terminal warning-not-block defaults wired into PATCH/create; CPMO in-place project_code UPDATE with auditLog**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-25T19:47:00Z
- **Completed:** 2026-08-25T19:55:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `applyProjectGovernance` — L5 sets Completed / Not applicable / 100% with warnings on client overrides; terminal statuses default RAG; D-06 hard ValidationError only for Other-without-reason, weekly-without-period, and progress bounds
- Wired `updateProject` and `createProject` to apply governance, return `{ ...row, warnings }`, strip `project_code` for non-CPMO, and audit CPMO code changes in-place (D-02, D-19)
- Documented Phase 13 `progress_pct` read-at-submit contract (D-09); no snapshot tables added (D-10)

## Task Commits

1. **Task 11-02-01: L5 and terminal defaults return warnings**
   - `bf3b32d` test(11-02): RED add failing tests for applyProjectGovernance
   - `c46df4a` feat(11-02): implement applyProjectGovernance L5/terminal defaults
2. **Task 11-02-02: Wire PATCH create governance and CPMO code UPDATE**
   - `662e4dc` test(11-02): RED add governance wiring tests for projects.service
   - `1c71ec5` feat(11-02): wire governance PATCH create and CPMO code change

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `lib/services/project-governance.ts` — Pure governance defaults + D-06 validation + Phase 13 progress contract comment
- `lib/services/project-governance.unit.test.ts` — 9 unit tests for L5, terminal, D-06, progress bounds
- `lib/services/projects.service.ts` — Governance wiring, CPMO code change, auditLog, warnings on return
- `lib/services/projects.service.unit.test.ts` — PM strip, CPMO audit, duplicate ConflictError, L5 warnings

## Decisions Made

- Extended governance `prior` with `status_reason` for merged Other validation on PATCH updates
- Service-layer exclude-current-id filter on `findProjectByCompanyCode` rather than repo signature change
- PATCH route unchanged — passthrough JSON already serializes service return including `warnings`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest 4.1.10 does not support `-x` flag from plan verify commands; ran without `-x` (all 37 tests pass)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 11-03 can rewire PM assignment lookup without touching governance path
- PATCH clients receive top-level `id` plus `warnings` array on 200 responses

## Self-Check: PASSED

- FOUND: lib/services/project-governance.ts
- FOUND: lib/services/project-governance.unit.test.ts
- FOUND: lib/services/projects.service.ts (modified)
- FOUND: bf3b32d, c46df4a, 662e4dc, 1c71ec5

---
*Phase: 11-project-master-pm-assignment-stakeholders*
*Completed: 2026-08-26*
