# Phase 16: Portfolio & PM Dashboards - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Deliver spec CPMO/leadership portfolio KPIs (active / on-track / watch-act, stage and RAG charts, overdue-milestone project count, High open RAID count, technology-council count) with AND-combined session filters, drill-down lists that match tiles, and Excel/PDF export; plus a PM dashboard limited to assignment-window projects with weekly / milestone / High-RAID action queues and deep links. This is a **parallel product surface** — do not overwrite v1 `getPortfolioSummary` / `GET /api/portfolio` (inline RAG, `current_phase` Initiation/Planning/Execution/Closing).

**Requirements:** PDSH-01, PDSH-02, PDSH-03, PDSH-04, PDSH-05, PDSH-06, MDSH-01, MDSH-02, MDSH-03, MDSH-04, MDSH-05

**In:** CPMO sees company-scoped spec KPIs computed from live project master (`status`, `stage` L0–L5, `rag`) plus Phase 12 helpers (upcoming/overdue milestones, High open RAID, tech-council issues) and Phase 13/14 weekly shells for PM actions; filters persist per user+surface; drill-down lists use the same filtered set as tiles; export the filtered dashboard; PM sees only assigned projects and action rows that deep-link to existing mutators; a subsequent GET reflects completed work.

**Out:** Redesign of v1 `/api/portfolio`, ProgramTabs, PortfolioHealthMatrix, or `/portfolio/budget`; document catalog (Phase 17); full audit coverage (Phase 18 — incremental `auditLog` on filter-save/export is OK); new npm packages; CASL; D-23 leftover re-gate; requiring a pixel-perfect UI-SPEC (`workflow.ui_phase` is false — server tests are the gate).

</domain>

<decisions>
## Implementation Decisions

Decision IDs D-01..D-16.

### Parallel surface (not v1 portfolio home)

- **D-01:** New service `lib/services/spec-dashboards.service.ts` and routes under `/api/dashboards/portfolio` and `/api/dashboards/pm`. Do **not** change `getPortfolioSummary`, `listPortfolioProjects` enrichment RAG, or `GET /api/portfolio`. v1 home stays. — **Reversibility:** costly — mixing spec L0–L5 KPIs into the v1 inline-RAG aggregate would force a later split.

### KPI definitions (PDSH-01..04)

- **D-02:** Active count = projects with `status` Active **and** `stage` in L0–L4 (exclude L5). Company-scoped via the same tenancy as `listProjects(companyId)` (`p.company_id` or customer `c.company_id`).
- **D-03:** On-track = Active as in D-02 **and** `rag` Green (normalize case: `green` / `Green` → green). Watch/act = Active **and** rag Amber or Red. Missing/invalid rag on an Active L0–L4 project counts as Amber so Green + Amber + Red **equals** the active count (PDSH-02 invariant).
- **D-04:** Stage chart counts Active? No — PDSH-02 says charts projects by L0–L5 and by RAG among the **filtered dashboard set** after AND filters, but the identity Green+Amber+Red = active count is computed on the **active** (D-02) subset of that filtered set. L5 rows may appear in the stage chart if they pass filters; they do not enter the active/on-track/watch tiles.
- **D-05:** Overdue-milestone **project** count = distinct `project_id` in `listOverdueMilestones(companyId)` that also sit in the filtered project set. High open RAID count = length of `listHighOpenRaid(companyId).records` in the filtered set (record count, not project count). Technology-council count = `listTechnologyCouncilIssues(companyId)` rows in the filtered set (open/in-progress flagged issues). Each tile has a matching drill-down list of those same rows (project-level for overdue milestones: one row per project with its overdue milestone payload). Consume Phase 12 service exports — do not reimplement SQL.

### Filters, session, export (PDSH-05, PDSH-06)

