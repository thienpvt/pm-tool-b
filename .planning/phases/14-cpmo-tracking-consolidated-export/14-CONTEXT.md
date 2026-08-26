# Phase 14: CPMO Tracking & Consolidated Export - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Deliver a CPMO tracking view of one weekly period (counts + filterable grid) and a consolidated export built from **submitted version snapshots**, not live RAID. Consume Phase 13 `listPeriodShells` / latest `weekly_report_versions` rows. This is a **parallel product surface** — do not reuse v1 `/api/export/weekly-report/[id]` or `getWeeklyProjectReport`.

**Requirements:** CPMO-01, CPMO-02, CPMO-03, CPMO-04

**In:** obligated-project counts and Not submitted / Draft / Submitted / Overdue / Late for a period; filter tracking rows by period, status, lateness, PM, stage, RAG, and technology-council issues; open a report (return `project_id` + `report_id`); tick-select projects, preview consolidation, reorder, export an editable pack using already-supported Excel/Word/PPT libraries; export records period, data version, and who exported; each project section includes identity, PM, stage, prior/current RAG, progress, highlights, next-week goals, nearest milestone, RAID, and technology issues — all from the latest submitted snapshot.

**Out:** Dashboard pages (Phase 16); budget/ROI/deps (Phase 15); document templates (Phase 17); full audit coverage (Phase 18 — incremental `auditLog` on export is OK); redesign of v1 project report / `/api/export/weekly-report/[id]`; new RAID store; PM/Viewer tracking or export.

</domain>

<decisions>
## Implementation Decisions

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

### the agent's Discretion

- Exact workbook/sheet names, Word/PPT section layout, and whether preview is GET-with-body vs POST — planner locks those. Prefer POST preview + POST export. Filter `technology_council=true` means "project currently has at least one open/in-progress tech-council issue" (live), matching CPMO's operational filter.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — Phase 14 goal, success criteria 1–4, UI hint yes (ignored: `workflow.ui_phase` false)
- `.planning/REQUIREMENTS.md` — CPMO-01..04
- `.planning/PROJECT.md` — PR-12; weekly reports are a parallel product surface
- `.planning/STATE.md` — current position Phase 14

### Locked prior decisions
- `.planning/phases/13-weekly-periods-pm-submit/13-CONTEXT.md` — D-01 parallel surface; D-05 overdue computed; D-08 immutable versions; D-11 RAID master + locked snapshot; D-13 withCpmo; D-18 `listPeriodShells`
- `.planning/phases/13-weekly-periods-pm-submit/13-VERIFICATION.md` — helpers exported; no v1 report reuse
- `.planning/phases/12-milestone-raid-master-registers/12-CONTEXT.md` — `listTechnologyCouncilIssues`; never DELETE RAID
- `.planning/phases/10-users-roles-server-authorization/10-CONTEXT.md` — `withCpmo`, company-scoped CPMO, D-23 leftover carve-out
- `.planning/phases/11-project-master-pm-assignment-stakeholders/11-CONTEXT.md` — `progress_pct` never write-back; PM assignment windows

### Code maps
- `.planning/codebase/ARCHITECTURE.md` — route → service → repo
- `.planning/codebase/CONVENTIONS.md` — Vitest 4, settings-flag DDL
- `.planning/codebase/TESTING.md` — `TEST_DATABASE_URL` must end in `_test`
- `.planning/codebase/INTEGRATIONS.md` — Excel/Word/PPT export libs already in tree

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `listPeriodShells` / `listPeriodShellsRepo` — period-scoped shells + computed overdue
- `getWeeklyPeriodByCompany`, `getLatestVersionSnapshot`, `listProjectWeeklyHistory`
- `lib/http/with-role.ts` `withCpmo`
- `lib/services/access.ts` `assertCompanyWrite`
- `lib/repositories/issues.repo.ts` `listTechnologyCouncilIssues`
- `lib/repositories/pm-assignments.repo.ts` active primary lookup
- `lib/export/excel.ts`, Word/PPT generators under `lib/export/`
- `lib/services/audit.service.ts` `auditLog`
- `lib/db-weekly-reports.ts` + `runInTransaction` (`lib/db-tx.ts`)

### Established Patterns
- Tenant then role. CPMO company-scoped. Viewer/PM 403 on CPMO routes.
- Snapshots are immutable; live masters are for write-through on PM submit only.
- Vitest 4 TDD; do not put `-x` in automated commands.
- Route tests mock assignment helpers, not `getProjectPmIdentity`.
- Do not invent CASL.

### Integration Points
- New `/api/weekly-periods/[periodId]/tracking` and `/export` (+ `/export/preview`)
- Leave `/api/export/weekly-report/[id]` and `/api/projects/[id]/report` untouched
- Phase 16 dashboards may reuse tracking counts — export a `getPeriodTracking` service function

### Landmines
- Using live RAID in the pack violates CPMO-04 / RAID-02
- Reusing v1 weekly-report Excel export pulls activity-weighted live data
- `listPeriodShellsRepo` is period-id only at repo layer — always go through company-scoped service
- `progress_pct` write-back is still forbidden
- Seed `admin` has null `company_id` and is not CPMO — CPMO routes 403 for that user (Phase 10)

</code_context>

<specifics>
## Specific Ideas

- [auto] Source — Q: "Live RAID or snapshots?" → Selected: "Latest submitted snapshot only; live tech-council used only as a filter" (recommended default)
- [auto] Surface — Q: "Reuse v1 export?" → Selected: "New period-scoped export routes; leave `/api/export/weekly-report/[id]` unchanged" (recommended default)
- [auto] Pack — Q: "Which formats?" → Selected: "xlsx primary + docx + pptx via existing libs; same snapshot payload" (recommended default)
- [auto] Order — Q: "How does reorder work?" → Selected: "Caller `project_ids` array order; no persisted rank table" (recommended default)
- [auto] Audit — Q: "Record exports?" → Selected: "`weekly_export_logs` + `auditLog`; never DELETE" (recommended default)
- `workflow.ui_phase=false`

</specifics>

<deferred>
## Deferred Ideas

- Portfolio / PM dashboards — Phase 16 (may call `getPeriodTracking`)
- Budget, value, ROI, bidirectional deps — Phase 15
- Document templates & Confluence checklist — Phase 17
- Full append-only audit coverage — Phase 18
- Backfilling tech-council flags onto already-submitted snapshots that lack the field

</deferred>

---

*Phase: 14-CPMO Tracking & Consolidated Export*
*Context gathered: 2026-08-26*
