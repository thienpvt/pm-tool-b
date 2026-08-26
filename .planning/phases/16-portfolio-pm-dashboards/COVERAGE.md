# Phase 16 coverage map

Maps ROADMAP requirements and CONTEXT locked decisions to executable plans. Server tests are the gate (`workflow.ui_phase: false`).

## Requirements

| ID | Description | Plan | Tasks |
|----|-------------|------|-------|
| PDSH-01 | Active (Active + L0–L4), on-track (Green), watch/act (Amber/Red) | 16-01 | 16-01-01 |
| PDSH-02 | Charts by L0–L5 and RAG; Green + Amber + Red = active count | 16-01 | 16-01-02 |
| PDSH-03 | Overdue-milestone project count + High open RAID record count + matching drill-downs | 16-01 | 16-01-02 |
| PDSH-04 | Technology-council count + matching drill-down | 16-01 | 16-01-02 |
| PDSH-05 | AND filters on whole dashboard; persist; drill-down inherits | 16-01 (AND + inherit), 16-02 (persist) | 16-01-03, 16-02-01 |
| PDSH-06 | Clear / defaults / export xlsx + pdf | 16-02 | 16-02-01, 16-02-02 |
| MDSH-01 | PM sees only assigned projects; same list fields | 16-03 | 16-03-01 |
| MDSH-02 | Weekly Not submitted/Draft actions with period, due, status, submit href | 16-03 | 16-03-01 |
| MDSH-03 | Upcoming or overdue milestone actions | 16-03 | 16-03-02 |
| MDSH-04 | High RAID upcoming/overdue + tech-council flag | 16-03 | 16-03-02 |
| MDSH-05 | Deep-link hrefs; live GET omits resolved rows | 16-03 | 16-03-01, 16-03-02 |

## Decisions (D-01..D-16)

| ID | Lock | Plan |
|----|------|------|
| D-01 | Parallel `spec-dashboards.service` + `/api/dashboards/*`; do not change `getPortfolioSummary` / GET `/api/portfolio` | 16-01 (prohibitions + import guard) |
| D-02 | Active = status Active AND stage L0–L4 | 16-01 `isActiveProject` |
| D-03 | On-track Green; watch/act Amber/Red; missing/invalid rag → Amber so G+A+R = active | 16-01 `normalizeRag` + kpi identity |
| D-04 | Stage chart = filtered set (incl. L5); RAG identity on active subset only | 16-01-02 |
| D-05 | Overdue tile = distinct projects; drill-down = per milestone; RAID/tech-council = record counts | 16-01-02 |
| D-06 | AND keys; `type` = classification; `unit` accepted no-op; unknown key 400 | 16-01-03, 16-02 PUT `.strict()` |
| D-07 | `dashboard_filter_state` unique (user_id, surface portfolio\|pm); GET reads stored blob; PUT replace; POST clear/defaults `{}` | 16-01 GET empty; 16-02 portfolio persist; 16-03 surface pm |
| D-08 | POST export xlsx (`exceljs`) + pdf (`jspdf`); no npm install; `auditLog` `dashboard_export` | 16-02-02 |
| D-09 | PM list = `listProjects(..., { pmUserId })`; CPMO on PM route still own assignments; Viewer 403 | 16-03-01 |
| D-10 | Weekly actions via `listPeriodShellsRepo` + `isWeeklyReportOverdue`; never `getPeriodTracking` | 16-03-01 |
| D-11 | Milestone ∪ overdue; RAID upcoming-or-overdue + council flag; live GET | 16-03-02 |
| D-12 | Portfolio `withCpmo` + `assertCompanyWrite`; PM `withAuth` + pm\|cpmo + company_id; no CASL; no D-23 re-gate | 16-01, 16-02, 16-03 |
| D-13 | `ui_phase` false; server tests are the gate; href strings not new pages | all (no UI must_have) |
| D-14 | Consume Phase 12–13 helpers; no budget/dependency tiles; no v1 weekly Excel helpers | 16-01, 16-02, 16-03 |
| D-15 | Filter-state upsert-in-place; no physical DELETE | 16-02-01 |
| D-16 | Live `projects.rag` / stage / status; not snapshot `wv.rag` | 16-01 |

## Planner-locked JSON and hrefs

| Lock | Plan |
|------|------|
| GET portfolio `{ filters, kpis, charts, list, drilldowns }` | 16-01 |
| GET pm `{ filters, projects, actions.weekly\|milestones\|raid }` | 16-03 |
| Weekly href `/projects/{id}/weekly-reports/{reportId}` | 16-03 |
| Milestone href `/projects/{id}/milestones` | 16-03 |
| RAID href `/projects/{id}/raid` | 16-03 |
| `overdue_milestone_project_count` + per-milestone `drilldowns.overdue_milestones` | 16-01 |
| Export one-shot `body.filters` not persisted | 16-02 |
| migrateDashboards after migrateFiscalBudget | 16-01 |

## Deferred (not planned)

- Document templates / Confluence checklist — Phase 17
- Full append-only audit coverage — Phase 18
- Replacing v1 portfolio home UI chrome
- Budget remaining / open-dependency tiles

## File-layout lock (RESEARCH + PATTERNS)

| Path | Plan |
|------|------|
| lib/db-dashboards.ts | 16-01 |
| lib/dashboards/rag.ts, kpi.ts, filters.ts | 16-01 |
| lib/dashboards/filter-schema.ts | 16-02 |
| lib/dashboards/period-resolver.ts | 16-03 |
| dashboard-filter-state.repo.ts | 16-01 GET; 16-02 upsert |
| spec-dashboards.service.ts | 16-01, 16-02, 16-03 |
| lib/export/dashboard-portfolio.ts | 16-02 |
| app/api/dashboards/portfolio/route.ts | 16-01 |
| app/api/dashboards/portfolio/filters + export | 16-02 |
| app/api/dashboards/pm/route.ts + filters | 16-03 |
