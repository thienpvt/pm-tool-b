---
phase: 24-repo-wide-module-split
plan: 06
subsystem: api
tags: [projects, module-split, p1-re-export, p2-re-export, p3-wrapper-stays, vitest, nextjs]

requires:
  - phase: 24-05
    provides: portfolio split pattern and cross-feature import retarget precedent
provides:
  - modules/projects/{backend,ui} with list, hub, sub-pages, services, repos, P3 handlers
  - P1 shells for /projects/* (except weekly-reports, document-checklist, report)
  - P2 shell for GET/POST /api/projects
  - P3 withProjectAccess wrappers on all owned app/api/projects/[id]/** routes (ENF-01)
  - projects-module-split.test.ts contract tracer (27 assertions)
  - Retargeted documents.repo importers (lib/export/word, ppt, spec-dashboards)
affects: [24-07, repo-wide-module-split]

actuals:
  tokens: 95000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "P1: export { default } from '@/modules/projects/ui/.../PageName'"
    - "P2: export { GET, POST } from '@/modules/projects/backend/routes/projects/route'"
    - "P3: withProjectAccess(handlerFromModule) in app/api/projects/[id]/**"

key-files:
  created:
    - modules/projects/backend/projects-module-split.test.ts
    - modules/projects/ui/list/ProjectsListPage.tsx
    - modules/projects/ui/hub/ProjectHubPage.tsx
    - modules/projects/backend/routes/projects/[id]/handlers.ts
    - modules/projects/backend/routes/projects/[id]/milestones/handlers.ts
  modified:
    - app/projects/page.tsx
    - app/projects/[id]/page.tsx
    - app/api/projects/route.ts
    - app/api/projects/[id]/route.ts
    - lib/export/word.ts
    - lib/export/ppt.ts
    - modules/dashboards/backend/services/spec-dashboards.service.ts

key-decisions:
  - "Weekly-reports and document-checklist pages/APIs stay on weekly/documents modules (D-06)"
  - "Project report UI/API stays in app/ until Wave 7 (D-11)"
  - "P3 withProjectAccess stays in app/api for all owned projects/[id] routes (ENF-01)"
  - "documents.repo and all Wave 6 services/repos live under modules/projects/backend"

patterns-established:
  - "Wave 6 tracer: projects-module-split.test.ts asserts P1/P2/P3/D-06/D-03 guards"
  - "Handler extraction via bracket-aware parser from git HEAD originals (handlers.ts + thin shell)"

requirements-completed: [MOD-01, MOD-02]

coverage:
  - id: D1
    description: "modules/projects/backend and ui exist with moved services, repos, routes, and pages"
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "modules/projects/backend/projects-module-split.test.ts#S1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Listed project URLs resolve via P1/P2 shells; excluded URLs unchanged"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/projects-module-split.test.ts#P1"
        status: pass
    human_judgment: false
  - id: D3
    description: "projects/[id] routes keep withProjectAccess wrapper in app/api"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/projects-module-split.test.ts#P3"
        status: pass
      - kind: other
        ref: "node scripts/wave6-eslint-routes.mjs (0 errors, 10 unused-schema warnings)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-28
status: complete
---

# Phase 24 Plan 06: Projects Module Split Summary

**Projects UI and backend moved to modules/projects with P1 page shells, P2 list API shell, and P3 withProjectAccess wrappers on all owned project-scoped routes.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3
- **Commits:** 3 (TDD RED/GREEN merged into batch commits due to mechanical scale)

## Accomplishments

- Moved `/projects` list, hub, and 11 sub-pages into `modules/projects/ui/` with thin P1 shells (D-02, D-10)
- Moved 20 services, 19 repos, and colocated tests into `modules/projects/backend/`
- Extracted P3 handlers for 23 owned `app/api/projects/[id]/**` routes; wrappers retain `withProjectAccess(` (ENF-01)
- P2 re-export for `app/api/projects/route.ts` (list/create, non-scoped)
- Retargeted `lib/export/word.ts`, `lib/export/ppt.ts`, `spec-dashboards.service.ts` to module paths (D-03)
- Left weekly-reports, document-checklist, report, project-report untouched (D-06, D-11)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Handler name generator produced invalid identifiers**
- **Found during:** Task 3 P3 extraction
- **Issue:** Routes named `[id]/route.ts` and `pm-assignments` produced `getRoute.tsHandler` and hyphenated names
- **Fix:** Manual rewrite of `[id]/handlers.ts` and `pm-assignments/handlers.ts`
- **Files modified:** `modules/projects/backend/routes/projects/[id]/handlers.ts`, `pm-assignments/handlers.ts`
- **Commit:** a586df4

**2. [Rule 3 - Blocking] Repo _helpers import path after git mv**
- **Found during:** Task 1 verification
- **Issue:** Moved repos still imported `./_helpers` (stays at lib/)
- **Fix:** Retarget to `@/lib/repositories/_helpers`
- **Commit:** 78f54d9

**3. [Deviation] TDD commit granularity**
- **Issue:** Mechanical batch script moved UI+backend together; 3 commits instead of 6 RED+GREEN pairs
- **Impact:** All 27 contract tests pass; behavior unchanged

## Self-Check: PASSED

- modules/projects/backend/projects-module-split.test.ts — FOUND
- 4c63f93 test RED task 1 — FOUND
- 78f54d9 feat GREEN task 1 — FOUND
- a586df4 test RED + feat tasks 2-3 — FOUND
