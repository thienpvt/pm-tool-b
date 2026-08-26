---
phase: 10-users-roles-server-authorization
plan: 09
subsystem: auth
tags: [access, cpmo, company-scope, vitest, assertCompanyWrite]

requires:
  - phase: 10-users-roles-server-authorization
    provides: assertProjectAccess company match, isCpmo from 10-03
provides:
  - assertCompanyWrite CPMO-only company write seam
  - Company-scoped program/portfolio/roadmap/resource-member lists (no leftover is_admin all-rows)
  - CPMO-only writes on programs, portfolio, import-mapping, jira-mapping, allocations POST, POST resource-audit
affects: [10-10]

actuals:
  tokens: 18360
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Tenant assert first, then assertCompanyWrite on company-scoped mutators (D-16)"
    - "Repository list functions take companyId only — no isAdmin SQL branches (D-13)"

key-files:
  created:
    - app/api/programs/[id]/project-allocations/route.access.test.ts
    - app/api/admin/resource-audit/route.access.test.ts
  modified:
    - lib/services/access.ts
    - lib/services/programs.service.ts
    - lib/repositories/programs.repo.ts
    - lib/services/portfolio.service.ts
    - lib/repositories/portfolio.repo.ts
    - lib/services/roadmap.service.ts
    - lib/repositories/resources.repo.ts
    - app/api/admin/resource-audit/route.ts
    - app/api/programs/[id]/project-allocations/route.ts

key-decisions:
  - "assertCompanyWrite checks actor role + non-null company_id only; tenant assert must already scope the resource (D-16)"
  - "Removed isAdmin parameter from repo list helpers; portfolio-report callers updated to single companyId arg"

patterns-established:
  - "Company-scoped product writes: assertProgramAccess/assertCompanyRow then assertCompanyWrite"
  - "Leftover break-glass is_admin no longer bypasses company_id on program/portfolio/roadmap/resource lists (D-03, D-13)"

requirements-completed: [AUTH-04, AUTH-05]

coverage:
  - id: D1
    description: assertCompanyWrite CPMO-only write gate
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: lib/services/access.unit.test.ts#assertCompanyWrite
        status: pass
    human_judgment: false
  - id: D2
    description: assertProgramAccess company match; leftover-flag CPMO 5 vs program 9 ForbiddenError
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: lib/services/programs.service.unit.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: POST project-allocations Viewer 403 after tenant asserts
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: app/api/programs/[id]/project-allocations/route.access.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: POST /api/admin/resource-audit Viewer 403; addMissingTeamMembersToPortfolio not called
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: app/api/admin/resource-audit/route.access.test.ts
        status: pass
    human_judgment: false
  - id: D5
    description: getPortfolioSummary / getRoadmap company-scoped for leftover-flag CPMO
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: lib/services/portfolio.service.unit.test.ts
        status: pass
    human_judgment: false
  - id: D6
    description: listResourceMembers company_id only; no all-rows branch
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: lib/repositories/resources.repo.unit.test.ts
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 10 Plan 09: Company-Scoped Product Auth Summary

**assertCompanyWrite plus company-scoped program/portfolio/roadmap lists; CPMO-only writes on allocations POST and POST resource-audit (D-24)**

## Performance

- **Duration:** 25 min
- **Tasks:** 3
- **Files modified:** 27
- **Tests:** 138 passed (4 skipped integration)

## Accomplishments

- Exported `assertCompanyWrite` — CPMO with non-null `company_id` only; Viewer/PM ForbiddenError (D-13, D-15)
- Replaced `assertProgramAccess` leftover `is_admin` early-return with company_id equality; `createProgram` stamps `actor.company_id`
- Removed all-rows `isAdmin` SQL branches from programs/portfolio repos; services pass `actor.company_id` only
- POST `/api/programs/[id]/project-allocations` and POST `/api/admin/resource-audit` gated with `assertCompanyWrite` after tenant/session
- Portfolio and jira-mapping mutators call tenant assert then `assertCompanyWrite`
- `listResourceMembers(companyId)` only — dropped `isAdmin` argument

## Task Commits

1. **Export assertCompanyWrite** - `7b03880` (feat)
2. **Company-scope programs, allocations POST, resource-audit** - `dd57d78` (feat)
3. **Company-scope portfolio, roadmap, listResourceMembers** - `e66c119` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest 4 does not support `-x` flag; ran tests without it.

## Self-Check: PASSED

- FOUND: .planning/phases/10-users-roles-server-authorization/10-09-SUMMARY.md
- FOUND: 7b03880, dd57d78, e66c119

---
*Phase: 10-users-roles-server-authorization*
*Completed: 2026-08-26*
