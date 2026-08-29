---
phase: 24-repo-wide-module-split
plan: 02
subsystem: api
tags: [audit, module-split, p2-re-export, vitest, nextjs]

requires:
  - phase: 24-01
    provides: P1/P2/S1/S2 split pattern and dashboards backend tracer
provides:
  - modules/audit/backend tree with S1 service, S2 repo, P6 GET route
  - P2 app/api/audit/route.ts shell
  - audit-module-split.test.ts contract for Wave 2
  - Retargeted audit.service importers across lib/services and dashboards spec
affects: [24-03, 24-04, repo-wide-module-split]

actuals:
  tokens: 18500
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "P2: export { GET } from '@/modules/audit/backend/routes/audit/route'"
    - "S1/S2: git mv audit.service/audit.repo; fix @/lib cross-cutting imports only"

key-files:
  created:
    - modules/audit/backend/audit-module-split.test.ts
    - modules/audit/backend/routes/audit/route.ts
    - app/api/audit/route.ts
  modified:
    - modules/audit/backend/services/audit.service.ts
    - modules/audit/backend/repositories/audit.repo.ts
    - modules/dashboards/backend/services/spec-dashboards.service.ts
    - lib/services/*.ts (audit.service importers)

key-decisions:
  - "Mechanical git mv only — withCpmo wrapper stays inside moved route body (T-24-03)"
  - "Exhaustive retarget of @/lib/services/audit.service and relative ./audit.service in lib/services"

patterns-established:
  - "Wave 2 tracer: audit-module-split.test.ts asserts P1/P2/S1 before and after moves"
  - "Colocated route tests import ./route; vi.mock targets module repo path"

requirements-completed: [MOD-01, MOD-02]

coverage:
  - id: D1
    description: "modules/audit/backend exists with moved audit service, repo, and GET route"
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "modules/audit/backend/audit-module-split.test.ts#S1"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /api/audit resolves via P2 re-export of module route"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/audit/backend/audit-module-split.test.ts#P2"
        status: pass
      - kind: unit
        ref: "modules/audit/backend/routes/audit/route.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "/audit still re-exports AuditLogPage unchanged"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/audit/backend/audit-module-split.test.ts#P1"
        status: pass
    human_judgment: false
  - id: D4
    description: "Audit log page renders at /audit for CPMO"
    requirement: MOD-02
    verification: []
    human_judgment: true
    rationale: "Visual URL smoke requires signed-in CPMO session (plan human-check)"

duration: 7min
completed: 2026-08-28
status: complete
---

# Phase 24 Plan 02: Audit Backend Split Summary

**Audit backend module split with P2 GET /api/audit shell, S1/S2 service/repo moves, and exhaustive importer retargets preserving withCpmo auth**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-28T12:48:00Z
- **Completed:** 2026-08-28T12:55:00Z
- **Tasks:** 2
- **Files modified:** 53

## Accomplishments

- Created `modules/audit/backend/` with moved `audit.service`, `audit.repo`, and GET `/api/audit` handler
- Replaced `app/api/audit/route.ts` with thin P2 named re-export preserving URL
- Added `audit-module-split.test.ts` as Wave 2 contract tracer
- Retargeted all `@/lib/services/audit.service` and `./audit.service` importers in lib/services plus dashboards spec service

## Task Commits

Each task used TDD with RED then GREEN commits:

1. **Task 1: Move audit service, repo, and GET /api/audit** — `d2fcd3c` (test), `ae2506b` (feat)
2. **Task 2: Retarget remaining audit.service and audit.repo imports** — `d4796ac` (test), `2d5fba7` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `modules/audit/backend/audit-module-split.test.ts` — P1/P2/S1 contract assertions
- `modules/audit/backend/services/audit.service.ts` — moved audit service (S1)
- `modules/audit/backend/repositories/audit.repo.ts` — moved audit repo (S2)
- `modules/audit/backend/routes/audit/route.ts` — P6 GET handler with withCpmo
- `app/api/audit/route.ts` — P2 shell
- `modules/dashboards/backend/services/spec-dashboards.service.ts` — module audit import
- `lib/services/*.ts` — 14 production services retargeted to module audit path

## Decisions Made

- Mechanical git mv only; no business logic rewrites (D-03)
- withCpmo wrapper retained inside moved route handler (T-24-03 mitigation)
- Relative `./audit.service` imports in lib/services updated alongside `@/lib/` paths for compile safety

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 2 audit backend complete; Wave 3 (weekly) can copy P1/P2/P6/S1/S2 pattern
- All audit importers now point at single module source under `modules/audit/backend`

## Self-Check: PASSED

- FOUND: modules/audit/backend/audit-module-split.test.ts
- FOUND: modules/audit/backend/services/audit.service.ts
- FOUND: app/api/audit/route.ts
- FOUND: d2fcd3c, ae2506b, d4796ac, 2d5fba7

---
*Phase: 24-repo-wide-module-split*
*Completed: 2026-08-28*
