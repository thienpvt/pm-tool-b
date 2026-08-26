---
phase: 11-project-master-pm-assignment-stakeholders
plan: 03
subsystem: api
tags: [pm-assignments, access-control, postgres, vitest, backfill]

requires:
  - phase: 11-project-master-pm-assignment-stakeholders
    provides: project_pm_assignments DDL from 11-01; projects.service list wiring from 11-02
provides:
  - Nested CPMO-only /api/projects/[id]/pm-assignments GET/POST/PATCH with D-12 invariants
  - hasActivePmAssignment shared by assertPmWriteAccess, PM-only assertProjectAccess, listProjects
  - pm_assignment_backfill_v1 idempotent D-14 backfill
affects: [phase-12, phase-13, dashboards]

actuals:
  tokens: 42000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Soft-end assignment windows (effective_to) — never DELETE"
    - "CPMO assertCompanyWrite gate on assignment mutations"
    - "Single hasActivePmAssignment predicate on all three PM access sites"

key-files:
  created:
    - lib/repositories/pm-assignments.repo.ts
    - lib/services/pm-assignments.service.ts
    - lib/services/pm-assignments.service.unit.test.ts
    - app/api/projects/[id]/pm-assignments/route.ts
    - app/api/projects/[id]/pm-assignments/schema.ts
    - app/api/projects/[id]/pm-assignments/route.test.ts
    - lib/db-project-master.backfill.unit.test.ts
  modified:
    - lib/services/access.ts
    - lib/services/access.unit.test.ts
    - lib/repositories/projects.repo.ts
    - lib/repositories/projects.repo.unit.test.ts
    - lib/services/projects.service.ts
    - lib/services/projects.service.unit.test.ts
    - lib/db-project-master.ts

key-decisions:
  - "Kept assertPmWriteAccess export name; replaced lookup with hasActivePmAssignment only"
  - "Last-primary end uses endPrimaryWithCollaboratorCascade transaction for D-12 collaborator soft-end"
  - "Backfill uses DISTINCT ON (p.id) with Phase 10 email-first then name match rules"

patterns-established:
  - "Assignment mutations: assertProjectAccess then assertCompanyWrite (CPMO-only, D-15)"
  - "auditLog entity_type pm_assignment with create/end actions (D-19)"

requirements-completed: [PMAS-01, PMAS-02, PMAS-03, PMAS-04]

coverage:
  - id: D1
    description: "CPMO nested pm-assignments API with D-12 primary swap and collaborator cascade"
    requirement: PMAS-01
    verification:
      - kind: unit
        ref: lib/services/pm-assignments.service.unit.test.ts
        status: pass
      - kind: unit
        ref: app/api/projects/[id]/pm-assignments/route.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "assertPmWriteAccess, PM-only assertProjectAccess, and listProjects use hasActivePmAssignment"
    requirement: PMAS-04
    verification:
      - kind: unit
        ref: lib/services/access.unit.test.ts
        status: pass
      - kind: unit
        ref: lib/services/projects.service.unit.test.ts
        status: pass
      - kind: unit
        ref: lib/repositories/projects.repo.unit.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "D-14 idempotent pm_assignment_backfill_v1 from pm_email/pm_name"
    requirement: PMAS-04
    verification:
      - kind: unit
        ref: lib/db-project-master.backfill.unit.test.ts
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-08-26
status: complete
---

# Phase 11 Plan 03: PM Assignment Windows & Access Rewire Summary

**CPMO nested pm-assignments with D-12 invariants; all three PM access sites wired to hasActivePmAssignment; D-14 backfill idempotent**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-26T02:53:00+07:00
- **Completed:** 2026-08-26T02:57:00+07:00
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- CPMO can create and soft-end primary/collaborator assignment windows via nested `/api/projects/[id]/pm-assignments`; PM and viewer get 403 on POST/PATCH (D-15)
- D-12 enforced: second primary soft-ends prior; collaborator requires active primary; ending last primary cascades collaborator soft-end in one transaction
- `assertPmWriteAccess` name preserved; `assertProjectAccess` PM-only branch and `listProjects` PM filter all use `hasActivePmAssignment` — email/name no longer an access fallback (D-13, D-14)
- `pm_assignment_backfill_v1` backfill inserts at most one open primary per project from legacy pm_email/pm_name

## Task Commits

1. **Task 1: CPMO assignment windows with D-12 invariants** - `66b0e73` (feat)
2. **Task 2: Rewire all three PM lookup sites and backfill** - `ec360a3` (feat)

## Files Created/Modified

- `lib/repositories/pm-assignments.repo.ts` - hasActivePmAssignment, CRUD helpers, cascade transaction
- `lib/services/pm-assignments.service.ts` - CPMO-gated create/end with auditLog
- `app/api/projects/[id]/pm-assignments/route.ts` - GET/POST/PATCH nested routes
- `lib/services/access.ts` - hasActivePmAssignment on write and PM-only read
- `lib/repositories/projects.repo.ts` - listProjects pmUserId EXISTS filter
- `lib/db-project-master.ts` - backfillPmAssignments with pm_assignment_backfill_v1 flag

## Decisions Made

- Kept `assertPmWriteAccess` export name per Phase 10 contract; removed `matchesPmAssignment` entirely
- Used pg transaction helper only for last-primary + collaborator cascade (D-12 atomicity)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- PM access is unified on assignment windows; stakeholders (11-04) and downstream phases can rely on hasActivePmAssignment
- Denormalized pm_name/pm_email updated on primary change for display only

## Self-Check: PASSED

- FOUND: `.planning/phases/11-project-master-pm-assignment-stakeholders/11-03-SUMMARY.md`
- FOUND: commit 66b0e73
- FOUND: commit ec360a3

---
*Phase: 11-project-master-pm-assignment-stakeholders*
*Completed: 2026-08-26*
