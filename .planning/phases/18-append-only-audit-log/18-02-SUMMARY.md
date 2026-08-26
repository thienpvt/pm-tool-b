---
phase: 18-append-only-audit-log
plan: 02
subsystem: api
tags: [audit, raid, risks, issues, vitest, tdd]

requires:
  - phase: 18-01
    provides: auditLog INSERT path and GET /api/audit company-scoped read
provides:
  - createRisk/createIssue auditLog action create with after snapshot
  - updateRisk/updateIssue auditLog action update with before/after snapshots
  - due_date_change and deactivate audits preserved unchanged
affects: [18-03, audit-coverage, AUDIT-01]

actuals:
  tokens: 3200
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "auditSnapshot local helper on RAID services (id, code, description, status, priority, due_date, owner)"
    - "updateRisk/updateIssue always load prior row; branch due_date_change vs update by field keys"

key-files:
  created: []
  modified:
    - lib/services/risks.service.ts
    - lib/services/risks.service.unit.test.ts
    - lib/services/issues.service.ts
    - lib/services/issues.service.unit.test.ts

key-decisions:
  - "entity_type remains risk and issue separately — no unified raid string (D-02 discretion locked)"
  - "due_date-only updates emit due_date_change only; non-due_date keys emit action update"

patterns-established:
  - "RAID create/update audit mirrors pm-assignments auditSnapshot + auditLog after successful repo write"

requirements-completed: [AUDIT-01]

coverage:
  - id: D1
    description: "createRisk appends auditLog action create with after snapshot"
    requirement: AUDIT-01
    verification:
      - kind: unit
        ref: "lib/services/risks.service.unit.test.ts#calls auditLog action create after successful insert"
        status: pass
    human_judgment: false
  - id: D2
    description: "updateRisk general field changes append auditLog action update; due_date-only stays due_date_change only"
    requirement: AUDIT-01
    verification:
      - kind: unit
        ref: "lib/services/risks.service.unit.test.ts#calls auditLog action update for status-only field changes"
        status: pass
      - kind: unit
        ref: "lib/services/risks.service.unit.test.ts#appends due-date history and auditLog when due_date changes"
        status: pass
    human_judgment: false
  - id: D3
    description: "createIssue and updateIssue mirror risk with entity_type issue"
    requirement: AUDIT-01
    verification:
      - kind: unit
        ref: "lib/services/issues.service.unit.test.ts#calls auditLog action create after successful insert"
        status: pass
      - kind: unit
        ref: "lib/services/issues.service.unit.test.ts#calls auditLog action update for status-only field changes"
        status: pass
    human_judgment: false
  - id: D4
    description: "ConflictError and ForbiddenError paths do not call auditLog"
    requirement: AUDIT-01
    verification:
      - kind: unit
        ref: "lib/services/risks.service.unit.test.ts#throws ConflictError when code duplicates"
        status: pass
      - kind: unit
        ref: "lib/services/issues.service.unit.test.ts#throws ConflictError when code duplicates"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-26
status: complete
---

# Phase 18 Plan 02: RAID Create/Update Audit Summary

**createRisk/createIssue and general updateRisk/updateIssue append actor/time/entity/before-after via auditLog; entity_type stays risk and issue (D-02 RAID half closed)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-26T15:36:59Z
- **Completed:** 2026-08-26T15:38:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `auditSnapshot` helper and `auditLog` on successful `createRisk`/`createIssue` (action `create`, before null)
- `updateRisk`/`updateIssue` always load prior row; emit `update` when non-due_date fields present; preserve `due_date_change` and `deactivate` paths
- Unit tests cover create audit, conflict/forbidden no-audit, status-only update, and due_date-only (no duplicate update row)

## Task Commits

Each task was committed atomically:

1. **Task 18-02-01: Audit createRisk and general updateRisk** — `9f9b1b5` (test RED), `43cedcf` (feat GREEN)
2. **Task 18-02-02: Audit createIssue and general updateIssue** — `88c81a1` (test RED), `7ee301a` (feat GREEN)

## Files Created/Modified

- `lib/services/risks.service.ts` — auditSnapshot, create/update auditLog branching
- `lib/services/risks.service.unit.test.ts` — RED/GREEN coverage for create, update, conflict, forbidden
- `lib/services/issues.service.ts` — mirrored risk audit pattern with entity_type issue
- `lib/services/issues.service.unit.test.ts` — mirrored risk test cases

## Decisions Made

- Kept separate `entity_type` values `risk` and `issue` per planner lock (no unified `raid`)
- `getRiskRepo`/`getIssueRepo` always called on update (prior required for snapshots and due_date compare)

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED commits: `9f9b1b5`, `88c81a1`
- GREEN commits: `43cedcf`, `7ee301a`
- All gated tests pass (37/37)

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RAID D-02 gaps for create/general update are closed
- Ready for 18-03 (project/milestone/checklist audit gaps)

## Self-Check: PASSED

- FOUND: `.planning/phases/18-append-only-audit-log/18-02-SUMMARY.md`
- FOUND: `9f9b1b5`, `43cedcf`, `88c81a1`, `7ee301a`
- FOUND: `lib/services/risks.service.ts`, `lib/services/issues.service.ts`

---
*Phase: 18-append-only-audit-log*
*Completed: 2026-08-26*
