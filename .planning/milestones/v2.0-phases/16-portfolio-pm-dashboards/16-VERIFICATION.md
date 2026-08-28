---
phase: 16-portfolio-pm-dashboards
verified: 2026-08-26T14:30:00Z
status: passed
score: 19/19 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 16: Portfolio & PM Dashboards Verification Report

**Phase Goal:** CPMO sees spec portfolio KPIs with session filters and drill-down; PMs see only assigned projects and the actions they must take

**Verified:** 2026-08-26T14:30:00Z

**Status:** passed

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | CPMO GET `/api/dashboards/portfolio` returns `{ filters, kpis, charts, list, drilldowns }` from live project master after AND filters (SC1, PDSH-01, D-01) | ✓ VERIFIED | `getPortfolioDashboard` at `lib/services/spec-dashboards.service.ts:116-122` reads stored filters then `buildPortfolioDashboard` at `:82-113`; route wires at `app/api/dashboards/portfolio/route.ts:5-7`; service test `returns live-master KPI tiles…` passes |
| 2 | `active_count` = Active + L0–L4; `on_track_count` = Green; `watch_act_count` = Amber/Red; missing rag → Amber; G+A+R = `active_count` (SC1, PDSH-01/02, D-02/D-03) | ✓ VERIFIED | `isActiveProject` `lib/dashboards/rag.ts:15-17`; `normalizeRag` `:6-12`; `computePortfolioKpis` `lib/dashboards/kpi.ts:26-54`; identity test `lib/dashboards/kpi.unit.test.ts:38-49` |
| 3 | Stage chart counts filtered set including L5; RAG chart buckets Active L0–L4 subset only (D-04, PDSH-02) | ✓ VERIFIED | `computePortfolioCharts` `lib/dashboards/kpi.ts:56-72`; L5 in stage / excluded from RAG in `kpi.unit.test.ts:38-49` |
| 4 | Overdue tile = distinct `project_id`; drill-down one row per overdue milestone; High RAID = record count; tech-council count = filtered issue rows; drill-down lists match tiles (SC2, PDSH-03/04, D-05) | ✓ VERIFIED | Intersection in `buildPortfolioDashboard` `:89-112`; KPI logic `kpi.ts:42-52`; service tests `overdue tile is distinct projects`, `high_open_raid_count is filtered record length`, `technology_council_count equals drill-down length` |
| 5 | AND filters (`portfolio_year`, `program`, `unit` no-op, `pm_user_id`, `stage`, `status`, `rag`, `type`, `weekly_report_enabled`) apply to tiles, charts, list, drill-downs together; unknown keys 400 (SC3, PDSH-05, D-06) | ✓ VERIFIED | `parseDashboardFilters` / `applyDashboardFilters` `lib/dashboards/filters.ts:31-78`; service test `stored stage filter shrinks kpis, list, and overdue drill-down together`; ValidationError test in `savePortfolioDashboardFilters` |
| 6 | Filters persist per `(user_id, surface)`; GET inherits stored blob; PUT replaces; POST clear/defaults → `{}`; drill-down inherits same blob (no separate query) (SC3, PDSH-05/06, D-07) | ✓ VERIFIED | DDL `lib/db-dashboards.ts:8-14`; `getDashboardFilters` / `upsertDashboardFilters` `lib/repositories/dashboard-filter-state.repo.ts:5-38`; filter routes `app/api/dashboards/portfolio/filters/route.ts`; repo + service persist/clear tests pass |
| 7 | Export POST xlsx (exceljs) and pdf (jspdf) includes filtered KPIs, project list, drill-down row ids; optional `body.filters` one-shot override (SC3, PDSH-06, D-08) | ✓ VERIFIED | `exportPortfolioDashboard` `spec-dashboards.service.ts:149-181`; sheets `lib/export/dashboard-portfolio.ts:143-175`; export route `app/api/dashboards/portfolio/export/route.ts`; `dashboard-portfolio.unit.test.ts` + export route tests pass |
| 8 | Successful export calls `auditLog` action `dashboard_export` with format and applied filters (PDSH-06, D-08) | ✓ VERIFIED | `auditLog` call `spec-dashboards.service.ts:167-175`; service test `calls auditLog with dashboard_export after successful buffer` |
| 9 | `migrateDashboards` runs from `getDb` after `migrateFiscalBudget` (D-07) | ✓ VERIFIED | `lib/db.ts:633-636`; gsd-tools key-link verified |
| 10 | `spec-dashboards.service` does **not** import `portfolio.service` / `getPortfolioSummary` (D-01 prohibition) | ✓ VERIFIED | Imports `spec-dashboards.service.ts:1-27` exclude portfolio.service; static source test `does not import portfolio.service` |
| 11 | PM GET returns only assignment-window projects via `listProjects(companyId, { pmUserId })` with portfolio list row shape; CPMO on PM route still own assignments (SC4, MDSH-01, D-09) | ✓ VERIFIED | `getPmDashboard` `spec-dashboards.service.ts:190-192`; shared `enrichProjectListRows` `:46-74`; service test `calls listProjects with pmUserId` |
| 12 | Weekly actions: current period shells with `not_submitted`/`draft`, period/due/status/overdue, href `/projects/{id}/weekly-reports/{reportId}`; **never** `getPeriodTracking` (SC4, MDSH-02, D-10) | ✓ VERIFIED | Weekly block `spec-dashboards.service.ts:195-217`; uses `listPeriodShellsRepo` + `isWeeklyReportOverdue`; static test `does not import weekly-tracking.service`; no `getPeriodTracking` in file |
| 13 | Milestone actions: upcoming ∪ overdue on assigned projects with dates and href `/projects/{id}/milestones` (SC4, MDSH-03, D-11) | ✓ VERIFIED | `spec-dashboards.service.ts:219-240`; service test `unions upcoming and overdue milestones on assigned projects with href` |
| 14 | RAID actions: High open/in-progress on assigned projects, upcoming-or-overdue window, `has_technology_council` flag, href `/projects/{id}/raid` (SC4, MDSH-04, D-11) | ✓ VERIFIED | `spec-dashboards.service.ts:242-260`; `isDueInUpcomingOrOverdue` `lib/dashboards/period-resolver.ts:25-33`; service test `includes High RAID records in upcoming/overdue window with tech-council flag` |
| 15 | Second `getPmDashboard` in same session omits weekly row after shell becomes submitted (live read, no cache) (SC5, MDSH-05, D-11) | ✓ VERIFIED | No response cache in service; behavioral test `omits weekly action on second GET after shell becomes submitted` passes |
| 16 | Each PM action includes deep-link `href` strings (SC5, MDSH-05, D-13) | ✓ VERIFIED | href fields at `spec-dashboards.service.ts:216,239,259`; ui_phase false — JSON hrefs satisfy deep-link contract per D-13 |
| 17 | Portfolio auth: `withCpmo` + `assertCompanyWrite`; Viewer/PM 403; null-company admin 403 (D-12) | ✓ VERIFIED | Portfolio route `withCpmo`; `assertCompanyWrite` in `getPortfolioDashboard:117`; route tests 401/403/200 matrix pass |
| 18 | PM auth: `withAuth`, pm\|cpmo + non-null `company_id`; Viewer/null company 403; PM filter routes use surface `pm` (D-09, D-12) | ✓ VERIFIED | `app/api/dashboards/pm/route.ts:7-10`; `app/api/dashboards/pm/filters/route.ts:12-40`; route tests pass |
| 19 | Filter upsert in-place; no physical DELETE on `dashboard_filter_state` (D-15) | ✓ VERIFIED | `upsertDashboardFilters` uses INSERT ON CONFLICT DO UPDATE only `dashboard-filter-state.repo.ts:29-37`; grep finds no DELETE in repo module |

