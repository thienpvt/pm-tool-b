---
phase: 24-repo-wide-module-split
plan: 08
subsystem: api
tags: [jira, import, module-split, p2-shell, p3-wrapper]

requires:
  - phase: 24-07
    provides: projects timeline/bugs UI in modules/projects/ui
provides:
  - modules/jira/backend routes, services, repos for jira and import APIs
  - modules/jira/ui dialogs and timeline-import tree
  - P2 app/api shells preserving public URLs
  - P3 import/resource-plan/[id] with withProjectAccess in app/api
affects: [24-09-admin, projects-timeline, projects-bugs]

actuals:
  tokens: 52000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "P2 named re-export shells for jira/import APIs"
    - "P3 handler extraction for import/resource-plan/[id]"

key-files:
  created:
    - modules/jira/backend/jira-module-split.test.ts
    - modules/jira/ui/JiraSyncDialog.tsx
    - modules/jira/ui/BugImportDialog.tsx
    - modules/jira/ui/timeline-import/ImportMappingDialog.tsx
    - modules/jira/backend/routes/import/resource-plan/[id]/handlers.ts
  modified:
    - app/api/jira/search/route.ts
    - app/api/import/resource-plan/[id]/route.ts
    - modules/projects/ui/bugs/ProjectBugsPage.tsx
    - modules/projects/ui/timeline/_components/TimelineDialogs.tsx

key-decisions:
  - "Skipped app/admin/page.tsx — no JiraSyncDialog import; unrelated dirty edits left unstaged"
  - "P3 resource-plan wrapper stays in app/api with handler in modules/jira/backend"

patterns-established:
  - "Jira import UI under modules/jira/ui; timeline-import subtree for ImportMappingDialog"
  - "import-mapping and jira-mapping services colocated in modules/jira/backend/services"

requirements-completed: [MOD-01, MOD-02]

duration: 7min
completed: 2026-08-28
status: complete
---

# Phase 24 Plan 08: Jira/Import Module Split Summary

**Jira sync/import dialogs and all jira/import APIs moved into `modules/jira` with P2 re-export shells and P3 resource-plan wrapper preserved in `app/api`.**

## Performance

- **Duration:** 7 min
- **Tasks:** 3/3
- **Commits:** 7 (6 TDD RED/GREEN + 1 Rule 3 fix)

## Accomplishments

- Created `modules/jira/ui` with JiraSyncDialog, BugImportDialog, and timeline-import tree
- Moved GET/POST jira/search and all remaining jira/import API handlers to `modules/jira/backend/routes`
- Moved import-mapping.service, jira-mapping.service, and import-mapping.repo into the jira module
- P3 `app/api/import/resource-plan/[id]/route.ts` keeps `withProjectAccess(` and delegates to module handler
- Retargeted importers in ProjectBugsPage, TimelineDialogs, and page.component.test.tsx mocks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] import-mapping.repo.test.ts wrong path after move**
- **Found during:** Task 3 verification
- **Issue:** Relative import pointed at `lib/test/db` instead of repo-root `test/db`
- **Fix:** Updated to `../../../../test/db` and `../../../../test/repo-db`
- **Files modified:** modules/jira/backend/repositories/import-mapping.repo.test.ts
- **Commit:** 8a2063d

**2. [Plan deviation] app/admin/page.tsx not retargeted**
- **Reason:** File has no JiraSyncDialog import; working tree has unrelated BOM/Array.isArray edits excluded per orchestrator guidance
- **Impact:** None — JiraSyncDialog only imported from ProjectBugsPage and TimelineDialogs

### Test fix in GREEN

- P2 contract test for `[id]` routes switched from regex (bracket character-class bug) to `toContain(target)`

## Verification

- `npx vitest run --project node modules/jira/backend/jira-module-split.test.ts` — 18 passed
- `npx vitest run modules/jira` — 113 passed, 4 skipped (integration DB)
- `npx eslint app/api/import/resource-plan/[id]/route.ts` — exit 0

## Commits

| Task | RED | GREEN |
|------|-----|-------|
| 24-08-01 | 68e1249 | aa71dcc |
| 24-08-02 | ea720ac | d83bfd6 |
| 24-08-03 | 3d99750 | 5beaaa8 |
| fix | — | 8a2063d |

## Self-Check: PASSED

- FOUND: modules/jira/backend/jira-module-split.test.ts
- FOUND: modules/jira/ui/JiraSyncDialog.tsx
- FOUND: modules/jira/ui/timeline-import/ImportMappingDialog.tsx
- FOUND: modules/jira/backend/routes/import/resource-plan/[id]/handlers.ts
- FOUND: 68e1249, aa71dcc, ea720ac, d83bfd6, 3d99750, 5beaaa8, 8a2063d
