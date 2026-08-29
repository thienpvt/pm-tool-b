---
phase: 20-api-contract-leftover-routes
plan: 06
subsystem: api
tags: [admin, service-layer, thin-routes, vitest, break-glass, requireAdmin]

requires:
  - phase: 20-api-contract-leftover-routes
    provides: Phase 20 THIN-01 pattern and D-23/D-05 service split conventions
provides:
  - admin-platform.service.ts with companies, demo-requests, and resource-audit wrappers
  - Thin /api/admin/companies route (requireAdmin break-glass, no withCpmo)
  - Thin /api/admin/demo-requests route (requireAdmin)
  - Thin /api/admin/resource-audit route (assertCompanyWrite on POST in route)
affects: [20-07-admin-jira-rag-settings]

actuals:
  tokens: 3000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Route → admin-platform.service → admin.repo for platform admin leftovers"
    - "D-23: companies/demo-requests keep requireAdmin is_admin; no withCpmo"
    - "D-24: resource-audit POST keeps assertCompanyWrite in route before service call"

key-files:
  created:
    - lib/services/admin-platform.service.ts
    - lib/services/admin-platform.service.unit.test.ts
    - app/api/admin/companies/route.test.ts
    - app/api/admin/demo-requests/route.test.ts
  modified:
    - app/api/admin/companies/route.ts
    - app/api/admin/demo-requests/route.ts
    - app/api/admin/resource-audit/route.ts
    - app/api/admin/resource-audit/route.access.test.ts

key-decisions:
  - "D-23 preserved: companies route uses requireAdmin/unauthorized/forbidden; withCpmo not added"
  - "D-24 preserved: assertCompanyWrite stays in resource-audit POST route, not moved to service"
  - "createCompanyPlatform maps repo throw to ConflictError for serviceErrorResponse 409"

patterns-established:
  - "admin-platform.service mirrors users.service repo-import + typed ConflictError pattern"
  - "Route tests use importOriginal auth mock to preserve real unauthorized/forbidden helpers"

requirements-completed: [THIN-01]

coverage:
  - id: D1
    description: admin-platform.service companies/demo/audit wrappers
    requirement: THIN-01
    verification:
      - kind: unit
        ref: lib/services/admin-platform.service.unit.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: /api/admin/companies break-glass requireAdmin with service delegation
    requirement: THIN-01
    verification:
      - kind: unit
        ref: app/api/admin/companies/route.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: /api/admin/demo-requests requireAdmin with service delegation
    requirement: THIN-01
    verification:
      - kind: unit
        ref: app/api/admin/demo-requests/route.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: /api/admin/resource-audit POST assertCompanyWrite gate before service
    requirement: THIN-01
    verification:
      - kind: unit
        ref: app/api/admin/resource-audit/route.access.test.ts
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 06: Admin Platform Service Summary

**admin-platform.service backs companies, demo-requests, and resource-audit with D-23 break-glass requireAdmin unchanged on companies**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-28T07:30:00Z
- **Completed:** 2026-08-28T07:35:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Created `admin-platform.service.ts` with `listCompaniesPlatform`, CRUD wrappers, demo-request helpers, and resource-audit functions delegating to `admin.repo`
- Thinned `/api/admin/companies` to service calls; kept `requireAdmin` with `unauthorized`/`forbidden`; POST uses `serviceErrorResponse` for 409 ConflictError; no `withCpmo`
- Thinned `/api/admin/demo-requests` list/update/delete to service; kept `requireAdmin`
- Thinned `/api/admin/resource-audit` GET/POST to service; POST still calls `assertCompanyWrite(actor)` in route before `addMissingTeamMembersToPortfolioForCompany`
- Added route and service unit tests (11 passing across wave)

## Task Commits

Each task was committed atomically:

1. **Task 1: admin-platform.service and thin companies route** - `4c8f87e` (feat)
2. **Task 2: Thin admin demo-requests route** - `8becbc8` (feat)
3. **Task 3: Thin resource-audit; keep assertCompanyWrite on POST** - `d1b7120` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `lib/services/admin-platform.service.ts` - Platform admin repo wrappers (companies, demo, audit)
- `lib/services/admin-platform.service.unit.test.ts` - listCompaniesPlatform (null, true) and ConflictError mapping
- `app/api/admin/companies/route.ts` - Service-backed break-glass CRUD
- `app/api/admin/companies/route.test.ts` - 401/403/200 auth gates
- `app/api/admin/demo-requests/route.ts` - Service-backed demo request admin
- `app/api/admin/demo-requests/route.test.ts` - 401/403/200 auth gates
- `app/api/admin/resource-audit/route.ts` - Service-backed audit with route-level write gate
- `app/api/admin/resource-audit/route.access.test.ts` - Mocks service; viewer 403 proves no add call

## Decisions Made

- Used `importOriginal` in companies/demo route tests to preserve real `unauthorized`/`forbidden` from `@/lib/auth`
- `createCompanyPlatform` catches repo throw and rethrows `ConflictError('Company name already exists')` for consistent 409 via `serviceErrorResponse`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Auth mock missing unauthorized/forbidden exports**
- **Found during:** Task 1 (companies route.test.ts)
- **Issue:** Partial `@/lib/auth` mock caused requireAdmin to fail when calling unauthorized/forbidden
- **Fix:** Switched to `importOriginal` pattern preserving real helper exports
- **Files modified:** app/api/admin/companies/route.test.ts, app/api/admin/demo-requests/route.test.ts
- **Verification:** vitest 401/403 tests pass
- **Committed in:** 4c8f87e (Task 1 commit, refined in 8becbc8 for demo-requests)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test infrastructure fix only; no behavior change.

## Issues Encountered

None beyond the auth mock fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 20-07 can add jira-config/rag-config/settings wrappers to separate service modules per D-05
- admin-platform.service is ready for any remaining platform admin routes in phase 20

## Self-Check: PASSED

- FOUND: lib/services/admin-platform.service.ts
- FOUND: lib/services/admin-platform.service.unit.test.ts
- FOUND: app/api/admin/companies/route.test.ts
- FOUND: app/api/admin/demo-requests/route.test.ts
- FOUND: app/api/admin/resource-audit/route.access.test.ts
- FOUND: commit 4c8f87e
- FOUND: commit 8becbc8
- FOUND: commit d1b7120

---
*Phase: 20-api-contract-leftover-routes*
*Completed: 2026-08-28*
