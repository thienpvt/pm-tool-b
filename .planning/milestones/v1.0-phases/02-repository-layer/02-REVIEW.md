---
phase: 02-repository-layer
reviewed: 2026-08-09T08:18:03Z
depth: standard
reviewer: "generic-agent fallback (gsd-code-reviewer contract)"
files_reviewed: 126
files_reviewed_list:
  - 'app/api/admin/companies/route.ts'
  - 'app/api/admin/demo-requests/route.ts'
  - 'app/api/admin/jira-config/[companyId]/route.ts'
  - 'app/api/admin/rag-config/[companyId]/route.ts'
  - 'app/api/admin/resource-audit/route.ts'
  - 'app/api/admin/users/route.ts'
  - 'app/api/auth/change-password/route.ts'
  - 'app/api/auth/complete-onboarding/route.ts'
  - 'app/api/auth/login/route.ts'
  - 'app/api/bug-import-mapping/[id]/route.ts'
  - 'app/api/bug-import-mapping/route.ts'
  - 'app/api/config/route.ts'
  - 'app/api/demo-requests/route.ts'
  - 'app/api/export/portfolio/members/route.ts'
  - 'app/api/export/resource-plan/[id]/route.ts'
  - 'app/api/import-mapping/[id]/route.ts'
  - 'app/api/import-mapping/route.ts'
  - 'app/api/jira/fields/route.ts'
  - 'app/api/jira/jql-presets/[id]/route.ts'
  - 'app/api/jira/jql-presets/route.ts'
  - 'app/api/jira/search/route.ts'
  - 'app/api/jira/sync-mappings/route.ts'
  - 'app/api/jira/test/route.ts'
  - 'app/api/operations/systems/[id]/budget-items/[itemId]/route.ts'
  - 'app/api/operations/systems/[id]/budget-items/route.ts'
  - 'app/api/operations/systems/[id]/expenses/[expId]/route.ts'
  - 'app/api/operations/systems/[id]/expenses/route.ts'
  - 'app/api/operations/systems/[id]/incidents/[incId]/route.ts'
  - 'app/api/operations/systems/[id]/incidents/route.ts'
  - 'app/api/operations/systems/[id]/route.ts'
  - 'app/api/operations/systems/route.ts'
  - 'app/api/portfolio/budgets/[id]/allocations/[allocId]/route.ts'
  - 'app/api/portfolio/budgets/[id]/allocations/route.ts'
  - 'app/api/portfolio/budgets/[id]/categories/[catId]/route.ts'
  - 'app/api/portfolio/budgets/[id]/categories/route.ts'
  - 'app/api/portfolio/budgets/[id]/route.ts'
  - 'app/api/portfolio/budgets/route.ts'
  - 'app/api/portfolio/bug-assignees/route.ts'
  - 'app/api/portfolio/members/[id]/route.ts'
  - 'app/api/portfolio/members/route.ts'
  - 'app/api/portfolio/milestones/route.ts'
  - 'app/api/portfolio/program-allocations/[id]/route.ts'
  - 'app/api/portfolio/program-allocations/route.ts'
  - 'app/api/portfolio/quota/route.ts'
  - 'app/api/portfolio/report/generate-email/route.ts'
  - 'app/api/portfolio/report/route.ts'
  - 'app/api/portfolio/roadmap/epics/route.ts'
  - 'app/api/portfolio/roadmap/route.ts'
  - 'app/api/portfolio/route.ts'
  - 'app/api/programs/[id]/project-allocations/route.ts'
  - 'app/api/programs/[id]/route.ts'
  - 'app/api/programs/route.ts'
  - 'app/api/projects/[id]/activities/import/route.ts'
  - 'app/api/projects/[id]/activities/route.ts'
  - 'app/api/projects/[id]/budget/[itemId]/expenses/[expId]/route.ts'
  - 'app/api/projects/[id]/budget/[itemId]/expenses/route.ts'
  - 'app/api/projects/[id]/budget/[itemId]/route.ts'
  - 'app/api/projects/[id]/budget/route.ts'
  - 'app/api/projects/[id]/bugs/route.ts'
  - 'app/api/projects/[id]/documents/route.ts'
  - 'app/api/projects/[id]/escalations/route.ts'
  - 'app/api/projects/[id]/holidays/route.ts'
  - 'app/api/projects/[id]/issues/route.ts'
  - 'app/api/projects/[id]/meetings/route.ts'
  - 'app/api/projects/[id]/milestones/[milestoneId]/epics/route.ts'
  - 'app/api/projects/[id]/milestones/[milestoneId]/route.ts'
  - 'app/api/projects/[id]/milestones/route.ts'
  - 'app/api/projects/[id]/project-report/generate-email/route.ts'
  - 'app/api/projects/[id]/project-report/route.ts'
  - 'app/api/projects/[id]/report/route.ts'
  - 'app/api/projects/[id]/risks/route.ts'
  - 'app/api/projects/[id]/route.test.ts'
  - 'app/api/projects/[id]/route.ts'
  - 'app/api/projects/[id]/team/route.ts'
  - 'app/api/projects/route.ts'
  - 'app/api/resources/route.ts'
  - 'lib/api-errors.ts'
  - 'lib/db.ts'
  - 'lib/export/excel.ts'
  - 'lib/export/ppt.ts'
  - 'lib/export/word.ts'
  - 'lib/repositories/ALLOWLIST-DIFF.md'
  - 'lib/repositories/_helpers.test.ts'
  - 'lib/repositories/_helpers.ts'
  - 'lib/repositories/activities.repo.test.ts'
  - 'lib/repositories/activities.repo.ts'
  - 'lib/repositories/admin.repo.test.ts'
  - 'lib/repositories/admin.repo.ts'
  - 'lib/repositories/auth.repo.ts'
  - 'lib/repositories/budget.repo.test.ts'
  - 'lib/repositories/budget.repo.ts'
  - 'lib/repositories/bugs.repo.test.ts'
  - 'lib/repositories/bugs.repo.ts'
  - 'lib/repositories/demo-requests.repo.ts'
  - 'lib/repositories/documents.repo.test.ts'
  - 'lib/repositories/documents.repo.ts'
  - 'lib/repositories/escalations.repo.test.ts'
  - 'lib/repositories/escalations.repo.ts'
  - 'lib/repositories/holidays.repo.test.ts'
  - 'lib/repositories/holidays.repo.ts'
  - 'lib/repositories/import-mapping.repo.ts'
  - 'lib/repositories/issues.repo.test.ts'
  - 'lib/repositories/issues.repo.ts'
  - 'lib/repositories/jira-config.repo.ts'
  - 'lib/repositories/meetings.repo.test.ts'
  - 'lib/repositories/meetings.repo.ts'
  - 'lib/repositories/milestones.repo.test.ts'
  - 'lib/repositories/milestones.repo.ts'
  - 'lib/repositories/operations.repo.test.ts'
  - 'lib/repositories/operations.repo.ts'
  - 'lib/repositories/portfolio.repo.test.ts'
  - 'lib/repositories/portfolio.repo.ts'
  - 'lib/repositories/programs.repo.test.ts'
  - 'lib/repositories/programs.repo.ts'
  - 'lib/repositories/projects.repo.test.ts'
  - 'lib/repositories/projects.repo.ts'
  - 'lib/repositories/rag-config.repo.test.ts'
  - 'lib/repositories/rag-config.repo.ts'
  - 'lib/repositories/resources.repo.ts'
  - 'lib/repositories/risks.repo.test.ts'
  - 'lib/repositories/risks.repo.ts'
  - 'lib/repositories/settings.repo.test.ts'
  - 'lib/repositories/settings.repo.ts'
  - 'lib/repositories/team.repo.test.ts'
  - 'lib/repositories/team.repo.ts'
  - 'test/repo-db.ts'
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 02: Repository Layer Code Review