- **D-06:** AND-combined filters: `portfolio_year`, `program` (`customer_id`), `unit` (project unit/org field if present; else skip silently if column absent — planner verifies column name), `pm_user_id` (active primary assignment), `stage`, `status`, `rag`, `type` (project type column if present), `weekly_report_enabled`. Unknown filter keys 400. Empty/omitted key = no constraint.
- **D-07:** Persist filters in table `dashboard_filter_state` (`user_id`, `surface` `portfolio`|`pm`, `filters_json` JSONB/TEXT, `updated_at`) unique `(user_id, surface)`, settings-flag DDL in `lib/db-dashboards.ts` invoked from `getDb()` **after** `migrateFiscalBudget`. GET dashboard reads stored filters then applies; PUT/PATCH replaces; POST `clear` empties to `{}`; POST `defaults` restores empty defaults. Drill-down GET uses the same stored blob — no separate query-string required (query-string overrides are allowed for one-shot export).
- **D-08:** Export POST `/api/dashboards/portfolio/export` with `format` `xlsx`|`pdf`. xlsx via existing `exceljs`. PDF: reuse an existing in-repo generator if one exists without a new package; if none, generate xlsx plus a `docx`/`pptx` is **not** a substitute — planner must find a zero-dependency or already-installed path (e.g. existing client PDF helper invoked server-side, or `exceljs` workbook saved and a minimal PDF via a dependency already in `package.json`). Do not `npm install`. Export the **filtered** project list + KPI numbers + drill-down row ids. `auditLog` action `dashboard_export`.

### PM dashboard (MDSH-01..05)

- **D-09:** PM list = `listProjects(actor.company_id, { pmUserId: actor.user_id })` — assignment windows, same list fields as the CPMO filtered list for those rows. CPMO hitting `/api/dashboards/pm` still sees **only their own** assignments (not the whole portfolio). Viewer 403 on both dashboard surfaces. Null-company admin 403 via `assertCompanyWrite` on portfolio; PM dashboard requires `company_id` plus `pm` or `cpmo` role.
- **D-10:** Weekly actions: current company period (the period whose `[start_date, end_date]` contains today, else latest by `start_date`) — list obligated shells for the PM's assigned project ids with stored status `not_submitted` or `draft` (include overdue as a computed flag). Do **not** call `getPeriodTracking` (that asserts CPMO). Consume `listPeriodShellsRepo` (or a thin repo filter by `project_id = ANY(...)`) and `isWeeklyReportOverdue`. Deep-link `href` to the Phase 13 PM weekly-report path for that project/period.
- **D-11:** Milestone actions: `listUpcomingMilestones` ∪ `listOverdueMilestones` filtered to assigned project ids. RAID actions: `listHighOpenRaid` records that are upcoming or overdue (due date in the Phase 12 upcoming window or past due) on assigned projects, with `has_technology_council` from the tech-council helper. Deep-link to existing project milestone / RAID screens (URL strings in JSON). Completing an action is an existing mutator; the dashboard GET is live (no cache) so the next GET in the same session omits resolved rows (MDSH-05).

### Authz, UI, testing

- **D-12:** Portfolio GET/export/filters: `withCpmo` + `assertCompanyWrite`. PM GET: `withAuth` then require `pm` or `cpmo` and non-null `company_id`; still assignment-scoped. Do not invent CASL. Do not re-gate D-23 leftover ops/admin.
- **D-13:** `workflow.ui_phase` is false. Server tests are the gate. Thin pages optional and **not** must_haves. Deep links are strings on action rows; do not build a new SPA filter chrome as the success criterion.
- **D-14:** Consume, do not rewrite: `listUpcomingMilestones`, `listOverdueMilestones`, `listHighOpenRaid`, `listTechnologyCouncilIssues`, `listPeriodShellsRepo` / `isWeeklyReportOverdue`, `listProjects` assignment predicate, `computeFiscalBudgetMetrics` / `listOpenProjectDependencies` **only if** a KPI needs them — spec tiles do **not** require budget/dependency tiles this phase. Do not call v1 weekly Excel or activity-weighted report helpers.
- **D-15:** No physical DELETE of dashboard_filter_state history required; upsert-in-place of the one row per user+surface is OK (filter state is not an audit entity). Never physical DELETE projects/milestones/RAID/weekly rows.
- **D-16:** RAG/stage/status source of truth is the **live project master**, not weekly snapshot `wv.rag` (snapshots stay Phase 14 tracking).

### the agent's Discretion

