---
phase: 13-weekly-periods-pm-submit
plan: 01
subsystem: api
tags: [weekly-reports, postgres, vitest, cpmo, iso-week]

requires:
  - phase: 12-milestone-raid-master-registers
    provides: migrateRaidMasters pattern and RAID master columns
  - phase: 11-project-master-pm-assignment-stakeholders
    provides: weekly_report_enabled, weekly_report_start_period on projects
provides:
  - Settings-flag DDL for company_weekly_config, weekly_periods, weekly_reports, weekly_report_versions
  - CPMO /api/weekly-periods GET/POST and /api/weekly-periods/config GET/PUT
  - createWeeklyPeriod transactional shell materialization and auditLog
  - isWeeklyReportOverdue computed helper
affects:
  - 13-02 draft/submit/versioning
  - 14 CPMO tracking export helpers

actuals:
  tokens: 42000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Settings-flag migrateWeeklyReports after migrateRaidMasters in getDb"
    - "withCpmo + assertCompanyWrite for period/config mutators"
    - "UTC ISO week Thursday rule in lib/iso-week.ts"

key-files:
  created:
    - lib/db-weekly-reports.ts
    - lib/iso-week.ts
    - lib/repositories/weekly-periods.repo.ts
    - lib/repositories/weekly-reports.repo.ts
    - lib/services/weekly-reports.service.ts
    - app/api/weekly-periods/route.ts
    - app/api/weekly-periods/config/route.ts
  modified:
    - lib/db.ts

key-decisions:
  - "Default due Friday 18:00 UTC when no company_weekly_config row (D-03)"
  - "Transaction uses single PoolClient for period + shell inserts (not separate pool connection)"
  - "Repo integration tests mock getDb via test/repo-db TestDbClient pattern"

patterns-established:
  - "Parallel weekly tables — no documents or getWeeklyProjectReport coupling (D-01)"
  - "config_snapshot frozen at period create; upsertCompanyWeeklyConfig never UPDATEs weekly_periods (PERD-02)"

requirements-completed: [PERD-01, PERD-02, PERD-03, WKRP-01]

coverage:
  - id: D1
    description: "CPMO POST creates period with display_name, due_at, config_snapshot, and obligated shells"
    requirement: PERD-01
    verification:
      - kind: unit
        ref: "lib/services/weekly-reports.service.unit.test.ts#createWeeklyPeriod calls assertCompanyWrite"
        status: pass
      - kind: integration
        ref: "lib/repositories/weekly-periods.repo.test.ts#createPeriodWithShells inserts shells"
        status: pass
    human_judgment: false
  - id: D2
    description: "Later config edits do not rewrite existing period due_at or config_snapshot"
    requirement: PERD-02
    verification:
      - kind: integration
        ref: "lib/repositories/weekly-periods.repo.test.ts#upsertCompanyWeeklyConfig does not UPDATE existing period due_at"
        status: pass
    human_judgment: false
  - id: D3
    description: "Overdue is computed from status and due_at, never stored"
    requirement: PERD-03
    verification:
      - kind: unit
        ref: "lib/services/weekly-reports.service.unit.test.ts#isWeeklyReportOverdue"
        status: pass
    human_judgment: false
  - id: D4
    description: "At most one shell per obligated project at period create with obligation exclusions"
    requirement: WKRP-01
    verification:
      - kind: integration
        ref: "lib/repositories/weekly-periods.repo.test.ts#listObligatedProjectIds excludes"
        status: pass
    human_judgment: false
  - id: D5
    description: "CPMO route auth — 401/403/201 gates on /api/weekly-periods"
    requirement: PERD-01
    verification:
      - kind: unit
        ref: "app/api/weekly-periods/route.test.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 13 Plan 01: Weekly Period Spine Summary

**CPMO weekly periods with UTC ISO week bounds, frozen config snapshots, transactional obligated shells, and withCpmo routes — parallel to v1 activity reports**

## Performance

- **Duration:** 25 min
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- Added `migrateWeeklyReports` settings-flag DDL for four weekly tables wired in `getDb` after `migrateRaidMasters`
- Implemented `lib/iso-week.ts` with UTC Thursday-rule bounds, display_name formatter, and due_at materialization
- CPMO can POST `/api/weekly-periods` to create a period with obligated project shells in one transaction
- Config PUT only touches `company_weekly_config`; existing periods keep frozen `due_at` and `config_snapshot`
- `isWeeklyReportOverdue` derives lateness from status + due_at without persisting an overdue enum

## Task Commits

1. **Task 13-01-01 RED** - `f78de46` (test)
2. **Task 13-01-01 GREEN** - `45c8ba3` (feat)
3. **Task 13-01-02 GREEN** - `abe01ac` (feat)

## Files Created/Modified

- `lib/db-weekly-reports.ts` — DDL + migrateWeeklyReports orchestrator
- `lib/iso-week.ts` — UTC ISO week helpers
- `lib/repositories/weekly-periods.repo.ts` — config, obligation query, transactional period+shells
- `lib/repositories/weekly-reports.repo.ts` — shell insert with ON CONFLICT DO NOTHING
- `lib/services/weekly-reports.service.ts` — createWeeklyPeriod, list, config, overdue helper
- `app/api/weekly-periods/route.ts` — GET/POST withCpmo
- `app/api/weekly-periods/config/route.ts` — GET/PUT withCpmo
- `lib/db.ts` — migrateWeeklyReports wire + company_weekly_config in noIdTables

## Decisions Made

- Transaction callback receives `PoolClient` (not `Pool`) so BEGIN/COMMIT wraps all inserts on one connection
- Repo tests use `test/repo-db` mock of `getDb` per project convention; added `company_weekly_config` to TestDbClient noIdTables

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repo tests aligned with test/repo-db harness**
- **Found during:** Task 13-01-02
- **Issue:** Raw testPool setup failed on companies ON CONFLICT and bypassed getDb mock pattern
- **Fix:** Refactored repo tests to use setupRepoTables, seedCompany/seedProject, vi.mock getDb
- **Files modified:** lib/repositories/weekly-periods.repo.test.ts, lib/repositories/weekly-reports.repo.test.ts, test/repo-db.ts
- **Committed in:** abe01ac

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test harness fix only; production behavior matches plan.

## Issues Encountered

None

## User Setup Required

None — uses existing PostgreSQL and Vitest harness.

## Next Phase Readiness

- 13-02 can add PM draft/submit on `/api/projects/[id]/weekly-reports` using shell draft columns already created
- `weekly_report_versions` table exists; version rows land in 13-02

## Self-Check: PASSED

- lib/db-weekly-reports.ts: FOUND
- lib/iso-week.ts: FOUND
- app/api/weekly-periods/route.ts: FOUND
- Commits f78de46, 45c8ba3, abe01ac: FOUND

---
*Phase: 13-weekly-periods-pm-submit*
*Completed: 2026-08-26*
