# Phase 14: CPMO Tracking & Consolidated Export - Research

**Researched:** 2026-08-26
**Domain:** CPMO period submission tracking (counts + filterable grid) and consolidated Excel/Word/PPT export from immutable weekly-report version snapshots — parallel product surface (not v1 activity export)
**Confidence:** HIGH

## Summary

Phase 14 consumes Phase 13's `weekly_periods`, `weekly_reports`, and `weekly_report_versions` pipeline. CPMO gets a company-scoped tracking API for one period (obligation counts, per-project rows with computed overdue, filterable by status/lateness/PM/stage/RAG/live tech-council flag) and a three-step export flow: tick-select → POST preview (ordered section summaries from latest submitted snapshots) → POST export (xlsx primary + docx + pptx). All pack content comes from `getLatestVersionSnapshot(report_id, latest_version)` — never live RAID, never `getWeeklyProjectReport`, never `/api/export/weekly-report/[id]`.

Phase 13 already ships `listPeriodShells`, `listPeriodShellsRepo`, `getWeeklyPeriodByCompany`, `getLatestVersionSnapshot`, `isWeeklyReportOverdue`, and `withCpmo` + `assertCompanyWrite` gates. Phase 14 extends the shell query (project identity, active primary PM display name, live tech-council filter flag), adds `getPeriodTracking` (counts + filtered rows — exportable for Phase 16), new routes under `/api/weekly-periods/[periodId]/tracking` and `/export`, snapshot-driven generators in `lib/export/` (new payload functions — existing `generateProjectPlan` / `generateWordDoc` / `generateKickoffPPT` all fetch live project data by `projectId`), and append-only `weekly_export_logs` plus `auditLog` action `weekly_export`.

