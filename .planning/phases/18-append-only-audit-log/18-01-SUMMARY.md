---
phase: 18-append-only-audit-log
plan: 01
subsystem: api
tags: [audit, postgres, vitest, withCpmo, append-only]

requires:
  - phase: 10-users-roles
    provides: audit_logs DDL, insertAuditLog, withCpmo, assertCompanyWrite
provides:
  - Company-scoped listAuditLogs SELECT in audit.repo.ts
  - listAuditLogs service with assertCompanyWrite, limit clamp, date validation
  - GET /api/audit (CPMO-only read)
  - Immutability source-scan and D-07 two-row persistence tests
affects: [18-02, 18-03, AUDIT-01 gap-fill mutators]

actuals:
  tokens: 5300
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Repo INSERT+SELECT only with source-scan immutability gate"
    - "assertCompanyWrite before company-scoped audit list"
    - "withCpmo GET with query filter passthrough"

key-files:
  created:
    - app/api/audit/route.ts
    - app/api/audit/route.test.ts
    - lib/repositories/audit.repo.unit.test.ts
    - lib/repositories/audit.repo.test.ts
  modified:
    - lib/repositories/audit.repo.ts
    - lib/services/audit.service.ts
    - lib/services/audit.service.unit.test.ts

key-decisions:
  - "Kept insertAuditLog INSERT path unchanged per D-01"
  - "No settings-flag migrate — company_id column already exists (D-10 skip)"
  - "Route tests mock repo listAuditLogs so real assertCompanyWrite runs for null-company CPMO 403"

patterns-established:
  - "audit.repo exports insertAuditLog + listAuditLogs only; source-scan forbids UPDATE/DELETE"
  - "Service clampLimit: default 50, max 200 before SQL LIMIT"

requirements-completed: [AUDIT-01]

coverage:
  - id: D1
    description: "CPMO GET /api/audit returns company-scoped rows; PM/Viewer/null-company denied"
    requirement: AUDIT-01
    verification:
      - kind: unit
        ref: "app/api/audit/route.test.ts#GET /api/audit"
        status: pass
    human_judgment: false
  - id: D2
    description: "audit.repo INSERT+SELECT only — no mutating SQL helpers"
    requirement: AUDIT-01
    verification:
      - kind: unit
        ref: "lib/repositories/audit.repo.unit.test.ts#audit.repo immutability"
        status: pass
    human_judgment: false
  - id: D3
    description: "listAuditLogs filters (entity_type, entity_id, from, to) and limit cap 50/200"
    requirement: AUDIT-01
    verification:
      - kind: unit
        ref: "lib/repositories/audit.repo.unit.test.ts#audit.repo listAuditLogs"
        status: pass
      - kind: unit
        ref: "lib/services/audit.service.unit.test.ts#audit.service listAuditLogs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two inserts for same entity_id leave first row unchanged (D-07 append-only)"
    requirement: AUDIT-01
    verification:
      - kind: unit
        ref: "lib/repositories/audit.repo.unit.test.ts#audit.repo append-only persistence"
        status: pass
      - kind: integration
        ref: "lib/repositories/audit.repo.test.ts#returns both rows"
        status: pass
    human_judgment: false
  - id: D5
    description: "GET route exports GET only; query params forwarded to service"
    requirement: AUDIT-01
    verification:
      - kind: unit
        ref: "app/api/audit/route.test.ts#audit route module shape"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-26
status: complete
---

# Phase 18 Plan 01: Append-Only Audit Read Summary

**Company-scoped GET /api/audit with assertCompanyWrite, SQL tenant filter, limit cap 50/200, and immutability source-scan — insert path unchanged**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-26T15:33:00Z
- **Completed:** 2026-08-26T15:45:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `listAuditLogs(companyId, filters)` SELECT with mandatory `company_id = ?`, optional entity/date filters, `ORDER BY created_at DESC, id DESC`, and `LIMIT`
- Extended `audit.service` with `listAuditLogs(actor, filters)` using `assertCompanyWrite`, `clampLimit`, and `parseIsoDate` validation
- Shipped GET-only `/api/audit` via `withCpmo` with query param passthrough
- Proved append-only contract via source-scan unit test and D-07 two-row hermetic + integration tests

## Task Commits

1. **Task 18-01-01 RED** - `d23b269` (test)
2. **Task 18-01-01 GREEN** - `9c91ba4` (feat)
3. **Task 18-01-02 RED** - `742527b` (test)
4. **Task 18-01-02 GREEN** - `36979be` (feat)
5. **Task 18-01-03 RED** - `54730ca` (test)

Task 18-01-03 GREEN required no additional implementation — auth matrix and GET-only shape validated existing route/service.

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `lib/repositories/audit.repo.ts` - `listAuditLogs` SELECT; types `AuditListFilters`, `AuditLogRow`
- `lib/services/audit.service.ts` - `listAuditLogs(actor)` with tenant gate and filter validation
- `app/api/audit/route.ts` - GET-only CPMO audit list endpoint
- `lib/repositories/audit.repo.unit.test.ts` - company scope SQL, filters, immutability scan, hermetic D-07
- `lib/repositories/audit.repo.test.ts` - integration D-07 against TEST_DATABASE_URL
- `lib/services/audit.service.unit.test.ts` - list gate, clamp, ValidationError
- `app/api/audit/route.test.ts` - auth matrix, filter forwarding, module shape

## Decisions Made

- Route tests mock `@/lib/repositories/audit.repo` `listAuditLogs` (not the service) so real `assertCompanyWrite` executes for null-company CPMO 403
- Skipped D-10 settings-flag migrate — `company_id` column already present in `audit_logs`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Route test mock strategy for assertCompanyWrite**
- **Found during:** Task 18-01-03
- **Issue:** Mocking `@/lib/services/audit.service` bypassed `assertCompanyWrite` for null-company CPMO
- **Fix:** Refactored route tests to mock repo `listAuditLogs` while using real service
- **Files modified:** `app/api/audit/route.test.ts`
- **Committed in:** `54730ca`

---

**Total deviations:** 1 auto-fixed (1 blocking test harness)
**Impact on plan:** Test-only fix; no production behavior change.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Read path proven for AUDIT-01; ready for 18-02/18-03 D-02 mutator gap fills
- Wave verify: 26 tests pass across 4 files

## Self-Check: PASSED

- FOUND: lib/repositories/audit.repo.ts
- FOUND: lib/services/audit.service.ts
- FOUND: app/api/audit/route.ts
- FOUND: lib/repositories/audit.repo.unit.test.ts
- FOUND: lib/repositories/audit.repo.test.ts
- FOUND: app/api/audit/route.test.ts
- FOUND: d23b269, 9c91ba4, 742527b, 36979be, 54730ca

---
*Phase: 18-append-only-audit-log*
*Completed: 2026-08-26*
