---
phase: 14-cpmo-tracking-consolidated-export
plan: 01
subsystem: api
tags: [cpmo, weekly-reports, tracking, vitest, postgres]

requires:
  - phase: 13-weekly-periods-pm-submit
    provides: listPeriodShells, isWeeklyReportOverdue, getWeeklyPeriodByCompany, migrateWeeklyReports, withCpmo
provides:
  - GET /api/weekly-periods/[periodId]/tracking with period, counts, rows
  - getPeriodTracking service for Phase 16 reuse
  - migrateWeeklyExportLogs DDL (weekly_export_logs)
  - Company-scoped listPeriodShellsRepo(companyId, periodId) with identity and PM join
affects:
  - 14-02-cpmo-preview
  - 14-03-cpmo-export
  - 16-dashboards

actuals:
  tokens: 82000
  tasks: 2
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Settings-flag DDL for weekly_export_logs at tail of migrateWeeklyReports"
    - "Dedicated weekly-tracking.service.ts for CPMO grid orchestration"
    - "Counts from unfiltered shells; filters apply to rows only"

key-files:
  created:
    - lib/services/weekly-tracking.service.ts
    - app/api/weekly-periods/[periodId]/tracking/route.ts
    - app/api/weekly-periods/[periodId]/tracking/route.test.ts
    - lib/services/weekly-tracking.service.unit.test.ts
  modified:
    - lib/db-weekly-reports.ts
    - lib/repositories/weekly-reports.repo.ts
    - lib/services/weekly-reports.service.ts
    - lib/db-weekly-reports.ddl.unit.test.ts
    - lib/repositories/weekly-reports.repo.test.ts
    - lib/services/weekly-reports.service.unit.test.ts

key-decisions:
  - "Tracking orchestration lives in weekly-tracking.service.ts, not weekly-reports.service.ts (D-03)"
  - "Grid RAG from weekly_report_versions join only; projects.rag excluded (D-03)"
  - "technology_council filter uses live listTechnologyCouncilIssues project_id set (D-02)"

patterns-established:
  - "applyTrackingFilters after buildCounts — period-wide counts never recomputed from filtered rows"
  - "listPeriodShellsRepo joins wp.company_id for defense-in-depth (D-13)"

requirements-completed: [CPMO-01, CPMO-02]

coverage:
  - id: D1
    description: "CPMO GET tracking returns period, obligated/not_submitted/draft/submitted/overdue/late counts, and rows with project_id and report_id"
    requirement: CPMO-01
    verification:
      - kind: unit
        ref: "lib/services/weekly-tracking.service.unit.test.ts#getPeriodTracking returns period, counts, and rows"
        status: pass
      - kind: unit
        ref: "app/api/weekly-periods/[periodId]/tracking/route.test.ts#returns 200 with period, counts, and rows for cpmo"
        status: pass
    human_judgment: false
  - id: D2
    description: "Server-side filters (status including computed overdue, lateness, PM, stage, version RAG, live tech-council) shrink rows only; counts stay period-wide"
    requirement: CPMO-02
    verification:
      - kind: unit
        ref: "lib/services/weekly-tracking.service.unit.test.ts#getPeriodTracking filters"
        status: pass
      - kind: unit
        ref: "app/api/weekly-periods/[periodId]/tracking/route.test.ts#forwards query filters"
        status: pass
    human_judgment: false
  - id: D3
    description: "weekly_export_logs DDL via settings flag after weekly index migration"
    requirement: CPMO-01
    verification:
      - kind: unit
        ref: "lib/db-weekly-reports.ddl.unit.test.ts#migrateWeeklyExportLogs DDL fragments"
        status: pass
    human_judgment: false
  - id: D4
    description: "listPeriodShellsRepo company join blocks foreign companyId; includes identity and active primary PM columns"
    requirement: CPMO-02
    verification:
      - kind: integration
        ref: "lib/repositories/weekly-reports.repo.test.ts#listPeriodShellsRepo"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-26
status: complete
---

# Phase 14 Plan 01: CPMO Period Tracking API Summary

**Company-scoped GET tracking with period-wide counts, version RAG grid, live tech-council filter flag, and weekly_export_logs DDL**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files modified:** 10
- **Tests:** 60 passing (5 files)

## Accomplishments

- Added `migrateWeeklyExportLogs` / `WEEKLY_EXPORT_LOGS_DDL` invoked at tail of `migrateWeeklyReports` (D-09, D-10)
- Extended `listPeriodShellsRepo(companyId, periodId)` with company join, project identity, version RAG, and active primary PM display (D-13)
- Created `getPeriodTracking` in `weekly-tracking.service.ts` with authz gates, counts, and filterable rows (CPMO-01, CPMO-02)
- Wired `GET /api/weekly-periods/[periodId]/tracking` with `withCpmo` and query-param filter forwarding (D-11)

## Task Commits

1. **Task 14-01-01 RED** - `66bf0f3` (test)
2. **Task 14-01-01 GREEN** - `8149f96` (feat)
3. **Task 14-01-02 RED** - `675b199` (test)
4. **Task 14-01-02 GREEN** - `a66377c` (feat)

## Files Created/Modified

- `lib/db-weekly-reports.ts` — export log DDL flag and migrateWeeklyExportLogs
- `lib/repositories/weekly-reports.repo.ts` — company-scoped shells with PM join
- `lib/services/weekly-tracking.service.ts` — getPeriodTracking, applyTrackingFilters, buildCounts
- `app/api/weekly-periods/[periodId]/tracking/route.ts` — CPMO GET handler
- Test files for DDL, repo integration, service unit, route unit

## Decisions Made

- Tracking orchestration isolated in `weekly-tracking.service.ts` per D-03 (no weekly-reports.service bloat)
- Filters applied after count computation so obligated/submitted/overdue tallies remain period-wide (D-04)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Repo test FK cleanup order**
- **Found during:** Task 14-01-01 GREEN
- **Issue:** `beforeEach` deleted projects before `project_pm_assignments`, causing FK violations after PM join test
- **Fix:** Delete PM assignments before projects; use unique email for seeded users
- **Files modified:** lib/repositories/weekly-reports.repo.test.ts
- **Committed in:** 8149f96

---

**Total deviations:** 1 auto-fixed
**Impact on plan:** Test hygiene only; no production behavior change.

## Issues Encountered

None blocking.

## User Setup Required

None — uses existing `TEST_DATABASE_URL` ending in `_test` for repo integration tests.

## Next Phase Readiness

- 14-02 can call `getPeriodTracking` patterns and reuse extended `listPeriodShellsRepo`
- `weekly_export_logs` table ready for 14-03 export log inserts

## Self-Check: PASSED

- FOUND: lib/services/weekly-tracking.service.ts
- FOUND: app/api/weekly-periods/[periodId]/tracking/route.ts
- FOUND: .planning/phases/14-cpmo-tracking-consolidated-export/14-01-SUMMARY.md
- FOUND: 66bf0f3, 8149f96, 675b199, a66377c

---
*Phase: 14-cpmo-tracking-consolidated-export*
*Completed: 2026-08-26*
