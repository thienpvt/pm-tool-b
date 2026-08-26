---
phase: 16-portfolio-pm-dashboards
plan: 01
subsystem: api
tags: [dashboards, portfolio, vitest, postgres, cpmo, kpi]

requires:
  - phase: 12-milestone-raid-master-registers
    provides: listOverdueMilestones, listHighOpenRaid, listTechnologyCouncilIssues
  - phase: 11-project-master-pm-assignment-stakeholders
    provides: listProjects, getActivePrimaryAssignment, live stage/rag/status
  - phase: 15-budget-value-roi-dependencies
    provides: migrateFiscalBudget settings-flag DDL pattern
provides:
  - GET /api/dashboards/portfolio parallel CPMO surface
  - dashboard_filter_state DDL and migrateDashboards in getDb
  - spec-dashboards.service getPortfolioDashboard with live KPIs, charts, drill-downs, AND filters
affects:
  - 16-02 filter persist/export
  - 16-03 PM dashboard

actuals:
  tokens: 92000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - Settings-flag DDL module (db-dashboards.ts) after migrateFiscalBudget
    - Parallel /api/dashboards/* surface separate from v1 /api/portfolio
    - Live projects.rag for KPI tiles (not weekly snapshot)

key-files:
  created:
    - lib/db-dashboards.ts
    - lib/dashboards/rag.ts
    - lib/dashboards/kpi.ts
    - lib/dashboards/filters.ts
    - lib/repositories/dashboard-filter-state.repo.ts
    - lib/services/spec-dashboards.service.ts
    - app/api/dashboards/portfolio/route.ts
  modified:
    - lib/db.ts

key-decisions:
  - "Tracer shipped charts/drill-downs/filters in one service pass; tasks 02–03 added test coverage without separate feat commits"
  - "pm_name uses denormalized projects.pm_name with assignment display_name fallback for tests"

patterns-established:
  - "Portfolio dashboard reads stored filters then applyDashboardFilters once for tiles, list, and drill-downs"
  - "Route auth matrix mirrors weekly-periods tracking: 401/403 PM/viewer/null-company-admin, 200 CPMO"

requirements-completed: [PDSH-01, PDSH-02, PDSH-03, PDSH-04, PDSH-05]

coverage:
  - id: D1
    description: CPMO GET /api/dashboards/portfolio returns filters, kpis, charts, list, drilldowns from live master
    requirement: PDSH-01
    verification:
      - kind: unit
        ref: app/api/dashboards/portfolio/route.test.ts#returns 200 with filters, kpis, charts, list, drilldowns for cpmo
        status: pass
      - kind: unit
        ref: lib/services/spec-dashboards.service.unit.test.ts#getPortfolioDashboard
        status: pass
    human_judgment: false
  - id: D2
    description: Active/on-track/watch tiles and RAG chart identity (G+A+R = active)
    requirement: PDSH-02
    verification:
      - kind: unit
        ref: lib/dashboards/kpi.unit.test.ts#computePortfolioCharts stage and RAG identity
        status: pass
    human_judgment: false
  - id: D3
    description: Overdue distinct-project tile with per-milestone drill-down; RAID record count
    requirement: PDSH-03
    verification:
      - kind: unit
        ref: lib/services/spec-dashboards.service.unit.test.ts#overdue tile is distinct projects
        status: pass
      - kind: unit
        ref: lib/services/spec-dashboards.service.unit.test.ts#high_open_raid_count is filtered record length
        status: pass
    human_judgment: false
  - id: D4
    description: Technology-council tile matches drill-down length
    requirement: PDSH-04
    verification:
      - kind: unit
        ref: lib/services/spec-dashboards.service.unit.test.ts#technology_council_count equals drill-down length
        status: pass
    human_judgment: false
  - id: D5
    description: AND filters on portfolio_year, program, pm_user_id, stage, status, rag, type, weekly_report_enabled; unit no-op
    requirement: PDSH-05
    verification:
      - kind: unit
        ref: lib/dashboards/filters.unit.test.ts
        status: pass
      - kind: unit
        ref: lib/services/spec-dashboards.service.unit.test.ts#stored stage filter shrinks kpis, list, and overdue drill-down together
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 16 Plan 01: Portfolio Dashboard Spine Summary

**Parallel GET /api/dashboards/portfolio with live-master KPIs, AND filters, matching drill-downs, and dashboard_filter_state DDL — v1 /api/portfolio untouched**

## Performance

- **Duration:** 25 min
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Added `migrateDashboards` / `dashboard_filter_state` after `migrateFiscalBudget` in `getDb`
- Implemented `getPortfolioDashboard` with active L0–L4 KPIs, stage/RAG charts, Phase 12 drill-down intersection
- Exposed CPMO-only GET `/api/dashboards/portfolio` via `withCpmo` + `assertCompanyWrite`
- AND-combined session filters (type=classification, unit no-op) applied once to tiles, list, and drill-downs

## Task Commits

1. **Task 16-01-01 RED** - `bcdd5f4` (test)
2. **Task 16-01-01 GREEN** - `5e7d145` (feat)
3. **Task 16-01-02 RED** - `7a87c7a` (test) — charts/drill-downs implemented in tracer GREEN
4. **Task 16-01-03 RED** - `1d63122` (test) — AND filters implemented in tracer GREEN

## Files Created/Modified

- `lib/db-dashboards.ts` — DDL flag + `dashboard_filter_state` table
- `lib/dashboards/rag.ts` — `normalizeRag`, `isActiveProject`
- `lib/dashboards/kpi.ts` — `computePortfolioKpis`, `computePortfolioCharts`
- `lib/dashboards/filters.ts` — `parseDashboardFilters`, `applyDashboardFilters`
- `lib/repositories/dashboard-filter-state.repo.ts` — `getDashboardFilters`
- `lib/services/spec-dashboards.service.ts` — `getPortfolioDashboard`
- `app/api/dashboards/portfolio/route.ts` — CPMO GET handler
- `lib/db.ts` — wire `migrateDashboards` before `backfillWeightedCompletion`
- Six test files covering DDL, KPI, filters, repo, service, route

## Decisions Made

- Tracer GREEN delivered full charts/drill-downs/filter matrix; tasks 02–03 added RED test commits only (no additional feat commits needed)
- Route tests pass `params: Promise.resolve({})` for `withAuth` compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route test missing withAuth params context**
- **Found during:** Task 16-01-01 GREEN
- **Issue:** GET calls without `ctx.params` threw in `with-auth.ts`
- **Fix:** Added `const ctx = { params: Promise.resolve({}) }` to route tests
- **Files modified:** `app/api/dashboards/portfolio/route.test.ts`
- **Committed in:** `5e7d145`

None otherwise — plan executed as written.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- Ready for 16-02 filter persist PUT/clear/export
- Ready for 16-03 PM dashboard routes

## Self-Check: PASSED

- FOUND: `.planning/phases/16-portfolio-pm-dashboards/16-01-SUMMARY.md`
- FOUND: commits bcdd5f4, 5e7d145, 7a87c7a, 1d63122
- Wave verify: 30 tests passed

---
*Phase: 16-portfolio-pm-dashboards*
*Completed: 2026-08-26*
