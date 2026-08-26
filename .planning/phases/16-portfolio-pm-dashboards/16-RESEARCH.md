# Phase 16: Portfolio & PM Dashboards - Research

**Researched:** 2026-08-26
**Domain:** Parallel CPMO portfolio KPI dashboard (live project master + Phase 12 registers) and PM assignment-scoped action queues — separate from v1 `getPortfolioSummary` inline-RAG portfolio home
**Confidence:** HIGH

## Summary

Phase 16 delivers a **parallel product surface** for spec portfolio KPIs and PM action queues. v1 `GET /api/portfolio` → `getPortfolioSummary` recomputes RAG from open risks, deadline proximity, and `current_phase` Initiation/Planning/Execution/Closing — **not** spec `projects.stage` L0–L5 or stored `projects.rag` [VERIFIED: lib/services/portfolio.service.ts:73-106]. That route and service must remain untouched [D-01].

The spec dashboard reads **live project master** columns (`status`, `stage`, `rag`, `portfolio_year`, `weekly_report_enabled`, `classification`) [VERIFIED: lib/repositories/projects.repo.ts:12-41] [VERIFIED: lib/db-project-master.ts:10-21], applies AND-combined session filters persisted in new table `dashboard_filter_state`, aggregates KPI tiles + charts + drill-down lists from Phase 12 list helpers (`listOverdueMilestones`, `listUpcomingMilestones`, `listHighOpenRaid`, `listTechnologyCouncilIssues`) [VERIFIED: lib/services/raid-masters.service.ts:14-32], and exports filtered results via existing `exceljs` and `jspdf` (no new npm packages) [VERIFIED: package.json:20-22].

The PM dashboard scopes projects via `listProjects(companyId, { pmUserId })` assignment-window predicate [VERIFIED: lib/repositories/projects.repo.ts:94-112] and builds weekly/milestone/RAID action rows without calling `getPeriodTracking` (CPMO-only `assertCompanyWrite`) [VERIFIED: lib/services/weekly-tracking.service.ts:178-185]. PM weekly actions consume `listPeriodShellsRepo` + `isWeeklyReportOverdue` directly [VERIFIED: lib/repositories/weekly-reports.repo.ts:413-437] [VERIFIED: lib/services/weekly-reports.service.ts:242-250].

Schema DDL follows the settings-flag pattern in new `lib/db-dashboards.ts`, invoked from `getDb()` **after** `migrateFiscalBudget` [VERIFIED: lib/db.ts:633-634] [VERIFIED: lib/db-fiscal-budget.ts:75-108]. Auth: portfolio surface `withCpmo` + `assertCompanyWrite`; PM surface `withAuth` + `pm`|`cpmo` role + non-null `company_id`; viewer 403; seed `admin` (`is_admin=1`, null `company_id`, no cpmo role) correctly 403 on portfolio via `assertCompanyWrite` [VERIFIED: lib/services/access.ts:126-128] [VERIFIED: lib/db.ts:562-564].

