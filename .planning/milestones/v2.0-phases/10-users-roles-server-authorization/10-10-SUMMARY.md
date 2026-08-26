---
phase: 10-users-roles-server-authorization
plan: 10
subsystem: auth
tags: [access, toAccessActor, role-matrix, vitest, portfolio, D-24]

requires:
  - phase: 10-users-roles-server-authorization
    provides: assertProjectWriteAccess on risks POST (10-04), assertCompanyWrite needs actor.roles (10-09)
provides:
  - lib/http/role-matrix.test.ts proving Viewer GET allow, Viewer POST deny, PM-unassigned POST 403, CPMO POST allow (D-19)
  - All leftover portfolio/programs two-field actors peeled to toAccessActor(user) (D-03, D-24)
affects: [10-11, phase-11]

actuals:
  tokens: 4700
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Routes peel session via toAccessActor(user) so roles[] reach assertCompanyWrite and assertCanMutate (D-03)"
    - "Single role-matrix.test.ts complements per-route access tests without replacing them (D-19)"

key-files:
  created:
    - lib/http/role-matrix.test.ts
  modified:
    - app/api/portfolio/route.ts
    - app/api/portfolio/roadmap/route.ts
    - app/api/portfolio/milestones/route.ts
    - app/api/portfolio/roadmap/epics/route.ts
    - app/api/programs/route.ts
    - app/api/portfolio/quota/route.ts
    - app/api/portfolio/members/route.ts
    - app/api/portfolio/members/[id]/route.ts
    - app/api/portfolio/budgets/route.ts
    - app/api/portfolio/budgets/[id]/route.ts
    - app/api/portfolio/budgets/[id]/categories/route.ts
    - app/api/portfolio/budgets/[id]/categories/[catId]/route.ts
    - app/api/portfolio/budgets/[id]/allocations/route.ts
    - app/api/portfolio/budgets/[id]/allocations/[allocId]/route.ts
    - app/api/portfolio/program-allocations/[id]/route.ts

key-decisions:
  - "Removed local actorOf helpers; all portfolio/programs routes import toAccessActor from access.ts (D-03)"
  - "GET /api/portfolio/report already used toAccessActor from 10-08 — no change needed; POST isCpmo gate preserved"

patterns-established:
  - "Hand-rolled { company_id, is_admin } actors eliminated from product portfolio surface (D-24)"
  - "Role matrix uses same repo-boundary mocks as route.access.test.ts for GET project + POST risks"

requirements-completed: [AUTH-04, AUTH-05]

coverage:
  - id: D1
    description: Role matrix Viewer GET allow, Viewer POST deny, PM-unassigned POST 403, CPMO POST allow
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: lib/http/role-matrix.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Portfolio/programs leftover actors carry roles via toAccessActor
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: lib/http/role-matrix.test.ts
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-26
status: complete
---

# Phase 10 Plan 10: Actor Peel + Role Matrix Summary

**D-19 role-matrix test plus toAccessActor peel on all leftover portfolio/programs two-field actors (D-24)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-26T02:03:00+07:00
- **Completed:** 2026-08-26T02:08:00+07:00
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Added `lib/http/role-matrix.test.ts` covering Viewer GET 200, Viewer POST risks 403, PM-unassigned POST 403, CPMO in-company POST 201 (D-19, AUTH-04, AUTH-05)
- Replaced all `{ company_id, is_admin }` and local `actorOf` helpers with `toAccessActor(user)` on GET /api/portfolio, GET /api/portfolio/roadmap, GET+POST /api/programs, GET /api/portfolio/milestones, quota, members, budgets, program-allocations, and roadmap/epics (D-03, D-24)
- Preserved 10-08 POST /api/portfolio/report isCpmo gate; GET already used toAccessActor

## Task Commits

1. **Task 1: Ship Viewer/PM/CPMO role-matrix test** - `4ad9718` (test)
2. **Task 2: toAccessActor on portfolio GET, programs, milestones, quota, allocations, and members** - `fbbe0d2` (feat)
3. **Task 3: toAccessActor on portfolio budget routes, report GET, and epics** - `67c077e` (feat)

## Files Created/Modified

- `lib/http/role-matrix.test.ts` - D-19 role matrix across GET project + POST risks
- `app/api/programs/route.ts` - GET+POST peel to toAccessActor
- `app/api/portfolio/route.ts`, `roadmap/route.ts`, `milestones/route.ts`, `roadmap/epics/route.ts` - GET peels
- `app/api/portfolio/quota`, `members`, `budgets`, `program-allocations` routes - removed actorOf helpers

## Decisions Made

- Followed plan exactly; report GET already compliant from prior wave
- D-23 carve-out honored: no changes to operations/** or /api/admin/companies

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AUTH-05 actor peel complete for product portfolio surface
- Role matrix green; ready for 10-11 phase closeout / verification

## Self-Check: PASSED

- FOUND: lib/http/role-matrix.test.ts
- FOUND: 4ad9718, fbbe0d2, 67c077e

---
*Phase: 10-users-roles-server-authorization*
*Completed: 2026-08-26*