**Score:** 19/19 truths verified (0 present, behavior-unverified)

### ROADMAP Success Criteria Mapping

| SC | Criterion | Status | Primary evidence |
| --- | --------- | ------ | ---------------- |
| 1 | Active/on-track/watch KPIs; L0–L5 and RAG charts; G+A+R = active | ✓ | Truths #2–3; `kpi.ts`, `kpi.unit.test.ts` |
| 2 | Overdue-milestone project count, High RAID count, tech-council count with matching drill-downs | ✓ | Truth #4; `buildPortfolioDashboard` drilldown intersection |
| 3 | AND filters whole dashboard; session persist; inherited drill-down; clear/defaults; Excel/PDF export | ✓ | Truths #5–8; filter + export routes |
| 4 | PM assigned projects + weekly/milestone/RAID action queues | ✓ | Truths #11–14 |
| 5 | Deep-links resolve screens; completing action refreshes dashboard same session | ✓ | Truths #15–16; live GET + submitted-shell omission test |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `lib/db-dashboards.ts` | DDL + migrateDashboards | ✓ VERIFIED | Settings-flag DDL; 7/7 gsd-tools artifacts pass (16-01 plan) |
| `lib/dashboards/rag.ts` | normalizeRag, isActiveProject | ✓ VERIFIED | Substantive + used by kpi/filters |
| `lib/dashboards/kpi.ts` | computePortfolioKpis/Charts | ✓ VERIFIED | Wired from spec-dashboards.service |
| `lib/dashboards/filters.ts` | parse/apply AND filters | ✓ VERIFIED | Wired portfolio + PM paths |
| `lib/dashboards/period-resolver.ts` | resolveCurrentPeriod, isDueInUpcomingOrOverdue | ✓ VERIFIED | Used by getPmDashboard |
| `lib/dashboards/filter-schema.ts` | zod strict schemas | ✓ VERIFIED | Filter/export routes |
| `lib/repositories/dashboard-filter-state.repo.ts` | get/upsert filters | ✓ VERIFIED | Repo tests with TEST_DATABASE_URL |
| `lib/services/spec-dashboards.service.ts` | portfolio + PM + export | ✓ VERIFIED | Central service; no portfolio.service import |
| `lib/export/dashboard-portfolio.ts` | xlsx/pdf generators | ✓ VERIFIED | 5 xlsx sheets + PDF %PDF header test |
| `app/api/dashboards/portfolio/route.ts` | CPMO GET | ✓ VERIFIED | WIRED |
| `app/api/dashboards/portfolio/filters/route.ts` | GET/PUT/POST filters | ✓ VERIFIED | WIRED |
| `app/api/dashboards/portfolio/export/route.ts` | POST export | ✓ VERIFIED | WIRED |
| `app/api/dashboards/pm/route.ts` | PM GET | ✓ VERIFIED | WIRED |
| `app/api/dashboards/pm/filters/route.ts` | PM filter persist | ✓ VERIFIED | WIRED |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `lib/db.ts` | `lib/db-dashboards.ts` | migrateDashboards after migrateFiscalBudget | ✓ WIRED | `lib/db.ts:633-636` |
| `app/api/dashboards/portfolio/route.ts` | `spec-dashboards.service.ts` | getPortfolioDashboard | ✓ WIRED | route.ts:3-6 |
| `spec-dashboards.service.ts` | `projects.repo.ts` | listProjects + applyDashboardFilters | ✓ WIRED | :83-86, :190-192 |
| `spec-dashboards.service.ts` | `raid-masters.service.ts` | Phase 12 list helpers | ✓ WIRED | :89-91, :219-244 |
| `app/api/dashboards/portfolio/filters/route.ts` | `spec-dashboards.service.ts` | save/clear/get filters | ✓ WIRED | filters route imports |
| `app/api/dashboards/portfolio/export/route.ts` | `spec-dashboards.service.ts` | exportPortfolioDashboard | ✓ WIRED | export route:3-10 |
| `app/api/dashboards/pm/route.ts` | `spec-dashboards.service.ts` | getPmDashboard | ✓ WIRED | pm route:5-10 |
| `spec-dashboards.service.ts` | `weekly-reports.repo.ts` | listPeriodShellsRepo | ✓ WIRED | :200-204 |
| `spec-dashboards.service.ts` | `dashboard-portfolio.ts` | generate xlsx/pdf | ✓ WIRED | :162-165 |
| `spec-dashboards.service.ts` | `audit.service.ts` | auditLog dashboard_export | ✓ WIRED | :167-175 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Portfolio KPIs | `active_count`, charts | `listProjects(companyId)` live `status`/`stage`/`rag` | ✓ | ✓ FLOWING |
| Overdue drill-down | `overdue_milestones` | `listOverdueMilestones(companyId)` ∩ filtered ids | ✓ | ✓ FLOWING |
| High RAID drill-down | `high_raid` | `listHighOpenRaid(companyId).records` ∩ filtered ids | ✓ | ✓ FLOWING |
| Tech council drill-down | `technology_council` | `listTechnologyCouncilIssues(companyId)` ∩ filtered ids | ✓ | ✓ FLOWING |
| Stored filters | `filters` | `dashboard_filter_state.filters_json` via repo | ✓ | ✓ FLOWING |
| PM weekly actions | `actions.weekly` | `listPeriodShellsRepo` + `isWeeklyReportOverdue` | ✓ | ✓ FLOWING |
| PM milestones | `actions.milestones` | `listUpcomingMilestones` ∪ `listOverdueMilestones` | ✓ | ✓ FLOWING |
| PM RAID actions | `actions.raid` | `listHighOpenRaid` + council id set | ✓ | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 16 targeted vitest (12 files, 97 tests) | `TEST_DATABASE_URL=postgres://…/pm_tool_test npx vitest run lib/db-dashboards.ddl.unit.test.ts lib/dashboards/*.unit.test.ts lib/repositories/dashboard-filter-state.repo.test.ts lib/services/spec-dashboards.service.unit.test.ts lib/export/dashboard-portfolio.unit.test.ts app/api/dashboards/**/route.test.ts` | 12 files, 97 passed, exit 0 | ✓ PASS |
| G+A+R identity | kpi.unit.test.ts `by_stage counts L5… G+A+R === active` | pass | ✓ PASS |
| Live refresh after submit | spec-dashboards.service.unit.test.ts `omits weekly action on second GET` | pass | ✓ PASS |
| No getPeriodTracking import | spec-dashboards.service source test | pass | ✓ PASS |
| No portfolio.service import | spec-dashboards.service source test | pass | ✓ PASS |
| Export PDF magic bytes | dashboard-portfolio.unit.test.ts `%PDF` | pass | ✓ PASS |
| auditLog on export | spec-dashboards.service.unit.test.ts `dashboard_export` | pass | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no phase-declared probes or `scripts/*/tests/probe-*.sh` for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PDSH-01 | 16-01 | Active/on-track/watch KPI tiles | ✓ SATISFIED | Truths #2, kpi.ts, service tests |
| PDSH-02 | 16-01 | Stage/RAG charts; G+A+R = active | ✓ SATISFIED | Truth #3, kpi.unit.test.ts |
| PDSH-03 | 16-01 | Overdue project count + High RAID drill-downs | ✓ SATISFIED | Truth #4 |
| PDSH-04 | 16-01 | Technology-council count + drill-down | ✓ SATISFIED | Truth #4 |
| PDSH-05 | 16-01, 16-02 | AND filters, persist, inherit drill-down | ✓ SATISFIED | Truths #5–6 |
| PDSH-06 | 16-02 | Clear/defaults + Excel/PDF export | ✓ SATISFIED | Truths #6–8 |
| MDSH-01 | 16-03 | PM assigned projects, portfolio list fields | ✓ SATISFIED | Truth #11 |
| MDSH-02 | 16-03 | Weekly-report actions | ✓ SATISFIED | Truth #12 |
| MDSH-03 | 16-03 | Milestone actions | ✓ SATISFIED | Truth #13 |
| MDSH-04 | 16-03 | High RAID actions + tech-council flag | ✓ SATISFIED | Truth #14 |
| MDSH-05 | 16-03 | Deep-links + session refresh | ✓ SATISFIED | Truths #15–16 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None in phase-modified dashboard files | — | — |

No TBD/FIXME/XXX markers, stub returns, or unwired placeholders found in phase artifacts.

### Human Verification Required

None — server tests exercise KPI identity, filter intersection, export buffers, auth matrix, PM action mapping, and live weekly refresh. ui_phase false; JSON href deep-links accepted per D-13.

### Gaps Summary

None. All ROADMAP success criteria 1–5 are implemented, wired, and covered by 97 passing targeted vitest tests. Prohibitions confirmed: no `getPortfolioSummary`/`portfolio.service` import in spec-dashboards; no `getPeriodTracking` on PM path; v1 `/api/portfolio` untouched.

---

_Verified: 2026-08-26T14:30:00Z_

_Verifier: Claude (gsd-verifier)_
