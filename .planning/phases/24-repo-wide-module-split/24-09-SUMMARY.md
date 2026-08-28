---
phase: 24-repo-wide-module-split
plan: 09
subsystem: api
tags: [admin, module-split, p1-shell, p2-shell, p4-session-admin, d-07]

requires:
  - phase: 24-08
    provides: jira module split pattern and JiraSyncDialog in modules/jira/ui
provides:
  - modules/admin/ui AdminPage and modules/admin/backend services, repos, routes
  - P1 app/admin/page.tsx shell
  - P4 companies re-export preserving D-07 session+requireAdmin auth
  - P2 shells for users, jira-config, rag-config, resource-audit, demo-requests
affects: [24-10-operations]

actuals:
  tokens: 48000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "P1 admin page shell re-exporting AdminPage"
    - "P4 companies route with getSessionFromRequest+requireAdmin (no withCpmo)"
    - "P2 named re-export shells for remaining admin APIs"

key-files:
  created:
    - modules/admin/backend/admin-module-split.test.ts
    - modules/admin/ui/AdminPage.tsx
    - modules/admin/backend/routes/admin/companies/route.ts
    - modules/admin/backend/services/admin-platform.service.ts
  modified:
    - app/admin/page.tsx
    - app/api/admin/companies/route.ts
    - app/api/admin/users/route.ts
    - modules/projects/backend/services/stakeholders.service.ts
    - modules/reports/backend/services/portfolio-report.service.ts

key-decisions:
  - "AdminPage sourced from HEAD commit to avoid unrelated working-tree edits on app/admin/page.tsx"
  - "Cross-module importers retargeted to modules/admin/backend/repositories for users, jira-config, rag-config repos"

patterns-established:
  - "Admin backend under modules/admin/backend; D-07 companies auth unchanged"
  - "admin-module-split.test.ts contract tests for P1/P2/P4 shells and D-07"

requirements-completed: [MOD-01, MOD-02]

duration: 5min
completed: 2026-08-28
status: complete
---

# Phase 24 Plan 09: Admin Module Split Summary

**Admin UI and all /api/admin handlers moved into `modules/admin` with P1 page shell, P4 companies auth preserved (D-07), and P2 re-export shells for remaining routes.**

## Performance

- **Duration:** 5 min
- **Tasks:** 2/2
- **Commits:** 5 (4 TDD RED/GREEN + 1 docs)

## Accomplishments

- Moved AdminPage to `modules/admin/ui/AdminPage.tsx`; P1 shell at `app/admin/page.tsx`
- Moved companies route with verbatim `getSessionFromRequest` + `requireAdmin` (no `withCpmo` / `@/lib/http/with-role`)
- P4 shell at `app/api/admin/companies/route.ts`; eslint allowlist path unchanged
- Moved admin services, repos, and all remaining admin API handlers to `modules/admin/backend`
- P2 shells for users, jira-config, rag-config, resource-audit, and admin demo-requests
- Retargeted cross-module importers (projects, reports, jira, credentials)

## Task Commits

1. **Task 1 RED:** Move AdminPage and companies route (D-07) — `c6a10e7` (test)
2. **Task 1 GREEN:** Move AdminPage and companies route (D-07) — `16c7d0a` (feat)
3. **Task 2 RED:** Move remaining admin services, repos, and P2 routes — `a89814c` (test)
4. **Task 2 GREEN:** Move remaining admin services, repos, and P2 routes — `5881764` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Self-Check: PASSED

- FOUND: modules/admin/ui/AdminPage.tsx
- FOUND: modules/admin/backend/routes/admin/companies/route.ts
- FOUND: modules/admin/backend/admin-module-split.test.ts
- FOUND: c6a10e7, 16c7d0a, a89814c, 5881764

---
*Phase: 24-repo-wide-module-split*
*Completed: 2026-08-28*
