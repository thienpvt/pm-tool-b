---
phase: 09-mapping-table-tenant-isolation
plan: 03
subsystem: api
tags: [postgresql, vitest, tenant-isolation, jira-mapping]

requires:
  - phase: 09-01
    provides: migrateMappingTableTenancy helper, requireCompanyId pattern
  - phase: 09-02
    provides: bug mapping tenant isolation (no regression)
provides:
  - jira_jql_presets and jira_sync_mappings in migrateMappingTableTenancy (D-01/D-02)
  - jira-mapping.service.ts with JQL 403 assert and sync list/save scoping (D-03/D-04)
  - Company-scoped JQL cap (10) and sync eviction (5) DELETE predicates (D-04, T-09-04)
  - Thin /api/jira/jql-presets and /api/jira/sync-mappings routes (D-05)
affects: []

actuals:
  tokens: 48000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "JQL unique index (company_id, name, context) via extended MappingTableSpec"
    - "Sync eviction uses derived-table subquery with company_id on outer and inner DELETE"
    - "jira-mapping.service duplicates requireCompanyId/assertCompanyRow (not import-mapping)"

key-files:
  created:
    - lib/services/jira-mapping.service.ts
    - lib/services/jira-mapping.service.unit.test.ts
  modified:
    - lib/db-mapping-tenant.ts
    - lib/db.mapping-tenant-migration.integration.test.ts
    - test/repo-db.ts
    - lib/repositories/jira-config.repo.ts
    - lib/repositories/jira-config.repo.unit.test.ts
    - app/api/jira/jql-presets/route.ts
    - app/api/jira/jql-presets/[id]/route.ts
    - app/api/jira/jql-presets/route.test.ts
    - app/api/jira/sync-mappings/route.ts
    - app/api/jira/sync-mappings/route.test.ts

key-decisions:
  - "JQL preset unique key is (company_id, name, context) per research A1"
  - "Sync mappings: list isolation + POST scoping only — no by-id route (research A4)"
  - "findJqlPresetByName pre-check for ConflictError (same as timeline/bug)"
  - "companyJiraConfig / setCompanyJiraConfig left unchanged"

patterns-established:
  - "Jira mapping routes: withAuth → jira-mapping.service → jira-config.repo(companyId)"
  - "Integration tests: JQL and sync two-company backfill in migration spec file"

requirements-completed: [TENANT-01]

coverage:
  - id: D1
    description: Cross-company DELETE JQL preset returns 403 Forbidden
    requirement: TENANT-01
    verification:
      - kind: unit
        ref: "lib/services/jira-mapping.service.unit.test.ts#deleteJqlPreset ForbiddenError"
        status: pass
      - kind: unit
        ref: "app/api/jira/jql-presets/route.test.ts#403 cross-company"
        status: pass
    human_judgment: false
  - id: D2
    description: JQL list/create scoped to session company+context; sync list scoped per company
    requirement: TENANT-01
    verification:
      - kind: unit
        ref: "lib/services/jira-mapping.service.unit.test.ts#list and create JQL"
        status: pass
      - kind: unit
        ref: "lib/repositories/jira-config.repo.unit.test.ts#company_id filter JQL and sync"
        status: pass
      - kind: unit
        ref: "app/api/jira/sync-mappings/route.test.ts#session-company GET"
        status: pass
    human_judgment: false
  - id: D3
    description: Two-company JQL/sync backfill; sync eviction cannot delete other tenants
    requirement: TENANT-01
    verification:
      - kind: integration
        ref: "lib/db.mapping-tenant-migration.integration.test.ts#jql and sync backfill"
        status: pass
      - kind: unit
        ref: "lib/repositories/jira-config.repo.unit.test.ts#saveJiraSyncMapping company_id DELETE"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 9 Plan 03: Jira Mapping Tenant Isolation Summary

**Company-scoped jira_jql_presets and jira_sync_mappings with migrateMappingTableTenancy, jira-mapping.service tenant assert, scoped sync eviction, and Vitest 403/list coverage (TENANT-01 wave 3 — completes all four mapping tables)**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-25T17:03:00Z
- **Completed:** 2026-08-25T17:28:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Registered `jira_jql_presets` (UNIQUE company_id, name, context) and `jira_sync_mappings` (company_id index only) in `migrateMappingTableTenancy` with D-02 two-company backfill
- Introduced `jira-mapping.service.ts` with `requireCompanyId`, `assertCompanyRow`, company-scoped JQL list/create/delete, and sync list/save
- Fixed high-risk global `saveJiraSyncMapping` eviction — DELETE now scoped by `company_id` on outer and inner subquery (derived table for PostgreSQL LIMIT)
- Thinned `/api/jira/jql-presets` and `/api/jira/sync-mappings` to call service; cross-company JQL DELETE returns 403 `{ error: 'Forbidden' }`
- All four TENANT-01 mapping tables now company-scoped; timeline and bug tests still pass (regression verified)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate JQL presets and sync mappings** - `1d039b0` (feat)
2. **Task 2: JQL preset service, repo, routes, and 403** - `c072c46` (test), `cf6d6b1` (feat)
3. **Task 3: Sync mappings list isolation and scoped eviction** - `bf0b603` (test), `cffedd6` (feat)

## Files Created/Modified

- `lib/db-mapping-tenant.ts` - JQL_SPEC + SYNC_SPEC with extended uniqueIndexColumns
- `lib/services/jira-mapping.service.ts` - Tenant assert + JQL/sync service functions
- `lib/repositories/jira-config.repo.ts` - Company-scoped JQL/sync SQL; companyJiraConfig unchanged
- `app/api/jira/jql-presets/route.ts` - GET/POST via service with actor
- `app/api/jira/jql-presets/[id]/route.ts` - DELETE via service with actor
- `app/api/jira/sync-mappings/route.ts` - GET/POST via service with actor
- `lib/db.mapping-tenant-migration.integration.test.ts` - JQL + sync two-company backfill assertions

## Decisions Made

- JQL unique index includes `context` column — same display name allowed across contexts within a company
- Sync mappings proven via list isolation + POST scoping (no by-id route per research A4)
- `findJqlPresetByName` pre-check for ConflictError (holidays/timeline analog)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 9 TENANT-01 complete — all four mapping tables company-scoped
- Ready for phase verification (`/gsd-verify-work 9`) and Phase 10 (CPMO/PM/Viewer roles)

## Self-Check: PASSED

- FOUND: lib/services/jira-mapping.service.ts
- FOUND: lib/db-mapping-tenant.ts (JQL_SPEC, SYNC_SPEC)
- FOUND: lib/db.mapping-tenant-migration.integration.test.ts (jql + sync blocks)
- FOUND: 1d039b0, c072c46, cf6d6b1, bf0b603, cffedd6

---
*Phase: 09-mapping-table-tenant-isolation*
*Completed: 2026-08-26*
