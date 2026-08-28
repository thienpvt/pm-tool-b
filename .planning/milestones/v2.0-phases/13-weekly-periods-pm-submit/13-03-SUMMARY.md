---
phase: 13-weekly-periods-pm-submit
plan: 03
subsystem: api
tags: [weekly-reports, raid, milestones, submit, vitest, tdd]

requires:
  - phase: 13-weekly-periods-pm-submit
    provides: "13-02 draft/submit versioning shell and version INSERT"
provides:
  - SubmitValidationError with multi-field 400 mapping
  - submitWeeklyReport RAID writes, locked snapshots, progress copy, RAG sync
  - listPeriodShells company-scoped helper for Phase 14
  - listProjectWeeklyHistory export preserved for Phase 16
  - Access matrix tests for Viewer/PM/CPMO weekly-report routes
affects: [14-cpmo-tracking, 16-dashboards]

actuals:
  tokens: 10000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "SubmitValidationError fields[] separate from ValidationError.field"
    - "Submit validate-then-write RAID via risks/issues services; lock snapshot from getRisk/getIssue"
    - "progress_pct copy-at-submit; updateProject rag-only when this_week_rag differs"

key-files:
  created:
    - app/api/projects/[id]/weekly-reports/route.access.test.ts
  modified:
    - lib/services/errors.ts
    - lib/api-errors.ts
    - lib/services/weekly-reports.service.ts
    - lib/repositories/weekly-reports.repo.ts
    - lib/services/weekly-reports.service.unit.test.ts
    - lib/services/errors.unit.test.ts
    - lib/api-errors.test.ts
    - app/api/projects/[id]/weekly-reports/[reportId]/submit/route.test.ts

key-decisions:
  - "SubmitValidationError is a standalone Error class (not ValidationError subclass) for fields[] HTTP mapping"
  - "Milestone snapshot uses getMilestone result from pre-write validation pass (no re-fetch after RAID writes)"
  - "listPeriodShells scoped by company_id + period lookup; no tracking grid HTTP in Phase 13"

patterns-established:
  - "Pre-write validate draft_raid_json + nearest_milestone_id; abort with SubmitValidationError before any master/version writes"
  - "Locked RAID snapshot copies master rows after create/update; later master edits do not mutate stored snapshot"

requirements-completed: [MS-04, RAID-02, RAID-03, WKRP-03]

coverage:
  - id: D1
    description: "SubmitValidationError maps to HTTP 400 { error, fields }"
    requirement: RAID-03
    verification:
      - kind: unit
        ref: lib/api-errors.test.ts#maps SubmitValidationError to 400 with fields array
        status: pass
    human_judgment: false
  - id: D2
    description: "Submit validates RAID first; failed validation skips createRisk and version INSERT"
    requirement: RAID-03
    verification:
      - kind: unit
        ref: lib/services/weekly-reports.service.unit.test.ts#throws SubmitValidationError on invalid new RAID
        status: pass
    human_judgment: false
  - id: D3
    description: "Successful submit locks RAID and milestone copies in version snapshot"
    requirement: RAID-02
    verification:
      - kind: unit
        ref: lib/services/weekly-reports.service.unit.test.ts#createRisk and snapshot.raid.risks
        status: pass
    human_judgment: false
  - id: D4
    description: "progress_pct copied from project; rag synced only when this_week_rag differs"
    requirement: WKRP-03
    verification:
      - kind: unit
        ref: lib/services/weekly-reports.service.unit.test.ts#copies progress_pct and syncs rag only
        status: pass
    human_judgment: false
  - id: D5
    description: "listPeriodShells company-scoped; Viewer mutate 403; CPMO history GET 200"
    requirement: MS-04
    verification:
      - kind: unit
        ref: app/api/projects/[id]/weekly-reports/route.access.test.ts
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 13 Plan 03: Submit Snapshots & Access Summary

**Submit validates multi-field RAID, writes masters through existing services, locks RAID/milestone snapshots, copies progress_pct without write-back, and syncs RAG only when changed — plus company-scoped listPeriodShells and access tests.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-26T06:48:00Z
- **Completed:** 2026-08-26T06:50:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added `SubmitValidationError` with `fields: string[]` mapped globally in `serviceErrorResponse` to 400 `{ error, fields }`
- Extended `submitWeeklyReport` with validate-then-write RAID flow, locked snapshot assembly, milestone copy, progress_pct copy, and rag-only project update
- Exported `listPeriodShells(companyId, periodId, actor)` for Phase 14 tracking grid consumption
- Added route access matrix tests: Viewer 403 on mutate, PM without assignment 403, CPMO GET history 200

## Task Commits

1. **Task 1 RED + Task 2 RED:** `47a4182` (test)
2. **Task 1 GREEN + Task 2 GREEN:** `8a37f5f` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `lib/services/errors.ts` — `SubmitValidationError` class
- `lib/api-errors.ts` — 400 mapping for multi-field submit validation
- `lib/services/weekly-reports.service.ts` — submit side effects + `listPeriodShells`
- `lib/repositories/weekly-reports.repo.ts` — `getWeeklyPeriodByCompany`, `listPeriodShellsRepo`
- `app/api/projects/[id]/weekly-reports/route.access.test.ts` — D-13 access matrix

## Decisions Made

- Kept `ValidationError` single-field mapping unchanged; `SubmitValidationError` is a separate class per D-11
- Used repo-level `getRisk`/`getIssue` for pre-write validation and post-write snapshot locking (services for writes only)
- Milestone row loaded during validation pass is reused for snapshot (no second getMilestone after RAID writes)

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED commit `47a4182` precedes GREEN commit `8a37f5f` ✓
- All specified `<automated>` verify commands exit 0 (67 tests)

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 14 can import `listPeriodShells` for CPMO tracking grid
- Phase 16 can import `listProjectWeeklyHistory` (unchanged export)
- Submit contract complete: RAID/milestone snapshots, progress copy, RAG sync, multi-field validation

## Self-Check: PASSED

- FOUND: lib/services/errors.ts
- FOUND: lib/api-errors.ts
- FOUND: lib/services/weekly-reports.service.ts
- FOUND: lib/repositories/weekly-reports.repo.ts
- FOUND: app/api/projects/[id]/weekly-reports/route.access.test.ts
- FOUND: .planning/phases/13-weekly-periods-pm-submit/13-03-SUMMARY.md
- FOUND: 47a4182
- FOUND: 8a37f5f

---
*Phase: 13-weekly-periods-pm-submit*
*Completed: 2026-08-26*