**Primary recommendation:** Add `lib/services/weekly-tracking.service.ts` (or extend weekly-reports service with tracking/export orchestration), extend `listPeriodShellsRepo` with company-scoped join + project/PM columns, add `lib/export/consolidated-weekly.ts` with pure snapshot payload generators, wire `weekly_export_logs` DDL via a new settings flag after `migrateWeeklyReports`, and gate with Vitest 4 service + route tests (`workflow.ui_phase: false`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Decision IDs D-01..D-14.

### Consume Phase 13 snapshots (not live RAID)

- **D-01:** Tracking and export read `weekly_periods` + `weekly_reports` + latest `weekly_report_versions.snapshot`. Do **not** pull live `risks`/`issues` into the exported RAID section. Do **not** reuse `getWeeklyProjectReport` or `documents` `status_report`. — **Reversibility:** costly — mixing live RAID into the pack would break RAID-02 / CPMO-04.
- **D-02:** Technology-council **filter** (CPMO-02) may join **live** `issues.technology_council` via existing `listTechnologyCouncilIssues` to decide which project_ids match. Exported "technology issues" come from `snapshot.raid.issues` where `technology_council` is true (or a snapshot field if present). If the snapshot has no tech-council flag, export the issues array as stored and leave the section empty when none qualify — do not substitute live rows.

### Tracking API (CPMO-01, CPMO-02)

- **D-03:** `GET /api/weekly-periods/[periodId]/tracking` — `withCpmo` + `assertCompanyWrite` + `actor.company_id` must own the period (reuse `getWeeklyPeriodByCompany`). Response: `{ period, counts, rows }`. Build rows by extending `listPeriodShells` with project identity (`name`, `project_code`, `stage`, `rag` live is **not** the grid RAG — grid RAG is latest version `wv.rag` / snapshot `this_week_rag`), active primary PM (`project_pm_assignments`), and `has_technology_council_issues` (live filter flag).
- **D-04:** Counts (CPMO-01): `obligated` = shell count; `not_submitted` / `draft` / `submitted` from stored status; `overdue` = computed (`isWeeklyReportOverdue`); `late` = `first_lateness = 'late'` (submitted late, including corrections that were first-late). Overdue is never a stored status.
- **D-05:** Filters are query params on the same GET: `status`, `lateness` (`on_time`|`late`), `pm_user_id`, `stage`, `rag`, `technology_council` (`true`). Period is the path id. Filtering is server-side. `status=overdue` means computed overdue. Opening a report is the row's `project_id` + `report_id` (no new "open" route).

### Preview, reorder, export (CPMO-03, CPMO-04)

- **D-06:** `POST /api/weekly-periods/[periodId]/export/preview` — body `{ project_ids: number[] }` in caller order. Only **submitted** shells (`status = submitted`, `latest_version >= 1`) are eligible; others → 400 `{ error, fields }` naming ineligible ids. Preview returns ordered section summaries from each latest snapshot (identity, PM, stage, prev/current RAG, progress, highlights, next-week goals, nearest milestone, RAID counts, tech-issue counts). Reorder = array order; no persisted order table.
- **D-07:** `POST /api/weekly-periods/[periodId]/export` — body `{ project_ids: number[], format: 'xlsx' | 'docx' | 'pptx' }`. Generate an editable pack via existing Excel/Word/PPT libraries (`lib/export/*`). Do **not** call `/api/export/weekly-report/[id]`. Default/primary format is **xlsx** (one workbook: summary sheet + one sheet per project). Word/PPT must still be implemented (CPMO-03 "as already supported") using the same snapshot payload.
- **D-08:** Each project section includes: identity (code, name), PM (active primary display name), stage, prior RAG (`prev_week_rag` from snapshot), current RAG (`this_week_rag` / version.rag), progress (`snapshot.progress_pct`), highlights, next-week goals, nearest milestone (snapshot.milestones / nearest_milestone), RAID (`snapshot.raid`), technology issues (subset of snapshot issues). Missing snapshot fields render blank — do not backfill from live masters.
- **D-09:** Persist an export record: table `weekly_export_logs` (`period_id`, `company_id`, `exported_by`, `exported_at`, `format`, `data_version` = max `latest_version` among included reports, `project_ids` JSON, `period_display_name`). Incremental `auditLog` action `weekly_export`. Never physical DELETE logs or weekly/RAID/milestone rows.
- **D-10:** Schema helper: add `weekly_export_logs` in `lib/db-weekly-reports.ts` (same settings-flag pattern) or a sibling `lib/db-weekly-export.ts` invoked from `getDb()` **after** `migrateWeeklyReports`. No Prisma.

### Authz, UI, testing

- **D-11:** Tracking, preview, and export are CPMO-only (`withCpmo` + `assertCompanyWrite`). PM/Viewer → 403. Do not invent CASL. Do not re-gate D-23 leftover ops/admin routes.
- **D-12:** `workflow.ui_phase` is false. A thin tracking page may exist so CPMO can operate; **server tests are the gate**. Do not redesign portfolio/v1 report pages.
- **D-13:** Extend `listPeriodShells` / repo join rather than inventing a second shell query that drops company scope. Repo-level `listPeriodShellsRepo` should join `weekly_periods.company_id` (defense-in-depth from 13-REVIEW IN-02) when touched.
- **D-14:** Ineligible export (draft/not_submitted, foreign period, empty `project_ids`) is 400/404/409 via existing error types. Concurrent export is allowed (append-only log).

### Claude's Discretion

- Exact workbook/sheet names, Word/PPT section layout, and whether preview is GET-with-body vs POST — planner locks those. Prefer POST preview + POST export. Filter `technology_council=true` means "project currently has at least one open/in-progress tech-council issue" (live), matching CPMO's operational filter.

### Deferred Ideas (OUT OF SCOPE)

- Portfolio / PM dashboards — Phase 16 (may call `getPeriodTracking`)
- Budget, value, ROI, bidirectional deps — Phase 15
- Document templates & Confluence checklist — Phase 17
- Full append-only audit coverage — Phase 18
- Backfilling tech-council flags onto already-submitted snapshots that lack the field
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CPMO-01 | CPMO sees obligated-project counts and Not submitted / Draft / Submitted / Overdue / Late for a period | `getPeriodTracking` aggregates shells via extended `listPeriodShellsRepo`; counts use stored status + `isWeeklyReportOverdue` + `first_lateness = 'late'` [D-04]; `GET .../tracking` with `withCpmo` [D-03] |
| CPMO-02 | CPMO filters tracking grid by period, status, lateness, PM, stage, RAG, tech-council issues; open report via row ids | Server-side query params on tracking GET [D-05]; grid RAG from `wv.rag` not live `projects.rag` [D-03]; live `listTechnologyCouncilIssues(company_id)` for filter flag only [D-02]; row carries `project_id` + `report_id` |
| CPMO-03 | Tick-select, preview consolidation, reorder, export editable pack (xlsx/docx/pptx) | POST preview + POST export [D-06, D-07]; order = `project_ids` array; new snapshot payload generators in `lib/export/` — do not extend v1 weekly-report route |
| CPMO-04 | Export records period, data version, exporter; sections from snapshot fields | `weekly_export_logs` + `auditLog('weekly_export')` [D-09]; `data_version = max(latest_version)`; section fields from verified snapshot shape [D-08] |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Period tracking counts + grid | API / Backend (`getPeriodTracking` service) | Database (join shells, periods, projects, versions, PM assignments) | CPMO-only; company scope via `getWeeklyPeriodByCompany` [VERIFIED: lib/repositories/weekly-reports.repo.ts:385-394] |
| Tech-council filter flag | API / Backend (tracking service) | Database (live `issues` via `listTechnologyCouncilIssues`) | Filter uses live open/in-progress council issues [D-02]; export uses snapshot subset only |
| Snapshot read for preview/export | API / Backend (export orchestration) | Database (`weekly_report_versions.snapshot`) | Immutable submitted data [D-01]; `getLatestVersionSnapshot(reportId, version)` [VERIFIED: lib/repositories/weekly-reports.repo.ts:343-354] |
| Consolidated pack generation | API / Backend (new export functions) | — (in-memory Buffer) | Existing `lib/export/*` fetch live project data by id — unsuitable [VERIFIED: lib/export/excel.ts:106-120, lib/export/word.ts:76-88, lib/export/ppt.ts:90-111] |
| Export audit trail | API / Backend (`auditLog`) | Database (`weekly_export_logs`, `audit_logs`) | Append-only [D-09]; reuse `auditLog` [VERIFIED: lib/services/audit.service.ts:5-8] |
| Authz | API / Backend (`withCpmo`, `assertCompanyWrite`) | — | Same gate as period create [VERIFIED: lib/http/with-role.ts:26-34, lib/services/access.ts:126-128] |
| Schema DDL | Database (migrate on boot) | — | New flag after `migrateWeeklyReports` in `getDb()` [VERIFIED: lib/db.ts:631-632] |
| Phase 16 dashboard reuse | API / Backend (exported `getPeriodTracking`) | — | D-03 notes export helper for dashboards |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | ^8.20.0 [VERIFIED: package.json:26] | PostgreSQL pool | Existing `getDb()` client |
| `zod` | ^4.4.3 [VERIFIED: package.json:35] | Route body/query validation | Matches `app/api/weekly-periods/schema.ts` pattern |
| `exceljs` | ^4.4.0 [VERIFIED: package.json:20] | Consolidated xlsx pack | Already used by v1 export and `lib/export/excel.ts` |
| `docx` | ^9.6.1 [VERIFIED: package.json:19] | Consolidated docx pack | Already used by `lib/export/word.ts` |
| `pptxgenjs` | ^4.0.1 [VERIFIED: package.json:27] | Consolidated pptx pack | Already used by `lib/export/ppt.ts` |
| `vitest` | 4.1.10 [VERIFIED: package.json:49] | Service + route tests | Phase gate (D-12); TDD enabled |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `withCpmo` | — | CPMO route wrapper | All tracking/export routes [VERIFIED: lib/http/with-role.ts:26-34] |
| Existing `isWeeklyReportOverdue` | — | Computed overdue | Counts + `status=overdue` filter [VERIFIED: lib/services/weekly-reports.service.ts:242-250] |
| Existing `listTechnologyCouncilIssues` | — | Live tech-council project set | Tracking filter only [VERIFIED: lib/repositories/issues.repo.ts:154-172] |
| Existing `getActivePrimaryAssignment` | — | PM user_id per project | Join to `users.display_name` for grid/export [VERIFIED: lib/repositories/pm-assignments.repo.ts:47-55] |
| Existing error types | — | 400/403/404/409 | `ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError` [VERIFIED: lib/services/errors.ts:11-44] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New snapshot export generators | Reuse `/api/export/weekly-report/[id]` | **Rejected** — v1 pulls activity-weighted live `ReportData` [VERIFIED: app/api/export/weekly-report/[id]/route.ts:7-15, 52-57] |
| Live RAID in pack | Refresh snapshot at export time | **Rejected** — breaks RAID-02 / CPMO-04 immutability [D-01] |
| Persist export project order | Caller `project_ids` order only | **Rejected** — D-06 locked no rank table |
| Prisma migration | Settings-flag DDL helper | **Rejected** — project convention [D-10] |

**Installation:** No new packages. Use existing dependencies only.

**Version verification:** All export libraries already in `package.json`; no new installs.

## Package Legitimacy Audit

> Phase 14 installs **no new external packages**.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| — | — | — | N/A — no new installs |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart TD
  CPMO[CPMO client] -->|GET tracking + filters| TR[withCpmo tracking route]
  CPMO -->|POST preview/export| EX[withCpmo export routes]

  TR --> ACW[assertCompanyWrite]
  EX --> ACW

  TR --> GT[getPeriodTracking service]
  EX --> PE[previewConsolidatedExport]
  EX --> GE[generateConsolidatedExport]

  GT --> GPBC[getWeeklyPeriodByCompany]
  GT --> LPS[listPeriodShellsRepo extended]
  GT --> LTC[listTechnologyCouncilIssues live filter]
  GT --> PM[active primary PM lookup]

  PE --> GLVS[getLatestVersionSnapshot per report]
  GE --> GLVS
  GE --> GEN[lib/export/consolidated-weekly.ts]
  GE --> LOG[insert weekly_export_logs + auditLog]

  LPS --> DB[(weekly_reports + weekly_periods + projects + wv)]
  GLVS --> DB
  LOG --> DB

  V1[/api/export/weekly-report/id] -.->|DO NOT CALL| X[landmine]
  GPR[getWeeklyProjectReport] -.->|DO NOT CALL| X
```

### Recommended Project Structure

```
lib/
├── db-weekly-reports.ts          # extend: WEEKLY_EXPORT_LOGS_DDL + migrateWeeklyExportLogs
├── services/
│   └── weekly-tracking.service.ts   # getPeriodTracking, preview, export orchestration
├── repositories/
│   ├── weekly-reports.repo.ts       # extend listPeriodShellsRepo; insertExportLog
│   └── weekly-export.repo.ts        # optional: export log insert/list
├── export/
│   └── consolidated-weekly.ts       # generateConsolidatedXlsx/Docx/Pptx(snapshot payload)
app/api/weekly-periods/
└── [periodId]/
    ├── tracking/route.ts
    └── export/
        ├── preview/route.ts
        └── route.ts
```

### Pattern 1: Extend shell repo with company defense-in-depth

**What:** When touching `listPeriodShellsRepo`, add `weekly_periods.company_id` to the WHERE clause and join `projects` for identity columns.

**When to use:** Every tracking row query (D-13).

**Example:**

```typescript
// Extend listPeriodShellsRepo(companyId, periodId) — add company_id predicate
`SELECT wr.project_id, wr.status, wr.first_submitted_at, wr.first_lateness,
        wr.latest_version, wr.id AS report_id, wp.due_at, wv.rag,
        p.name, p.project_code, p.stage
 FROM weekly_reports wr
 JOIN weekly_periods wp ON wp.id = wr.period_id
 JOIN projects p ON p.id = wr.project_id
 LEFT JOIN weekly_report_versions wv
   ON wv.report_id = wr.id AND wv.version = wr.latest_version
 WHERE wr.period_id = ? AND wp.company_id = ?`
```

### Pattern 2: Snapshot payload export (not project-id export)

**What:** New generators accept a typed `ConsolidatedWeeklyPayload` built from snapshots — no `assertProjectAccess(projectId)` or live repo fetches inside the generator.

**When to use:** Preview response shaping and all three export formats (D-07, D-08).

**Why existing libs cannot be reused as-is:**

| Function | Signature | Data source |
|----------|-----------|-------------|
| `generateProjectPlan` | `(projectId, actor)` | Live activities/team/risks [VERIFIED: lib/export/excel.ts:106-120] |
| `generateWordDoc` | `(projectId, actor, docType, docId?)` | Live project + documents [VERIFIED: lib/export/word.ts:76-88] |
| `generateKickoffPPT` | `(projectId, actor, extras?)` | Live team/meetings/risks [VERIFIED: lib/export/ppt.ts:90-111] |
| v1 weekly POST | `{ reportData: ReportData }` | Activity-weighted client payload [VERIFIED: app/api/export/weekly-report/[id]/route.ts:7-15] |

Reuse **styling helpers** (colors, header rows) from existing export modules where practical; do not call the project-scoped entry points.

### Pattern 3: Settings-flag DDL for `weekly_export_logs`

**What:** Mirror Phase 13 `migrateWeeklyReports` — separate flag, idempotent CREATE TABLE, invoked after weekly reports migrate.

**When to use:** D-10 schema addition.

**Example:**

```typescript
export const WEEKLY_EXPORT_LOGS_DDL_FLAG = 'weekly_export_logs_ddl_v1';
export const WEEKLY_EXPORT_LOGS_DDL = [`
  CREATE TABLE IF NOT EXISTS weekly_export_logs (
    id SERIAL PRIMARY KEY,
    period_id INTEGER NOT NULL REFERENCES weekly_periods(id),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    exported_by INTEGER REFERENCES users(id),
    exported_at TIMESTAMPTZ DEFAULT now(),
    format TEXT NOT NULL,
    data_version INTEGER NOT NULL,
    project_ids JSONB NOT NULL,
    period_display_name TEXT NOT NULL
  )
`];

export async function migrateWeeklyExportLogs(pool: Pool): Promise<void> {
  // settingsFlagExists → query DDL → writeSettingsFlag (same as migrateWeeklyReportsDdl)
}

// In migrateWeeklyReports tail OR getDb() immediately after migrateWeeklyReports(pool):
await migrateWeeklyExportLogs(pool);
```

Prefer extending `lib/db-weekly-reports.ts` and exporting new constants for DDL unit tests (matches Phase 13 `lib/db-weekly-reports.ddl.unit.test.ts` pattern).

### Pattern 4: Verified snapshot JSON shape (from submit)

**What:** Export/preview map fields from the immutable snapshot written at submit.

**Verbatim top-level keys from `submitWeeklyReport`:**

```typescript
// buildSnapshotFromShell output + submit additions [VERIFIED: lib/services/weekly-reports.service.ts:77-100, 455-460]
{
  highlights, completed_work, next_week_goals,
  nearest_milestone: { text, milestone_id },
  raid_dependency, leadership_support,
  this_week_rag, prev_week_rag,
  progress_pct,   // number copied from projects.progress_pct at submit
  raid: { risks: [...master rows], issues: [...master rows] },
  milestones: [{ id, name, plan_end, adjusted_end, status, end_date }]
}
```

Grid RAG for tracking uses `wv.rag` from latest version join (equivalent to snapshot `this_week_rag` when submitted) [VERIFIED: lib/repositories/weekly-reports.repo.ts:400-406]. Tech issues in export: filter `snapshot.raid.issues` where `technology_council === true` (full issue row copied at submit includes column from master [VERIFIED: lib/repositories/issues.repo.ts:8-11]).

### Pattern 5: Tracking route auth (mirror period routes)

**What:** `withCpmo` handler → service calls `assertCompanyWrite(actor)` → `getWeeklyPeriodByCompany(actor.company_id, periodId)`.

**Example:**

```typescript
// Source: app/api/weekly-periods/route.ts + lib/services/weekly-reports.service.ts:555-575
export const GET = withCpmo(async (req, { actor, params }) => {
  const periodId = Number(params.periodId);
  const filters = parseTrackingQuery(req.nextUrl.searchParams);
  return NextResponse.json(
    await getPeriodTracking(actor.company_id!, periodId, actor, filters),
  );
});
```

### Anti-Patterns to Avoid

- **Calling `/api/export/weekly-report/[id]` or `getWeeklyProjectReport`:** Activity-weighted v1 surface; violates D-01.
- **Using live `projects.rag` for grid RAG column:** D-03 requires version/snapshot RAG.
- **Using live RAID rows in export sections:** D-01/D-08; filter-only exception for tech-council flag.
- **Repo query by `period_id` alone without `company_id`:** D-13 defense-in-depth gap.
- **Physical DELETE on export logs:** D-09 append-only contract.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overdue computation | Custom date logic in routes | `isWeeklyReportOverdue(status, due_at, now)` | Single exported helper already tested [VERIFIED: lib/services/weekly-reports.service.ts:242-250] |
| Tech-council company filter | Ad-hoc issues SQL in route | `listTechnologyCouncilIssues(companyId)` | Existing company-scoped query [VERIFIED: lib/repositories/issues.repo.ts:154-172] |
| CPMO auth | CASL policies | `withCpmo` + `assertCompanyWrite` | Locked D-11; matches period routes |
| xlsx/docx/pptx binary format | Custom XML | exceljs / docx / pptxgenjs | Already installed and styled |
| Export audit | Custom log table without audit_logs | `weekly_export_logs` + `auditLog` | D-09 dual record |
| PM assignment window | Read `projects.pm_name` only | `getActivePrimaryAssignment` → `users.display_name` | Assignment windows are source of truth (Phase 11); denormalized `pm_name` can lag |

**Key insight:** The hard part is orchestration and snapshot mapping — not document formats or auth. Reuse Phase 13 seams; add pure payload exporters.

## Common Pitfalls

### Pitfall 1: Reusing v1 weekly Excel export

**What goes wrong:** Pack shows activity completion tables from live timeline, not PM narrative snapshots.  
**Why it happens:** `/api/export/weekly-report/[id]` accepts client-built `ReportData` with `doneThisWeek` / `inProgress` activities [VERIFIED: app/api/export/weekly-report/[id]/route.ts:7-15].  
**How to avoid:** New `lib/export/consolidated-weekly.ts` only; leave v1 route untouched.  
**Warning signs:** Import from `app/api/export/weekly-report` or `getWeeklyProjectReport` in new service.

### Pitfall 2: Live RAID bleed into export

**What goes wrong:** Export reflects current master register, not what PM submitted.  
**Why it happens:** Temptation to call `listRisks` / `listIssues` inside generator (existing export pattern).  
**How to avoid:** Build payload exclusively from `getLatestVersionSnapshot`; blank missing fields.  
**Warning signs:** `listOpenIssues` or `listRisks` imports in consolidated export module.

### Pitfall 3: Grid RAG from `projects.rag`

**What goes wrong:** Tracking shows current portfolio RAG, not submitted week RAG.  
**Why it happens:** `projects.rag` updates on later submits (WKRP-03).  
**How to avoid:** Use `wv.rag` / snapshot `this_week_rag` for grid and export current RAG [D-03].  
**Warning signs:** `p.rag` in tracking SELECT.

### Pitfall 4: Export eligibility gaps

**What goes wrong:** Draft shells exported or 500 instead of structured 400.  
**Why it happens:** Checking `status` without `latest_version >= 1`.  
**How to avoid:** Validate all `project_ids` belong to period, company, and `status === 'submitted'` with version row; return `ValidationError` with `fields: ['project_ids']` listing ineligible ids [D-06, D-14].  
**Warning signs:** No validation before snapshot fetch.

### Pitfall 5: `listPeriodShellsRepo` IDOR

**What goes wrong:** Caller passes foreign company's period id — rows leak if only period_id filtered.  
**Why it happens:** Current repo filters `WHERE wr.period_id = ?` only [VERIFIED: lib/repositories/weekly-reports.repo.ts:397-409].  
**How to avoid:** Service already uses `getWeeklyPeriodByCompany`; repo adds `AND wp.company_id = ?` when extended [D-13].  
**Warning signs:** Repo function signature still `(periodId)` only after Phase 14.

### Pitfall 6: Admin seed user on CPMO routes

**What goes wrong:** Tests expect 200 for `admin` user on tracking routes.  
**Why it happens:** Seed admin has `company_id = null`; `assertCompanyWrite` throws [VERIFIED: lib/services/access.ts:126-128].  
**How to avoid:** Route tests use company-scoped CPMO actor (Phase 10 pattern).  
**Warning signs:** Test actor `{ is_admin: 1, company_id: null }` expecting success.

## Code Examples

### Count aggregation (CPMO-01)

```typescript
// Derived from D-04 + isWeeklyReportOverdue [VERIFIED: lib/services/weekly-reports.service.ts:242-250]
function buildTrackingCounts(rows: TrackingRow[], now: Date) {
  return {
    obligated: rows.length,
    not_submitted: rows.filter((r) => r.status === 'not_submitted').length,
    draft: rows.filter((r) => r.status === 'draft').length,
    submitted: rows.filter((r) => r.status === 'submitted').length,
    overdue: rows.filter((r) => r.overdue).length,
    late: rows.filter((r) => r.first_lateness === 'late').length,
  };
}
```

### Tech-council filter flag (live, filter only)

```typescript
// D-02: live issues for filter; snapshot for export
const councilIssues = await listTechnologyCouncilIssues(companyId);
const councilProjectIds = new Set(councilIssues.map((i) => i.project_id));
// row.has_technology_council_issues = councilProjectIds.has(row.project_id)
// filter technology_council=true → rows where has_technology_council_issues
```

### Export log + audit (CPMO-04)

```typescript
const dataVersion = Math.max(...included.map((r) => r.latest_version));
await insertWeeklyExportLog({
  periodId, companyId: actor.company_id!, exportedBy: actor.user_id,
  format, dataVersion, projectIds, periodDisplayName: period.display_name,
});
await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'weekly_export',
  entity_id: String(periodId),
  action: 'weekly_export',
  before: null,
  after: { format, data_version: dataVersion, project_ids: projectIds },
});
```

### Active primary PM display name

```typescript
// [VERIFIED: lib/repositories/pm-assignments.repo.ts:47-55, 179-196]
const primary = await getActivePrimaryAssignment(projectId);
const pmDisplayName = primary
  ? (await findUserById(primary.user_id))?.display_name ?? ''
  : '';
