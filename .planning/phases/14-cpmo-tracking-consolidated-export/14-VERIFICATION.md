---
phase: 14-cpmo-tracking-consolidated-export
verified: 2026-08-26T00:30:00Z
status: passed
score: 20/20 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 14
  total: 14
  not_honored: []
---

# Phase 14: CPMO Tracking & Consolidated Export Verification Report

**Phase Goal:** CPMO sees period submission status and exports a consolidated pack from submitted snapshots, not live RAID
**Verified:** 2026-08-26T00:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CPMO GET `/api/weekly-periods/[periodId]/tracking` returns `{ period, counts, rows }` for a period owned by `actor.company_id` (SC1, CPMO-01, D-03, D-11) | ✓ VERIFIED | `getPeriodTracking` (`lib/services/weekly-tracking.service.ts:178-225`); GET `withCpmo` (`app/api/weekly-periods/[periodId]/tracking/route.ts:45-51`) |
| 2 | `counts.obligated` is unfiltered shell count; `not_submitted`/`draft`/`submitted` are stored status tallies; `overdue` uses `isWeeklyReportOverdue`; `late` is `first_lateness === 'late'`; overdue is never stored (D-04, CPMO-01) | ✓ VERIFIED | `buildCounts` (`lib/services/weekly-tracking.service.ts:136-144`); unit test `returns period, counts, and rows` |
| 3 | Server-side filters (`status` including computed `overdue`, `lateness`, `pm_user_id`, `stage`, `rag`, `technology_council=true`) shrink `rows` only; `counts` stay period-wide (D-05, CPMO-02) | ✓ VERIFIED | `applyTrackingFilters` after `buildCounts` (`147-175`, `211-212`); unit test `keeps unfiltered counts when status filter shrinks rows` |
| 4 | Each row exposes `project_id` and `report_id` for open-report navigation; grid `rag` is `wv.rag` from version join, not live `projects.rag` (D-03, CPMO-02) | ✓ VERIFIED | `listPeriodShellsRepo` selects `wv.rag` only, no `p.rag` (`lib/repositories/weekly-reports.repo.ts:419-422`); row mapping (`weekly-tracking.service.ts:195-208`) |
| 5 | `has_technology_council_issues` uses live `listTechnologyCouncilIssues` project_id set for filter-only; not pack RAID content (D-02) | ✓ VERIFIED | `listTechnologyCouncilIssues` in `getPeriodTracking` only (`weekly-tracking.service.ts:192-193,208`); absent from `previewConsolidatedExport`/`exportConsolidatedWeekly` |
| 6 | Tracking, preview, and export use `withCpmo` plus `assertCompanyWrite`; PM/Viewer 403; unknown/foreign period 404 via `getWeeklyPeriodByCompany` (D-11, D-14) | ✓ VERIFIED | All three routes wrap `withCpmo`; route tests 401/403; `NotFoundError` when period missing (`weekly-tracking.service.ts:187-188`) |
| 7 | `listPeriodShellsRepo(companyId, periodId)` joins `weekly_periods.company_id` for defense-in-depth; `listPeriodShells` passes `companyId` (D-13) | ✓ VERIFIED | JOIN clause (`weekly-reports.repo.ts:424`); `listPeriodShells` calls repo with companyId (`lib/services/weekly-reports.service.ts:564`) |
| 8 | `weekly_export_logs` created by settings-flag helper at tail of `migrateWeeklyReports`; invoked from `getDb` (D-09, D-10) | ✓ VERIFIED | `WEEKLY_EXPORT_LOGS_DDL` + `migrateWeeklyExportLogs` (`lib/db-weekly-reports.ts:76-146`); `getDb` → `migrateWeeklyReports` (`lib/db.ts:631-632`); DDL unit test passes |
| 9 | CPMO POST `/export/preview` with `{ project_ids }` returns caller-ordered section summaries; reorder = array order, no rank table (D-06, CPMO-03) | ✓ VERIFIED | `previewConsolidatedExport` walks `projectIds` (`weekly-tracking.service.ts:260-267`); `assembleSnapshotSections` maps in caller order (`103-133`); unit test `returns sections in caller project_ids order` |
| 10 | Only `submitted` shells with `latest_version >= 1` are export-eligible; ineligible ids → `SubmitValidationError` → HTTP 400 `{ error, fields }` (D-06, D-14, CPMO-03) | ✓ VERIFIED | `assertExportEligible` (`228-241`); route uses `serviceErrorResponse` via `withAuth`; unit + route tests pass |
| 11 | Preview/export sections assembled from `getLatestVersionSnapshot(report_id, latest_version)` only; live RAID master helpers not called for section content (D-01, D-08, CPMO-04) | ✓ VERIFIED | Snapshot load loop (`260-264`, `303-307`); grep: no `getRisk`/`getIssue`/`listRisks` in `weekly-tracking.service.ts` export paths; unit test `loads preview content only via getLatestVersionSnapshot` |
| 12 | Section fields include identity, PM, stage, prev/current RAG, progress, highlights, next-week goals, nearest milestone, RAID arrays, tech issues from snapshot `technology_council === true`; missing keys blank (D-08, CPMO-04) | ✓ VERIFIED | `assembleSnapshotSections` (`103-133`); `filterSnapshotTechIssues` (`94-100`); unit tests for blank fields and absent tech flags |
| 13 | POST `/export` with `{ project_ids, format: xlsx\|docx\|pptx }` returns binary Buffer; xlsx has `Portfolio Summary` plus one sheet per project in caller order (D-07, CPMO-03) | ✓ VERIFIED | `exportConsolidatedWeekly` → `generateConsolidatedWeekly` (`315-327`); `generateConsolidatedXlsx` sheet names (`lib/export/consolidated-weekly.ts:129,236-243`); route binary response (`export/route.ts:16-21`); unit test read-back |
| 14 | docx and pptx generated from same `ConsolidatedWeeklyPayload`; generator module has no repository imports and no v1 export entry points (D-01, D-07) | ✓ VERIFIED | `generateConsolidatedWeekly` dispatch (`592-607`); unit test `generator module has no repository imports`; grep: no `getWeeklyProjectReport`/`generateProjectPlan` in phase artifacts |
| 15 | Successful export inserts `weekly_export_logs` with `period_id`, `company_id`, `exported_by`, `format`, `data_version` (= max included `latest_version`), `project_ids` JSON, `period_display_name` (D-09, CPMO-04) | ✓ VERIFIED | `insertWeeklyExportLog` INSERT-only (`lib/repositories/weekly-export.repo.ts:14-27`); orchestration (`weekly-tracking.service.ts:311-337`); repo integration test passes |
| 16 | `auditLog` action `weekly_export` records format, data_version, project_ids after successful Buffer (D-09) | ✓ VERIFIED | `auditLog` call (`weekly-tracking.service.ts:339-347`); unit test `generates buffer then insertWeeklyExportLog then auditLog weekly_export` |
| 17 | Buffer generated before log insert; generator failure does not write export log row (D-09) | ✓ VERIFIED | Order: `generateConsolidatedWeekly` then `insertWeeklyExportLog` (`315-337`); unit test `does not insert log when generator fails` |
| 18 | Concurrent exports append additional log rows; no UPDATE/DELETE helpers on `weekly_export_logs` (D-09, D-14) | ✓ VERIFIED | INSERT-only repo comment + implementation; unit test `two sequential successful exports call insertWeeklyExportLog twice`; grep: no DELETE/UPDATE in `weekly-export.repo.ts` |
| 19 | Parallel surface — no Phase 14 coupling to v1 `/api/export/weekly-report/[id]` or `getWeeklyProjectReport` (D-01, D-07) | ✓ VERIFIED | New routes under `/api/weekly-periods/[periodId]/export*` only; grep phase artifacts: 0 matches for v1 paths |
| 20 | Never physical DELETE on weekly periods, shells, versions, export logs, milestones, risks, or issues in production `lib/` (D-09, D-17 analog) | ✓ VERIFIED | grep `DELETE FROM (weekly_|milestones|risks|issues)` in `lib/` excluding tests: 0 matches in production code |

