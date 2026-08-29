---
phase: 24-repo-wide-module-split
plan: 07
subsystem: api
tags: [reports, module-split, p1-re-export, p2-re-export, p3-wrapper-stays, portfolio-report, vitest, nextjs]

requires:
  - phase: 24-06
    provides: projects P3 handler extraction pattern and cross-module import retarget precedent
provides:
  - modules/reports/{backend,ui} with portfolio report UI, project report UI, services, P2/P3 routes
  - P1 shell at /portfolio/report re-exporting modules/reports/ui (D-11)
  - P1 shells for /projects/[id]/report and /projects/[id]/reports
  - P2 shells for portfolio report API and email/export/portfolio/members
  - P3 withProjectAccess wrappers on project report and scoped export APIs (ENF-01)
  - reports-module-split.test.ts contract tracer (17 assertions)
affects: [24-08, repo-wide-module-split]

actuals:
  tokens: 72000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "D-11: /portfolio/report UI in modules/reports/ui with P1 shell at existing URL"
    - "P2: export { GET, POST } from '@/modules/reports/backend/routes/...'"
    - "P3: withProjectAccess(handlerFromModule) on project/export [id] routes"

key-files:
  created:
    - modules/reports/backend/reports-module-split.test.ts
    - modules/reports/ui/portfolio-report/PortfolioReportPage.tsx
    - modules/reports/ui/project-report/ProjectReportPage.tsx
    - modules/reports/ui/project-reports-list/ProjectReportsListPage.tsx
    - modules/reports/backend/services/portfolio-report.service.ts
    - modules/reports/backend/services/project-report.service.ts
    - modules/reports/backend/routes/projects/[id]/report/handlers.ts
    - modules/reports/backend/routes/export/excel/[id]/handlers.ts
  modified:
    - app/portfolio/report/page.tsx
    - app/api/portfolio/report/route.ts
    - app/projects/[id]/report/page.tsx
    - app/projects/[id]/reports/page.tsx
    - app/api/projects/[id]/report/route.ts
    - app/api/export/excel/[id]/route.ts
    - modules/portfolio/backend/portfolio-module-split.test.ts
    - modules/projects/backend/projects-module-split.test.ts

key-decisions:
  - "/portfolio/report URL unchanged; UI lives under modules/reports/ui (D-11)"
  - "P3 withProjectAccess stays in app/api for project report and scoped export routes (ENF-01)"
  - "lib/export formatters stay at lib/export; only route handlers moved (D-03)"
  - "P3 route integration tests remain in app/api where they import wrapper shells"

patterns-established:
  - "Wave 7 tracer: reports-module-split.test.ts asserts D-11 P1, S1, P2, P3 ENF-01"
  - "Portfolio report: full P2 move for API; project/export: handler extraction + thin wrapper"

requirements-completed: [MOD-01, MOD-02]

coverage:
  - id: D1
    description: "modules/reports/backend and ui exist with moved report services, UI, and routes"
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "modules/reports/backend/reports-module-split.test.ts#S1"
        status: pass
    human_judgment: false
  - id: D2
    description: "/portfolio/report and project report URLs resolve via P1 shells (D-11, MOD-02)"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/reports/backend/reports-module-split.test.ts#D-11 P1"
        status: pass
    human_judgment: true
    rationale: "Report chrome is visual; contract tests prove re-export wiring only"
  - id: D3
    description: "Scoped export and project report app/api routes keep withProjectAccess (ENF-01)"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/reports/backend/reports-module-split.test.ts#P3 ENF-01"
        status: pass
      - kind: other
        ref: "npx eslint app/api/export/excel/[id]/route.ts ..."
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-28
status: complete
---

# Phase 24 Plan 07: Reports Module Split Summary

**Reports module owns portfolio/project report UI and backend with D-11 /portfolio/report P1 shell, P2 portfolio APIs, and P3 withProjectAccess export wrappers**

## Performance

- **Duration:** 45 min
- **Tasks:** 3
- **Files modified:** 77
- **Tests:** 46 passing in modules/reports

## Accomplishments

- Created `modules/reports/{backend,ui}` and moved portfolio report UI per D-11 with thin P1 shell at `/portfolio/report`
- Moved project report UI (`/projects/[id]/report`, `/projects/[id]/reports`) and both report services
- Extracted P3 handlers for project report and scoped export routes; wrappers stay in `app/api` (ENF-01)
- Moved P2 portfolio report API, email routes, and export/portfolio/members with re-export shells

## Task Commits

Each task used TDD with RED then GREEN commits:

1. **Task 1: Move /portfolio/report UI and API (D-11)**
   - RED: `70aa5c2` test(24-07): red portfolio report D-11 tracer
   - GREEN: `642f21a` feat(24-07): portfolio report UI in reports module
2. **Task 2: Move project report UI and P3 project report APIs**
   - RED: `0b8f0a0` test(24-07): red project report P1 and P3
   - GREEN: `b39d2aa` feat(24-07): project report UI and P3 APIs
3. **Task 3: Move remaining report APIs (email plus export)**
   - RED: `575f292` test(24-07): red report export routes
   - GREEN: `668faa6` feat(24-07): report export and email routes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed project-report.service relative imports after move**
- **Found during:** Task 2
- **Issue:** `./access` and `./errors` siblings invalid under modules/reports/backend/services
- **Fix:** Retargeted to `@/lib/services/access` and `@/lib/services/errors`
- **Files modified:** modules/reports/backend/services/project-report.service.ts
- **Committed in:** b39d2aa

**2. [Rule 2 - Missing Critical] Updated upstream module-split tests for Wave 7 completion**
- **Found during:** Tasks 1–3
- **Issue:** portfolio-module-split and projects-module-split still asserted pre-Wave-7 paths
- **Fix:** Updated D-11 guards and service path assertions; fixed company-scope and integration-error test imports
- **Files modified:** modules/portfolio/backend/portfolio-module-split.test.ts, modules/projects/backend/projects-module-split.test.ts, lib/services/company-scope.repo.test.ts, lib/services/integration-error-passthrough.unit.test.ts
- **Committed in:** 642f21a, b39d2aa, 668faa6

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Import fixes required for module path correctness; test updates preserve cross-wave contract tracers.

## Issues Encountered

None beyond expected import path retargets after service moves.

## Next Phase Readiness

- Wave 7 (reports) complete; jira module split (Wave 8) can proceed
- `/portfolio/report` URL and behavior preserved per D-11

## Self-Check: PASSED

- FOUND: modules/reports/backend/reports-module-split.test.ts
- FOUND: modules/reports/ui/portfolio-report/PortfolioReportPage.tsx
- FOUND: app/portfolio/report/page.tsx
- FOUND: 70aa5c2, 642f21a, 0b8f0a0, b39d2aa, 575f292, 668faa6

---
*Phase: 24-repo-wide-module-split*
*Completed: 2026-08-28*
