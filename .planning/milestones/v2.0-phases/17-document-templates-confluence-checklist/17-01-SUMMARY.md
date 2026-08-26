---
phase: 17-document-templates-confluence-checklist
plan: 01
subsystem: api
tags: [postgres, vitest, document-catalog, checklist, settings-flag-ddl]

requires:
  - phase: 16-portfolio-pm-dashboards
    provides: migrateDashboards settings-flag DDL, withCpmo, withAuth patterns
provides:
  - document_catalog, document_templates, project_document_checklist DDL via migrateDocuments
  - Company-scoped catalog CRUD API at /api/document-catalog
  - generateProjectChecklist idempotent helper
  - apply_to_in_flight backfill for Active projects
affects: [17-02, 17-03]

actuals:
  tokens: 14000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Settings-flag DDL after migrateDashboards (documents_ddl_v1)
    - Company-scoped catalog with soft-retire (active=false)
    - ON CONFLICT DO NOTHING for checklist idempotency

key-files:
  created:
    - lib/db-documents.ts
    - lib/repositories/document-catalog.repo.ts
    - lib/repositories/project-document-checklist.repo.ts
    - lib/services/document-catalog.service.ts
    - lib/services/document-checklist-generate.ts
    - app/api/document-catalog/route.ts
    - app/api/document-catalog/[id]/route.ts
  modified:
    - lib/db.ts

key-decisions:
  - "apply_to_in_flight implemented in tracer task 1 alongside create/update (plan allowed deferral to task 2)"
  - "Route tests mock catalog service; viewer 403 verified via ForbiddenError rejection mock"

patterns-established:
  - "Parallel document spine: catalog/checklist tables separate from legacy documents diary"
  - "generateProjectChecklist as dedicated module for 17-03 project hooks"

requirements-completed: [DOC-01, DOC-02]

coverage:
  - id: D1
    description: CPMO maintains company-scoped document catalog via POST/GET/PATCH /api/document-catalog
    requirement: DOC-01
    verification:
      - kind: unit
        ref: app/api/document-catalog/route.test.ts
        status: pass
      - kind: unit
        ref: lib/services/document-catalog.service.unit.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: generateProjectChecklist inserts missing stage-matching rows idempotently
    requirement: DOC-02
    verification:
      - kind: unit
        ref: lib/services/document-checklist-generate.unit.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: migrateDocuments creates three tables after migrateDashboards
    verification:
      - kind: unit
        ref: lib/db-documents.ddl.unit.test.ts
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 17 Plan 01: Document Catalog Tracer Summary

**Parallel document catalog spine with settings-flag DDL, CPMO catalog API, idempotent generateProjectChecklist helper, and explicit apply_to_in_flight backfill — legacy diary untouched.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-26T14:56:00Z
- **Completed:** 2026-08-26T15:21:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Three-table DDL (`document_catalog`, `document_templates`, `project_document_checklist`) wired via `migrateDocuments` after `migrateDashboards`
- CPMO POST/GET/PATCH catalog API with company isolation, Viewer GET 403, PM GET 200
- `generateProjectChecklist` inserts L2+ALL matching rows, skips existing, second call inserts 0
- `apply_to_in_flight` backfills Active projects on create/update; soft-retire via `active=false`
- `auditLog` on catalog create and update

## Task Commits

1. **Task 1 RED:** `13ad5a0` test(17-01): red catalog POST and generate helper
2. **Task 1 GREEN:** `4cfb3a9` feat(17-01): document catalog API and checklist generate helper
3. **Task 2 RED:** `e06b89f` test(17-01): red in-flight catalog apply
4. **Task 2 GREEN:** (included in `4cfb3a9` — apply logic shipped with tracer)
5. **Task 3 RED:** `3137036` test(17-01): red catalog by-id routes
6. **Task 3 GREEN:** `afba5d9` feat(17-01): catalog item GET and PATCH

## Files Created/Modified

- `lib/db-documents.ts` — DDL flag + three CREATE TABLE fragments + migrateDocuments
- `lib/db.ts` — await migrateDocuments after migrateDashboards
- `lib/repositories/document-catalog.repo.ts` — company-scoped insert/list/update/get + listActiveCatalogForStage
- `lib/repositories/project-document-checklist.repo.ts` — idempotent insert + list with catalog join
- `lib/services/document-catalog.service.ts` — create/update/list/get + applyCatalogToInFlightProjects + auditLog
- `lib/services/document-checklist-generate.ts` — generateProjectChecklist helper
- `app/api/document-catalog/route.ts` — GET withAuth, POST withCpmo
- `app/api/document-catalog/[id]/route.ts` — GET withAuth, PATCH withCpmo (no DELETE)

## Decisions Made

- apply_to_in_flight shipped in tracer (task 1) rather than deferred — tests in task 2 validate existing behavior
- Route tests fully mock catalog service; service unit tests cover Viewer ForbiddenError

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Scope alignment] apply_to_in_flight implemented in task 1 tracer**
- **Found during:** Task 1 GREEN
- **Issue:** Plan allowed deferring apply_to_in_flight to task 2; implemented alongside create for cohesive service
- **Fix:** Task 2 tests added; no separate feat commit needed
- **Files modified:** lib/services/document-catalog.service.ts
- **Verification:** lib/services/document-catalog.service.unit.test.ts apply_to_in_flight cases pass
- **Committed in:** 4cfb3a9

---

**Total deviations:** 1 (tracer included task 2 backfill logic)
**Impact on plan:** No scope creep; task 2 validated pre-shipped behavior.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 17-02 (template versioning routes)
- Ready for 17-03 (createProject/stage hooks calling generateProjectChecklist)
- Legacy `app/api/projects/[id]/documents` untouched

## Self-Check: PASSED

- FOUND: lib/db-documents.ts
- FOUND: app/api/document-catalog/route.ts
- FOUND: app/api/document-catalog/[id]/route.ts
- FOUND: .planning/phases/17-document-templates-confluence-checklist/17-01-SUMMARY.md
- FOUND: 13ad5a0, 4cfb3a9, e06b89f, 3137036, afba5d9

---
*Phase: 17-document-templates-confluence-checklist*
*Completed: 2026-08-26*