**Score:** 20/20 truths verified (0 present, behavior-unverified)

### ROADMAP Success Criteria Mapping

| SC | Summary | Status |
|----|---------|--------|
| 1 | CPMO sees obligated-project counts and Not submitted / Draft / Submitted / Overdue / Late for a period | ✓ VERIFIED (truths 1–2) |
| 2 | CPMO can filter tracking grid by period, status, lateness, PM, stage, RAG, tech-council issues; open report via row ids | ✓ VERIFIED (truths 3–5, 4) |
| 3 | CPMO can tick-select projects, preview consolidation, reorder via array order, export editable xlsx/docx/pptx pack | ✓ VERIFIED (truths 9–14) |
| 4 | Export records period, data version, exporter; sections include identity, PM, stage, RAG, progress, highlights, goals, milestone, RAID, tech issues from snapshot | ✓ VERIFIED (truths 11–12, 15–16) |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `lib/db-weekly-reports.ts` | `weekly_export_logs` DDL + migrate tail | ✓ VERIFIED | WIRED from `getDb` |
| `lib/repositories/weekly-reports.repo.ts` | Company-scoped shells + snapshots | ✓ VERIFIED | WIRED via tracking service |
| `lib/services/weekly-tracking.service.ts` | Tracking, preview, export orchestration | ✓ VERIFIED | All exports wired to routes |
| `lib/export/consolidated-weekly.ts` | Payload-only xlsx/docx/pptx generators | ✓ VERIFIED | No repo imports |
| `lib/repositories/weekly-export.repo.ts` | Append-only export log INSERT | ✓ VERIFIED | WIRED from exportConsolidatedWeekly |
| `app/api/weekly-periods/[periodId]/tracking/route.ts` | CPMO GET tracking | ✓ VERIFIED | withCpmo |
| `app/api/weekly-periods/[periodId]/export/preview/route.ts` | CPMO POST preview | ✓ VERIFIED | withCpmo + Zod |
| `app/api/weekly-periods/[periodId]/export/route.ts` | CPMO POST binary pack | ✓ VERIFIED | withCpmo + Content-Disposition |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `lib/db.ts` | `lib/db-weekly-reports.ts` | getDb → migrateWeeklyReports → migrateWeeklyExportLogs | ✓ WIRED | After weekly indexes |
| `tracking/route.ts` | `weekly-tracking.service.ts` | GET → getPeriodTracking | ✓ WIRED | Filter forwarding |
| `weekly-tracking.service.ts` | `weekly-reports.repo.ts` | listPeriodShellsRepo + getLatestVersionSnapshot | ✓ WIRED | Company-scoped |
| `preview/route.ts` | `weekly-tracking.service.ts` | POST → previewConsolidatedExport | ✓ WIRED | Eligibility gate |
| `export/route.ts` | `weekly-tracking.service.ts` | POST → exportConsolidatedWeekly | ✓ WIRED | Binary response |
| `weekly-tracking.service.ts` | `consolidated-weekly.ts` | assembleSnapshotSections → generateConsolidatedWeekly | ✓ WIRED | Snapshot payload only |
| `weekly-tracking.service.ts` | `weekly-export.repo.ts` | insertWeeklyExportLog after Buffer | ✓ WIRED | Append-only |
| `weekly-tracking.service.ts` | `audit.service.ts` | auditLog weekly_export | ✓ WIRED | After successful pack |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `getPeriodTracking` counts/rows | shells + overdue | `listPeriodShellsRepo` JOIN versions | ✓ | ✓ FLOWING |
| `getPeriodTracking` tech flag | has_technology_council_issues | live `listTechnologyCouncilIssues` (filter only) | ✓ | ✓ FLOWING |
| `assembleSnapshotSections` RAID | risks/issues arrays | `weekly_report_versions.snapshot.raid` | ✓ | ✓ FLOWING |
| `assembleSnapshotSections` tech_issues | filtered issues | snapshot `technology_council === true` | ✓ | ✓ FLOWING |
| `exportConsolidatedWeekly` pack | Buffer | snapshot payload generators | ✓ | ✓ FLOWING |
| `insertWeeklyExportLog` | export record | actor + max latest_version + project_ids | ✓ | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 14 test suite (57 tests) | `npx vitest run lib/services/weekly-tracking.service.unit.test.ts lib/export/consolidated-weekly.unit.test.ts lib/repositories/weekly-export.repo.test.ts lib/db-weekly-reports.ddl.unit.test.ts app/api/weekly-periods/[periodId]/tracking/route.test.ts app/api/weekly-periods/[periodId]/export/preview/route.test.ts app/api/weekly-periods/[periodId]/export/route.test.ts lib/repositories/weekly-reports.repo.test.ts` with `TEST_DATABASE_URL` | 8 files passed, 57 passed | ✓ PASS |
| weekly_export_logs DDL fragments | `lib/db-weekly-reports.ddl.unit.test.ts` | Passed | ✓ PASS |
| xlsx Portfolio Summary + D-08 labels | `lib/export/consolidated-weekly.unit.test.ts` | Passed | ✓ PASS |
| Export log before audit; skip log on generator fail | `lib/services/weekly-tracking.service.unit.test.ts#exportConsolidatedWeekly` | Passed | ✓ PASS |
| Ineligible export skips insertWeeklyExportLog | `lib/services/weekly-tracking.service.unit.test.ts#assertExportEligible` | Passed | ✓ PASS |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `weekly-tracking.service.unit.test.ts` | CPMO-01..04 | Yes | 0 | No | Behavioral | PASS |
| `consolidated-weekly.unit.test.ts` | CPMO-03..04 | Yes | 0 | No | Value/behavioral | PASS |
| `weekly-export.repo.test.ts` | CPMO-04 | Yes | 0 | No | Value/behavioral | PASS |
| `tracking/route.test.ts` | CPMO-01..02 | Yes | 0 | No | Behavioral | PASS |
| `export/preview/route.test.ts` | CPMO-03 | Yes | 0 | No | Behavioral | PASS |
| `export/route.test.ts` | CPMO-03..04 | Yes | 0 | No | Behavioral | PASS |
| `db-weekly-reports.ddl.unit.test.ts` | D-10 | Yes | 0 | No | Value | PASS |
| `weekly-reports.repo.test.ts` | D-13 | Yes | 0 | No | Value/behavioral | PASS |