// Planner may add bulk repo: listActivePrimaryWithDisplayNames(projectIds[])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1 activity weekly export | Phase 13 versioned snapshots + Phase 14 consolidated export | Phase 13–14 | Parallel surfaces; v1 unchanged |
| `projects.pm_name` only | `project_pm_assignments` windows | Phase 11 | Tracking should use active primary + user display name |
| Single-project export generators | Payload-driven consolidated generators | Phase 14 (new) | Existing libs stay project-scoped |

**Deprecated/outdated for this phase:**

- Extending `/api/export/weekly-report/[id]` — landmine per D-07 and CONTEXT.
- Reading live RAID for pack content — superseded by snapshot contract (D-01).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bulk PM lookup needs new repo SQL (`listActivePrimaryDisplayNames(projectIds)`) — no bulk helper exists today | Architecture | N+1 queries if not batched |
| A2 | Snapshot issue rows include `technology_council` boolean from master copy at submit | Pattern 4 | Tech section empty for all exports if field stripped |
| A3 | `period.display_name` available from extended period fetch for export log | Export log | Extra join if tracking only loads `{ id, due_at }` today |
| A4 | Word/PPT consolidated layout is planner discretion — no GuiIT template in repo | Claude's Discretion | Visual review may iterate |

**If A2 wrong:** Export still legal per D-02 — tech section empty when snapshot lacks flag; no live backfill.