**Reviewed:** 2026-08-09T08:18:03Z
**Depth:** standard
**Files Reviewed:** 126
**Status:** clean

## Narrative Findings (AI reviewer)

The re-review found no remaining Critical, Warning, or Info findings in the 126-file scope. The six findings from the prior review are resolved, and the repository extraction still satisfies the phase boundary and allowlist invariants.

## Resolution Check

| Prior finding | Resolution verified |
|---|---|
| CR-01 | All five null-company query paths now require both direct project ownership and customer ownership to be unassigned. |
| CR-02 | All 13 affected update functions use scoped `RETURNING *`/CTE behavior, and their direct route callers return `404` when no scoped row matches. |
| CR-03 | Portfolio milestone selection accepts `companyId`/`isAdmin`, scopes through the selected project, and limits linked activities to that project. |
| WR-01 | `repoErrorResponse` logs unexpected failures server-side and returns the generic `Internal server error` response. |
| WR-02 | RAG config reads project only the eight public response fields. |
| WR-03 | Five non-skippable repository unit suites cover the previously untested modules; the default run now executes 61 tests. |

Documented route-authorization work deferred to Phases 5 and 6 was not reclassified as a Phase 02 defect because the extraction did not introduce or change that behavior.

## Verification

- `npx tsc --noEmit`: pass
- `npx next build`: pass
- `npm test -- --run`: pass; 15 files passed, 20 skipped; 61 tests passed, 109 skipped
- `git diff --check 926bf71..HEAD -- . ':!.planning/'`: pass
- No `db.get`/`db.all`/`db.run`, SQL literals, `getDb()`, or direct `pg` use remains in application/export source outside the repository/database boundary
- No repository imports `next/server`, `@/lib/auth`, request/session types, or session helpers
- `lib/export/{excel,ppt,word}.ts` contains no SQL
- `lib/repositories/settings.repo.ts` and `lib/repositories/jira-config.repo.ts` contain no `lastInsertRowid`
- `lib/auth.ts` has no diff from `1cd4921864fa3f713c9914a622693547c4a8cdd4^..HEAD`
- CodeGraph caller checks confirm each scoped update and milestone-selection function is wired through the reviewed routes

---

_Reviewed: 2026-08-09T08:18:03Z_
_Reviewer: generic-agent fallback (gsd-code-reviewer contract)_
_Depth: standard_
