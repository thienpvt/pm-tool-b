---
phase: 13-weekly-periods-pm-submit
plan: 02
subsystem: api
tags: [vitest, postgres, weekly-reports, versioning, tdd]

requires:
  - phase: 13-01
    provides: weekly_periods tables, shells, isWeeklyReportOverdue, CPMO period routes
provides:
  - PM draft PATCH with allowlisted fields and not_submitted→draft transition
  - Read-only prev_week_rag prefilled at draft-open
  - POST submit with immutable weekly_report_versions rows and frozen first_lateness
  - POST correct overlay and version N+1 submit without changing first_*
  - GET history one row per period newest iso_week first
affects: [13-03, 14-tracking-export, 16-dashboards]

actuals:
  tokens: 19400
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Draft columns on weekly_reports shell; INSERT-only weekly_report_versions"
    - "assertProjectWriteAccess on mutate; assertProjectAccess on read"
    - "Route tests mock hasActivePmAssignment not getProjectPmIdentity"

key-files:
  created:
    - app/api/projects/[id]/weekly-reports/route.ts
    - app/api/projects/[id]/weekly-reports/[reportId]/route.ts
    - app/api/projects/[id]/weekly-reports/[reportId]/schema.ts
    - app/api/projects/[id]/weekly-reports/[reportId]/submit/route.ts
    - app/api/projects/[id]/weekly-reports/[reportId]/correct/route.ts
  modified:
    - lib/repositories/weekly-reports.repo.ts
    - lib/services/weekly-reports.service.ts
    - lib/services/weekly-reports.service.unit.test.ts

key-decisions:
  - "Submit route uses rawBody:true because POST has no JSON body (withAuth otherwise returns 400)"
  - "Snapshot stores draft_raid_json as-is on shell; no risks/issues service calls until 13-03"

patterns-established:
  - "PATCH strips prev_week_rag; prefilled once via prior period submitted rag or projects.rag"
  - "ConflictError 409 when PATCH submitted shell with correction_open false"

requirements-completed: [PERD-03, WKRP-02, WKRP-03, WKRP-04, WKRP-05, WKRP-06]

coverage:
  - id: D1
    description: PM can PATCH allowlisted draft fields; first save moves not_submitted to draft
    requirement: WKRP-02
    verification:
      - kind: unit
        ref: lib/services/weekly-reports.service.unit.test.ts#saveWeeklyReportDraft
        status: pass
    human_judgment: false
  - id: D2
    description: prev_week_rag prefilled read-only; not writable via PATCH
    requirement: WKRP-03
    verification:
      - kind: unit
        ref: lib/services/weekly-reports.service.unit.test.ts#getWeeklyReportShell
        status: pass
    human_judgment: false
  - id: D3
    description: Submit creates immutable version row with frozen first_lateness; late submit allowed
    requirement: PERD-03
    verification:
      - kind: unit
        ref: lib/services/weekly-reports.service.unit.test.ts#submitWeeklyReport
        status: pass
    human_judgment: false
  - id: D4
    description: Correction opens overlay; resubmit increments version without changing first_*
    requirement: WKRP-04
    verification:
      - kind: unit
        ref: lib/services/weekly-reports.service.unit.test.ts#openWeeklyReportCorrection
        status: pass
    human_judgment: false
  - id: D5
    description: PATCH submitted without correction_open returns 409
    requirement: WKRP-05
    verification:
      - kind: unit
        ref: app/api/projects/[id]/weekly-reports/[reportId]/route.test.ts
        status: pass
    human_judgment: false
  - id: D6
    description: History list one row per period newest iso_week first with computed overdue
    requirement: WKRP-06
    verification:
      - kind: unit
        ref: app/api/projects/[id]/weekly-reports/route.test.ts
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 13 Plan 02: PM Draft Submit Versioning Summary

**Versioned weekly report draft/submit/correct API with read-only prev-week RAG, immutable first lateness, and newest-first history — no RAID master writes on PATCH**

## Performance

- **Duration:** 25min
- **Started:** 2026-08-25T23:44:00Z
- **Completed:** 2026-08-25T23:49:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- `saveWeeklyReportDraft` and GET/PATCH shell routes with Zod allowlist; draft_raid_json persisted on shell only (D-11)
- `getWeeklyReportShell` prefills `prev_week_rag` from prior submitted version or `projects.rag`
- `submitWeeklyReport` INSERT-only versions, frozen `first_submitted_at`/`first_lateness`, audit `weekly_submit`/`weekly_correct`
- `openWeeklyReportCorrection` copies latest snapshot into draft columns; POST `/correct` route
- `listProjectWeeklyHistory` with computed overdue; GET `/weekly-reports` route

## Task Commits

Each task was committed atomically:

1. **Task 1+2 RED: Tests** - `f6be9b1` (test)
2. **Task 1+2 GREEN: Implementation** - `90aaa2f` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `lib/repositories/weekly-reports.repo.ts` - allowlisted draft UPDATE, version INSERT, history join
- `lib/services/weekly-reports.service.ts` - draft/submit/correct/history service exports
- `app/api/projects/[id]/weekly-reports/` - GET history, GET/PATCH shell, POST submit/correct routes + tests

## Decisions Made

- Submit route uses `{ rawBody: true }` to avoid withAuth 400 on body-less POST
- Snapshot includes `draft_raid_json` as stored; 13-03 extends submit with RAID master writes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 13-03 can extend `submitWeeklyReport` with RAID/milestone master writes, progress_pct copy, and projects.rag sync
- History and shell routes ready for PM UI wiring when ui_phase enables

## Self-Check: PASSED

- FOUND: lib/services/weekly-reports.service.ts
- FOUND: app/api/projects/[id]/weekly-reports/route.ts
- FOUND: app/api/projects/[id]/weekly-reports/[reportId]/submit/route.ts
- FOUND: f6be9b1
- FOUND: 90aaa2f

---
*Phase: 13-weekly-periods-pm-submit*
*Completed: 2026-08-26*
