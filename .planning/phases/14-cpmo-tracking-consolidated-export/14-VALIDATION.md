---
phase: 14
slug: cpmo-tracking-consolidated-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 14 — Validation Strategy

> Nyquist-style must-haves mapped to CPMO-01..04. Server tests are the phase gate (`workflow.ui_phase: false`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run lib/services/weekly-tracking.service.unit.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~90 seconds |

Do not use `-x` in automated plan commands (Vitest 4 ignores it).

---

## Requirement Must-Haves (CPMO-01..04)

| Req | Must-have behavior | Automated proof | Min test type |
|-----|-------------------|-----------------|---------------|
| **CPMO-01** | Response includes counts: `obligated`, `not_submitted`, `draft`, `submitted`, `overdue` (computed), `late` (`first_lateness === 'late'`) | Service unit: mock shells with mixed status/due_at/lateness; assert count object | unit |
| **CPMO-01** | Overdue never stored as shell status | Assert overdue count uses `isWeeklyReportOverdue`, not `status === 'overdue'` | unit |
| **CPMO-02** | GET tracking accepts filters: `status`, `lateness`, `pm_user_id`, `stage`, `rag`, `technology_council` | Service unit: param matrix reduces row set correctly | unit |
| **CPMO-02** | `status=overdue` filters computed overdue rows only | Service unit: draft past due included; submitted excluded | unit |
| **CPMO-02** | Grid RAG from latest version (`wv.rag`), not live `projects.rag` | Repo or service unit: rag source column | unit |
| **CPMO-02** | Tech-council filter uses live open/in-progress council issues; export does not | Service unit: mock `listTechnologyCouncilIssues`; generator unit: no issues repo import | unit |
| **CPMO-02** | Each row exposes `project_id` + `report_id` for open-report navigation | Service unit: shape assertion | unit |
| **CPMO-02** | PM/Viewer receive 403 on tracking route | Route test with non-CPMO actor | route |
| **CPMO-03** | POST preview: body `{ project_ids }` order preserved in sections | Service unit: reorder input ids → output order | unit |
| **CPMO-03** | Preview/export reject non-submitted or `latest_version < 1` with 400 `{ error, fields }` | Service unit: ineligible id list in fields | unit |
| **CPMO-03** | POST export supports `xlsx`, `docx`, `pptx`; returns binary Buffer/stream | `lib/export/consolidated-weekly.unit.test.ts` per format | unit |
| **CPMO-03** | Export does not call `/api/export/weekly-report/[id]` or `getWeeklyProjectReport` | Static/mock test: no import of v1 route or project-report service | unit |
| **CPMO-04** | Export inserts `weekly_export_logs` with period, format, `data_version`, `project_ids`, `period_display_name`, `exported_by` | Repo or service test with mock insert | unit/repo |
| **CPMO-04** | `auditLog` action `weekly_export` on successful export | Service unit: `auditLog` mock called once | unit |
| **CPMO-04** | Pack sections include snapshot fields: identity, PM, stage, prev/current RAG, progress, highlights, next-week goals, milestone, RAID, tech issues subset | Generator unit: fixture snapshot → expected headings/rows | unit |
| **CPMO-04** | Missing snapshot fields render blank — no live master backfill | Generator unit: partial snapshot; mock live repos not called | unit |

### Cross-cutting (locked D-01..D-14)

| Must-have | Automated proof |
|-----------|-----------------|
| CPMO + company write only (`withCpmo`, `assertCompanyWrite`) | Route tests: CPMO 200, PM/Viewer 403, wrong company 403/404 |
| Company owns period (`getWeeklyPeriodByCompany`) | Service: foreign period → NotFoundError |
| `listPeriodShellsRepo` joins `weekly_periods.company_id` when extended | DDL/repo test or SQL fragment assertion |
| `weekly_export_logs` DDL via settings flag after `migrateWeeklyReports` | `lib/db-weekly-reports.ddl.unit.test.ts` extended |
| Concurrent exports allowed (append-only) | Two export calls → two log rows (repo integration optional) |

---

## Sampling Rate

- **After every task commit:** run task `<verify><automated>` file(s)
- **After every plan wave:** `npx vitest run lib/services/weekly-tracking.service.unit.test.ts lib/export/consolidated-weekly.unit.test.ts app/api/weekly-periods`
- **Before `$gsd-verify-work`:** full `npm test` green
- **Max feedback latency:** 90 seconds

---

## Wave 0 Files (all ❌ until created)

- [ ] `lib/services/weekly-tracking.service.ts` + `.unit.test.ts`
- [ ] `lib/export/consolidated-weekly.ts` + `.unit.test.ts`
- [ ] Extend `lib/repositories/weekly-reports.repo.ts` + `.repo.test.ts`
- [ ] Extend `lib/db-weekly-reports.ts` + `.ddl.unit.test.ts` (`weekly_export_logs`)
- [ ] `app/api/weekly-periods/[periodId]/tracking/route.ts` + `route.test.ts`
- [ ] `app/api/weekly-periods/[periodId]/export/preview/route.ts` + `route.test.ts`
- [ ] `app/api/weekly-periods/[periodId]/export/route.ts` + `route.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
|----------|-------------|------------|--------------|
| Thin tracking UI operable (if added) | D-12 | `ui_phase: false` | Optional smoke: CPMO opens tracking page, filters, selects projects. Server tests remain gate. |

All CPMO-01..04 behaviors above have intended automated coverage.

---

## Validation Sign-Off

- [ ] Every CPMO-01..04 must-have row has a Wave 0 test target
- [ ] No three consecutive tasks without `<automated>` verify
- [ ] v1 weekly-report export landmine covered by negative import/mock test
- [ ] `nyquist_compliant: true` when Wave 0 complete

**Approval:** pending
