---
phase: 24-repo-wide-module-split
plan: 05
subsystem: api
tags: [portfolio, module-split, p1-re-export, p2-re-export, p3-wrapper-stays, vitest, nextjs]

requires:
  - phase: 24-04
    provides: documents P2/P3 split pattern and contract-test tracer
provides:
  - modules/portfolio/{backend,ui} with home, budget, roadmap, resources, programs, members pages
  - P1 shells for /, /portfolio/* (except report), /programs, /resources
  - P2 shells for portfolio/programs/resources APIs (report routes excluded D-11)
  - P3 programs/[id] handlers with withProgramAccess in app/api (ENF-01)
  - portfolio-module-split.test.ts contract tracer
  - Retargeted cross-feature importers (fiscal-budget, roi, projects, portfolio-report, export)
affects: [24-06, 24-07, repo-wide-module-split]

actuals:
  tokens: 92000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "P1: export { default } from '@/modules/portfolio/ui/.../PageName'"
    - "P2: export { GET, POST } from '@/modules/portfolio/backend/routes/.../route'"
    - "P3: withProgramAccess(handlerFromModule) in app/api/programs/[id]/**"

key-files:
  created:
    - modules/portfolio/backend/portfolio-module-split.test.ts
    - modules/portfolio/ui/home/PortfolioHomePage.tsx
    - modules/portfolio/backend/routes/programs/[id]/handlers.ts
    - modules/portfolio/backend/routes/programs/[id]/project-allocations/handlers.ts
  modified:
    - app/page.tsx
    - app/api/portfolio/route.ts
    - app/api/programs/[id]/route.ts
    - lib/http/with-program-access.ts
    - lib/services/projects.service.ts
    - lib/services/roi.service.ts

key-decisions:
  - "Mechanical git mv only — /portfolio/report UI and API stay in app/ until Wave 7 (D-11)"
  - "P3 withProgramAccess stays in app/api for programs/[id]/** (ENF-01)"
  - "Exhaustive retarget of fiscal-budget, portfolio, programs importers in stayers per 24-02 pattern"

patterns-established:
  - "Wave 5 tracer: portfolio-module-split.test.ts asserts P1/P2/P3/S1/D-11 guard"
  - "ResourceImportDialog under modules/projects/ui; PortfolioImportDialog colocated with portfolio resources page"

requirements-completed: [MOD-01, MOD-02]

coverage:
  - id: D1
    description: "modules/portfolio/backend and ui exist with moved services, repos, routes, and pages"
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "modules/portfolio/backend/portfolio-module-split.test.ts#S1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Listed portfolio URLs resolve via P1/P2 shells; report URL unchanged"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/portfolio/backend/portfolio-module-split.test.ts#P1"
        status: pass
      - kind: unit
        ref: "modules/portfolio/backend/portfolio-module-split.test.ts#P2"
        status: pass
    human_judgment: false
  - id: D3
    description: "programs/[id] routes keep withProgramAccess wrapper in app/api"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/portfolio/backend/portfolio-module-split.test.ts#P3"
        status: pass
      - kind: other
        ref: "npx eslint app/api/programs/[id]/route.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Home page renders same layout for signed-in CPMO"
    requirement: MOD-02
    verification: []
    human_judgment: true
    rationale: "Visual chrome unchanged per D-10 but requires human sign-off on layout"

duration: 75min
completed: 2026-08-28
status: complete
---

# Phase 24 Plan 05: Portfolio Module Split Summary

**Portfolio v1 UI and backend moved to modules/portfolio with P1 page shells, P2 API re-exports, and P3 program-id wrappers preserving ENF-01**

## Performance

- **Duration:** ~75 min
- **Tasks:** 3
- **Files modified:** ~120
- **Commits:** 7 (3 RED + 3 GREEN + prior tracer commits)

## Accomplishments

- Home `/` and five portfolio-area pages are P1 re-exports into `modules/portfolio/ui`
- Portfolio, programs, and resources APIs are P2 shells; `programs/[id]/**` uses extracted handlers with local `withProgramAccess`
- Services/repos (`portfolio`, `programs`, `roadmap`, `fiscal-budget`, `resources`) live under `modules/portfolio/backend`
- Cross-feature importers (fiscal-budget routes, roi, projects, portfolio-report, export members, with-program-access) retargeted to module paths
- `/portfolio/report` UI and `app/api/portfolio/report/**` left in place (D-11)

## Task Commits

1. **Task 24-05-01 RED** - `4eda68b` (test)
2. **Task 24-05-01 GREEN** - `21456fb` (feat)
3. **Task 24-05-02 RED** - `673dd9a` (test)
4. **Task 24-05-02 GREEN** - `399a3b9` (feat)
5. **Task 24-05-03 RED** - `3087455` (test)
6. **Task 24-05-03 GREEN** - `ebca3be` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed service `./access`/`./errors` imports after git mv**
- **Found during:** Task 24-05-01
- **Issue:** Moved `portfolio.service.ts` still imported sibling `./access` paths from `lib/services`
- **Fix:** Retargeted to `@/lib/services/access` and `@/lib/services/errors` (D-01 cross-cutting lib)
- **Files modified:** `modules/portfolio/backend/services/portfolio.service.ts`, unit test
- **Committed in:** `21456fb`

**2. [Rule 3 - Blocking] Fixed colocated test import paths after repo moves**
- **Found during:** Task 24-05-03
- **Issue:** `portfolio.repo.test.ts`, `programs.repo.test.ts` used `../../test/*`; `fiscal-budget.repo.test.ts` imported sibling `budget-adjustments.repo`
- **Fix:** Updated to `../../../../test/*` and `@/lib/repositories/budget-adjustments.repo`
- **Committed in:** `ebca3be`

**3. [Rule 3 - Blocking] Windows bracket-path git mv for nested portfolio routes**
- **Found during:** Task 24-05-03
- **Issue:** PowerShell globbed `[id]` segments; initial directory `git mv` failed
- **Fix:** Node-assisted literal-path moves for `budgets/[id]/**`, `members/[id]/**`, `program-allocations/[id]/**`
- **Committed in:** `ebca3be`

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** Mechanical path fixes only; no scope or behavior change.

## Issues Encountered

None beyond Windows path/bracket handling during bulk route moves.

## Next Phase Readiness

- Wave 6 (projects) can proceed; fiscal-budget and programs importers already retargeted
- Wave 7 owns `/portfolio/report` UI/API and `portfolio-report.service` move

## Self-Check: PASSED

- FOUND: `.planning/phases/24-repo-wide-module-split/24-05-SUMMARY.md`
- FOUND: `4eda68b`, `21456fb`, `673dd9a`, `399a3b9`, `3087455`, `ebca3be`

---
*Phase: 24-repo-wide-module-split*
*Completed: 2026-08-28*
