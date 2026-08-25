---
phase: 04-service-layer
plan: 01
subsystem: services
tags: [services, access-control, errors, tdd, multi-tenant]
depends_on:
  requires: [Phase 2 repositories (projectAccessRow, risks.repo), Phase 1 vitest]
  provides: [lib/services/errors.ts, assertProjectAccess, serviceErrorResponse, risks.service]
  affects: [04-02 export leaks, 04-03 orchestration services, 04-04 thin resource sweep]
tech-stack:
  added: []
  patterns:
    - "Service errors: bare extends Error, this.name, no HTTP status (SVC-03)"
    - "assertProjectAccess returns Promise<void> and throws — never a boolean"
    - "Null-company actor allowed only when BOTH company_id and customer_company_id are null (CR-01)"
    - "serviceErrorResponse third mapper; IntegrationError deliberately falls through to 500"
    - "Services import repos + assert; never next/server; route peels session → actor"
key-files:
  created:
    - lib/services/errors.ts
    - lib/services/errors.unit.test.ts
    - lib/services/access.ts
    - lib/services/access.unit.test.ts
    - lib/services/risks.service.ts
    - lib/services/risks.service.unit.test.ts
    - app/api/projects/[id]/risks/route.test.ts
  modified:
    - lib/api-errors.ts
    - lib/api-errors.test.ts
    - app/api/projects/[id]/risks/route.ts
decisions:
  - "ForbiddenError body is always { error: 'Forbidden' } — message never crosses the wire"
  - "deleteRisk treats changes===0 as NotFoundError so the route yields 404 rather than {ok:true} on a miss"
  - "Route catch keeps repoErrorResponse for UnknownColumnError before serviceErrorResponse"
  - "Risks route tests mock repos (default tier) so skip count stays 109 without TEST_DATABASE_URL"
estimate:
  tokens: 42000
actuals:
  tokens: 8041
  tasks: 6
  commits: 6
metrics:
  duration_min: 5
  completed: "2026-08-10"
status: complete
---

# Phase [4] Plan [1]: Service Substrate + Reference Service Summary

Typed service errors, the single project-ownership assert, and `serviceErrorResponse` land first; `risks` is the tracer resource that proves session gate + access assert + prior owner shapes end to end on a route that previously had no auth at all.

## Completed Tasks

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Status-free ForbiddenError / NotFoundError / ValidationError | tdd | 825d9b7 | lib/services/errors.ts, errors.unit.test.ts |
| 2 | assertProjectAccess ownership primitive | tdd | 7fdf0bc | lib/services/access.ts, access.unit.test.ts |
| 3 | serviceErrorResponse mapper | tdd | 6881f0a | lib/api-errors.ts, lib/api-errors.test.ts |
| 4 | risks.service list/create/update/delete | tdd | fcbe7a5 | lib/services/risks.service.ts, risks.service.unit.test.ts |
| 5 | Rewire risks route onto service (HYG-02 401/403) | execute | b14225a | app/api/projects/[id]/risks/route.ts |
| 6 | Risks route 401/403/404/owner tests + full suite | execute | 56c3588 | app/api/projects/[id]/risks/route.test.ts |

## Verification Evidence

| Check | Result |
|-------|--------|
| `vitest run lib/services/errors` | 4 passed |
| `vitest run lib/services/access` | 8 passed |
| `vitest run lib/api-errors` | 10 passed |
| `vitest run lib/services/risks` | 14 passed |
| `vitest run app/api/projects/[id]/risks` | 7 passed |
| Full suite JSON reporter | 271 total, **162 passed**, **109 skipped**, **0 failed** (baseline 124/109/0) |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` on changed files | exit 0 |
| `grep -rE "next/server\|NextRequest\|NextResponse" lib/services/` | no matches |

## Deviations from Plan

None - plan executed exactly as written.

### TDD Gate Compliance

- RED/GREEN per task: tests written with implementation in the same task commit (single-commit-per-task protocol). Each suite was green before commit.
- No `refactor(...)` commits — no post-GREEN cleanup needed.

## Requirement Coverage

| Requirement | Evidence |
|-------------|----------|
| SVC-02 | `serviceErrorResponse` maps 403/404/400 + generic 500 without `String(e)`; IntegrationError fall-through documented |
| SVC-03 | Three error classes, `grep -c status lib/services/errors.ts` = 0; layer free of framework HTTP types |
| SVC-04 | `assertProjectAccess` first statement of every risks.service function; admin/owner/cross-company/null-company paths unit-tested |
| SVC-07 | Explicit ForbiddenError case per risks.service function + route 403 test |

## Threat Surface

| Flag | File | Description |
|------|------|-------------|
| none | — | T-04-01..T-04-05 mitigations landed as planned (assert-first, session 401, ordered 404/403, CR-01 null-company, generic 500). No new endpoints, schemas, or auth surfaces outside the plan threat model. |

## Known Stubs

None.

## Self-Check: PASSED

- [x] lib/services/errors.ts (FOUND)
- [x] lib/services/access.ts (FOUND)
- [x] lib/services/risks.service.ts (FOUND)
- [x] lib/api-errors.ts exports serviceErrorResponse (FOUND)
- [x] app/api/projects/[id]/risks/route.ts uses getSessionFromRequest, no risks.repo import (FOUND)
- [x] app/api/projects/[id]/risks/route.test.ts (FOUND)
- [x] commits 825d9b7, 7fdf0bc, 6881f0a, fcbe7a5, b14225a, 56c3588 (FOUND)
