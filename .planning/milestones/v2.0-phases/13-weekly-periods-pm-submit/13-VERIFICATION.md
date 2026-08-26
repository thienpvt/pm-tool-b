---
phase: 13-weekly-periods-pm-submit
verified: 2026-08-26T06:52:00Z
status: passed
score: 21/21 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 18
  total: 18
  not_honored: []
deferred:
  - truth: "CPMO tracking grid with counts, filters, and consolidated export pack"
    addressed_in: "Phase 14"
    evidence: "Phase 14 goal: CPMO tracking and consolidated export; D-18 exports listPeriodShells only — no grid HTTP in Phase 13"
  - truth: "Portfolio/PM dashboard pages consuming weekly overdue and RAG lists"
    addressed_in: "Phase 16"
    evidence: "Phase 16 goal: Portfolio One View dashboards; D-18 exports listProjectWeeklyHistory for Phase 16"
---

# Phase 13: Weekly Periods & PM Submit Verification Report

**Phase Goal:** CPMO configures weekly periods; PMs draft and submit versioned reports that snapshot RAID and milestones from the masters
**Verified:** 2026-08-26T06:52:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CPMO POST `/api/weekly-periods` creates `weekly_periods` with frozen `display_name` `YYYY-Wnn \| start – end`, materialized `due_at`, `config_snapshot`, and at most one shell per obligated project in one transaction (SC1, PERD-01, D-02–D-04) | ✓ VERIFIED | `createPeriodWithShells` (`lib/repositories/weekly-periods.repo.ts:137-180`); `formatPeriodDisplayName` (`lib/iso-week.ts:40-45`); `insertShell` ON CONFLICT DO NOTHING (`lib/repositories/weekly-reports.repo.ts:67-79`); route `withCpmo` POST (`app/api/weekly-periods/route.ts:10-15`) |
| 2 | PUT `/api/weekly-periods/config` upserts `company_weekly_config` only; existing period `due_at`, `display_name`, `config_snapshot`, and shells unchanged (SC1, PERD-02, D-03) | ✓ VERIFIED | `upsertCompanyWeeklyConfig` touches config table only (`lib/repositories/weekly-periods.repo.ts:78-95`); repo test asserts period row unchanged after config upsert |
| 3 | ISO week bounds and `due_at` use UTC Thursday rule; default due Friday 18:00 UTC when no config row (D-02, D-03) | ✓ VERIFIED | `isoWeekBoundsUtc` Thursday rule (`lib/iso-week.ts:29-37`); `DEFAULT_CONFIG` weekday 5 / 18:00 (`lib/repositories/weekly-periods.repo.ts:36-38`, `lib/services/weekly-reports.service.ts:38`) |
| 4 | Obligation at create: enabled + start_period ≤ iso_week + not L5/terminal; UNIQUE(period_id, project_id); no backfill (SC1, WKRP-01, D-04) | ✓ VERIFIED | `listObligatedProjectIds` SQL (`lib/repositories/weekly-periods.repo.ts:98-122`); unique index `weekly_reports_period_project_unique` (`lib/db-weekly-reports.ts:70-71`); repo tests for exclusions |
| 5 | Overdue computed `now > due_at` AND status in `not_submitted`/`draft`; never stored; late submit allowed (SC1, PERD-03, D-05) | ✓ VERIFIED | `isWeeklyReportOverdue` (`lib/services/weekly-reports.service.ts:211-218`); submit allowed after due in service + unit tests; no `overdue` status in DDL |
| 6 | Period mutate uses `withCpmo` + `assertCompanyWrite`; list company-scoped (D-13) | ✓ VERIFIED | `createWeeklyPeriod` calls `assertCompanyWrite` (`lib/services/weekly-reports.service.ts:248`); routes use `withCpmo`; CPMO-only 403 in route tests |
| 7 | `migrateWeeklyReports` runs from `getDb` after `migrateRaidMasters`; settings-flag DDL; no Prisma (D-14) | ✓ VERIFIED | `lib/db.ts:618-619`; four-table DDL + flags (`lib/db-weekly-reports.ts:7-120`); DDL unit test passes |
| 8 | PM PATCH allowlisted draft fields moves `not_submitted` → `draft`; RAID masters not written on PATCH (SC2, WKRP-02, D-06, D-11) | ✓ VERIFIED | `saveWeeklyReportDraft` + `DRAFT_ALLOWLIST` (`lib/services/weekly-reports.service.ts:40-50,304-337`); `createRisk`/`updateRisk` only in `submitWeeklyReport` (lines 370-395), not in draft save |
| 9 | `prev_week_rag` copied at draft-open from prior submitted version `this_week_rag` else `projects.rag`; read-only, not in PATCH allowlist (SC2, WKRP-03, D-07) | ✓ VERIFIED | `ensurePrevWeekRag` + `getPriorPeriodSubmittedRag` (`lib/services/weekly-reports.service.ts:274-288`, `lib/repositories/weekly-reports.repo.ts:133-157`); `prev_week_rag` absent from `DRAFT_ALLOWLIST` |
| 10 | POST submit inserts immutable `weekly_report_versions` row, sets status `submitted`, records `first_submitted_at` and `first_lateness` once; late submit sets `late` (SC2–3, WKRP-04, D-08) | ✓ VERIFIED | `insertWeeklyReportVersion` INSERT-only (`lib/repositories/weekly-reports.repo.ts:210-234`); `finalizeWeeklyReportSubmit` sets `first_*` only when null (`lib/repositories/weekly-reports.repo.ts:246-265`); lateness at submit (`lib/services/weekly-reports.service.ts:439-447`) |
| 11 | PATCH submitted shell with `correction_open` false → 409; POST `/correct` opens overlay; resubmit becomes version N+1 without changing `first_*` (SC3, WKRP-04–5, D-08) | ✓ VERIFIED | `saveWeeklyReportDraft` ConflictError (`lib/services/weekly-reports.service.ts:317-318`); `openWeeklyReportCorrection` (`lib/services/weekly-reports.service.ts:464-491`); correction branch of `finalizeWeeklyReportSubmit` skips `first_*` UPDATE (`lib/repositories/weekly-reports.repo.ts:267-281`) |
| 12 | History one row per period for project, newest `iso_week` first, with display_name, status, computed overdue, latest RAG, submit time, submitter, on-time/late (SC3, WKRP-06, D-09) | ✓ VERIFIED | `listProjectWeeklyHistoryRepo` JOIN + `ORDER BY wp.iso_week DESC` (`lib/repositories/weekly-reports.repo.ts:330-345`); service maps overdue (`lib/services/weekly-reports.service.ts:494-513`) |
| 13 | Submit validates `draft_raid_json`, writes masters only via `createRisk`/`updateRisk`/`createIssue`/`updateIssue`; locked copies in `snapshot.raid`; later master edits do not UPDATE old snapshots (SC4, RAID-02–03, D-11) | ✓ VERIFIED | `validateSubmitDraft` pre-write (`lib/services/weekly-reports.service.ts:115-175`); RAID loop in submit (`370-415`); snapshot assembly (`419-423`); no UPDATE on `weekly_report_versions.snapshot` |
| 14 | Submit validation failure throws `SubmitValidationError` → HTTP 400 `{ error, fields: [...] }`; no version row and no master writes (SC4, RAID-03) | ✓ VERIFIED | throw at `366-368`; `serviceErrorResponse` mapping (`lib/api-errors.ts:55-56`); unit test skips `createRisk` on invalid draft |
| 15 | Submit stores milestone snapshot from validated `nearest_milestone_id`; later milestone cancel/edit does not change stored snapshot (SC5, MS-04, D-12) | ✓ VERIFIED | `copyMilestoneSnapshot` (`lib/services/weekly-reports.service.ts:177-185`); included in snapshot.milestones (`423`); no milestone DELETE in `lib/` |
| 16 | Submit copies live `projects.progress_pct` into version; never writes `progress_pct` back; updates `projects.rag` only when `this_week_rag` differs (SC2, WKRP-03, D-10) | ✓ VERIFIED | read at `397-400`; snapshot `progress_pct: progressPct` (`421`); `updateProject(pid, { rag: ... })` only (`402-403`); grep shows no `progress_pct` in updateProject call |
| 17 | `listPeriodShells` company-scoped for Phase 14; Viewer mutate 403; CPMO GET history 200 (D-13, D-18) | ✓ VERIFIED | `listPeriodShells` (`lib/services/weekly-reports.service.ts:516-536`); `route.access.test.ts` matrix passes |
| 18 | Parallel surface — no Phase 13 obligations in `documents` or `getWeeklyProjectReport`; v1 report routes untouched (D-01, D-15) | ✓ VERIFIED | grep `getWeeklyProjectReport`/`status_report` under weekly paths: 0 matches; new routes under `/api/weekly-periods` and `/api/projects/[id]/weekly-reports` only |
| 19 | Never physical DELETE on weekly periods, shells, versions, milestones, risks, or issues in production `lib/` (D-17, D-12) | ✓ VERIFIED | grep `DELETE FROM (weekly_|milestones|risks|issues)` in `lib/` excluding tests: 0 matches |
| 20 | Reads use `assertProjectAccess`; PATCH/submit/correct use `assertProjectWriteAccess` (D-09, D-13) | ✓ VERIFIED | `getWeeklyReportShell`/`listProjectWeeklyHistory` vs mutate paths in service; access tests pass |
| 21 | Incremental `auditLog` on period create and submit/correct (D-14) | ✓ VERIFIED | `createWeeklyPeriod` audit (`lib/services/weekly-reports.service.ts:256-264`); submit audit `weekly_submit`/`weekly_correct` (`451-459`) |