## Open Questions (RESOLVED)

1. **Bulk PM join vs per-project loop** — RESOLVED: `listPeriodShellsRepo` left-joins active primary `project_pm_assignments` + `users.display_name` for all obligated project_ids (same `effective_from` / `effective_to` window as `getActivePrimaryAssignment`). Locked in 14-01 interfaces.

2. **Extend `weekly-reports.service.ts` vs new `weekly-tracking.service.ts`** — RESOLVED: new `lib/services/weekly-tracking.service.ts`; export `getPeriodTracking` for Phase 16. Do not bloat Phase 13 `weekly-reports.service.ts` with tracking/export orchestration. Locked in 14-01.

3. **Sheet naming / Word heading hierarchy** — RESOLVED: xlsx summary sheet `Portfolio Summary`, per-project sheets sanitized `project_code` (Excel 31-char unique); Word Heading 1 = `period.display_name`, Heading 2 per project covering every D-08 field. Locked in 14-03 discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next | ✓ | (runtime) | — |
| vitest | D-12 test gate | ✓ | 4.1.10 [VERIFIED: package.json:49] | — |
| PostgreSQL (`TEST_DATABASE_URL`) | Repo integration tests | optional | — | `describe.skipIf(!hasTestDb)` [ASSUMED: test/db.ts pattern from Phase 13] |
| exceljs / docx / pptxgenjs | Export formats | ✓ | see package.json | — |

