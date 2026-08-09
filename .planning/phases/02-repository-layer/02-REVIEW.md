---
phase: 02-repository-layer
reviewed: 2026-08-09T07:36:55Z
depth: standard
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
  critical: 3
  warning: 3
  info: 0
  total: 6
status: issues_found
---

# Phase 02: Repository Layer Code Review

**Reviewed:** 2026-08-09T07:36:55Z  
**Depth:** standard  
**Files Reviewed:** 126  
**Status:** issues_found

## Narrative Findings (AI reviewer)

The SQL extraction and repository-boundary invariants are structurally in place, but the new boundary still exposes several tenant-scoping holes and response regressions. The allowlist implementation itself is sound: unknown update columns are rejected atomically, tenancy columns are excluded, export generators contain no SQL, repositories do not inspect sessions, id-less settings/Jira writes do not use `lastInsertRowid`, and `lib/auth.ts` is unchanged.

## Critical Issues

### CR-01: Null-company branches expose projects assigned to real tenants

**Severity:** BLOCKER (Critical)  
**Files:** `lib/repositories/projects.repo.ts:74`, `lib/repositories/resources.repo.ts:35`, `lib/repositories/portfolio.repo.ts:36`, `lib/repositories/portfolio.repo.ts:233`, `lib/repositories/programs.repo.ts:42`

**Issue:** The non-admin `companyId === null` branches use `(p.company_id IS NULL OR c.company_id IS NULL)`. Because `c` is a `LEFT JOIN`, `c.company_id` is null whenever a project has no customer. An unassigned user therefore receives any customer-less project even when `p.company_id` belongs to another tenant. The inverse also leaks a project with no direct company when its customer belongs to a tenant. These functions back `/api/projects`, `/api/resources`, `/api/portfolio`, portfolio milestones, and program project counts.

**Fix:** Require both ownership paths to be unassigned. The repository already uses the safer shape at `lib/repositories/portfolio.repo.ts:217`:

```sql
WHERE p.company_id IS NULL
  AND (p.customer_id IS NULL OR c.company_id IS NULL)
```

Apply the equivalent `AND` predicate to every null-company branch and add fixtures for (1) tenant project with no customer, (2) unassigned project with tenant customer, and (3) fully unassigned project.

### CR-02: Scoped updates return foreign child rows after a zero-row update

**Severity:** BLOCKER (Critical)  
**Files:** `lib/repositories/budget.repo.ts:83`, `lib/repositories/activities.repo.ts:66`, `lib/repositories/milestones.repo.ts:39`, `lib/repositories/operations.repo.ts:123`, `lib/repositories/operations.repo.ts:196`, `lib/repositories/portfolio.repo.ts:175`, `lib/repositories/portfolio.repo.ts:378`

**Issue:** These functions correctly scope the `UPDATE` by both child id and parent/project id, but then fetch the response with `SELECT * WHERE id = ?` only. If a caller authorized for project/system/budget A supplies a child id belonging to B, the update changes zero rows and the follow-up query returns B's row. For example, `app/api/projects/[id]/budget/[itemId]/route.ts:26` returns that repository value directly, creating a cross-tenant read even though the mutation guard worked. The same pattern also exists in risks, issues, meetings, team members, escalations, operations incidents, and portfolio allocations/categories. Existing foreign-update tests only assert that the foreign row was not modified; they do not assert that the returned value is absent.

**Fix:** Make the update and read one scoped statement, or scope the follow-up read identically:

```sql
UPDATE budget_items
SET ...
WHERE id = ? AND project_id = ?
RETURNING *
```

Use `db.get(...)` for the `UPDATE ... RETURNING *`, return `undefined` when no row matched, and have routes return `404`. Add a regression assertion that a foreign child id yields no row/body, not the foreign record.

### CR-03: Portfolio milestone selection ignores company scope and admin bypass

**Severity:** BLOCKER (Critical)  
**Files:** `lib/repositories/portfolio.repo.ts:484`, `lib/repositories/portfolio.repo.ts:499`, `app/api/portfolio/report/route.ts:60`, `app/api/portfolio/report/route.ts:490`