**Primary recommendation:** Add `lib/services/spec-dashboards.service.ts`, pure KPI/filter helpers in `lib/dashboards/`, `lib/db-dashboards.ts` + filter-state repo, routes under `/api/dashboards/portfolio` and `/api/dashboards/pm`, export generator `lib/export/dashboard-portfolio.ts` (exceljs + jspdf), and gate with Vitest 4 service + route tests (`workflow.ui_phase: false`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

- **D-12:** Portfolio GET/export/filters: `withCpmo` + `assertCompanyWrite`. PM GET: `withAuth` then require `pm` or `cpmo` and non-null `company_id`; still assignment-scoped. Do not invent CASL. Do not re-gate D-23 leftover ops/admin routes.
- **D-13:** `workflow.ui_phase` is false. Server tests are the gate. Thin pages optional and **not** must_haves. Deep links are strings on action rows; do not build a new SPA filter chrome as the success criterion.
- **D-14:** Consume, do not rewrite: `listUpcomingMilestones`, `listOverdueMilestones`, `listHighOpenRaid`, `listTechnologyCouncilIssues`, `listPeriodShellsRepo` / `isWeeklyReportOverdue`, `listProjects` assignment predicate, `computeFiscalBudgetMetrics` / `listOpenProjectDependencies` **only if** a KPI needs them — spec tiles do **not** require budget/dependency tiles this phase. Do not call v1 weekly Excel or activity-weighted report helpers.
- **D-15:** No physical DELETE of dashboard_filter_state history required; upsert-in-place of the one row per user+surface is OK (filter state is not an audit entity). Never physical DELETE projects/milestones/RAID/weekly rows.
- **D-16:** RAG/stage/status source of truth is the **live project master**, not weekly snapshot `wv.rag` (snapshots stay Phase 14 tracking). [VERIFIED: listPeriodShellsRepo selects wv.rag for CPMO tracking — dashboards must use projects.rag instead]

### Claude's Discretion

- Exact JSON shape of GET portfolio (`kpis`, `charts`, `list`, `drilldowns`) and PM (`projects`, `actions.weekly|milestones|raid`). Prefer one GET that returns tiles + list + drill-down payloads so filters apply once.
- Unit field / project-type column names — researcher confirms; if a filter dimension has no column, document skip in PLAN and still accept the other AND keys.
- PDF implementation path among already-installed libraries.
- Whether overdue-milestone drill-down is one row per project or per milestone — prefer **per overdue milestone** so the list "matches the tile" while the tile count remains distinct projects (expose both `overdue_milestone_project_count` and `overdue_milestone_rows`).

### Deferred Ideas (OUT OF SCOPE)

- Document templates / Confluence checklist — Phase 17
- Full append-only audit coverage — Phase 18
- Replacing v1 portfolio home UI chrome
- Budget remaining / open-dependency tiles (helpers exist; not in PDSH/MDSH)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDSH-01 | Active (status Active + stage L0–L4), on-track (Active + Green), watch/act (Active + Amber/Red) | Pure KPI helpers on filtered project set; active predicate + `normalizeRag` [D-02, D-03]; live `projects.status`/`stage`/`rag` [D-16] |
| PDSH-02 | Charts by L0–L5 and by RAG; Green + Amber + Red = active count | Stage/RAG buckets on filtered set; RAG invariant on active L0–L4 subset only [D-04] |
| PDSH-03 | Overdue-milestone project count + High open RAID record count with matching drill-downs | `listOverdueMilestones` distinct project_id ∩ filtered set; `listHighOpenRaid` record count ∩ filtered set [D-05]; per-milestone drill rows (discretion) |
| PDSH-04 | Technology-council issue count + drill-down | `listTechnologyCouncilIssues` filtered to dashboard project set [VERIFIED: lib/repositories/issues.repo.ts:154-171] |
| PDSH-05 | AND filters on whole dashboard; persist session; drill-down inherits | `dashboard_filter_state` upsert [D-07]; filter keys mapped to columns (see Filter Column Map); unknown key → 400 |
| PDSH-06 | Clear filters, restore defaults, export Excel + PDF | Filter POST clear/defaults; export POST with `exceljs` + `jspdf`; `auditLog('dashboard_export')` [D-08] |
| MDSH-01 | PM sees only assigned projects with same list fields as portfolio | `listProjects(companyId, { pmUserId })` [VERIFIED: lib/repositories/projects.repo.ts:102-109] [D-09] |
| MDSH-02 | Weekly-report actions: Not submitted/Draft, period, due, status, submit control | Current period resolution + `listPeriodShellsRepo` + `isWeeklyReportOverdue`; no `getPeriodTracking` [D-10] |
| MDSH-03 | Milestone actions: upcoming or overdue on assigned projects | Union of Phase 12 milestone lists filtered by assigned project ids [D-11] |
| MDSH-04 | High open/in-progress RAID upcoming or overdue + tech-council flag | `listHighOpenRaid` date window filter + council issue lookup [D-11] |
| MDSH-05 | Deep-links + live refresh after mutator | href strings on action rows; stateless GET (no cache) [D-11, D-13] |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Portfolio KPI aggregation (active/on-track/watch, charts) | API / Backend (`spec-dashboards.service`) | Database (live `projects` read via `listProjects`) | Live master RAG/stage — not v1 inline RAG [D-16] |
| Drill-down lists (milestones, RAID, tech council) | API / Backend (service composes Phase 12 exports) | Database (existing repo SQL) | Do not reimplement SQL [D-14] |
| AND filter application + persistence | API / Backend (filter service + repo) | Database (`dashboard_filter_state`) | Per user+surface upsert [D-07] |
| Portfolio export (xlsx/pdf) | API / Backend (`lib/export/dashboard-portfolio.ts`) | — (in-memory Buffer) | Reuse `exceljs`/`jspdf` [D-08]; no new packages |
| PM project list | API / Backend (`listProjects` + pmUserId) | Database (`project_pm_assignments` window) | Assignment-window predicate [D-09] |
| PM action queues (weekly/milestone/RAID) | API / Backend (`spec-dashboards.service`) | Database (shells, milestones, risks/issues) | **Must not** call `getPeriodTracking` [D-10] |
| Portfolio authz | API / Backend (`withCpmo` + `assertCompanyWrite`) | — | CPMO + company_id required [D-12] |
| PM authz | API / Backend (`withAuth` + role gate) | — | pm/cpmo + company_id; assignment scope [D-09, D-12] |
| Schema DDL | Database (`migrateDashboards` on boot) | — | After `migrateFiscalBudget` [VERIFIED: lib/db.ts:633-634] |
| Incremental audit | API / Backend (`auditLog`) | Database (`audit_logs`) | Export only this phase [D-08] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | ^8.20.0 [VERIFIED: package.json:26] | PostgreSQL pool | Existing `getDb()` client |
| `zod` | ^4.4.3 [VERIFIED: package.json:35] | Route body/query validation | Matches existing API schema pattern |
| `exceljs` | ^4.4.0 [VERIFIED: package.json:20] | Portfolio xlsx export | Already used in `lib/export/consolidated-weekly.ts` [VERIFIED: lib/export/consolidated-weekly.ts:1] |
| `jspdf` | ^2.5.1 [VERIFIED: package.json:22] | Portfolio pdf export | Already in repo; client usage in `app/portfolio/report/useReportPageActions.ts` — invoke server-side for dashboard PDF [ASSUMED: server Buffer generation mirrors client pattern] |
| `vitest` | 4.1.10 [VERIFIED: package.json:49] | Service + route tests | Phase gate (D-13); TDD enabled |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `withCpmo` | — | CPMO route wrapper | Portfolio routes [VERIFIED: lib/http/with-role.ts:26-34] |
| Existing `withAuth` | — | Session wrapper | PM dashboard routes |
| Existing `assertCompanyWrite` | — | CPMO company write gate | Portfolio GET/export/filters [VERIFIED: lib/services/access.ts:126-128] |
| Existing `listProjects` | — | Company + optional PM scope | Base project list for both surfaces |
| Phase 12 `raid-masters.service` exports | — | Milestone/RAID/tech-council lists | KPI tiles + drill-downs [D-14] |
| Phase 13 `isWeeklyReportOverdue` | — | Computed overdue flag | PM weekly actions [D-10] |
| Existing `auditLog` | — | Export audit | `dashboard_export` action [D-08] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `/api/dashboards/*` | Extend `GET /api/portfolio` | **Rejected** — v1 inline RAG landmine [VERIFIED: lib/services/portfolio.service.ts:73-85] |
| `getPeriodTracking` for PM weekly queue | `listPeriodShellsRepo` + period resolver | **Rejected** — PM 403 on tracking [VERIFIED: lib/services/weekly-tracking.service.ts:184] |
| `docx`/`pptx` for PDF substitute | `jspdf` server-side | **Rejected** — D-08 requires PDF; `jspdf` already installed |
| New npm PDF package | `jspdf` | **Rejected** — D-08 / CONTEXT no new packages |
| Weekly snapshot RAG for KPIs | Live `projects.rag` | **Rejected** — D-16 |
| `governance` column for `unit` filter | Skip `unit` silently | **Accepted** — no `unit` column on `projects` [VERIFIED: lib/repositories/projects.repo.ts:12-41] |

**Installation:** No new packages. Use existing dependencies only.

**Version verification:** `npm view exceljs version` → 4.4.0; `npm view jspdf version` → 4.2.1 (package.json pins ^2.5.1 — compatible range).

## Package Legitimacy Audit

> Phase 16 installs **no new external packages**. Existing export libraries verified.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `exceljs` | npm | ~2 yrs | ~13.9M/wk | github.com/exceljs/exceljs | OK | Approved (already installed) |
| `jspdf` | npm | current | ~14.8M/wk | github.com/parallax/jsPDF | OK | Approved (already installed) |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart TD
  CPMO[CPMO client] -->|GET/PUT/POST| PF[/api/dashboards/portfolio]
  CPMO -->|POST export| PFX[/api/dashboards/portfolio/export]
  PM[PM client] -->|GET| PMR[/api/dashboards/pm]

  PF --> WC[withCpmo]
  PFX --> WC
  PMR --> WA[withAuth + pm/cpmo gate]

  WC --> ACW[assertCompanyWrite]
  WA --> LP[listProjects pmUserId]

  PF --> SVC[spec-dashboards.service]
  PFX --> SVC
  PMR --> SVC

  SVC --> FS[dashboard_filter_state repo]
  SVC --> LP2[listProjects company scope]
  SVC --> RM[listOverdueMilestones / listUpcomingMilestones]
  SVC --> HR[listHighOpenRaid]
  SVC --> TC[listTechnologyCouncilIssues]
  SVC --> PS[listPeriodShellsRepo + isWeeklyReportOverdue]
  SVC --> KPI[lib/dashboards/kpi.ts pure helpers]

  PFX --> EXP[lib/export/dashboard-portfolio.ts]
  EXP --> XLS[exceljs]
  EXP --> PDF[jspdf]

  PFX --> AUD[auditLog dashboard_export]

  V1[GET /api/portfolio v1] -.->|unchanged| V1SVC[getPortfolioSummary inline RAG]
  TRACK[getPeriodTracking] -.->|not called by PM| X[403 for PM]
```

### Recommended Project Structure

```
lib/
├── db-dashboards.ts                    # settings-flag DDL (D-07)
├── db-dashboards.ddl.unit.test.ts
├── dashboards/
│   ├── filters.ts                      # AND filter apply + key validation
│   ├── kpi.ts                          # active/on-track/watch, stage/RAG charts
│   ├── rag.ts                          # normalizeRag (D-03)
│   └── period-resolver.ts              # current company period (D-10)
├── repositories/
│   └── dashboard-filter-state.repo.ts
├── services/
│   └── spec-dashboards.service.ts
├── export/
│   └── dashboard-portfolio.ts          # xlsx + pdf generators
app/api/dashboards/
├── portfolio/
│   ├── route.ts                        # GET dashboard
│   ├── filters/route.ts                # PUT/PATCH + POST clear/defaults
│   ├── export/route.ts                 # POST xlsx|pdf
│   ├── route.test.ts
│   └── export/route.test.ts
└── pm/
    ├── route.ts                        # GET PM dashboard
    └── route.test.ts
```

### Pattern 1: Parallel surface (do not extend v1 portfolio)

**What:** New routes and service; leave `getPortfolioSummary` and `GET /api/portfolio` untouched.  
**When to use:** All spec KPI and filter logic.  
**Landmine:** v1 recomputes RAG from risks/deadlines — not spec stored RAG:

```typescript
// [VERIFIED: lib/services/portfolio.service.ts:73-85]
// INLINE RAG — diverges from lib/rag.ts:calculateRAG. Do not substitute.
let rag: 'red' | 'amber' | 'green' = 'green';
if (p.current_phase !== 'Closing') {
  if ((days_until_deadline !== null && days_until_deadline < 0) || open_risks >= 3) {
    rag = 'red';
  } else if (/* deadline / risks / completion */) {
    rag = 'amber';
  }
}
```

v1 route is a thin wrapper only [VERIFIED: app/api/portfolio/route.ts:7-17] — do not add spec fields there.

### Pattern 2: Settings-flag DDL after fiscal migrate

**What:** Idempotent DDL via `settings` key — same as fiscal budget.  
**When to use:** `dashboard_filter_state` table.  
**Example:**

```typescript
// Analog [VERIFIED: lib/db-fiscal-budget.ts:75-108]
export const DASHBOARDS_DDL_FLAG = 'dashboards_ddl_v1';
export const DASHBOARDS_DDL = [
  `CREATE TABLE IF NOT EXISTS dashboard_filter_state (
     user_id INTEGER NOT NULL REFERENCES users(id),
     surface TEXT NOT NULL CHECK (surface IN ('portfolio', 'pm')),
     filters_json JSONB NOT NULL DEFAULT '{}',
     updated_at TIMESTAMPTZ DEFAULT now(),
     UNIQUE (user_id, surface)
   )`,
];
// In getDb() after migrateFiscalBudget [VERIFIED: lib/db.ts:633-634]
```

### Pattern 3: Filter column map (D-06)

**What:** Map API filter keys to project columns; skip absent dimensions silently.  
**Verified column mapping:**

| Filter key | DB column / join | Notes |
|------------|------------------|-------|
| `portfolio_year` | `p.portfolio_year` | INTEGER [VERIFIED: lib/db-project-master.ts:10] |
| `program` | `p.customer_id` | program = customer |
| `unit` | — | **No column** in `PROJECT_COLUMNS` — skip silently [VERIFIED: lib/repositories/projects.repo.ts:12-41] |
| `pm_user_id` | `project_pm_assignments` EXISTS | Active window predicate [VERIFIED: lib/repositories/projects.repo.ts:103-108] |
| `stage` | `p.stage` | L0–L5 text [VERIFIED: lib/db-project-master.ts:11] |
| `status` | `p.status` | e.g. `'Active'` [VERIFIED: app/projects/[id]/page.tsx:23] |
| `rag` | `p.rag` | Live master [D-16] |
| `type` | `p.classification` | No `type` column; use `classification` [VERIFIED: lib/db-project-master.ts:20] |
| `weekly_report_enabled` | `p.weekly_report_enabled` | BOOLEAN [VERIFIED: lib/db-project-master.ts:15] |

Unknown keys → `ValidationError` 400. Omitted/empty → no constraint.

### Pattern 4: KPI math (pure functions)

**What:** Compute tiles and charts from in-memory project rows after filter application.  
**When to use:** Portfolio GET and export summary sheet.

```typescript
// D-02/D-03 — active stages L0–L4 only for tile counts
const ACTIVE_STAGES = new Set(['L0', 'L1', 'L2', 'L3', 'L4']);

function normalizeRag(raw: string | null | undefined): 'green' | 'amber' | 'red' {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'green') return 'green';
  if (v === 'red') return 'red';
  if (v === 'amber') return 'amber';
  return 'amber'; // missing/invalid → amber (D-03)
}

