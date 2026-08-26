---
phase: 16
slug: portfolio-pm-dashboards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 16 — Validation Strategy

> Nyquist-style must-haves mapped to PDSH-01..06 and MDSH-01..05. Server tests are the phase gate (`workflow.ui_phase: false`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run lib/dashboards/kpi.unit.test.ts lib/services/spec-dashboards.service.unit.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~90 seconds |

Do not use `-x` in automated plan commands (Vitest 4 ignores it).

---

## Requirement Must-Haves (PDSH-01..06, MDSH-01..05)

| Req | Must-have behavior | Automated proof | Min test type |
|-----|-------------------|-----------------|---------------|
| **PDSH-01** | Active count = projects with `status === 'Active'` and `stage` in L0–L4 | `lib/dashboards/kpi.unit.test.ts` fixture matrix | unit |
| **PDSH-01** | On-track = active subset with normalized Green RAG | Same kpi unit tests | unit |
| **PDSH-01** | Watch/act = active subset with Amber or Red RAG | Same kpi unit tests | unit |
| **PDSH-01** | Missing/invalid RAG on active L0–L4 counts as Amber | Unit: null/empty/`Not applicable` rag → amber bucket | unit |
| **PDSH-02** | Stage chart counts filtered projects by L0–L5 (includes L5 if in filtered set) | `computePortfolioCharts` unit test | unit |
| **PDSH-02** | RAG chart buckets active L0–L4 only; Green + Amber + Red === active count | Unit invariant assertion | unit |
| **PDSH-03** | Overdue-milestone **project** tile = distinct `project_id` from overdue list ∩ filtered set | Service unit with mocked `listOverdueMilestones` | unit |
| **PDSH-03** | High open RAID tile = **record count** (not project count) in filtered set | Service unit with mocked `listHighOpenRaid` | unit |
| **PDSH-03** | Drill-down overdue rows match tile filter (per-milestone rows preferred) | Service unit: drilldown length ≥ distinct projects when multiple milestones | unit |
| **PDSH-03** | Drill-down High RAID rows === filtered `listHighOpenRaid` records | Service unit equality on ids | unit |
| **PDSH-04** | Tech-council tile count = open/in-progress council issues in filtered set | Service unit with mocked `listTechnologyCouncilIssues` | unit |
| **PDSH-04** | Tech-council drill-down lists same rows as tile | Service unit equality | unit |
| **PDSH-05** | AND-combined filters: year, program, PM, stage, status, RAG, type, weekly flag | `lib/dashboards/filters.unit.test.ts` each dimension + combined | unit |
| **PDSH-05** | `unit` filter key accepted but no-op (no column) | Unit: filter object with `unit` does not throw; does not narrow set | unit |
| **PDSH-05** | Unknown filter key → 400 | Route or filters schema unit test | unit/route |
| **PDSH-05** | Filters persist per user+surface; GET applies stored blob | Repo upsert test + service read | unit/repo |
| **PDSH-05** | Drill-down GET inherits same stored filters (no separate query required) | Service unit: one filter load per GET | unit |
| **PDSH-06** | POST clear → `{}`; POST defaults → `{}` | Route test on `/api/dashboards/portfolio/filters` | route |
| **PDSH-06** | Export POST `format: xlsx` returns spreadsheet buffer | `lib/export/dashboard-portfolio.unit.test.ts` | unit |
| **PDSH-06** | Export POST `format: pdf` returns PDF buffer via jspdf (no new package) | Same export unit test | unit |
| **PDSH-06** | Export includes filtered project list + KPI numbers + drill-down ids | Export unit asserts sheet/section content | unit |
| **PDSH-06** | Optional export `body.filters` is one-shot (not written to `dashboard_filter_state`) | Service unit | unit |
| **PDSH-06** | `auditLog` action `dashboard_export` on export | Service/route unit mock | unit |
| **MDSH-01** | PM GET returns only assignment-window projects | Service unit: `listProjects` called with `{ pmUserId: actor.user_id }` | unit |
| **MDSH-01** | PM project list fields match portfolio list shape for same rows | Service unit shape assertion | unit |
| **MDSH-01** | CPMO on `/api/dashboards/pm` sees own assignments only (not whole portfolio) | Route test: cpmo session still scoped by pmUserId | route |
| **MDSH-02** | Weekly actions: shells with `not_submitted` or `draft` on assigned projects | Service unit with mocked shells | unit |
| **MDSH-02** | Weekly actions include period, due, status, overdue flag | Service unit field assertion | unit |
| **MDSH-02** | Weekly actions do **not** call `getPeriodTracking` | Static import guard / mock never called | unit |
| **MDSH-02** | `isWeeklyReportOverdue` used for overdue flag | Service unit mock assertion | unit |
| **MDSH-03** | Milestone actions = upcoming ∪ overdue on assigned projects only | Service unit with filtered Phase 12 lists | unit |
| **MDSH-03** | Milestone action rows include dates + update href | Service unit shape | unit |
| **MDSH-04** | RAID actions = High open/in-progress with due in upcoming window or past due | Service unit date filter | unit |
| **MDSH-04** | RAID rows include `has_technology_council` when issue flagged | Service unit with council lookup | unit |
| **MDSH-05** | Each action row includes `href` deep-link string: weekly `/projects/{id}/weekly-reports/{reportId}`; milestone `/projects/{id}/milestones`; RAID `/projects/{id}/raid` | Service unit | unit |
| **MDSH-05** | Second GET after mutator omits resolved action (live read, no cache) | Service unit: simulate status change between calls | unit |

### Cross-cutting (locked D-01..D-16)

| Must-have | Automated proof |
|-----------|-----------------|
| Parallel surface — no import of `getPortfolioSummary` / `portfolio.service` | Static unit: spec-dashboards.service does not import `@/lib/services/portfolio.service` |
| v1 `GET /api/portfolio` unchanged | No edits in `app/api/portfolio/route.ts`; existing tests still pass |
| Portfolio routes: `withCpmo` + `assertCompanyWrite` | Route tests: cpmo 200, pm 403, viewer 403 |
| PM routes: pm/cpmo with `company_id`; viewer 403 | Route tests |
| Seed admin pattern (`is_admin=1`, null `company_id`) → portfolio 403 | Route test session mirrors landmine |
| KPI RAG from live `projects.rag`, not `wv.rag` snapshot | Service unit: no join to weekly_report_versions in KPI path |
| DDL via settings flag after `migrateFiscalBudget` in `getDb()` | `lib/db-dashboards.ddl.unit.test.ts` |
| No new npm packages for export | package.json diff guard / no install step in plan |
| Filter state upsert only — no physical DELETE | Repo test: INSERT/UPDATE upsert only |
| No physical DELETE on projects/milestones/RAID/weekly rows | N/A — read-only dashboard phase |

---

## Sampling Rate

- **After every task commit:** run task `<verify><automated>` file(s)
- **After every plan wave:** `npx vitest run lib/dashboards lib/services/spec-dashboards.service.unit.test.ts lib/db-dashboards.ddl.unit.test.ts lib/export/dashboard-portfolio.unit.test.ts app/api/dashboards`
- **Before `$gsd-verify-work`:** full `npm test` green
- **Max feedback latency:** 90 seconds

---

## Wave 0 Files (all ❌ until created)

- [ ] `lib/db-dashboards.ts` + `.ddl.unit.test.ts`
- [ ] `lib/dashboards/filters.ts`, `kpi.ts`, `rag.ts`, `period-resolver.ts` + unit tests
- [ ] `lib/repositories/dashboard-filter-state.repo.ts` + `.repo.test.ts`
- [ ] `lib/services/spec-dashboards.service.ts` + `.unit.test.ts`
- [ ] `lib/export/dashboard-portfolio.ts` + `.unit.test.ts`
- [ ] `app/api/dashboards/portfolio/route.ts` + `filters/route.ts` + `export/route.ts` + route tests
- [ ] `app/api/dashboards/pm/route.ts` + `route.test.ts`
- [ ] `app/api/dashboards/pm/filters/route.ts` + `route.test.ts`
- [ ] `lib/dashboards/filter-schema.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
|----------|-------------|------------|--------------|
| Thin portfolio/PM dashboard UI (if added) | D-13 | `ui_phase: false` | Optional smoke: CPMO opens dashboard, applies filter, exports. Server tests remain gate. |

All PDSH-01..06 and MDSH-01..05 behaviors above have intended automated coverage.

---

## Validation Sign-Off

- [ ] Every PDSH-01..06 and MDSH-01..05 must-have row has a Wave 0 test target
- [ ] No three consecutive tasks without `<automated>` verify
- [ ] v1 `getPortfolioSummary` landmine covered by negative import test
- [ ] `getPeriodTracking` not called from PM path covered by static/mock test
- [ ] PDSH-02 RAG invariant (Green+Amber+Red=active) covered in kpi unit tests
- [ ] `nyquist_compliant: true` when Wave 0 complete

**Approval:** pending
