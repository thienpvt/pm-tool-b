---
phase: 10-users-roles-server-authorization
plan: 03
subsystem: auth
tags: [vitest, access-control, cpmo, pm-assignment, tenant-isolation]

requires:
  - phase: 10-users-roles-server-authorization
    provides: "hasRole, assertCanMutate, toAccessActor, roles on fixtures from 10-01"
provides:
  - "Company-scoped CPMO in assertProjectAccess (no is_admin cross-tenant bypass)"
  - "Interim D-14 assertPmWriteAccess / assertProjectWriteAccess seam"
  - "PM-only nested GET assignment via assertProjectAccess after tenant match"
  - "listProjects company-scoped; PM assigned-only; createProject CPMO-only"
affects: [10-04, 10-06, 10-07, 10-08, 10-09, 10-10]

actuals:
  tokens: 9318
  tasks: 3
  commits: 8

tech-stack:
  added: []
  patterns:
    - "isCpmo + D-14 matcher composes with tenant assert, never replaces it"
    - "assertProjectWriteAccess = tenant + mutate + PM write gate"

key-files:
  created:
    - lib/repositories/projects.repo.unit.test.ts
  modified:
    - lib/services/access.ts
    - lib/services/access.unit.test.ts
    - lib/services/projects.service.ts
    - lib/services/projects.service.unit.test.ts
    - lib/repositories/projects.repo.ts
    - lib/repositories/tenant-scope.repo.unit.test.ts
    - app/api/projects/[id]/route.access.test.ts
    - app/api/projects/route.ts

key-decisions:
  - "Removed is_admin early-return from assertProjectAccess; CPMO uses company_id match (D-13)"
  - "PM-only actors run D-14 matcher on GET after tenant match; pm+viewer skips matcher (D-24)"
  - "createProject stamps actor.company_id only; CPMO-only (D-13, D-15)"

patterns-established:
  - "assertPmWriteAccess is the Phase 11 replacement seam for PM assignment lookup"
  - "listProjects repo drops isAdmin global branch; PM filter via opts"

requirements-completed: [AUTH-04, AUTH-05, USER-03]

coverage:
  - id: D1
    description: "CPMO cannot read another company's project via assertProjectAccess"
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: "lib/services/access.unit.test.ts#throws ForbiddenError when CPMO company does not match"
        status: pass
    human_judgment: false
  - id: D2
    description: "PM write/list/GET gated by interim D-14 email-first assignment"
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: "lib/services/access.unit.test.ts#assertPmWriteAccess"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cross-company GET/PATCH return 403; Viewer and unassigned PM PATCH 403"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "app/api/projects/[id]/route.access.test.ts"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-26
status: complete
---

# Phase 10 Plan 03: Company-Scoped CPMO & PM Assignment Summary

**Removed global admin project bypass; CPMO is company-scoped, PM uses D-14 interim assignment on read/write/list, createProject is CPMO-only**

## Performance

- **Duration:** 8min
- **Started:** 2026-08-25T18:28:00Z
- **Completed:** 2026-08-25T18:36:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `assertProjectAccess` no longer treats `is_admin` as cross-tenant superuser; CPMO matches `company_id` / `customer_company_id` (D-13)
- PM-only actors run D-14 matcher after tenant match on GET; `assertPmWriteAccess` / `assertProjectWriteAccess` exported for writes (D-14, D-24)
- `listProjects` never uses global all-rows branch; PM lists assigned rows only; `createProject` is CPMO-only with session company stamp
- Route access matrix extended: foreign GET 403, Viewer PATCH 403, unassigned PM PATCH 403

## Task Commits

Each task was committed atomically (TDD test → feat pairs):

1. **Task 1: Company-scope CPMO in assertProjectAccess** - `58621c7` (test), `93a75f8` (feat)
2. **Task 2: Interim PM assignment seam and project list/create** - `04cbb16` (test), `8bae1f5` (feat)
3. **Task 3: Keep cross-company 403 on project GET/PATCH** - `a6badd7` (test), `4cdda6a` (feat)

**Plan metadata:** `3165411` (docs: complete plan)

## Files Created/Modified

- `lib/services/access.ts` - isCpmo, D-14 matcher, assertPmWriteAccess, assertProjectWriteAccess, company-scoped CPMO
- `lib/services/projects.service.ts` - list/create/update/delete role-aware behavior
- `lib/repositories/projects.repo.ts` - getProjectPmIdentity, listProjects without isAdmin branch
- `lib/repositories/projects.repo.unit.test.ts` - listProjects SQL contract tests
- `app/api/projects/route.ts` - toAccessActor for list/create
- `app/api/projects/[id]/route.access.test.ts` - Viewer/PM-unassigned PATCH 403, CPMO foreign GET 403

## Decisions Made

- Followed locked D-13/D-14/D-24: email-first when pm_email set; pm+viewer union skips GET matcher
- Phase 11 replaces assertPmWriteAccess lookup only (one-line comment preserved)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Nested mutators (10-04+) can call `assertProjectWriteAccess`
- Phase 11 can replace `getProjectPmIdentity` lookup inside `assertPmWriteAccess` without renaming the seam

## Self-Check: PASSED

- FOUND: .planning/phases/10-users-roles-server-authorization/10-03-SUMMARY.md
- FOUND: 58621c7, 93a75f8, 04cbb16, 8bae1f5, a6badd7, 4cdda6a

---
*Phase: 10-users-roles-server-authorization*
*Completed: 2026-08-26*