**Disabled tests on requirements:** 0  
**Circular patterns detected:** 0  
**Insufficient assertions:** 0

### Decision Coverage

All 14 trackable CONTEXT.md decisions (D-01..D-14) honored by shipped artifacts.

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01 Snapshot-only pack | ✓ | getLatestVersionSnapshot; no live RAID in export |
| D-02 Live tech filter / snapshot tech export | ✓ | listTechnologyCouncilIssues in tracking only; filterSnapshotTechIssues in assembly |
| D-03 Tracking API shape | ✓ | GET tracking route + getPeriodTracking |
| D-04 Count semantics | ✓ | buildCounts + isWeeklyReportOverdue |
| D-05 Server-side filters | ✓ | applyTrackingFilters; parseTrackingFilters |
| D-06 Preview/reorder | ✓ | caller-order project_ids; POST preview |
| D-07 Pack formats | ✓ | generateConsolidatedWeekly xlsx/docx/pptx |
| D-08 Section fields | ✓ | assembleSnapshotSections + generator D-08 labels |
| D-09 Export log + audit | ✓ | weekly_export_logs + auditLog weekly_export |
| D-10 Schema helper | ✓ | migrateWeeklyExportLogs in db-weekly-reports |
| D-11 CPMO-only authz | ✓ | withCpmo on all three routes |
| D-12 Server tests gate | ✓ | 57 automated tests; no UI gate |
| D-13 Company-scoped repo | ✓ | listPeriodShellsRepo company join |
| D-14 Error boundaries | ✓ | SubmitValidationError fields; Zod min(1) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CPMO-01 | 14-01 | Obligated counts and status tallies including computed overdue and late | ✓ SATISFIED | getPeriodTracking + GET tracking |
| CPMO-02 | 14-01 | Filter grid by period/status/lateness/PM/stage/RAG/tech-council; open report | ✓ SATISFIED | applyTrackingFilters + row project_id/report_id |
| CPMO-03 | 14-02, 14-03 | Select, preview, reorder, export editable xlsx/docx/pptx pack | ✓ SATISFIED | preview + export routes + consolidated-weekly generators |
| CPMO-04 | 14-02, 14-03 | Export log with period/data version/exporter; full snapshot sections | ✓ SATISFIED | insertWeeklyExportLog + assembleSnapshotSections + D-08 generators |

No orphaned requirements for Phase 14. REQUIREMENTS.md checkboxes for CPMO-01..04 were already marked complete and match verified implementation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No TBD/FIXME/XXX, stubs, v1 export reuse, live RAID in pack, or production DELETE paths in phase artifacts |

### Human Verification

N/A — Backend/API phase (`workflow.ui_phase` false per D-12). All acceptance criteria verified programmatically via unit, repo integration, and route tests (57/57 passed). Thin tracking UI is optional and not the verification gate; portfolio dashboards deferred to Phase 16.

### Gaps Summary

No gaps found. Phase 14 delivers company-scoped CPMO period tracking with version RAG grid and live tech-council filter flag, snapshot-only preview/export with caller-order reordering, payload-driven xlsx/docx/pptx consolidated packs, and append-only `weekly_export_logs` plus `auditLog weekly_export` — without reusing v1 weekly report export or reading live RAID into the pack.

---

_Verified: 2026-08-26T00:30:00Z_  
_Verifier: Claude (gsd-verifier)_