**Missing dependencies with no fallback:** none for unit-test gate.

**Missing dependencies with fallback:** Live Postgres optional for repo tests (skip pattern).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 [VERIFIED: package.json:49] |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run lib/services/weekly-tracking.service.unit.test.ts` |
| Full suite command | `npm test` |

Note: Vitest 4 ignores `-x`; do not put it in plan `<automated>` commands.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CPMO-01 | Counts: obligated, not_submitted, draft, submitted, overdue, late | unit | `npx vitest run lib/services/weekly-tracking.service.unit.test.ts` | ❌ Wave 0 |
| CPMO-02 | Filters: status, lateness, pm, stage, rag, tech_council; row has project_id + report_id | unit | same | ❌ Wave 0 |
| CPMO-02 | PM/Viewer 403 on tracking route | route | `npx vitest run app/api/weekly-periods/[periodId]/tracking/route.test.ts` | ❌ Wave 0 |
| CPMO-03 | Preview order = project_ids; ineligible → 400 fields | unit | weekly-tracking.service.unit.test.ts | ❌ Wave 0 |
| CPMO-03 | xlsx/docx/pptx return Buffer; no live repo in generator | unit | `npx vitest run lib/export/consolidated-weekly.unit.test.ts` | ❌ Wave 0 |
| CPMO-04 | Export log row + auditLog weekly_export | unit + repo | weekly-tracking.service + repo test | ❌ Wave 0 |
| CPMO-04 | Section fields from snapshot only | unit | consolidated-weekly.unit.test.ts | ❌ Wave 0 |
| D-13 | listPeriodShellsRepo filters company_id | repo | `npx vitest run lib/repositories/weekly-reports.repo.test.ts` | ✅ extend |
| D-10 | weekly_export_logs DDL flag | unit | `npx vitest run lib/db-weekly-reports.ddl.unit.test.ts` | ✅ extend |

### Sampling Rate

- **Per task commit:** focused vitest file from task verify block
- **Per wave merge:** `npx vitest run lib/services/weekly-tracking.service.unit.test.ts lib/export/consolidated-weekly.unit.test.ts lib/repositories/weekly-reports.repo.test.ts lib/db-weekly-reports.ddl.unit.test.ts`
- **Phase gate:** `npm test` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `lib/services/weekly-tracking.service.ts` + unit tests
- [ ] `lib/export/consolidated-weekly.ts` + unit tests
- [ ] Extend `listPeriodShellsRepo` + tests for company_id + project columns
- [ ] `weekly_export_logs` DDL + `lib/db-weekly-reports.ddl.unit.test.ts` assertions
- [ ] `app/api/weekly-periods/[periodId]/tracking/route.test.ts`
- [ ] `app/api/weekly-periods/[periodId]/export/preview/route.test.ts`
- [ ] `app/api/weekly-periods/[periodId]/export/route.test.ts`
- [ ] Bulk primary PM display repo helper (if not inlined in tracking repo query)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Session via `withAuth` upstream |
| V3 Session Management | no | Out of phase scope |
| V4 Access Control | yes | `withCpmo` + `assertCompanyWrite`; company-scoped period lookup |
| V5 Input Validation | yes | Zod schemas for export body; validate project_ids eligibility |
| V6 Cryptography | no | No secrets in this phase |

### Known Threat Patterns for stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-company period tracking/export | Elevation of privilege | `getWeeklyPeriodByCompany(companyId, periodId)` before rows; repo `company_id` join [D-13] |
| PM/Viewer access to CPMO export | Elevation of privilege | `withCpmo` + `assertCompanyWrite` → 403 [D-11] |
| Export of draft/unsubmitted snapshots | Information disclosure / integrity | Eligibility gate: submitted + version ≥ 1 [D-06] |
| IDOR via foreign project_ids in export body | Elevation of privilege | Reject ids not in period shells for actor company |
| Live RAID substitution | Tampering (misreport) | Snapshot-only pack [D-01] |

## Sources

### Primary (HIGH confidence)

- Codebase via codegraph: `lib/services/weekly-reports.service.ts`, `lib/repositories/weekly-reports.repo.ts`, `lib/repositories/issues.repo.ts`, `lib/repositories/pm-assignments.repo.ts`, `lib/export/excel.ts`, `lib/export/word.ts`, `lib/export/ppt.ts`, `app/api/export/weekly-report/[id]/route.ts`, `lib/db-weekly-reports.ts`, `lib/db.ts`, `lib/http/with-role.ts`, `lib/services/access.ts`, `lib/services/audit.service.ts`
- `.planning/phases/14-cpmo-tracking-consolidated-export/14-CONTEXT.md` — D-01..D-14 locked

### Secondary (MEDIUM confidence)

- `.planning/phases/13-weekly-periods-pm-submit/13-RESEARCH.md` — parallel surface, migrate pattern, test harness
- `.planning/codebase/INTEGRATIONS.md` — export library map (lines 161–164)
- `.planning/codebase/TESTING.md` — Vitest 4, TEST_DATABASE_URL `_test` suffix

### Tertiary (LOW confidence)

- Exact Word/PPT section order — planner discretion only

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; export libs and auth verified in source
- Architecture: HIGH — Phase 13 helpers and snapshot shape traced verbatim; v1 landmine confirmed
- Pitfalls: HIGH — live-vs-snapshot and repo scope gaps documented with line citations

**Research date:** 2026-08-26  
**Valid until:** 2026-09-26 (stable domain); re-verify if `submitWeeklyReport` snapshot shape or v1 export routes change
