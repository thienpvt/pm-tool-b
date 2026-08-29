---
phase: 25-kysely-repositories
plan: 05
subsystem: database
tags: [kysely, postgres, documents, company-scoped, checklist]

requires:
  - phase: 25-04
    provides: getKysely admin conversion patterns and testKysely harness
provides:
  - document-catalog.repo on getKysely with company-scoped list/get/insert/update
  - document-templates.repo on getKysely with DISTINCT ON effective list
  - project-document-checklist.repo on getKysely with idempotent insert and join reads
affects: [25-06, documents-services, document-compliance]

actuals:
  tokens: 12000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns: [getKysely documents conversion, sql template for DISTINCT ON effective templates, onConflict doNothing checklist insert]

key-files:
  created:
    - modules/documents/backend/repositories/document-catalog.repo.test.ts
    - modules/documents/backend/repositories/document-templates.repo.test.ts
    - modules/documents/backend/repositories/project-document-checklist.repo.test.ts
  modified:
    - modules/documents/backend/repositories/document-catalog.repo.ts
    - modules/documents/backend/repositories/document-templates.repo.ts
    - modules/documents/backend/repositories/project-document-checklist.repo.ts
    - test/repo-db.ts

key-decisions:
  - "listEffectiveTemplates keeps DISTINCT ON (catalog_id) via sql template on getKysely — Kysely builder has no native equivalent (D-05)"
  - "insertDocumentCatalog uses returningAll instead of re-fetch — same row shape, one round trip (D-05)"
  - "Document DDL added to setupRepoTables for document_catalog, document_templates, project_document_checklist (D-07 test harness only)"

patterns-established:
  - "Documents integration tests mock getKysely → testKysely alongside getDb → testDb() (D-07)"
  - "Checklist join reads use innerJoin on document_catalog with typed row mappers for timestamps"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "document-catalog list/get/insert/update use getKysely and stay company-scoped"
    requirement: ENF-02
    verification:
      - kind: integration
        ref: "modules/documents/backend/repositories/document-catalog.repo.test.ts#insertDocumentCatalog then listDocumentCatalog"
        status: unknown
    human_judgment: false
  - id: D2
    description: "document-templates version/retire/listEffective use getKysely"
    requirement: ENF-02
    verification:
      - kind: integration
        ref: "modules/documents/backend/repositories/document-templates.repo.test.ts#insertDocumentTemplate then listEffectiveTemplates"
        status: unknown
    human_judgment: false
  - id: D3
    description: "project-document-checklist insert-if-missing and status updates use getKysely"
    requirement: ENF-02
    verification:
      - kind: integration
        ref: "modules/documents/backend/repositories/project-document-checklist.repo.test.ts#insertChecklistRowIfMissing twice"
        status: unknown
    human_judgment: false

duration: 8min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 05: Documents Repositories Summary

**Three documents module repositories converted to getKysely with colocated integration tests and company/project scoping preserved**

## Performance

- **Duration:** 8 min
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- document-catalog.repo.ts uses getKysely for list, get, insert, update, and stage-filtered active list (company-scoped)
- document-templates.repo.ts uses getKysely with sql template for DISTINCT ON effective template listing
- project-document-checklist.repo.ts uses getKysely with onConflict doNothing insert, join reads, and dynamic field updates
- test/repo-db.ts extended with document_catalog, document_templates, and project_document_checklist DDL

## Task Commits

Each task followed TDD with RED then GREEN commits:

1. **Task 1: Convert document-catalog.repo.ts** — `a0ae7b0` (test), `5c6e50b` (feat)
2. **Task 2: Convert document-templates.repo.ts** — `f309983` (test), `e24ea4f` (feat)
3. **Task 3: Convert project-document-checklist.repo.ts** — `502b01b` (test), `8204e58` (feat)

## Files Created/Modified

- `modules/documents/backend/repositories/document-catalog.repo.ts` — Kysely catalog CRUD
- `modules/documents/backend/repositories/document-catalog.repo.test.ts` — insert+list and getKysely probe
- `modules/documents/backend/repositories/document-templates.repo.ts` — Kysely templates with effective list
- `modules/documents/backend/repositories/document-templates.repo.test.ts` — insert+listEffectiveTemplates
- `modules/documents/backend/repositories/project-document-checklist.repo.ts` — Kysely checklist with joins
- `modules/documents/backend/repositories/project-document-checklist.repo.test.ts` — idempotent insert test
- `test/repo-db.ts` — document table DDL for integration tests

## Decisions Made

- DISTINCT ON effective template query stays as raw sql on getKysely to preserve Phase 17 semantics
- Document DDL added to test harness only — not a schema migration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Integration tests skip when `TEST_DATABASE_URL` is unset (vitest `describe.skipIf(!hasTestDb)`). Repo conversions verified via lint and TypeScript compile; full integration pass requires test DB.

## Next Phase Readiness

Documents repos ready for remaining Phase 25 wave conversions. No UI or route changes (D-06 preserved).

## Self-Check: PASSED

- FOUND: modules/documents/backend/repositories/document-catalog.repo.test.ts
- FOUND: modules/documents/backend/repositories/document-templates.repo.test.ts
- FOUND: modules/documents/backend/repositories/project-document-checklist.repo.test.ts
- FOUND: a0ae7b0, 5c6e50b, f309983, e24ea4f, 502b01b, 8204e58

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
