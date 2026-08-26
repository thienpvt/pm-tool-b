---
phase: 09-mapping-table-tenant-isolation
plan: 01
subsystem: api
tags: [postgresql, vitest, tenant-isolation, import-mapping]

requires: []
provides:
  - migrateMappingTableTenancy for timeline_import_mappings (reusable in 09-02/09-03)
  - import-mapping.service.ts with requireCompanyId + assertCompanyRow
  - Company-scoped timeline list/create/update/delete via /api/import-mapping
affects: [09-02, 09-03]

actuals:
  tokens: 72000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "migrateMappingTableTenancy: nullable column → backfill → NOT NULL → UNIQUE(company_id, name)"
    - "Service requireCompanyId + assertCompanyRow (NotFound then Forbidden ordering)"
    - "Repo companyId-first signatures with WHERE company_id = ?"

key-files:
  created:
    - lib/db-mapping-tenant.ts
    - lib/services/import-mapping.service.ts
    - lib/services/import-mapping.service.unit.test.ts
    - lib/db.mapping-tenant-migration.integration.test.ts
    - lib/repositories/import-mapping.repo.test.ts
  modified:
    - lib/db.ts
    - lib/repositories/import-mapping.repo.ts
    - lib/repositories/import-mapping.repo.unit.test.ts
    - app/api/import-mapping/route.ts
    - app/api/import-mapping/[id]/route.ts
    - app/api/import-mapping/route.test.ts
    - test/repo-db.ts

key-decisions:
  - "Pre-check duplicate template name via findTimelineMappingByName → ConflictError (no PG 23505 helper)"
  - "Multi-company backfill duplicates legacy rows via CROSS JOIN companies, never assigns all to company 1"

patterns-established:
  - "Timeline mapping routes: withAuth → import-mapping.service → import-mapping.repo(companyId)"
  - "Integration tests use describe.skipIf(!hasTestDb); migration test calls migrateMappingTableTenancy(pool) directly"

requirements-completed: [TENANT-01]

coverage:
  - id: D1
    description: Cross-company PUT/DELETE timeline mapping returns 403 Forbidden
    requirement: TENANT-01
    verification:
      - kind: unit
        ref: "lib/services/import-mapping.service.unit.test.ts#ForbiddenError cross-company"
        status: pass
      - kind: unit
        ref: "app/api/import-mapping/route.test.ts#403 cross-company"
        status: pass
    human_judgment: false
  - id: D2
    description: List/create scoped to session company; null company_id → 403
    requirement: TENANT-01
    verification:
      - kind: unit
        ref: "lib/services/import-mapping.service.unit.test.ts#list and create"
        status: pass
      - kind: unit
        ref: "lib/repositories/import-mapping.repo.unit.test.ts#company_id filter"
        status: pass
    human_judgment: false
  - id: D3
    description: Two-company backfill duplicates rows; unique names per company
    requirement: TENANT-01
    verification:
      - kind: integration
        ref: "lib/db.mapping-tenant-migration.integration.test.ts"
        status: pass
      - kind: integration
        ref: "lib/repositories/import-mapping.repo.test.ts"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-25
status: complete
---

# Phase 9 Plan 01: Timeline Mapping Tenant Tracer Summary

**Company-scoped timeline import mappings with migrateMappingTableTenancy, service tenant assert, and Vitest 403/list/create coverage (TENANT-01 tracer on timeline_import_mappings)**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-25T16:46:00Z
- **Completed:** 2026-08-25T17:31:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added `migrateMappingTableTenancy` for `timeline_import_mappings` with D-01 migration order and D-02 single/multi-company backfill (CROSS JOIN duplicate, never collapse to company 1)
- Introduced `import-mapping.service.ts` with `requireCompanyId`, `assertCompanyRow`, and company-scoped list/create/update/delete
- Refactored `/api/import-mapping` and `/api/import-mapping/[id]` to call the service (withAuth preserved); cross-company by-id returns 403 `{ error: 'Forbidden' }`
- Integration tests prove two-company backfill and per-company unique template names (skip cleanly without TEST_DATABASE_URL)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end timeline mapping tenant deny** - `04ccda7` (test), `fd84c1d` (feat)
2. **Task 2: Scope timeline list and stamp create from session** - `f923aa3` (test), `17cee57` (feat)
3. **Task 3: Prove two-company backfill and unique-per-company** - `3d878ad` (feat)

## Files Created/Modified

- `lib/db-mapping-tenant.ts` - Idempotent timeline tenancy migration (D-01/D-02)
- `lib/services/import-mapping.service.ts` - Tenant assert + list/create/update/delete
- `lib/repositories/import-mapping.repo.ts` - companyId-scoped timeline SQL; bug functions unchanged
- `app/api/import-mapping/route.ts` - GET/POST via service with actor
- `app/api/import-mapping/[id]/route.ts` - PUT/DELETE via service with actor
- `lib/db.mapping-tenant-migration.integration.test.ts` - Two-company backfill assertions
- `lib/repositories/import-mapping.repo.test.ts` - Same-name-across-companies integration

## Decisions Made

- Used `findTimelineMappingByName` pre-check for ConflictError on duplicate in-company names (holidays analog; no PG 23505 helper in codebase)
- Migration flag `mapping_tenant_timeline_import_mappings_v1` in settings table for idempotent re-run

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 09-02 (bug_import_mappings) — reuse `migrateMappingTableTenancy` spec registration pattern
- Ready for 09-03 (Jira preset/sync tables)
- Bug mapping routes still call global repo signatures until 09-02

## Self-Check: PASSED

- FOUND: lib/db-mapping-tenant.ts
- FOUND: lib/services/import-mapping.service.ts
- FOUND: lib/db.mapping-tenant-migration.integration.test.ts
- FOUND: lib/repositories/import-mapping.repo.test.ts
- FOUND: 04ccda7, fd84c1d, f923aa3, 17cee57, 3d878ad

---
*Phase: 09-mapping-table-tenant-isolation*
*Completed: 2026-08-25*
