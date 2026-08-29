---
phase: 25-kysely-repositories
plan: 06
subsystem: database
tags: [kysely, postgres, jira, operations, tenant-scoped]

requires:
  - phase: 25-05
    provides: getKysely documents conversion patterns and testKysely harness
provides:
  - import-mapping.repo on getKysely with company-scoped timeline and bug mapping CRUD
  - operations.repo on getKysely with systems/budget/expenses/incidents CRUD and isAdmin list filter
affects: [25-07, jira-import, operations-services]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns: [getKysely jira/operations conversion, sql template for operations list aggregates, delete result shape compatibility]

key-files:
  created: []
  modified:
    - modules/jira/backend/repositories/import-mapping.repo.ts
    - modules/jira/backend/repositories/import-mapping.repo.test.ts
    - modules/operations/backend/repositories/operations.repo.ts
    - modules/operations/backend/repositories/operations.repo.test.ts

key-decisions:
  - "listOperationsSystems keeps aggregate SQL via sql template on getKysely — preserves GROUP BY and open_incidents subquery (D-05)"
  - "isAdmin filter preserved via (company_id OR adminFlag) in sql and if (!isAdmin) on find/get/delete — no withCpmo on routes (D-06)"
  - "Delete functions return { changes, lastInsertRowid } from numDeletedRows for operations.service compatibility"

patterns-established:
  - "Jira/operations integration tests mock getKysely → testKysely alongside getDb → testDb() (D-07)"
  - "Record<string, unknown> body fields coerced with String/Number/null checks — no as any"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "import-mapping timeline/bug mapping CRUD uses getKysely and stays company-scoped"
    requirement: ENF-02
    verification:
      - kind: integration
        ref: "modules/jira/backend/repositories/import-mapping.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false
  - id: D2
    description: "operations systems/budget/expenses/incidents CRUD uses getKysely with isAdmin list filter"
    requirement: ENF-02
    verification:
      - kind: integration
        ref: "modules/operations/backend/repositories/operations.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false

duration: 5min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 06: Jira Import-Mapping and Operations Repositories Summary

**Jira import-mapping and operations repositories converted to getKysely with company-scoped mappings and isAdmin operations list filter preserved**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-29T00:44:00Z
- **Completed:** 2026-08-29T00:49:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `import-mapping.repo.ts` — all timeline and bug mapping CRUD via getKysely; company_id scoping and UNIQUE name conflict behavior preserved (W5, D-05)
- `operations.repo.ts` — systems, budget items, expenses, and incidents via getKysely; isAdmin vs companyId list filter unchanged (W6, D-06)
- Both test files mock getKysely → testKysely with loads-via-getKysely assertions (D-07)

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1: Convert import-mapping.repo.ts** — `648d7a5` (test), `6796302` (feat)
2. **Task 2: Convert operations.repo.ts** — `846fbfc` (test), `4e4ce5c` (feat)

## Files Created/Modified

- `modules/jira/backend/repositories/import-mapping.repo.ts` — Kysely CRUD for timeline_import_mappings and bug_import_mappings
- `modules/jira/backend/repositories/import-mapping.repo.test.ts` — getKysely mock and assertion
- `modules/operations/backend/repositories/operations.repo.ts` — Kysely CRUD for operations tables
- `modules/operations/backend/repositories/operations.repo.test.ts` — getKysely mock and assertion

## Decisions Made

- listOperationsSystems uses sql template for aggregate query (SUM, subquery count, GROUP BY) — Kysely builder would not preserve exact semantics cleanly
- Delete functions map Kysely numDeletedRows to `{ changes, lastInsertRowid: 0 }` so operations.service boolean checks stay compatible
- No route or withCpmo changes per D-06

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Integration tests skip when TEST_DATABASE_URL unset (hasTestDb); vitest exits 0 with skipped suites — same harness behavior as prior Phase 25 plans

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 6 jira/operations repos ready; 25-07 can proceed with remaining module repos
- Operations routes unchanged — D-23/D-06 wrappers intact

## Self-Check: PASSED

- FOUND: modules/jira/backend/repositories/import-mapping.repo.ts
- FOUND: modules/operations/backend/repositories/operations.repo.ts
- FOUND: .planning/phases/25-kysely-repositories/25-06-SUMMARY.md
- FOUND: 648d7a5
- FOUND: 6796302
- FOUND: 846fbfc
- FOUND: 4e4ce5c

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
