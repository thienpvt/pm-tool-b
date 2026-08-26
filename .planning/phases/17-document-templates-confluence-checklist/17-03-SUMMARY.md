---
phase: 17-document-templates-confluence-checklist
plan: 03
subsystem: api
tags: [document-compliance, mandatory-incomplete, checklist-generation, vitest, tdd]

requires:
  - phase: 17-01
    provides: generateProjectChecklist, listChecklistByProject catalog join
provides:
  - MandatoryIncompleteError structured 409 for stage-change warnings
  - projectComplianceStatus rollup helper
  - createProject and updateProject checklist generate hooks with stage guard
  - GET /api/dashboards/document-compliance CPMO endpoint with filters
affects: [17-02, phase-18-audit]

actuals:
  tokens: 72000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "MandatoryIncompleteError before ConflictError in serviceErrorResponse"
    - "Stage guard uses catalog.stage === current.stage only (not destination)"
    - "parseComplianceFilters allowlist stage/status/rag/program reusing applyDashboardFilters"

key-files:
  created:
    - lib/documents/compliance.ts
    - lib/documents/compliance.unit.test.ts
    - lib/services/document-compliance.service.ts
    - lib/services/document-compliance.service.unit.test.ts
    - app/api/dashboards/document-compliance/route.ts
    - app/api/dashboards/document-compliance/route.test.ts
  modified:
    - lib/services/errors.ts
    - lib/api-errors.ts
    - lib/api-errors.test.ts
    - lib/services/projects.service.ts
    - lib/services/projects.service.unit.test.ts

key-decisions:
  - "Stage guard checks mandatory items for current stage only; ALL-stage catalog rows excluded"
  - "acknowledge_incomplete_mandatory peeled before applyProjectGovernance and never reaches PROJECT_COLUMNS"
  - "Compliance filters limited to stage/status/rag/program with program coerced to number when all digits"

patterns-established:
  - "Structured 409 { code, items } for mandatory_incomplete distinct from ConflictError { error }"
  - "generateProjectChecklist called after repo write on create and successful stage update"

requirements-completed: [DOC-02, DOC-05, DOC-06]

coverage:
  - id: D1
    description: "MandatoryIncompleteError maps to 409 { code: mandatory_incomplete, items }"
    requirement: DOC-06
    verification:
      - kind: unit
        ref: "lib/api-errors.test.ts#maps MandatoryIncompleteError to 409 with code and items"
        status: pass
    human_judgment: false
  - id: D2
    description: "projectComplianceStatus rollup (compliant / not_compliant / not_applicable)"
    requirement: DOC-05
    verification:
      - kind: unit
        ref: "lib/documents/compliance.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "createProject generates checklist rows; stage change guard with ack override"
    requirement: DOC-02
    verification:
      - kind: unit
        ref: "lib/services/projects.service.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "CPMO GET /api/dashboards/document-compliance with auth matrix and filters"
    requirement: DOC-06
    verification:
      - kind: unit
        ref: "app/api/dashboards/document-compliance/route.test.ts"
        status: pass
      - kind: unit
        ref: "lib/services/document-compliance.service.unit.test.ts"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-26
status: complete
---

# Phase 17 Plan 03: Checklist Hooks & Compliance Dashboard Summary

**Checklist generation on create/stage change, structured 409 mandatory-incomplete warnings, and CPMO document-compliance GET with dashboard filters**

## Performance

- **Duration:** 15 min
- **Tasks:** 3
- **Files modified:** 11
- **Tests:** 63 passing (full wave)

## Accomplishments

- Added `MandatoryIncompleteError` and mapped it to HTTP 409 `{ code, items }` before `ConflictError`
- Implemented `projectComplianceStatus` pure rollup for mandatory checklist items only
- Hooked `generateProjectChecklist` on `createProject` success and after successful stage PATCH
- Stage guard blocks when current-stage mandatory items are incomplete unless `acknowledge_incomplete_mandatory: true`; ack triggers `auditLog` `stage_change_ack`
- Exposed `GET /api/dashboards/document-compliance` via `withCpmo` + `assertCompanyWrite` with stage/status/rag/program filters

## Task Commits

1. **Task 1 RED** - `91c4467` (test)
2. **Task 1 GREEN** - `d2cbbb8` (feat)
3. **Task 2 RED** - `63b5623` (test)
4. **Task 2 GREEN** - `a212679` (feat)
5. **Task 3 RED** - `7fb9ed8` (test)
6. **Task 3 GREEN** - `4b7e3eb` (feat)

## Files Created/Modified

- `lib/services/errors.ts` - `MandatoryIncompleteError` class
- `lib/api-errors.ts` - 409 mapper before ConflictError branch
- `lib/documents/compliance.ts` - `projectComplianceStatus` rollup
- `lib/services/projects.service.ts` - generate hooks + stage guard + ack audit
- `lib/services/document-compliance.service.ts` - `getDocumentCompliance` with filter allowlist
- `app/api/dashboards/document-compliance/route.ts` - CPMO GET endpoint

## Decisions Made

- Stage guard uses `catalog.stage === current.stage` only; destination-stage incomplete rows do not block
- `acknowledge_incomplete_mandatory` stripped before governance/repo write
- Compliance reuses `applyDashboardFilters` with a four-key allowlist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 17-02 can wire checklist PATCH without conflicting on `projects.service.ts`
- CPMO compliance API ready for optional UI in a future phase

## Self-Check: PASSED

- lib/documents/compliance.ts: FOUND
- lib/services/document-compliance.service.ts: FOUND
- app/api/dashboards/document-compliance/route.ts: FOUND
- Commits 91c4467, d2cbbb8, 63b5623, a212679, 7fb9ed8, 4b7e3eb: FOUND

---
*Phase: 17-document-templates-confluence-checklist*
*Completed: 2026-08-26*
