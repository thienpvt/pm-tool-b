---
phase: 07-ui-decomposition
plan: 07
subsystem: ui
tags: [react, nextjs, vitest, timeline, import-dialog, hook-extraction]

requires:
  - phase: 07-ui-decomposition
    provides: "07-03 timeline caller stability (ImportMappingDialog import path via TimelineDialogs)"
provides:
  - "Decomposed ImportMappingDialog at components/timeline/ with useImportMapping hook"
  - "Sub-400-line _components/ modules (UploadStep, MappingStep, ImportPreview, parsers)"
  - "ImportMappingDialog.component.test.tsx with render + mapping step advance"
affects: [07-ui-decomposition, 07-08]

actuals:
  tokens: 85000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "useImportMapping owns fetch-on-open; step/mapping/upload state stays in dialog container"
    - "importLogic.ts holds Jira/preview/upsert pure helpers to keep container thin"
    - "MappingStepPanels sub-split when MappingStep exceeded 400-line gate"

key-files:
  created:
    - components/timeline/useImportMapping.ts
    - components/timeline/types.ts
    - components/timeline/_components/ActivityFields.ts
    - components/timeline/_components/ValueNormalizers.ts
    - components/timeline/_components/CsvParser.ts
    - components/timeline/_components/importLogic.ts
    - components/timeline/_components/UploadStep.tsx
    - components/timeline/_components/MappingStep.tsx
    - components/timeline/_components/MappingStepPanels.tsx
    - components/timeline/_components/ImportPreview.tsx
    - components/timeline/ImportMappingDialog.component.test.tsx
  modified:
    - components/timeline/ImportMappingDialog.tsx

key-decisions:
  - "Dialog stays at components/timeline/ImportMappingDialog.tsx (shared domain, not route _components/)"
  - "importLogic.ts extracted for Jira epic/preview/upsert memos to keep container under 400 lines"
  - "MappingStepPanels split from MappingStep when first pass hit 416 lines"

patterns-established:
  - "Import dialog mirrors route decomposition: hook for fetch-on-open, _components/ for step UI, container for wizard state"
  - "UI-09 grep clean on components/timeline/**"

requirements-completed: [UI-01, UI-07, UI-09, UI-10, UI-11, HYG-01, HYG-02, HYG-03]

coverage:
  - id: D1
    description: "ImportMappingDialog decomposed in shared timeline folder; all files under 400 lines"
    requirement: UI-07
    verification:
      - kind: other
        ref: "node line-count gate (all components/timeline/** < 400)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dialog renders with mocked import-mapping and activities/import fetch"
    requirement: UI-10
    verification:
      - kind: unit
        ref: "components/timeline/ImportMappingDialog.component.test.tsx#renders dialog open with mocked import-mapping and activities/import fetch"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mapping step advance via paste text through preview step"
    requirement: UI-11
    verification:
      - kind: unit
        ref: "components/timeline/ImportMappingDialog.component.test.tsx#advances mapping step via paste text without error"
        status: pass
    human_judgment: false
  - id: D4
    description: "No server-layer imports in components/timeline client tree"
    requirement: UI-09
    verification:
      - kind: other
        ref: "rg forbidden imports components/timeline/ (0 matches)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-25
status: complete
---

# Phase 7 Plan 7: ImportMappingDialog Decomposition Summary

**Shared ImportMappingDialog decomposed in place under components/timeline/ with useImportMapping hook, step modules, and mock-fetch component tests**

## Performance

- **Duration:** 45 min
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Split 1179-line ImportMappingDialog into hook + _components/ + thin 317-line container
- useImportMapping owns fetch-on-open for `/api/import-mapping` and `/api/projects/{id}/activities/import`
- UploadStep, MappingStep, ImportPreview step modules preserve 3-step wizard flow unchanged
- ImportMappingDialog.component.test.tsx passes render + mapping step advance tests

## Task Commits

1. **Task 1: Field normalizers, CSV parser, types, hook** - `0bc8bd5` (feat)
2. **Task 2: Mapping step UI + thin dialog container** - `0125a3d` (feat)
3. **Task 3: Dialog component test + UI-09** - `c066bd2` (test)

## Files Created/Modified

- `components/timeline/ImportMappingDialog.tsx` - Thin wizard container composing hook + step modules
- `components/timeline/useImportMapping.ts` - Fetch-on-open hook for saved mappings and existing Jira keys
- `components/timeline/_components/` - ActivityFields, ValueNormalizers, CsvParser, importLogic, UploadStep, MappingStep, ImportPreview
- `components/timeline/ImportMappingDialog.component.test.tsx` - jsdom tests with vi.stubGlobal fetch

## Decisions Made

- importLogic.ts holds Jira epic/preview/upsert/buildActivities pure functions to satisfy 400-line gate without moving UI state into hook
- MappingStepPanels.tsx extracted when MappingStep first pass was 416 lines

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split MappingStep into MappingStepPanels**
- **Found during:** Task 2 (400-line verification)
- **Issue:** MappingStep.tsx was 416 lines after first extraction
- **Fix:** Moved TimelineFieldsPanel, FieldMappingRow, StatusValueMapping to MappingStepPanels.tsx
- **Files modified:** components/timeline/_components/MappingStep.tsx, MappingStepPanels.tsx
- **Committed in:** 0125a3d

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for UI-01 400-line gate; no behavior change.

## Issues Encountered

None

## Next Phase Readiness

- UI-07 complete; ImportMappingDialog ready for 07-08 cross-page verification gate
- Caller import path unchanged: `@/components/timeline/ImportMappingDialog` via TimelineDialogs

## Self-Check: PASSED

- components/timeline/ImportMappingDialog.component.test.tsx: FOUND
- components/timeline/useImportMapping.ts: FOUND
- Commits 0bc8bd5, 0125a3d, c066bd2: FOUND

---
*Phase: 07-ui-decomposition*
*Completed: 2026-08-25*
