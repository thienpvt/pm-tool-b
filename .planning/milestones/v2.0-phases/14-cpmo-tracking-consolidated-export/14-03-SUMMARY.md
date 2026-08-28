---
phase: 14-cpmo-tracking-consolidated-export
plan: 03
subsystem: api
tags: [exceljs, docx, pptxgenjs, vitest, cpmo, export, weekly-reports]

requires:
  - phase: 14-01
    provides: weekly_export_logs DDL and tracking foundation
  - phase: 14-02
    provides: assertExportEligible and assembleSnapshotSections
provides:
  - Payload-driven xlsx/docx/pptx consolidated pack generators
  - insertWeeklyExportLog append-only repository
  - exportConsolidatedWeekly orchestration with auditLog weekly_export
  - POST /api/weekly-periods/[periodId]/export binary route
affects: [phase-16-dashboards, phase-18-audit]

actuals:
  tokens: 18500
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Snapshot-only generators: ConsolidatedWeeklyPayload in, Buffer out — no repository imports"
    - "Generate Buffer before insertWeeklyExportLog so generator failures leave no log row"
    - "Dual append-only record: weekly_export_logs + auditLog action weekly_export"

key-files:
  created:
    - lib/export/consolidated-weekly.ts
    - lib/export/consolidated-weekly.unit.test.ts
    - lib/repositories/weekly-export.repo.ts
    - lib/repositories/weekly-export.repo.test.ts
    - app/api/weekly-periods/[periodId]/export/route.ts
    - app/api/weekly-periods/[periodId]/export/schema.ts
    - app/api/weekly-periods/[periodId]/export/route.test.ts
  modified:
    - lib/services/weekly-tracking.service.ts
    - lib/services/weekly-tracking.service.unit.test.ts

key-decisions:
  - "Generators accept ConsolidatedWeeklyPayload only — no live RAID or project-id export entry points (D-01, D-07)"
  - "data_version = max latest_version among included shells at export time (D-09)"
  - "Concurrent exports append additional weekly_export_logs rows — no unique constraint (D-14)"

patterns-established:
  - "Excel sheet names sanitized to 31 chars with collision uniquification from project_code"
  - "Content-Type map and sanitizeConsolidatedFilename shared from consolidated-weekly module"

requirements-completed: [CPMO-03, CPMO-04]

coverage:
  - id: D1
    description: "xlsx/docx/pptx generators produce Buffer from snapshot payload with D-08 field labels"
    requirement: CPMO-03
    verification:
      - kind: unit
        ref: "lib/export/consolidated-weekly.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "exportConsolidatedWeekly writes weekly_export_logs and auditLog weekly_export after successful Buffer"
    requirement: CPMO-04
    verification:
      - kind: unit
        ref: "lib/services/weekly-tracking.service.unit.test.ts#exportConsolidatedWeekly"
        status: pass
      - kind: integration
        ref: "lib/repositories/weekly-export.repo.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "POST export returns binary attachment with format Content-Type; PM/Viewer 403"
    requirement: CPMO-03
    verification:
      - kind: unit
        ref: "app/api/weekly-periods/[periodId]/export/route.test.ts"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-26
status: complete
---

# Phase 14 Plan 03: Consolidated Export Pack Summary

**Snapshot-driven xlsx/docx/pptx consolidated packs with append-only weekly_export_logs and auditLog weekly_export on POST export**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-26T00:23:57Z
- **Completed:** 2026-08-26T00:26:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `generateConsolidatedWeekly(payload, format)` dispatches xlsx (Portfolio Summary + per-project sheets), docx, and pptx generators using only snapshot payload — no repository imports
- `exportConsolidatedWeekly` reuses 14-02 eligibility and assembly; computes max `data_version`; generates Buffer before logging
- `insertWeeklyExportLog` append-only INSERT with `project_ids` JSONB; concurrent exports allowed
- `POST /api/weekly-periods/[periodId]/export` returns binary attachment with correct Content-Type and Content-Disposition; CPMO-only via `withCpmo`

## Task Commits

1. **Task 1 RED: Snapshot payload generators** - `c5a7542` (test)
2. **Task 1 GREEN: xlsx/docx/pptx packs** - `28785f8` (feat)
3. **Task 2 RED: Export log and POST** - `48eeeb5` (test)
4. **Task 2 GREEN: weekly export logs and POST pack** - `96de694` (feat)

## TDD Gate Compliance

- RED `test(14-03)` commit present before GREEN `feat(14-03)` for both tasks
- All automated verifications exit 0 (42 tests across wave)

## Files Created/Modified

- `lib/export/consolidated-weekly.ts` - Payload-only xlsx/docx/pptx generators and format dispatcher
- `lib/export/consolidated-weekly.unit.test.ts` - Buffer, sheet names, D-08 label, and no-repo-import tests
- `lib/repositories/weekly-export.repo.ts` - `insertWeeklyExportLog` append-only INSERT
- `lib/repositories/weekly-export.repo.test.ts` - skipIf DB test for project_ids JSON round-trip
- `lib/services/weekly-tracking.service.ts` - `exportConsolidatedWeekly` orchestration
- `lib/services/weekly-tracking.service.unit.test.ts` - log/audit ordering, data_version max, ineligible skip
- `app/api/weekly-periods/[periodId]/export/route.ts` - POST binary pack route
- `app/api/weekly-periods/[periodId]/export/schema.ts` - Zod schema for project_ids + format
- `app/api/weekly-periods/[periodId]/export/route.test.ts` - 403/200 Content-Type route tests

## Decisions Made

- Copied Excel header/style helpers inline in consolidated-weekly.ts rather than exporting from excel.ts — avoids coupling to project-id generator module
- Generator failure before log insert verified in service unit test — no partial export records on pack errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced nonexistent seedUser in repo test with inline user INSERT**
- **Found during:** Task 2 GREEN (repo test compile)
- **Issue:** `@/test/repo-db` has no `seedUser` export
- **Fix:** Insert user via pool query in `weekly-export.repo.test.ts`
- **Files modified:** `lib/repositories/weekly-export.repo.test.ts`
- **Committed in:** `96de694`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test harness fix only; no behavior change.

## Issues Encountered

None beyond the repo test helper fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CPMO consolidated export API complete for xlsx/docx/pptx
- Phase 16 dashboards may consume tracking counts; export is ready for UAT verification

## Self-Check: PASSED

- FOUND: lib/export/consolidated-weekly.ts
- FOUND: lib/repositories/weekly-export.repo.ts
- FOUND: app/api/weekly-periods/[periodId]/export/route.ts
- FOUND: .planning/phases/14-cpmo-tracking-consolidated-export/14-03-SUMMARY.md
- FOUND: c5a7542, 28785f8, 48eeeb5, 96de694

---
*Phase: 14-cpmo-tracking-consolidated-export*
*Completed: 2026-08-26*
