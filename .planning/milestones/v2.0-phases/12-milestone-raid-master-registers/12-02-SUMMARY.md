---
phase: 12-milestone-raid-master-registers
plan: 02
subsystem: api
tags: [raid, risks, issues, deactivate, conflict-error, audit]

requires:
  - phase: 12-01
    provides: migrateRaidMasters columns and unique indexes on LOWER(code)
provides:
  - Unique per-project R-nnn / I-nnn codes with ConflictError 409
  - deactivateRisk / deactivateIssue with auditLog action deactivate
  - HTTP DELETE maps to deactivate returning 200 { ok: true }
  - technology_council allowlisted on issues
affects: [12-03, 12-04, phase-16-dashboards]

actuals:
  tokens: 18000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "findByCode pre-check + SQLSTATE 23505 → ConflictError (holidays/projects mirror)"
    - "cancelMilestone-style deactivate with auditLog before/after status"

key-files:
  created: []
  modified:
    - lib/repositories/risks.repo.ts
    - lib/repositories/issues.repo.ts
    - lib/services/risks.service.ts
    - lib/services/issues.service.ts
    - app/api/projects/[id]/risks/route.ts
    - app/api/projects/[id]/issues/route.ts
    - lib/repositories/ALLOWLIST-DIFF.md

key-decisions:
  - "Auto-code uses R-/I- prefix with zero-padded 3 digits; risk_id/issue_id populated from code when omitted"
  - "Deactivated status string is 'deactivated' (not 'closed'); row remains with deactivated_at set"

patterns-established:
  - "RAID retire path: UPDATE status + deactivated_at, never DELETE FROM risks/issues"
  - "Service-layer duplicate code guard via findRiskByCode/findIssueByCode before repo write"

requirements-completed: [RAID-01]

coverage:
  - id: D1
    description: "PM/CPMO create and update risks with unique R-nnn codes; Viewer cannot mutate"
    requirement: RAID-01
    verification:
      - kind: unit
        ref: "lib/services/risks.service.unit.test.ts#createRisk write gate"
        status: pass
      - kind: unit
        ref: "lib/repositories/risks.repo.test.ts#auto-generates zero-padded R-nnn"
        status: pass
    human_judgment: false
  - id: D2
    description: "Duplicate risk code throws ConflictError (409 path)"
    requirement: RAID-01
    verification:
      - kind: unit
        ref: "lib/services/risks.service.unit.test.ts#throws ConflictError when code duplicates"
        status: pass
    human_judgment: false
  - id: D3
    description: "deactivateRisk sets status deactivated and auditLogs"
    requirement: RAID-01
    verification:
      - kind: unit
        ref: "lib/services/risks.service.unit.test.ts#deactivateRisk audit"
        status: pass
      - kind: unit
        ref: "lib/repositories/risks.repo.test.ts#deactivates in place"
        status: pass
    human_judgment: false
  - id: D4
    description: "Issues mirror with I-nnn codes and technology_council allowlist"
    requirement: RAID-01
    verification:
      - kind: unit
        ref: "lib/services/issues.service.unit.test.ts#technology_council"
        status: pass
      - kind: unit
        ref: "lib/repositories/issues.repo.test.ts#includes code and technology_council"
        status: pass
    human_judgment: false
  - id: D5
    description: "HTTP DELETE on risks/issues returns 200 { ok: true } via deactivate"
    requirement: RAID-01
    verification:
      - kind: unit
        ref: "app/api/projects/[id]/risks/route.test.ts#DELETE returns ok true"
        status: pass
      - kind: unit
        ref: "app/api/projects/[id]/issues/route.test.ts#DELETE returns ok true"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-26
status: complete
---

# Phase 12 Plan 02: RAID Unique Codes & Deactivate Summary

**Unique R-nnn/I-nnn RAID codes with ConflictError 409, deactivate-in-place with audit, and HTTP DELETE preserved at 200 { ok: true }**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-26T03:33:00Z
- **Completed:** 2026-08-26T03:41:00Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- Risks and issues get unique per-project codes (case-insensitive) with auto R-001 / I-001 generation
- Duplicate codes throw ConflictError; SQLSTATE 23505 mapped to same error
- deactivateRisk/deactivateIssue replace physical delete; auditLog records action `deactivate`
- HTTP DELETE handlers swap to deactivate while keeping `{ ok: true }` response shape
- `technology_council` allowlisted on issues (defaults false)

## Task Commits

Each task followed TDD RED → GREEN:

1. **Task 1: Unique risk codes and deactivate** — `adcae57` (test RED), `060158e` (feat)
2. **Task 2: Unique issue codes, deactivate, technology_council** — `bde1854` (test RED), `2240c3d` (feat)
3. **Task 3: Map RAID HTTP DELETE to deactivate** — `9b5f0e1` (test RED), `9b81485` (feat)

## Files Created/Modified

- `lib/repositories/risks.repo.ts` — findRiskByCode, getRisk, deactivateRisk, auto R-nnn, code in RISK_COLUMNS
- `lib/repositories/issues.repo.ts` — findIssueByCode, getIssue, deactivateIssue, auto I-nnn, technology_council
- `lib/services/risks.service.ts` — ConflictError pre-check, deactivateRisk with audit, no deleteRisk export
- `lib/services/issues.service.ts` — mirror of risks service for issues
- `app/api/projects/[id]/risks/route.ts` — DELETE → deactivateRisk
- `app/api/projects/[id]/issues/route.ts` — DELETE → deactivateIssue
- `lib/repositories/ALLOWLIST-DIFF.md` — documented code and technology_council columns

## Decisions Made

- Auto-code increment test uses isolated project seed to avoid cross-test pollution on shared projectId
- Route tests mock audit.service to keep repo-boundary tests DB-free

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Isolated project for auto-code increment repo test**
- **Found during:** Task 1
- **Issue:** Shared projectId from beforeAll caused auto-code test to expect R-002 but received R-003
- **Fix:** Use `seedProject('risks auto increment')` for the increment assertion; same pattern for issues
- **Files modified:** lib/repositories/risks.repo.test.ts, lib/repositories/issues.repo.test.ts
- **Committed in:** 060158e

None otherwise — plan executed as written.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- RAID-01 identity and retire path complete; ready for 12-03 (due-date history, list ordering)
- deleteRisk/deleteIssue removed from services; any external importers must use deactivateRisk/deactivateIssue

## Self-Check: PASSED

- FOUND: .planning/phases/12-milestone-raid-master-registers/12-02-SUMMARY.md
- FOUND: adcae57, 060158e, bde1854, 2240c3d, 9b5f0e1, 9b81485

---
*Phase: 12-milestone-raid-master-registers*
*Completed: 2026-08-26*
