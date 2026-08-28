# Phase 14 coverage

No external API integration: Phase 14 consumes Phase 13 `weekly_periods` / `weekly_reports` / `weekly_report_versions` snapshots and existing `exceljs` / `docx` / `pptxgenjs` — no new third-party API or SDK.

## Requirements → plans

| ID | Description | Plan | Tasks | Automated proof |
|----|-------------|------|-------|-----------------|
| CPMO-01 | Obligated-project counts and Not submitted / Draft / Submitted / Overdue / Late | 14-01 | 14-01-01, 14-01-02 | `lib/services/weekly-tracking.service.unit.test.ts` — counts from unfiltered shells; overdue via `isWeeklyReportOverdue` |
| CPMO-02 | Filter grid by period, status, lateness, PM, stage, RAG, tech-council; open via row ids | 14-01 | 14-01-01, 14-01-02 | Service filter matrix + GET query forwarding; rows include `project_id` + `report_id`; route 403 for PM/Viewer |
| CPMO-03 | Tick-select, preview, reorder, export editable xlsx/docx/pptx | 14-02, 14-03 | 14-02-01, 14-02-02, 14-03-01, 14-03-02 | Preview order + eligibility 400 fields; `lib/export/consolidated-weekly.unit.test.ts` per format; POST export binary |
| CPMO-04 | Record period, data version, exporter; sections from snapshot fields | 14-02, 14-03 | 14-02-02, 14-03-01, 14-03-02 | Snapshot assembly; `insertWeeklyExportLog` + `auditLog` action `weekly_export`; generator D-08 headings |

## Decisions → plans

| ID | Decision | Plan | Status |
|----|----------|------|--------|
| D-01 | Snapshots only; no live RAID in pack; no v1 weekly Excel / activity-weighted helper | 14-02, 14-03 | COVERED |
| D-02 | Live tech-council filter; export tech issues from snapshot flag | 14-01, 14-02 | COVERED |
| D-03 | GET tracking `{ period, counts, rows }`; extend shells; grid RAG from version | 14-01 | COVERED |
| D-04 | Counts: obligated / stored statuses / computed overdue / first_lateness late | 14-01 | COVERED |
| D-05 | Server-side query filters; `status=overdue` computed; open = row ids | 14-01 | COVERED |
| D-06 | POST preview; submitted + version ≥ 1; order = `project_ids`; no rank table | 14-02 | COVERED |
| D-07 | POST export xlsx primary + docx + pptx; new generators | 14-03 | COVERED |
| D-08 | Section fields from snapshot; blanks not live-backfilled | 14-02, 14-03 | COVERED |
| D-09 | `weekly_export_logs` + `auditLog` `weekly_export`; append-only | 14-01 (DDL), 14-03 (insert) | COVERED |
| D-10 | Settings-flag DDL in `lib/db-weekly-reports.ts` after existing migrate | 14-01 | COVERED |
| D-11 | `withCpmo` + `assertCompanyWrite`; no policy-engine invention | 14-01, 14-02, 14-03 | COVERED |
| D-12 | `ui_phase` false; server tests are the gate; thin page not a must_have | all (no UI task) | COVERED |
| D-13 | Extend `listPeriodShellsRepo` with `company_id` join | 14-01 | COVERED |
| D-14 | 400/404/409 via existing errors; concurrent export allowed | 14-02, 14-03 | COVERED |

## ROADMAP goal

| Source | Item | Plans | Status |
|--------|------|-------|--------|
| GOAL | CPMO sees period submission status and exports a consolidated pack from submitted snapshots, not live RAID | 14-01, 14-02, 14-03 | COVERED |

Deferred (not gaps): Phase 16 dashboards, Phase 15 budget/ROI, Phase 17 templates, Phase 18 full audit, backfill of tech-council flags onto old snapshots.
