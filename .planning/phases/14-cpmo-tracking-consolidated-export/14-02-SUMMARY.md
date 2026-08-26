---
phase: 14-cpmo-tracking-consolidated-export
plan: 02
subsystem: api
tags: [cpmo, weekly-reports, export, snapshot, vitest, tdd]

requires:
  - phase: 14-01
    provides: getPeriodTracking, listPeriodShellsRepo company-scoped, weekly_export_logs DDL
provides:
  - previewConsolidatedExport with assertExportEligible and assembleSnapshotSections
  - POST /api/weekly-periods/[periodId]/export/preview with Zod project_ids min(1)
affects: [14-03 consolidated export pack generation]

actuals:
  tokens: 14000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Snapshot-only preview sections via getLatestVersionSnapshot; no live RAID for export content"
    - "SubmitValidationError fields[] for ineligible project_ids at export boundary"

key-files:
  created:
    - app/api/weekly-periods/[periodId]/export/preview/route.ts
    - app/api/weekly-periods/[periodId]/export/preview/schema.ts
    - app/api/weekly-periods/[periodId]/export/preview/route.test.ts
  modified:
    - lib/services/weekly-tracking.service.ts
    - lib/services/weekly-tracking.service.unit.test.ts

key-decisions:
  - "Export preview eligibility reuses SubmitValidationError with stringified project_ids in fields"
  - "assembleSnapshotSections exported for 14-03; preserves full raid.risks/issues and filtered tech_issues arrays"

patterns-established:
  - "Caller-order sections from project_ids array without persisted rank table (D-06)"
  - "Tech-issue counts from snapshot.raid.issues where technology_council === true only (D-02)"

requirements-completed: [CPMO-03]

coverage:
  - id: D1
    description: "POST export/preview returns caller-ordered section summaries from submitted snapshots"
    requirement: CPMO-03
    verification:
      - kind: unit
        ref: "lib/services/weekly-tracking.service.unit.test.ts#returns sections in caller project_ids order"
        status: pass
      - kind: unit
        ref: "app/api/weekly-periods/[periodId]/export/preview/route.test.ts#returns 200 with preview payload for cpmo"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ineligible project_ids throw SubmitValidationError mapped to 400 { error, fields }"
    requirement: CPMO-03
    verification:
      - kind: unit
        ref: "lib/services/weekly-tracking.service.unit.test.ts#assertExportEligible"
        status: pass
    human_judgment: false
  - id: D3
    description: "PM/Viewer receive 403; empty project_ids rejected by Zod at route boundary"
    requirement: CPMO-03
    verification:
      - kind: unit
        ref: "app/api/weekly-periods/[periodId]/export/preview/route.test.ts#returns 403 for pm session"
        status: pass
      - kind: unit
        ref: "app/api/weekly-periods/[periodId]/export/preview/route.test.ts#returns 400 for empty project_ids"
        status: pass
    human_judgment: false
  - id: D4
    description: "Section bodies assembled from snapshot keys only; tech counts from snapshot flags"
    requirement: CPMO-03
    verification:
      - kind: unit
        ref: "lib/services/weekly-tracking.service.unit.test.ts#assembleSnapshotSections"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-26
status: complete
---

# Phase 14 Plan 02: Export Preview Eligibility & Snapshot Sections Summary

**CPMO POST export/preview with caller-ordered snapshot sections, SubmitValidationError eligibility gate, and assembleSnapshotSections exported for 14-03**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-26T00:20:00Z
- **Completed:** 2026-08-26T00:28:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `assertExportEligible` rejects draft, not_submitted, version-0, and foreign project_ids via `SubmitValidationError`
- `previewConsolidatedExport` gates on `assertCompanyWrite`, company period lookup, and snapshot-only section assembly
- `assembleSnapshotSections` maps D-08 summary fields, RAID counts, full raid arrays, and tech-issue subsets for 14-03 reuse
- POST `/api/weekly-periods/[periodId]/export/preview` with `withCpmo`, Zod `project_ids` min(1), and route tests for 401/403/400/200

## Task Commits

1. **Task 14-02-01 RED: Preview eligibility tests** - `faba96b` (test)
2. **Task 14-02-01 GREEN: Preview eligibility gate** - `c23423e` (feat)
3. **Task 14-02-02 RED: Snapshot assembly tests** - `961b00e` (test)
4. **Task 14-02-02 GREEN: Snapshot preview sections** - `97f6a79` (feat)

## TDD Gate Compliance

- RED/GREEN commits present for both tasks in order
- Final verification: `npx vitest run lib/services/weekly-tracking.service.unit.test.ts "app/api/weekly-periods/[periodId]/export/preview/route.test.ts"` — 25 passed

## Files Created/Modified

- `lib/services/weekly-tracking.service.ts` - assertExportEligible, assembleSnapshotSections, previewConsolidatedExport
- `lib/services/weekly-tracking.service.unit.test.ts` - eligibility and snapshot assembly unit tests
- `app/api/weekly-periods/[periodId]/export/preview/route.ts` - CPMO POST preview handler
- `app/api/weekly-periods/[periodId]/export/preview/schema.ts` - periodExportPreviewSchema
- `app/api/weekly-periods/[periodId]/export/preview/route.test.ts` - auth, Zod, and success route tests

## Decisions Made

- Reused existing `SubmitValidationError('Projects not eligible for export', ids)` — no parallel 400 type
- Exported `assembleSnapshotSections` with full `raid.risks`, `raid.issues`, and `tech_issues` arrays for 14-03 pack rendering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 14-03 can call `previewConsolidatedExport` / `assembleSnapshotSections` for xlsx/docx/pptx generation and `weekly_export_logs` INSERT
- No binary generators or export logs added in this plan (by design)

---
*Phase: 14-cpmo-tracking-consolidated-export*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: `.planning/phases/14-cpmo-tracking-consolidated-export/14-02-SUMMARY.md`
- FOUND commits: `faba96b`, `c23423e`, `961b00e`, `97f6a79`
- Vitest: 25 passed (2 files)
