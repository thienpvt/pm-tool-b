---
phase: 09-mapping-table-tenant-isolation
plan: 02
subsystem: api
tags: [postgresql, vitest, tenant-isolation, bug-import-mapping]

requires:
  - phase: 09-01
    provides: migrateMappingTableTenancy, requireCompanyId, assertCompanyRow, timeline service pattern
provides:
  - bug_import_mappings registered in migrateMappingTableTenancy (D-01/D-02)
  - Company-scoped bug list/create/delete + per-company 5-template eviction (D-04)
  - Thin /api/bug-import-mapping routes with 403 on foreign DELETE (D-03)
affects: [09-03]

actuals:
  tokens: 52000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "BUG_SPEC in migrateMappingTableTenancy registry (same D-01/D-02 as timeline)"
    - "createBugMapping service owns MAX_BUG_TEMPLATES=5 eviction scoped by company_id"
    - "Route tests mock import-mapping.service not repo (Pitfall 5)"

key-files:
  created: []
  modified:
    - lib/db-mapping-tenant.ts
    - lib/db.mapping-tenant-migration.integration.test.ts
    - test/repo-db.ts
    - lib/repositories/import-mapping.repo.ts
    - lib/repositories/import-mapping.repo.unit.test.ts
    - lib/repositories/import-mapping.repo.test.ts
    - lib/services/import-mapping.service.ts
    - lib/services/import-mapping.service.unit.test.ts
    - app/api/bug-import-mapping/route.ts
    - app/api/bug-import-mapping/[id]/route.ts
    - app/api/bug-import-mapping/route.test.ts

key-decisions:
  - "Reuse migrateOneTable with BUG_FLAG mapping_tenant_bug_import_mappings_v1"
  - "Cap eviction deletes oldest id from bugMappingIds(companyId) only — never global ORDER BY"
  - "findBugMappingByName pre-check for ConflictError (same as timeline)"

patterns-established:
  - "Bug mapping routes: withAuth → import-mapping.service → import-mapping.repo(companyId)"
  - "Integration tests: bug table two-company backfill in same file as timeline spec"

requirements-completed: [TENANT-01]

coverage:
  - id: D1
    description: Cross-company DELETE bug mapping returns 403 Forbidden
    requirement: TENANT-01
    verification:
      - kind: unit
        ref: "lib/services/import-mapping.service.unit.test.ts#deleteBugMapping ForbiddenError"
        status: pass
      - kind: unit
        ref: "app/api/bug-import-mapping/route.test.ts#403 cross-company"
        status: pass
    human_judgment: false
  - id: D2
    description: Bug list/create scoped to session company; per-company 5-template eviction
    requirement: TENANT-01
    verification:
      - kind: unit
        ref: "lib/services/import-mapping.service.unit.test.ts#list and create bug"
        status: pass
      - kind: unit
        ref: "lib/repositories/import-mapping.repo.unit.test.ts#company_id filter bug"
        status: pass
    human_judgment: false
  - id: D3
    description: Two-company bug backfill; unique names per company
    requirement: TENANT-01
    verification:
      - kind: integration
        ref: "lib/db.mapping-tenant-migration.integration.test.ts#bug backfill"
        status: pass
      - kind: integration
        ref: "lib/repositories/import-mapping.repo.test.ts#bug same name"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 9 Plan 02: Bug Import Mapping Tenant Isolation Summary

**Company-scoped bug_import_mappings with migrateMappingTableTenancy registration, service tenant assert, per-company cap eviction, and Vitest 403/list/create coverage (TENANT-01 wave 2)**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-25T16:59:00Z
- **Completed:** 2026-08-25T17:24:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Registered `bug_import_mappings` in `migrateMappingTableTenancy` with D-01/D-02 two-company backfill (no tenant collapse)
- Company-scoped bug repo SQL (`WHERE company_id = ?`) and service functions with `requireCompanyId` / `assertCompanyRow`
- Moved 5-template cap eviction from route into service — deletes oldest id of session company only (D-04)
- Thinned `/api/bug-import-mapping` routes to call service; cross-company DELETE returns 403 `{ error: 'Forbidden' }`
- Timeline mapping tests from 09-01 still pass (regression verified)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate bug_import_mappings with D-01/D-02 helper** - `d30fa0b` (feat)
2. **Task 2: Service and repo company-scoped** - `a5c647e` (test), `3f8c48b` (feat)
3. **Task 3: Thin routes and 403 tests** - `625a842` (test), `6d8be56` (feat)

## Files Created/Modified

- `lib/db-mapping-tenant.ts` - Added BUG_SPEC + second migrateOneTable call
- `lib/services/import-mapping.service.ts` - listBugMappings, createBugMapping, deleteBugMapping with cap eviction
- `lib/repositories/import-mapping.repo.ts` - Company-scoped bug CRUD + getBugMappingById
- `app/api/bug-import-mapping/route.ts` - GET/POST via service with actor
- `app/api/bug-import-mapping/[id]/route.ts` - DELETE via service with actor
- `lib/db.mapping-tenant-migration.integration.test.ts` - Bug table two-company backfill assertions
- `app/api/bug-import-mapping/route.test.ts` - Service mocks + 403 DELETE case

## Decisions Made

- Reused 09-01 `migrateOneTable` helper with separate `mapping_tenant_bug_import_mappings_v1` flag
- `findBugMappingByName` pre-check for ConflictError (holidays/timeline analog)
- Eviction uses last element of newest-first `bugMappingIds(companyId)` array (same semantics as prior route)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 09-03 (jira_jql_presets + jira_sync_mappings)
- Bug and timeline mapping tables both company-scoped; Jira tables still global

## Self-Check: PASSED

- FOUND: lib/db-mapping-tenant.ts (BUG_SPEC)
- FOUND: lib/services/import-mapping.service.ts (bug functions)
- FOUND: app/api/bug-import-mapping/route.ts (service imports)
- FOUND: d30fa0b, a5c647e, 3f8c48b, 625a842, 6d8be56

---
*Phase: 09-mapping-table-tenant-isolation*
*Completed: 2026-08-26*