**Score:** 21/21 truths verified (0 present, behavior-unverified)

### ROADMAP Success Criteria Mapping

| SC | Summary | Status |
|----|---------|--------|
| 1 | CPMO periods with frozen config snapshot, obligated shells, computed overdue, late submit allowed | ✓ VERIFIED (truths 1–7) |
| 2 | PM draft/submit structured fields, read-only prev RAG, this-week RAG syncs to master on submit | ✓ VERIFIED (truths 8–10, 16) |
| 3 | Immutable submitted snapshots; correction = new version; history one row per period newest first | ✓ VERIFIED (truths 10–12) |
| 4 | RAID register is master; draft buffer until submit validates/writes/locks or rejects | ✓ VERIFIED (truths 8, 13–14) |
| 5 | Submitted reports store milestone snapshot immune to later edits | ✓ VERIFIED (truth 15) |

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | CPMO tracking grid and consolidated export | Phase 14 | Phase 14 requirements CPMO-01..04; `listPeriodShells` exported without HTTP grid |
| 2 | Dashboard UI for weekly overdue/RAG | Phase 16 | Phase 16 portfolio/PM dashboards; `listProjectWeeklyHistory` preserved |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `lib/db-weekly-reports.ts` | DDL + migrateWeeklyReports | ✓ VERIFIED | Four tables, two unique indexes, settings flags |
| `lib/iso-week.ts` | UTC ISO week helpers | ✓ VERIFIED | WIRED from `weekly-periods.repo` |
| `lib/repositories/weekly-periods.repo.ts` | Config, period+shells transaction | ✓ VERIFIED | WIRED via service |
| `lib/repositories/weekly-reports.repo.ts` | Draft UPDATE, version INSERT, history | ✓ VERIFIED | INSERT-only versions; no snapshot UPDATE |
| `lib/services/weekly-reports.service.ts` | Period, draft, submit, list helpers | ✓ VERIFIED | All exports wired to routes |
| `lib/services/errors.ts` | SubmitValidationError | ✓ VERIFIED | fields[] array |
| `lib/api-errors.ts` | 400 fields mapping | ✓ VERIFIED | instanceof branch before 500 |
| `app/api/weekly-periods/route.ts` | CPMO GET/POST | ✓ VERIFIED | withCpmo |
| `app/api/weekly-periods/config/route.ts` | Config GET/PUT | ✓ VERIFIED | withCpmo |
| `app/api/projects/[id]/weekly-reports/**` | History, draft, submit, correct | ✓ VERIFIED | withProjectAccess / write gates |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `lib/db.ts` | `lib/db-weekly-reports.ts` | getDb → migrateWeeklyReports | ✓ WIRED | After migrateRaidMasters |
| `app/api/weekly-periods/route.ts` | `weekly-reports.service.ts` | POST → createWeeklyPeriod | ✓ WIRED | Pattern verified |
| `weekly-reports.service.ts` | `weekly-periods.repo.ts` | createPeriodWithShells transaction | ✓ WIRED | Single PoolClient transaction |
| `[reportId]/route.ts` | `weekly-reports.service.ts` | PATCH → saveWeeklyReportDraft | ✓ WIRED | 409 on locked submit |
| `submit/route.ts` | `weekly-reports.service.ts` | POST → submitWeeklyReport | ✓ WIRED | RAID writes in submit only |
| `weekly-reports.service.ts` | `risks.service.ts` / `issues.service.ts` | submit → create/update | ✓ WIRED | No deactivate from submit path |
| `weekly-reports.service.ts` | `projects.repo.ts` | READ progress_pct; UPDATE rag only | ✓ WIRED | No progress_pct in updateProject |
| `lib/api-errors.ts` | `SubmitValidationError` | serviceErrorResponse 400 | ✓ WIRED | fields array in body |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `createPeriodWithShells` | period + shells | company config + obligated projects query | ✓ | ✓ FLOWING |
| `ensurePrevWeekRag` | prev_week_rag | prior version snapshot or projects.rag | ✓ | ✓ FLOWING |
| `submitWeeklyReport` snapshot.raid | locked risks/issues | getRisk/getIssue after service writes | ✓ | ✓ FLOWING |
| `submitWeeklyReport` snapshot.milestones | milestone row | getMilestone at validation | ✓ | ✓ FLOWING |
| `submitWeeklyReport` progress_pct | version column + snapshot | getProject.progress_pct read-only | ✓ | ✓ FLOWING |
| `listProjectWeeklyHistory` | history rows | JOIN periods + latest version | ✓ | ✓ FLOWING |
| `listPeriodShells` | shell rows | period-scoped JOIN with latest RAG | ✓ | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 13 test suite (86 tests) | `npx vitest run lib/db-weekly-reports.ddl.unit.test.ts lib/iso-week.unit.test.ts lib/services/weekly-reports.service.unit.test.ts lib/services/errors.unit.test.ts lib/api-errors.test.ts lib/repositories/weekly-periods.repo.test.ts lib/repositories/weekly-reports.repo.test.ts app/api/weekly-periods/*.test.ts app/api/projects/[id]/weekly-reports/**/*.test.ts` with `TEST_DATABASE_URL` | 12 files passed, 86 passed, 5 skipped | ✓ PASS |
| DDL four CREATE TABLE statements | `lib/db-weekly-reports.ddl.unit.test.ts` | Passed | ✓ PASS |
| SubmitValidationError 400 fields | `lib/api-errors.test.ts` | Passed | ✓ PASS |
| Invalid RAID skips createRisk | `lib/services/weekly-reports.service.unit.test.ts` | Passed | ✓ PASS |
| progress_pct copy without write-back | `lib/services/weekly-reports.service.unit.test.ts` | Passed | ✓ PASS |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `weekly-reports.service.unit.test.ts` | WKRP-02..06, RAID-03, PERD-03 | Yes | 0 | No | Behavioral | PASS |
| `weekly-periods.repo.test.ts` | PERD-01..02, WKRP-01 | Yes | 0 | No | Value/behavioral | PASS |
| `weekly-reports.repo.test.ts` | WKRP-01, D-08 | Yes | 0 | No | Value/behavioral | PASS |
| `db-weekly-reports.ddl.unit.test.ts` | D-14 | Yes | 0 | No | Value | PASS |
| `route.access.test.ts` | D-13 | Yes | 0 | No | Behavioral | PASS |
| `submit/route.test.ts` | RAID-03 | Yes | 0 | No | Behavioral | PASS |

