---
phase: 10-users-roles-server-authorization
plan: 08
subsystem: api
tags: [vitest, access-control, anthropic, portfolio-report, project-report, isCpmo, assertProjectWriteAccess, AUTH-05]

requires:
  - phase: 10-users-roles-server-authorization
    provides: "assertProjectWriteAccess and isCpmo from 10-03 access spine"
provides:
  - "Project AI POST routes gate with assertProjectWriteAccess before Anthropic"
  - "Portfolio AI POST routes gate with isCpmo before Anthropic/email"
  - "Portfolio report list helpers stop passing leftover is_admin all-rows bypass"
  - "Route.access tests prove Viewer POST 403 without createMessage"
affects: [10-09, 10-10, 10-11]

actuals:
  tokens: 18000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "AI spend routes: tenant assert then role write gate before resolveAnthropicCredentials"
    - "Portfolio reads: company_id-only list scope (isAdmin=false at call sites until 10-09 repo cleanup)"

key-files:
  created:
    - app/api/projects/[id]/report/route.access.test.ts
    - app/api/portfolio/report/route.access.test.ts
  modified:
    - app/api/projects/[id]/report/route.ts
    - app/api/projects/[id]/project-report/route.ts
    - app/api/projects/[id]/project-report/generate-email/route.ts
    - app/api/portfolio/report/route.ts
    - app/api/portfolio/report/generate-email/route.ts
    - app/api/portfolio/report/send-email/route.ts
    - lib/services/portfolio-report.service.ts
    - lib/services/project-report.service.unit.test.ts
    - lib/services/portfolio-report.service.unit.test.ts
    - app/api/portfolio/report/send-email/route.test.ts

key-decisions:
  - "Project-report.service has read-only functions; POST write gate lives on route handlers via assertProjectWriteAccess"
  - "Portfolio write gate exported as assertPortfolioCpmoWrite helper; routes inline isCpmo check before credentials"
  - "List helpers in portfolio-report.service pass isAdmin=false (company_id only) per D-13 pending 10-09 repo SQL cleanup"

patterns-established:
  - "Viewer POST on AI report routes returns 403 before resolveAnthropicCredentials or createMessage"
  - "Portfolio AI/email POSTs require CPMO role in session company (D-13)"

requirements-completed: [AUTH-04, AUTH-05]

coverage:
  - id: D1
    description: "Viewer cannot POST project weekly AI report; createMessage not called"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "app/api/projects/[id]/report/route.access.test.ts#returns 403 Forbidden for a viewer-only in-company actor on POST"
        status: pass
    human_judgment: false
  - id: D2
    description: "Viewer cannot POST portfolio AI report; createMessage not called"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "app/api/portfolio/report/route.access.test.ts#returns 403 Forbidden for a viewer-only in-company actor on POST"
        status: pass
    human_judgment: false
  - id: D3
    description: "Portfolio report reads scoped by company_id without is_admin all-rows bypass"
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: "lib/services/portfolio-report.service.unit.test.ts#passes company scope without leftover is_admin all-rows bypass"
        status: pass
    human_judgment: false
  - id: D4
    description: "assertPortfolioCpmoWrite denies viewer and PM-only actors"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: "lib/services/portfolio-report.service.unit.test.ts#assertPortfolioCpmoWrite"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-26
status: complete
---

# Phase 10 Plan 08: AI Report POST Authorization Summary

**Six AI report/email POST routes now enforce AUTH-05: project paths use assertProjectWriteAccess; portfolio paths require CPMO via isCpmo before Anthropic or Resend**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-25T18:49:00Z
- **Completed:** 2026-08-25T19:01:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Three project AI POST handlers (`/report`, `/project-report`, `/project-report/generate-email`) call `assertProjectWriteAccess` before Anthropic work
- Three portfolio AI/email POST handlers require `isCpmo(toAccessActor(user))` and return 403 before credentials resolution
- Portfolio report service list helpers no longer pass `Boolean(actor.is_admin)` — company_id-only scope (D-13)
- Route.access tests lock Viewer POST → 403 with `createMessage` not invoked

## Task Commits

1. **Task 1 RED:** `09de76f` test(10-08): RED — viewer POST 403 on project AI report routes
2. **Task 1 GREEN:** `6f88bf4` feat(10-08): gate project AI POSTs with assertProjectWriteAccess
3. **Task 2 RED:** `3b147b4` test(10-08): RED — viewer POST 403 on portfolio AI routes
4. **Task 2 GREEN:** `f74f54b` feat(10-08): gate portfolio AI POSTs with isCpmo, drop is_admin list bypass

## Files Created/Modified

- `app/api/projects/[id]/report/route.access.test.ts` — Viewer POST 403 proof (D-15, D-19)
- `app/api/portfolio/report/route.access.test.ts` — Viewer portfolio AI POST 403 proof
- `app/api/projects/[id]/report/route.ts` — POST asserts write access
- `app/api/projects/[id]/project-report/route.ts` — POST asserts write access
- `app/api/projects/[id]/project-report/generate-email/route.ts` — POST asserts write access
- `app/api/portfolio/report/route.ts` — POST isCpmo gate; GET uses toAccessActor
- `app/api/portfolio/report/generate-email/route.ts` — POST isCpmo gate
- `app/api/portfolio/report/send-email/route.ts` — POST isCpmo gate
- `lib/services/portfolio-report.service.ts` — assertPortfolioCpmoWrite; list calls use isAdmin=false
- `lib/services/portfolio-report.service.unit.test.ts` — CPMO write gate + scope tests
- `lib/services/project-report.service.unit.test.ts` — assertProjectWriteAccess mock wiring
- `app/api/portfolio/report/send-email/route.test.ts` — CPMO session fixture for success paths

## Decisions Made

- Project-report.service remains read-only; write authorization for AI POSTs is enforced at route boundary (withProjectAccess + assertProjectWriteAccess)
- Portfolio GET peeled to toAccessActor in this plan (partial D-24); full GET actor peel for other portfolio routes remains 10-10

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] send-email route tests needed CPMO session fixture**
- **Found during:** Task 2 verification
- **Issue:** Existing send-email tests used a session without `roles`, causing 403 after isCpmo gate
- **Fix:** Added `roles: ['cpmo']` and required session fields to test fixture
- **Files modified:** app/api/portfolio/report/send-email/route.test.ts
- **Committed in:** f74f54b

**2. [Clarification] No project-report.service mutators**
- **Found during:** Task 1
- **Issue:** Plan referenced service mutators calling assertProjectWriteAccess; service only exposes read functions
- **Fix:** Write gate applied on three POST route handlers; unit test mocks assertProjectWriteAccess for future mutators
- **Files modified:** route handlers only (not service body)

---

**Total deviations:** 1 auto-fix (Rule 3) + 1 scope clarification
**Impact on plan:** No scope creep; AUTH-05 truths satisfied via route gates

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 10-09 can delete leftover all-rows SQL in portfolio.repo.ts / programs.repo.ts
- 10-10 can peel remaining portfolio GET actor objects
- Wave 3 parallel plans unblocked for company write asserts (10-09)

## Self-Check: PASSED

- FOUND: .planning/phases/10-users-roles-server-authorization/10-08-SUMMARY.md
- FOUND: 09de76f, 6f88bf4, 3b147b4, f74f54b

---
*Phase: 10-users-roles-server-authorization*
*Completed: 2026-08-26*