function isActiveProject(p: { status: string; stage: string | null }): boolean {
  return p.status === 'Active' && p.stage != null && ACTIVE_STAGES.has(p.stage);
}
```

Stage chart: count all filtered projects by `stage` L0–L5. RAG chart: bucket active L0–L4 subset; invariant `green + amber + red === activeCount`.

### Pattern 5: PM weekly actions without getPeriodTracking

**What:** Resolve current period, fetch shells, filter to assigned projects.  
**When to use:** PM dashboard `actions.weekly` only.  
**Landmine:**

```typescript
// [VERIFIED: lib/services/weekly-tracking.service.ts:184]
assertCompanyWrite(actor); // CPMO-only — PM must not enter this path
```

**Recommended flow:**

```typescript
// D-10 — period resolver (pure on WeeklyPeriodRow[])
function resolveCurrentPeriod(periods: WeeklyPeriodRow[], today: string) {
  const containing = periods.find((p) => p.start_date <= today && today <= p.end_date);
  if (containing) return containing;
  return [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}

// Shells via listPeriodShellsRepo(companyId, period.id) — filter project_id ∈ assignedIds
// status in ('not_submitted','draft'); overdue = isWeeklyReportOverdue(status, due_at, now)
```

### Pattern 6: Portfolio export (exceljs + jspdf)

**What:** New `lib/export/dashboard-portfolio.ts` — separate from consolidated weekly (snapshot payload).  
**When to use:** POST `/api/dashboards/portfolio/export`.  
**xlsx:** Mirror `buildPortfolioSummarySheet` styling from consolidated weekly [VERIFIED: lib/export/consolidated-weekly.ts:132-164] — KPI sheet + project list + drill-down id columns.  
**pdf:** Server-side `jspdf` tabular layout (KPI block + project table) — same dependency as client PDF in portfolio report [VERIFIED: app/portfolio/report/useReportPageActions.ts:229-232]. Do **not** use docx/pptx as PDF substitute [D-08].

### Pattern 7: Route tests (auth matrix)

**What:** Mock service layer; assert 401/403/200 matrix like Phase 14 tracking tests.  
**When to use:** All dashboard routes.  
**Analog:** [VERIFIED: app/api/weekly-periods/[periodId]/tracking/route.test.ts:49-69] — cpmo 200, pm 403, viewer 403 on CPMO-only routes.

### Anti-Patterns to Avoid

- **Calling `getPortfolioSummary` for spec KPIs:** Wrong RAG source and phase model.
- **Calling `getPeriodTracking` from PM dashboard:** PM receives 403 by design.
- **Using `listPeriodShellsRepo` RAG (`wv.rag`) for portfolio KPIs:** Violates D-16 live master rule.
- **Reimplementing Phase 12 SQL in dashboard service:** Import `raid-masters.service` exports only.
- **Adding npm packages for PDF:** Use `jspdf` already in package.json.
- **Physical DELETE on filter state or governed entities:** Upsert only [D-15].
- **Inventing CASL or re-gating ops/admin routes:** D-12.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Company-scoped project list | Custom SQL in dashboard | `listProjects(companyId, opts?)` | Tenancy + PM window already proven [VERIFIED: lib/repositories/projects.repo.ts:94-112] |
| Overdue milestone / High RAID lists | Duplicate repo queries | Phase 12 service exports | Same company scope + ordering [VERIFIED: lib/services/raid-masters.service.ts:14-28] |
| Tech-council issues | Custom issue filter | `listTechnologyCouncilIssues` | Flag + status predicate locked [VERIFIED: lib/repositories/issues.repo.ts:161] |
| Weekly overdue computation | Stored overdue status | `isWeeklyReportOverdue` | Computed-only contract [VERIFIED: lib/services/weekly-reports.service.ts:242-250] |
| CPMO company write gate | Custom role if/else | `assertCompanyWrite` + `withCpmo` | Null-company admin 403 is correct [VERIFIED: lib/services/access.ts:126-128] |
| Filter persistence | HTTP session cookie JSON | `dashboard_filter_state` table | Sessions table has no JSON blob today [CONTEXT] |
| Schema migration | Prisma / one-off scripts | Settings-flag `lib/db-dashboards.ts` | Phases 11–15 convention |
| xlsx styling | Ad-hoc CSV | `exceljs` workbook helpers | Matches consolidated export quality |

**Key insight:** Phase 16 is orchestration — compose existing list helpers + live project master + filter persistence. The landmines are all **wrong data source** (v1 portfolio RAG, tracking RAG, getPeriodTracking auth).

## Common Pitfalls

### Pitfall 1: Extending v1 `getPortfolioSummary`

**What goes wrong:** Spec L0–L5 KPIs mixed with inline RAG; later split required.  
**Why it happens:** `/api/portfolio` already returns `kpi` object.  
**How to avoid:** Parallel `/api/dashboards/*` only [D-01]; static test that `spec-dashboards.service` does not import `portfolio.service`.  
**Warning signs:** Any edit to `lib/services/portfolio.service.ts` in Phase 16 plans.

### Pitfall 2: PM dashboard calling `getPeriodTracking`

**What goes wrong:** PM users 403 on entire PM dashboard weekly section.  
**Why it happens:** Tracking helper looks convenient.  
**How to avoid:** Direct `listPeriodShellsRepo` + period resolver [D-10].  
**Warning signs:** Import of `weekly-tracking.service` from PM code path.

### Pitfall 3: Using snapshot RAG for portfolio KPI tiles

**What goes wrong:** KPI disagrees with project master after PM submits weekly report.  
**Why it happens:** `listPeriodShellsRepo` joins `wv.rag` [VERIFIED: lib/repositories/weekly-reports.repo.ts:420].  
**How to avoid:** KPI/charts read `projects.rag` via `listProjects` rows [D-16].  
**Warning signs:** Dashboard KPI query joins `weekly_report_versions`.

### Pitfall 4: RAID tile as distinct project count

**What goes wrong:** Tile shows project count but drill-down shows records — mismatch with PDSH-03.  
**Why it happens:** Confusion with overdue-milestone **project** count.  
**How to avoid:** High RAID tile = `listHighOpenRaid().records.length` filtered [D-05]; drill-down = same records.  
**Warning signs:** `new Set(records.map(r => r.project_id)).size` used for RAID tile.

### Pitfall 5: Missing rag breaks PDSH-02 invariant

**What goes wrong:** Green + Amber + Red ≠ active count.  
**Why it happens:** Null rag excluded from all buckets.  
**How to avoid:** Map null/invalid → amber bucket [D-03].  
**Warning signs:** Unit test active count ≠ sum of RAG buckets.

### Pitfall 6: `unit` filter 400 when column absent

**What goes wrong:** Clients sending `unit` get errors despite spec allowing the dimension.  
**Why it happens:** Strict schema without column backing.  
**How to avoid:** Accept key in schema but no-op filter when no column [D-06].  
**Warning signs:** SQL references `p.unit` (column does not exist).

### Pitfall 7: Seed admin expects portfolio access

**What goes wrong:** False regression on 403 tests.  
**Why it happens:** Admin has `is_admin=1` but null `company_id` and no cpmo role.  
**How to avoid:** Route tests use cpmo session with `company_id: 5`, not seed admin [VERIFIED: lib/db.ts:562-564].  
**Warning signs:** Test session `{ is_admin: 1, company_id: null }` expects 200 on portfolio dashboard.

## Code Examples

### Portfolio GET orchestration (single pass)

```typescript
// spec-dashboards.service.ts — D-01, D-07
export async function getPortfolioDashboard(actor: AccessActor) {
  assertCompanyWrite(actor);
  const companyId = actor.company_id!;

  const filters = await getDashboardFilters(actor.user_id, 'portfolio');
  const allProjects = await listProjects(companyId);
  const filtered = applyDashboardFilters(allProjects, filters);

  const overdueMilestones = await listOverdueMilestones(companyId);
  const highRaid = await listHighOpenRaid(companyId);
  const techCouncil = await listTechnologyCouncilIssues(companyId);

  const filteredIds = new Set(filtered.map((p) => p.id));

  return {
    filters,
    kpis: computePortfolioKpis(filtered),
    charts: computePortfolioCharts(filtered),
    list: filtered,
    drilldowns: {
      overdue_milestones: overdueMilestones.filter((m) => filteredIds.has(m.project_id)),
      high_raid: highRaid.records.filter((r) => filteredIds.has(r.project_id)),
      technology_council: techCouncil.filter((i) => filteredIds.has(i.project_id)),
    },
  };
}
```

### PM dashboard weekly actions

```typescript
// D-10 — no getPeriodTracking
export async function getPmDashboard(actor: AccessActor) {
  if (actor.company_id === null) throw new ForbiddenError();
  if (!hasRole(actor, 'pm') && !hasRole(actor, 'cpmo')) throw new ForbiddenError();

  const projects = await listProjects(actor.company_id, { pmUserId: actor.user_id });
  const assignedIds = new Set(projects.map((p) => p.id));

  const periods = await listWeeklyPeriods(actor.company_id);
  const period = resolveCurrentPeriod(periods, new Date().toISOString().slice(0, 10));
  const shells = period
    ? (await listPeriodShellsRepo(actor.company_id, period.id)).filter((s) =>
        assignedIds.has(s.project_id),
      )
    : [];

  const now = new Date();
  const weeklyActions = shells
    .filter((s) => s.status === 'not_submitted' || s.status === 'draft')
    .map((s) => ({
      project_id: s.project_id,
      report_id: s.report_id,
      period_id: period?.id,
      status: s.status,
      overdue: isWeeklyReportOverdue(s.status, s.due_at, now),
      href: `/projects/${s.project_id}/documents`, // or `/projects/${s.project_id}/weekly-reports/${s.report_id}` — planner locks
    }));

  // milestones + raid: filter Phase 12 lists to assignedIds ...
}
```

### Filter state upsert

```typescript
// D-07 — upsert in place, no DELETE
export async function saveDashboardFilters(
  userId: number,
  surface: 'portfolio' | 'pm',
  filters: Record<string, unknown>,
) {
  await upsertDashboardFilterState({ user_id: userId, surface, filters_json: filters });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1 portfolio home (inline RAG, `current_phase`) | Spec dashboard (live `stage`/`rag`, L0–L5) | Phase 16 (new parallel surface) | v1 `/api/portfolio` unchanged |
| No session filter persistence | `dashboard_filter_state` per user+surface | Phase 16 (new) | Drill-down inherits filters |
| CPMO-only period tracking | PM weekly actions via shells repo | Phase 16 (new) | PM must not use tracking API |
| No portfolio export | xlsx + pdf from filtered dashboard | Phase 16 (new) | `auditLog('dashboard_export')` |

**Deprecated/outdated for this phase:**

- Extending `getPortfolioSummary` or `GET /api/portfolio` for PDSH KPIs.
- Using `getPeriodTracking` for PM action queues.
- Using weekly snapshot RAG for live portfolio KPIs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `type` filter maps to `projects.classification` (no `type` column) | Filter map | Wrong rows if spec intended a different column |
| A2 | `unit` filter is accepted but no-op (no column on `projects`) | Filter map | Unit filtering unavailable until a column is added |
| A3 | PM weekly deep-link href uses `/projects/{id}/documents` or nested weekly-reports path — no dedicated UI page exists yet | PM actions | href may need adjustment when UI page lands |
| A4 | Server-side `jspdf` PDF layout is sufficient for PDSH-06 (no html-to-image server pipeline) | Export | PDF may be simpler than client portfolio report PDF |
| A5 | `listWeeklyPeriods` + date containment resolves "current period" per D-10 | PM weekly | Edge case if no periods exist → empty weekly actions |

## Open Questions (for planner)

1. **PM weekly href exact string** — `/projects/{id}/documents` vs `/projects/{id}/weekly-reports/{reportId}`?
   - What we know: Phase 13 API is `/api/projects/[id]/weekly-reports/[reportId]`; no dedicated UI page in `app/projects/**`.
   - Recommendation: JSON `href: /projects/{projectId}/weekly-reports/{reportId}` for API-aligned future UI; document in PLAN.

2. **Overdue-milestone drill-down shape** — per milestone vs per project?
   - Recommendation: Per overdue milestone rows + separate `overdue_milestone_project_count` KPI [Claude's discretion].

3. **Export PDF content density** — full drill-down tables vs summary-only?
   - Recommendation: KPI summary + filtered project list + sheet/section per drill-down type (mirror xlsx structure).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next | ✓ | (runtime) | — |
| vitest | D-13 test gate | ✓ | 4.1.10 [VERIFIED: package.json:49] | — |
| PostgreSQL (`TEST_DATABASE_URL`) | Repo integration tests | optional | — | `describe.skipIf(!hasTestDb)` [ASSUMED: Phase 13–15 harness] |
| exceljs / jspdf | Export | ✓ | ^4.4.0 / ^2.5.1 | — |
| zod / pg | Validation + DB | ✓ | see package.json | — |

**Missing dependencies with no fallback:** none for unit-test gate.

**Missing dependencies with fallback:** Live Postgres optional for filter-state repo tests (skip pattern).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 [VERIFIED: package.json:49] |
| Config file | vitest.config.ts [VERIFIED: vitest.config.ts:6-31] |
| Quick run command | `npx vitest run lib/dashboards/kpi.unit.test.ts lib/services/spec-dashboards.service.unit.test.ts` |
| Full suite command | `npm test` |

Note: Vitest 4 ignores `-x`; do not put it in plan `<automated>` commands.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDSH-01 | Active/on-track/watch counts from live master | unit | `npx vitest run lib/dashboards/kpi.unit.test.ts` | ❌ Wave 0 |
| PDSH-02 | Stage/RAG charts; RAG sum = active | unit | same | ❌ Wave 0 |
| PDSH-03 | Overdue project count + RAID record count + drill-downs | unit + service | `npx vitest run lib/services/spec-dashboards.service.unit.test.ts` | ❌ Wave 0 |
| PDSH-04 | Tech-council count + drill-down | service unit | same | ❌ Wave 0 |
| PDSH-05 | AND filters; persist; drill-down inherits | unit + repo + route | filters unit + route tests | ❌ Wave 0 |
| PDSH-06 | Clear/defaults/export xlsx+pdf + auditLog | route + export unit | export route.test.ts | ❌ Wave 0 |
| MDSH-01 | PM assignment-scoped project list | service + route | pm route.test.ts | ❌ Wave 0 |
| MDSH-02 | Weekly actions without getPeriodTracking | service unit | spec-dashboards.service.unit.test.ts | ❌ Wave 0 |
| MDSH-03 | Milestone actions upcoming+overdue | service unit | same | ❌ Wave 0 |
| MDSH-04 | High RAID upcoming/overdue + council flag | service unit | same | ❌ Wave 0 |
| MDSH-05 | href on actions; live GET omits resolved | service unit | same | ❌ Wave 0 |
| D-01 | No import of portfolio.service / getPortfolioSummary | static | unit import guard | ❌ Wave 0 |
| D-07 | DDL after migrateFiscalBudget | unit | `npx vitest run lib/db-dashboards.ddl.unit.test.ts` | ❌ Wave 0 |
| D-12 | CPMO 200 / viewer+PM 403 portfolio; PM 403 viewer | route | portfolio + pm route.test.ts | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** focused vitest file from task verify block
- **Per wave merge:** `npx vitest run lib/dashboards lib/services/spec-dashboards.service.unit.test.ts lib/db-dashboards.ddl.unit.test.ts lib/export/dashboard-portfolio.unit.test.ts app/api/dashboards`
- **Phase gate:** `npm test` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `lib/db-dashboards.ts` + `.ddl.unit.test.ts`
- [ ] `lib/dashboards/filters.ts`, `kpi.ts`, `rag.ts`, `period-resolver.ts` + unit tests
- [ ] `lib/repositories/dashboard-filter-state.repo.ts` + `.repo.test.ts`
- [ ] `lib/services/spec-dashboards.service.ts` + `.unit.test.ts`
- [ ] `lib/export/dashboard-portfolio.ts` + `.unit.test.ts`
- [ ] `app/api/dashboards/portfolio/route.ts` + `filters/route.ts` + `export/route.ts` + route tests
- [ ] `app/api/dashboards/pm/route.ts` + route.test.ts
- [ ] Extend `lib/db.ts` `getDb()` to call `migrateDashboards` after `migrateFiscalBudget`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Session via `withAuth` / `getSessionFromRequest` |
| V3 Session Management | no | Filter state in DB not session cookie — out of scope |
| V4 Access Control | yes | `withCpmo` + `assertCompanyWrite` (portfolio); pm/cpmo + company_id (PM); viewer 403 [D-12] |
| V5 Input Validation | yes | Zod filter schemas; unknown filter keys 400 [D-06] |
| V6 Cryptography | no | No secrets in this phase |

### Known Threat Patterns for stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Viewer/PM accessing CPMO portfolio KPIs | Elevation of privilege | `withCpmo` + `assertCompanyWrite` on portfolio routes [D-12] |
| PM seeing unassigned projects | Information disclosure | `listProjects(..., { pmUserId })` [D-09] |
| Cross-company filter/state read | Information disclosure | Filter repo scoped by `user_id`; company scope on list helpers |
| Null-company admin portfolio access | Elevation of privilege | `assertCompanyWrite` rejects null `company_id` [VERIFIED: lib/services/access.ts:128] |
| Export audit bypass | Repudiation | `auditLog` on export [D-08] |
| IDOR via filter user_id | Tampering | Filter writes always use `actor.user_id` from session |

## Sources

### Primary (HIGH confidence)

- Codebase via codegraph: `lib/services/portfolio.service.ts`, `app/api/portfolio/route.ts`, `lib/services/weekly-tracking.service.ts`, `lib/services/raid-masters.service.ts`, `lib/repositories/projects.repo.ts`, `lib/repositories/weekly-reports.repo.ts`, `lib/repositories/risks.repo.ts`, `lib/repositories/issues.repo.ts`, `lib/services/access.ts`, `lib/http/with-role.ts`, `lib/db-fiscal-budget.ts`, `lib/db.ts`, `lib/export/consolidated-weekly.ts`, `lib/services/weekly-reports.service.ts`
- `.planning/phases/16-portfolio-pm-dashboards/16-CONTEXT.md` — D-01..D-16 locked
- Package legitimacy seam: `exceljs`, `jspdf` → OK

### Secondary (MEDIUM confidence)

- `.planning/phases/14-cpmo-tracking-consolidated-export/14-RESEARCH.md` — parallel surface, route test analog
- `.planning/phases/15-budget-value-roi-dependencies/15-RESEARCH.md` — DDL-after-fiscal pattern
- `.planning/phases/13-weekly-periods-pm-submit/13-PATTERNS.md` — weekly-report API paths

### Tertiary (LOW confidence)

- Exact PM weekly `href` string — no dedicated UI page verified
- Server-side jspdf layout fidelity vs client portfolio report PDF

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; exceljs/jspdf verified installed; auth wrappers traced
- Architecture: HIGH — v1 portfolio and getPeriodTracking landmines confirmed in source; filter column map verified against PROJECT_COLUMNS
- Pitfalls: HIGH — RAG source, RAID count semantics, and admin 403 behavior documented with line citations

**Research date:** 2026-08-26  
**Valid until:** 2026-09-26 (stable stack; href strings may be locked during planning)