**Issue:** `portfolioMilestoneSelection(ids)` accepts only milestone ids and loads milestone, project, program, and linked activity data without `companyId` or `isAdmin`. The report route calls it for caller-controlled `milestone_ids` and later returns `milestoneInfo`, so any authenticated user who can guess an id can retrieve another tenant's milestone name, project/program name, dates, and activity links. This also violates the phase contract that company-scoped repositories receive explicit authorization primitives.

**Fix:** Pass `companyId` and `isAdmin` into `portfolioMilestoneSelection`. Scope the milestone query through `projects` using the report's existing `p.company_id` rule with an explicit admin bypass, and only load epic links after the milestone row passes that scope. Verify linked activities belong to the selected milestone's project. Add non-admin cross-company and admin-bypass tests.

## Warnings

### WR-01: Repository error mapping exposes raw database errors to clients

**Severity:** WARNING  
**File:** `lib/api-errors.ts:18`

**Issue:** `repoErrorResponse` returns `String(e)` for every non-allowlist failure. CodeGraph shows 30 route handlers now call this helper. Several migrated handlers previously let Next.js produce a generic 500, so database constraint names, SQL fragments, connection details, and driver messages can now be returned to clients.

**Fix:** Keep the explicit `UnknownColumnError` 400 response, but log unexpected errors server-side and return a stable generic body such as `{ error: 'Internal server error' }`. Add a route-level test that injects a repository failure and asserts the internal message is not present in the response.

### WR-02: RAG config GET changed its public response shape

**Severity:** WARNING  
**Files:** `lib/repositories/rag-config.repo.ts:11`, `app/api/admin/rag-config/[companyId]/route.ts:21`

**Issue:** Before extraction, the route selected only the eight `RagConfig` fields. `companyRagConfig` now uses `SELECT *`, so a stored row includes `company_id` and `updated_at`, while the no-row fallback still returns only `DEFAULT_RAG_CONFIG`. The endpoint therefore has two different shapes and exposes database metadata that was not part of the API contract.

**Fix:** Restore the explicit eight-column projection and type the result as `RagConfig`. Add a response-shape test for both stored and fallback cases.

### WR-03: Most repository integration coverage is not executable in the default test run

**Severity:** WARNING  
**Files:** `test/db.ts:6`, `lib/repositories/resources.repo.ts:18`, `lib/repositories/jira-config.repo.ts:9`, `lib/repositories/auth.repo.ts:23`, `lib/repositories/import-mapping.repo.ts:14`, `lib/repositories/demo-requests.repo.ts:4`

**Issue:** With `TEST_DATABASE_URL` unset, `npm test -- --run` executes only 23 tests and skips 109. Five new repository modules have no companion test suite at all. Consequently, the null-company branch, milestone selection, foreign-update return value, Jira id-less writes, RAG response shape, and several extracted auth/import flows can regress while CI remains green.

**Fix:** Configure a guarded `*_test` Postgres database in CI so the integration suites run, and add focused non-skippable unit tests with a mocked `DbClient` for query shape/error propagation. At minimum, add suites for `resources`, `jira-config`, `auth`, `import-mapping`, and `demo-requests`, plus the three critical isolation cases above.

## Verification

- `npx tsc --noEmit`: pass
- `npx next build`: pass
- `npm test -- --run`: pass, but only 23 tests executed; 109 skipped across 20 files
- `git diff --check <base>..HEAD -- . ':!.planning/'`: pass
- No `db.get`/`db.all`/`db.run`, SQL literals, `getDb()`, or direct `pg` use remains in application/export source outside the repository/database boundary
- No repository imports `next/server`, `@/lib/auth`, request/session types, or session helpers
- `lib/export/{excel,ppt,word}.ts` contains no SQL
- `lib/repositories/settings.repo.ts` and `lib/repositories/jira-config.repo.ts` contain no `lastInsertRowid`
- `lib/auth.ts` has no diff from `1cd4921864fa3f713c9914a622693547c4a8cdd4^..HEAD`
- The pre-existing missing admin check in `app/api/config/route.ts` was not counted, per the Phase 5/6 deferral

---

_Reviewed: 2026-08-09T07:36:55Z_  
_Reviewer: generic-agent fallback (gsd-code-reviewer contract)_  
_Depth: standard_
