---
phase: 24-repo-wide-module-split
plan: 10
subsystem: api
tags: [operations, module-split, p1-shell, p4-session-tenant, d-07, mod-01-closeout]

requires:
  - phase: 24-09
    provides: admin module split and D-07 companies pattern
provides:
  - modules/operations/ui OperationsListPage and OperationsDetailPage
  - modules/operations/backend services, repos, and all operations API routes
  - P1 shells at /operations and /operations/[id]
  - P4 re-export shells for all /api/operations/** with session+tenant auth
  - MOD-01 closeout — all ten feature modules have backend/ and ui/
affects: [phase-25-kysely, phase-26-rsc]

actuals:
  tokens: 52000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "P1 operations page shells re-exporting OperationsListPage/OperationsDetailPage"
    - "P4 operations routes with getSessionFromRequest (no withCpmo) per D-07"
    - "operations-module-split.test.ts contract for P1/P4/D-07/allowlist/MOD-01"

key-files:
  created:
    - modules/operations/backend/operations-module-split.test.ts
    - modules/operations/ui/OperationsListPage.tsx
    - modules/operations/ui/OperationsDetailPage.tsx
    - modules/operations/backend/routes/operations/systems/route.ts
  modified:
    - app/operations/page.tsx
    - app/operations/[id]/page.tsx
    - app/api/operations/systems/route.ts
    - app/api/operations/systems/[id]/route.ts
    - lib/repositories/scoped-updates.repo.unit.test.ts

key-decisions:
  - "All operations handlers keep getSessionFromRequest verbatim — no withCpmo wrapper added (D-07)"
  - "eslint/route-wrapper-allowlist.json left unchanged; contract test asserts exact JSON contents"

patterns-established:
  - "Operations module under modules/operations/{backend,ui}; P4 pure re-export shells"
  - "operations-module-split.test.ts gates D-07, allowlist stability, and MOD-01 ten-module closeout"

requirements-completed: [MOD-01, MOD-02]

coverage:
  - id: D1
    description: "Operations list/detail pages at unchanged URLs via P1 shells"
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "modules/operations/backend/operations-module-split.test.ts#P1 shells"
        status: pass
    human_judgment: true
    rationale: "Ops chrome is visual — human UAT per plan human-check"
  - id: D2
    description: "All operations API routes are P4 shells over session+tenant handlers (D-07)"
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "modules/operations/backend/operations-module-split.test.ts#D-07 and P4"
        status: pass
    human_judgment: false
  - id: D3
    description: "All ten feature modules have backend/ and ui/ directories"
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "modules/operations/backend/operations-module-split.test.ts#MOD-01 closeout"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-28
status: complete
---

# Phase 24 Plan 10: Operations Module Split Summary

**Operations UI and all /api/operations/** moved into `modules/operations` with P4 session+tenant auth preserved (D-07), completing MOD-01 for all ten feature areas.**

## Performance

- **Duration:** 8 min
- **Tasks:** 2/2
- **Commits:** 5 (4 TDD RED/GREEN + 1 docs)

## Accomplishments

- Moved OperationsListPage and OperationsDetailPage to `modules/operations/ui/` with P1 shells
- Moved operations service, repo, and all eight operations API handlers to `modules/operations/backend/`
- Every handler retains `getSessionFromRequest` — no `@/lib/http/with-role` import (D-07)
- P4 re-export shells at all `app/api/operations/**` paths; eslint allowlist JSON unchanged
- MOD-01 closeout: dashboards, audit, weekly, documents, portfolio, projects, reports, jira, admin, and operations each have `backend/` and `ui/`

## Task Commits

1. **Task 1 RED:** Move operations pages and systems collection route (D-07) — `d5910c6` (test)
2. **Task 1 GREEN:** Move operations pages and systems collection route (D-07) — `d8646cd` (feat)
3. **Task 2 RED:** Move remaining operations nested routes with D-07 sweep — `fa104db` (test)
4. **Task 2 GREEN:** Move remaining operations nested routes with D-07 sweep — `fce2025` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `modules/operations/ui/OperationsListPage.tsx` — operations list page body
- `modules/operations/ui/OperationsDetailPage.tsx` — operations detail page body
- `modules/operations/backend/operations-module-split.test.ts` — P1/P4/D-07/allowlist/MOD-01 contract tests
- `modules/operations/backend/routes/operations/systems/**` — all operations API handlers
- `app/operations/page.tsx`, `app/operations/[id]/page.tsx` — P1 shells
- `app/api/operations/systems/**/route.ts` — P4 re-export shells

## Decisions Made

- Preserved D-23 session+tenant auth verbatim on every operations handler (D-07)
- Allowlist contract asserts exact JSON contents, not a count of 9

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed operations.repo.test.ts import paths after move**
- **Found during:** Task 2 GREEN
- **Issue:** Relative `../../test/*` imports broke after repo moved from `lib/repositories/` to `modules/operations/backend/repositories/`
- **Fix:** Retargeted to `@/test/db` and `@/test/repo-db`
- **Files modified:** `modules/operations/backend/repositories/operations.repo.test.ts`
- **Committed in:** `fce2025`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Import fix required for repo integration test to resolve; no scope creep.

## Issues Encountered

None beyond the import path fix above.

## Next Phase Readiness

- Phase 24 complete — all ten feature modules split with thin `app/` shells
- Ready for Phase 25 (Kysely) and Phase 26 (RSC chrome)

## Self-Check: PASSED

- `modules/operations/backend/operations-module-split.test.ts` — FOUND
- `modules/operations/ui/OperationsListPage.tsx` — FOUND
- Commits `d5910c6`, `d8646cd`, `fa104db`, `fce2025` — FOUND

---
*Phase: 24-repo-wide-module-split*
*Completed: 2026-08-28*