**Disabled tests on requirements:** 0  
**Circular patterns detected:** 0  
**Insufficient assertions:** 0

### Decision Coverage

All 18 trackable CONTEXT.md decisions (D-01..D-18) honored by shipped artifacts.

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01 Parallel surface | ✓ | New tables/routes; no documents coupling |
| D-02 weekly_periods schema | ✓ | DDL + iso_week unique |
| D-03 config snapshot | ✓ | config_snapshot at create; config PUT isolated |
| D-04 Obligation rules | ✓ | listObligatedProjectIds + transactional shells |
| D-05 Overdue computed | ✓ | isWeeklyReportOverdue |
| D-06 Draft fields | ✓ | DRAFT_ALLOWLIST |
| D-07 prev_week_rag | ✓ | ensurePrevWeekRag |
| D-08 Versioning | ✓ | INSERT-only versions; frozen first_* |
| D-09 History | ✓ | listProjectWeeklyHistoryRepo |
| D-10 progress/RAG | ✓ | copy-at-submit; rag-only update |
| D-11 RAID master | ✓ | validate-then-write on submit |
| D-12 Milestone snapshot | ✓ | copyMilestoneSnapshot |
| D-13 Authz | ✓ | withCpmo / assertProjectWriteAccess |
| D-14 Schema migration | ✓ | migrateWeeklyReports in getDb |
| D-15 Routes | ✓ | /api/weekly-periods + /weekly-reports |
| D-16 ui_phase false | ✓ | Server tests gate; no tracking grid |
| D-17 No DELETE | ✓ | No production DELETE SQL |
| D-18 Phase 14/16 helpers | ✓ | listPeriodShells + listProjectWeeklyHistory |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PERD-01 | 13-01 | CPMO configure periods with display name, due, shells | ✓ SATISFIED | createPeriodWithShells + CPMO routes |
| PERD-02 | 13-01 | Period stores config snapshot; later edits don't alter periods | ✓ SATISFIED | config_snapshot JSON at insert; config PUT isolated |
| PERD-03 | 13-01, 13-02 | Computed overdue; late submit allowed | ✓ SATISFIED | isWeeklyReportOverdue + submit after due |
| WKRP-01 | 13-01 | One obligation per project per period when obligated | ✓ SATISFIED | UNIQUE index + obligation query |
| WKRP-02 | 13-02 | PM draft structured fields | ✓ SATISFIED | saveWeeklyReportDraft allowlist |
| WKRP-03 | 13-02, 13-03 | prev RAG read-only; this-week RAG syncs on submit | ✓ SATISFIED | ensurePrevWeekRag + updateProject rag |
| WKRP-04 | 13-02 | First-submit timestamp and lateness immutable | ✓ SATISFIED | finalizeWeeklyReportSubmit first branch |
| WKRP-05 | 13-02 | Submitted immutable; correction = new version | ✓ SATISFIED | version INSERT + correction flow |
| WKRP-06 | 13-02 | History one row per period newest first | ✓ SATISFIED | listProjectWeeklyHistoryRepo ORDER BY |
| MS-04 | 13-03 | Milestone snapshot on submit | ✓ SATISFIED | snapshot.milestones locked copy |
| RAID-02 | 13-03 | Register is master; snapshots reference masters | ✓ SATISFIED | draft JSON until submit; snapshot.raid locked |
| RAID-03 | 13-03 | Draft RAID until submit validates/writes or rejects | ✓ SATISFIED | validateSubmitDraft + SubmitValidationError |

No orphaned requirements for Phase 13. REQUIREMENTS.md checkboxes for PERD-01..03, WKRP-01..06, MS-04, RAID-02, RAID-03 were already marked complete and match verified implementation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No TBD/FIXME/XXX, stubs, v1 report coupling, progress_pct write-back, or production DELETE paths in phase artifacts |

### Human Verification

N/A — Backend/API phase (`workflow.ui_phase` false). All acceptance criteria verified programmatically via unit, repo integration, and route tests (86/86 passed). CPMO tracking UI deferred to Phase 14; dashboard rendering deferred to Phase 16.

### Gaps Summary

No gaps found. Phase 13 delivers the weekly-period spine and PM submit contract: parallel tables (not v1 activity reports), frozen period config snapshots, versioned immutable submit with RAID/milestone master writes only on submit, progress_pct copy-at-submit without write-back, and company-scoped list helpers for Phase 14/16.

---

_Verified: 2026-08-26T06:52:00Z_  
_Verifier: Claude (gsd-verifier)_