- Exact JSON shape of GET portfolio (`kpis`, `charts`, `list`, `drilldowns`) and PM (`projects`, `actions.weekly|milestones|raid`). Prefer one GET that returns tiles + list + drill-down payloads so filters apply once.
- Unit field / project-type column names — researcher confirms; if a filter dimension has no column, document skip in PLAN and still accept the other AND keys.
- PDF implementation path among already-installed libraries.
- Whether overdue-milestone drill-down is one row per project or per milestone — prefer **per overdue milestone** so the list "matches the tile" while the tile count remains distinct projects (expose both `overdue_milestone_project_count` and `overdue_milestone_rows`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — Phase 16 goal, success criteria 1–5, UI hint yes (ignored: `workflow.ui_phase` false)
- `.planning/REQUIREMENTS.md` — PDSH-01..06, MDSH-01..05
- `.planning/PROJECT.md` — PR-13, PR-14
- `.planning/STATE.md` — current position Phase 16

### Locked prior decisions
- `.planning/phases/10-users-roles-server-authorization/10-CONTEXT.md` — `assertCompanyWrite`, D-23 leftover carve-out, `withCpmo`
- `.planning/phases/11-project-master-pm-assignment-stakeholders/11-CONTEXT.md` — `stage` L0–L5, `weekly_report_enabled`, assignment windows, `listProjects(..., { pmUserId })`
- `.planning/phases/12-milestone-raid-master-registers/12-CONTEXT.md` — listUpcoming/Overdue/HighOpen/TechCouncil helpers
- `.planning/phases/13-weekly-periods-pm-submit/13-CONTEXT.md` — obligated shells, `isWeeklyReportOverdue`, stored status vs computed overdue
- `.planning/phases/14-cpmo-tracking-consolidated-export/14-CONTEXT.md` — `getPeriodTracking` is CPMO-only; snapshots for export not for this dashboard's live RAG
- `.planning/phases/15-budget-value-roi-dependencies/15-CONTEXT.md` — fiscal helpers exist; no dashboard tiles required from them this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `listProjects(companyId, { pmUserId })` — PM assignment-window list (MDSH-01)
- `listUpcomingMilestones` / `listOverdueMilestones` / `listHighOpenRaid` / `listTechnologyCouncilIssues` — Phase 12, company-scoped
- `listPeriodShellsRepo` + `isWeeklyReportOverdue` — Phase 13/14; `getPeriodTracking` must not be reused for PM (asserts CPMO)
- `withCpmo` / `assertCompanyWrite` — portfolio surface
- `exceljs` — xlsx export analog `lib/export/consolidated-weekly.ts`
- Settings-flag DDL analog `lib/db-fiscal-budget.ts`

### Established Patterns
- Parallel product surface (Phases 13–15): new routes/tables, leave v1 `/api/portfolio` untouched
- Computed overdue, never a stored overdue status
- Route tests analog stakeholders / weekly tracking (401 / Viewer-or-PM 403 / CPMO 200)
- Repo tests `skipIf(!hasTestDb)` after `setupRepoTables` + new migrate helper

### Integration Points
- `getDb()` after `migrateFiscalBudget` → `migrateDashboards`
- Live `projects.status` / `projects.stage` / `projects.rag` / `projects.weekly_report_enabled` / `projects.portfolio_year`
- Filter upsert is per `user_id` + surface, not per HTTP cookie (sessions table has no JSON blob today)

### Landmines
- `getPortfolioSummary` recomputes RAG from open risks and `current_phase` — **not** spec RAG
- `getPeriodTracking` → `assertCompanyWrite` — PMs 403
- Seed `admin` has `is_admin=1`, null `company_id`, no `cpmo` role — portfolio 403 (correct)
- Vitest 4: do not put `-x` in automated commands
- Do not add npm packages

</code_context>

<specifics>
## Specific Ideas

Autonomous accept-all: parallel `/api/dashboards/*`, live master KPIs, user-scoped filter table, consume Phase 12–14 helpers, ui_phase false.

</specifics>

<deferred>
## Deferred Ideas

- Document templates / Confluence checklist — Phase 17
- Full append-only audit coverage — Phase 18
- Replacing v1 portfolio home UI chrome
- Budget remaining / open-dependency tiles (helpers exist; not in PDSH/MDSH)

</deferred>

---

*Phase: 16-portfolio-pm-dashboards*
*Context gathered: 2026-08-26*
