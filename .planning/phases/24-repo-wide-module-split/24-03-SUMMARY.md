---
phase: 24-repo-wide-module-split
plan: 03
subsystem: api
tags: [weekly, module-split, p2-re-export, p3-wrapper-stays, vitest, nextjs]

requires:
  - phase: 24-02
    provides: audit backend split pattern and contract-test tracer
provides:
  - modules/weekly/backend tree (services, repos, routes, handlers)
  - P2 app/api/weekly-periods/** shells
  - P3 app/api/projects/[id]/weekly-reports/** and export/weekly-report shells with local withProjectAccess
  - weekly-module-split.test.ts contract (S1, P1, P2, P3 ENF-01)
  - Retargeted period-resolver and spec-dashboards weekly imports
affects: [24-06, repo-wide-module-split]

actuals:
  tokens: 42000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "P2: export { GET, POST } from '@/modules/weekly/backend/routes/weekly-periods/route'"
    - "P3: export const GET = withProjectAccess(handlerFromModule)"
    - "P3 tests import wrapped methods from @/app/api/.../route"

key-files:
  created:
    - modules/weekly/backend/weekly-module-split.test.ts
    - modules/weekly/backend/routes/projects/[id]/weekly-reports/handlers.ts
    - modules/weekly/backend/routes/export/weekly-report/[id]/handlers.ts
    - app/api/weekly-periods/route.ts
  modified:
    - modules/weekly/backend/services/weekly-reports.service.ts
    - modules/weekly/backend/services/weekly-tracking.service.ts
    - lib/dashboards/period-resolver.ts
    - modules/dashboards/backend/services/spec-dashboards.service.ts
    - app/api/projects/[id]/weekly-reports/route.ts

key-decisions:
  - "weekly-periods routes are P2 pure re-exports; project weekly-reports and export/weekly-report stay P3 with wrappers in app/api (ENF-01)"
  - "P3 handler bodies live in handlers.ts; schema.ts colocated under module routes"
  - "Mechanical git mv only — no business logic rewrites (D-03)"

patterns-established:
  - "Wave 3 tracer: weekly-module-split.test.ts asserts S1/P1/P2/P3 before expansion"
  - "First P3 wrapper-stays pattern for projects-scoped weekly APIs"

requirements-completed: [MOD-01, MOD-02]

coverage:
  - id: D1
    description: "modules/weekly/backend exists with moved services, repos, and routes"
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "modules/weekly/backend/weekly-module-split.test.ts#S1"
        status: pass
    human_judgment: false
  - id: D2
    description: "/api/weekly-periods/** resolves via P2 re-exports"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/weekly/backend/weekly-module-split.test.ts#P2"
        status: pass
      - kind: unit
        ref: "modules/weekly/backend/routes/weekly-periods/route.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Project weekly-reports and export routes keep withProjectAccess in app/api (ENF-01)"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/weekly/backend/weekly-module-split.test.ts#P3"
        status: pass
      - kind: unit
        ref: "eslint app/api/projects/[id]/weekly-reports/**/route.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Weekly pages unchanged at /weekly/* and project report editor URL"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/weekly/backend/weekly-module-split.test.ts#P1"
        status: pass
    human_judgment: true
    rationale: "Visual URL smoke per plan human-check"

duration: 45min
completed: 2026-08-28
status: complete
---

# Phase 24 Plan 03: Weekly Backend Split Summary

**Weekly backend moved to modules/weekly/backend with P2 weekly-periods shells and P3 wrapper-stays for project-scoped weekly-reports and export routes.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3
- **Commits:** 7 (6 TDD RED/GREEN + 1 mock-path fix)

## Accomplishments

- Created `modules/weekly/backend/` with services, repositories, and route bodies for all weekly-periods endpoints (P2).
- Extracted P3 handler functions to `handlers.ts` under module routes; `app/api` shells retain local `withProjectAccess(` calls (ENF-01).
- Added `weekly-module-split.test.ts` contract covering S1 import, P1 page shells, P2 re-exports, and P3 wrapper-stays.
- Retargeted `lib/dashboards/period-resolver.ts`, `spec-dashboards.service.ts`, and `lib/export/consolidated-weekly.ts` to module paths.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|------------|--------------|
| 24-03-01 | c33494e | 881ae25 |
| 24-03-02 | fb099ae | e83c40d |
| 24-03-03 | b3647d6 | dbd08e9 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] weekly-tracking unit test access mock path**
- **Found during:** Task 2 verification (full modules/weekly run)
- **Issue:** `./access` mock did not intercept `@/lib/services/access` after service move
- **Fix:** Retargeted mock to `@/lib/services/access`
- **Files modified:** `modules/weekly/backend/services/weekly-tracking.service.unit.test.ts`
- **Commit:** 4fe989f

## Self-Check: PASSED

- FOUND: modules/weekly/backend/weekly-module-split.test.ts
- FOUND: modules/weekly/backend/services/weekly-reports.service.ts
- FOUND: app/api/weekly-periods/route.ts
- FOUND: app/api/projects/[id]/weekly-reports/route.ts
- FOUND: c33494e, 881ae25, fb099ae, e83c40d, b3647d6, dbd08e9, 4fe989f
