---
phase: 11-project-master-pm-assignment-stakeholders
plan: 01
subsystem: database
tags: [postgres, vitest, project-master, migration, tdd]

requires:
  - phase: 10-users-roles-server-authorization
    provides: CPMO-only createProject, getDb migrate loop, settings flags pattern
provides:
  - migrateProjectMaster DDL with project identity columns and history tables
  - Case-insensitive per-company unique project_code index
  - CPMO createProject validation for code, year, and in-company program
affects:
  - 11-02 governance PATCH
  - 11-03 PM assignment backfill
  - 11-04 stakeholder APIs

actuals:
  tokens: 4000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Settings-flag idempotent DDL via migrateProjectMaster (db-roles analog)"
    - "Hermetic DDL fragment export for unit tests"
    - "ConflictError pre-check before createProjectRepo insert"

key-files:
  created:
    - lib/db-project-master.ts
    - lib/db-project-master.ddl.unit.test.ts
  modified:
    - lib/db.ts
    - test/repo-db.ts
    - lib/repositories/projects.repo.ts
    - lib/repositories/ALLOWLIST-DIFF.md
    - lib/services/projects.service.ts
    - lib/services/projects.service.unit.test.ts

key-decisions:
  - "project_code column name locked (D-01, planner discretion)"
  - "Duplicate and foreign-program checks live in service layer with repo pre-check (T-11-01, T-11-02)"
  - "Task 11-01-02 covered by tracer — no separate implementation commit"

patterns-established:
  - "PROJECT_COLUMNS extended with Phase 11 identity/governance columns; customer_id and company_id remain excluded"
  - "findProjectByCompanyCode uses LOWER(project_code) per company"

requirements-completed: [PROJ-01, PROJ-02, PROJ-07]

coverage:
  - id: D1
    description: migrateProjectMaster adds project identity columns, history tables, and unique index
    requirement: PROJ-01
    verification:
      - kind: unit
        ref: "lib/db-project-master.ddl.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: CPMO createProject requires project_code, portfolio_year, and customer_id
    requirement: PROJ-01
    verification:
      - kind: unit
        ref: "lib/services/projects.service.unit.test.ts#createProject validation tests"
        status: pass
    human_judgment: false
  - id: D3
    description: Duplicate in-company project_code returns ConflictError
    requirement: PROJ-01
    verification:
      - kind: unit
        ref: "lib/services/projects.service.unit.test.ts#duplicate project_code"
        status: pass
    human_judgment: false
  - id: D4
    description: Foreign-company program returns ForbiddenError; missing program returns NotFoundError
    requirement: PROJ-02
    verification:
      - kind: unit
        ref: "lib/services/projects.service.unit.test.ts#foreign program"
        status: pass
    human_judgment: false
  - id: D5
    description: progress_pct column on projects for live master progress (no snapshot table)
    requirement: PROJ-07
    verification:
      - kind: unit
        ref: "lib/db-project-master.ddl.unit.test.ts#progress_pct"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-26
status: complete
---

# Phase 11 Plan 01: Project Master Create Spine Summary

**migrateProjectMaster in getDb loop with per-company case-insensitive project_code unique index and CPMO create validation for code, portfolio year, and in-company program**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-25T19:36:00Z
- **Completed:** 2026-08-25T19:44:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added `lib/db-project-master.ts` with idempotent DDL for identity columns, `progress_pct`, `project_pm_assignments`, `project_stakeholders`, and partial unique index `projects_company_code_lower_unique`
- Wired `migrateProjectMaster` into `getDb()` after `migrateUsersRolesAndAudit`
- Extended `PROJECT_COLUMNS`, `createProject` INSERT, and `test/repo-db.ts` mirror DDL
- CPMO `createProject` validates required fields, resolves program via `getProgram`, rejects duplicates and cross-company programs

## Task Commits

Each task was committed atomically (TDD RED/GREEN for tracer):

1. **Task 11-01-01: End-to-end CPMO create with unique project_code** — `384997d` (test), `bcea835` (feat)
2. **Task 11-01-02: Reject duplicate codes and foreign programs** — covered by tracer commits (no gap)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `lib/db-project-master.ts` — migrateProjectMaster DDL helper with exported fragments for hermetic tests
- `lib/db-project-master.ddl.unit.test.ts` — asserts unique index, history tables, progress_pct
- `lib/db.ts` — awaits migrateProjectMaster in getDb loop
- `test/repo-db.ts` — mirrors Phase 11 columns and history tables
- `lib/repositories/projects.repo.ts` — PROJECT_COLUMNS, findProjectByCompanyCode, extended INSERT
- `lib/repositories/ALLOWLIST-DIFF.md` — documents migrate-added columns
- `lib/services/projects.service.ts` — createProject validation and pre-checks
- `lib/services/projects.service.unit.test.ts` — required-field, duplicate, foreign-program tests

## Decisions Made

- Tracer task implemented duplicate/foreign-program checks so task 11-01-02 required no additional production diff
- Exported `PROJECT_MASTER_DDL` array for hermetic DDL unit tests (same pattern as db-roles backfill tests)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest 4 does not support `-x` bail flag from plan verify commands; ran without it (all 27 tests pass)
- Two legacy createProject unit tests updated to include new required identity fields

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema spine ready for 11-02 governance PATCH and L0–L5 defaults
- History tables exist empty for 11-03 assignment backfill and 11-04 stakeholders
- getProjectPmIdentity untouched per plan (11-03 rewires access)

## Self-Check: PASSED

- FOUND: lib/db-project-master.ts
- FOUND: lib/db-project-master.ddl.unit.test.ts
- FOUND: .planning/phases/11-project-master-pm-assignment-stakeholders/11-01-SUMMARY.md
- FOUND: commit 384997d
- FOUND: commit bcea835

---
*Phase: 11-project-master-pm-assignment-stakeholders*
*Completed: 2026-08-26*
