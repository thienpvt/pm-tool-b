---
phase: 02-repository-layer
fixed_at: 2026-08-09T15:03:50.2970619+07:00
review_path: .planning/phases/02-repository-layer/02-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-08-09T15:03:50.2970619+07:00  
**Source review:** `.planning/phases/02-repository-layer/02-REVIEW.md`  
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Null-company branches expose projects assigned to real tenants

**Status:** fixed: requires human verification  
**Files modified:** `lib/repositories/projects.repo.ts`, `lib/repositories/resources.repo.ts`, `lib/repositories/programs.repo.ts`, `lib/repositories/portfolio.repo.ts`, `lib/repositories/tenant-scope.repo.unit.test.ts`  
**Commit:** 132e3b2  
**Applied fix:** Replaced each null-company `OR` ownership branch with a predicate that requires the project and its customer ownership path to be unassigned. Added default-run query-shape coverage for project, resource, portfolio, milestone, and program-count reads.

### CR-02: Scoped updates return foreign child rows after a zero-row update

**Status:** fixed: requires human verification  
**Files modified:** `lib/repositories/activities.repo.ts`, `lib/repositories/budget.repo.ts`, `lib/repositories/escalations.repo.ts`, `lib/repositories/issues.repo.ts`, `lib/repositories/meetings.repo.ts`, `lib/repositories/milestones.repo.ts`, `lib/repositories/operations.repo.ts`, `lib/repositories/portfolio.repo.ts`, `lib/repositories/risks.repo.ts`, `lib/repositories/team.repo.ts`, thirteen direct route callers, `lib/repositories/scoped-updates.repo.unit.test.ts`, `app/api/projects/[id]/budget/[itemId]/route.test.ts`  
**Commit:** 8fb71bf  
**Applied fix:** Converted all thirteen affected scoped updates to return rows from the scoped update statement itself, so zero matches return `undefined`. Direct route callers now return `404`, with repository-wide and route-level regressions proving a foreign child is not returned.

### CR-03: Portfolio milestone selection ignores company scope and admin bypass

**Status:** fixed: requires human verification  
**Files modified:** `lib/repositories/portfolio.repo.ts`, `app/api/portfolio/report/route.ts`, `lib/repositories/portfolio-milestone-selection.repo.unit.test.ts`  
**Commit:** 5e8e7dc  
**Applied fix:** Added explicit `companyId` and `isAdmin` authorization primitives, scoped each selected milestone through its project before loading links, and restricted linked activities to the selected milestone's project. Added non-admin denial and admin-bypass tests.

### WR-01: Repository error mapping exposes raw database errors to clients

**Status:** fixed  
**Files modified:** `lib/api-errors.ts`, `app/api/projects/[id]/budget/[itemId]/route.test.ts`, `app/api/projects/route.test.ts`  
**Commits:** 2a73220, b2148b5  
**Applied fix:** Preserved `UnknownColumnError` as a client-visible `400`, logged unexpected errors server-side, and returned the stable `{ error: 'Internal server error' }` body. Route tests assert internal constraint/error text is absent.

### WR-02: RAG config GET changed its public response shape

**Status:** fixed  
**Files modified:** `lib/repositories/rag-config.repo.ts`, `lib/repositories/rag-config.repo.unit.test.ts`, `app/api/admin/rag-config/[companyId]/route.test.ts`  
**Commit:** 8447672  
**Applied fix:** Restored the explicit eight-column `RagConfig` projection and typed repository result. Added stored-row and fallback response-shape tests that exclude `company_id` and `updated_at`.

### WR-03: Most repository integration coverage is not executable in the default test run

**Status:** fixed  
**Files modified:** `lib/repositories/resources.repo.unit.test.ts`, `lib/repositories/jira-config.repo.unit.test.ts`, `lib/repositories/auth.repo.unit.test.ts`, `lib/repositories/import-mapping.repo.unit.test.ts`, `lib/repositories/demo-requests.repo.unit.test.ts`  
**Commit:** f7a60f7  
**Applied fix:** Added non-skippable mocked-`DbClient` companion suites for all five previously untested repositories. Together with the critical-finding suites, the default run now executes 61 tests instead of 23 without requiring `TEST_DATABASE_URL`; the existing 109 Postgres integration tests remain guarded.

## Verification

- **Isolated review-fix worktree:** nine default-run repository unit files passed, 34 tests total. Next-dependent route tests were deferred because the isolated worktree intentionally had no `node_modules`.
- **Main checkout after fast-forward:** `npx tsc --noEmit` passed.
- **Main checkout after fast-forward:** `npm test -- --run` passed with 61 tests executed and 109 existing database-gated tests skipped.
- **Main checkout after fast-forward:** `npx next build` passed and produced a fresh `.next/BUILD_ID`.
- **Main checkout after fast-forward:** `git diff --check 926bf71..HEAD -- . ':!.planning/'` passed.

---

_Fixed: 2026-08-09T15:03:50.2970619+07:00_  
_Fixer: generic-agent fallback (gsd-code-fixer contract)_  
_Iteration: 1_
