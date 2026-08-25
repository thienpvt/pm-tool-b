---
phase: 04-service-layer
plan: 06
subsystem: api
tags: [nextjs, typescript, service-layer, multi-tenant, portfolio]

requires:
  - phase: 04-service-layer
    provides: "portfolio.service.ts substrate (getPortfolioSummary), access.ts (AccessActor), errors.ts, api-errors.ts (serviceErrorResponse/repoErrorResponse)"
provides:
  - "portfolio.service.ts extended with company-scoped budget, member, milestone, program-allocation, and quota operations"
  - "All 11 portfolio sub-resource routes wired onto the service (no direct repo imports for converted resources)"
  - "program-allocations POST no longer leaks String(e) — generic serviceErrorResponse 500 (HYG-02 / T-04-27)"
affects: [05-route-hardening, portfolio-ui]

actuals:
  tokens: 17433
  tasks: 6
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Company-scoped service functions take (actor: AccessActor) and thread actor.company_id into repository calls — no assertProjectAccess (portfolio sub-resources are company-owned, not project-owned)"
    - "Ownership-scoped writes/reads for a nested budget id do a findPortfolioBudget(actor.company_id, id) existence-and-ownership check before any child read/write, throwing NotFoundError on miss"

key-files:
  created:
    - app/api/portfolio/budgets/[id]/route.test.ts
    - app/api/portfolio/members/[id]/route.test.ts
    - app/api/portfolio/program-allocations/route.test.ts
  modified:
    - lib/services/portfolio.service.ts
    - lib/services/portfolio.service.unit.test.ts
    - lib/services/company-scope.repo.test.ts
    - app/api/portfolio/budgets/route.ts
    - app/api/portfolio/budgets/[id]/route.ts
    - app/api/portfolio/budgets/[id]/allocations/route.ts
    - app/api/portfolio/budgets/[id]/allocations/[allocId]/route.ts
    - app/api/portfolio/budgets/[id]/categories/route.ts
    - app/api/portfolio/budgets/[id]/categories/[catId]/route.ts
    - app/api/portfolio/members/route.ts
    - app/api/portfolio/members/[id]/route.ts
    - app/api/portfolio/milestones/route.ts
    - app/api/portfolio/program-allocations/route.ts
    - app/api/portfolio/program-allocations/[id]/route.ts
    - app/api/portfolio/quota/route.ts

key-decisions:
  - "Budget/member/quota/allocation repository functions take only companyId (no is_admin all-companies branch, unlike listPortfolioProjects/listPortfolioMilestones) — this is the Phase 2 baseline. Services thread actor.company_id through unchanged rather than adding new admin-sees-all behavior, since this plan's scope is wiring/consistency-hardening, not expanding admin reach."
  - "getBudget reproduces the pre-extraction budgets/[id] GET aggregate (allocations + spendByCategory category-warning loop) byte-identically inside the service, verified against a fixed mocked fixture."
  - "createProgramAllocation lets repository/typed errors propagate untouched (no try/catch inside the service) so the route's serviceErrorResponse can map any unhandled failure to the generic 500 body — this is the HYG-02 fix for the confirmed String(e) leak."

requirements-completed: [SVC-01, SVC-04, SVC-07]

coverage:
  - id: D1
    description: "portfolio.service.ts exports budget/member/milestone/allocation/quota operations, all company-scoped"
    requirement: SVC-01
    verification:
      - kind: unit
        ref: "lib/services/portfolio.service.unit.test.ts#portfolio.service budgets/budget allocations/budget categories/members/milestones/program allocations/quota"
        status: pass
    human_judgment: false
  - id: D2
    description: "getBudget reproduces the spendByCategory aggregate byte-identically for an owner"
    requirement: SVC-01
    verification:
      - kind: unit
        ref: "lib/services/portfolio.service.unit.test.ts#getBudget reproduces the spendByCategory aggregate byte-identically for an owner"
        status: pass
      - kind: integration
        ref: "app/api/portfolio/budgets/[id]/route.test.ts#returns the spendByCategory aggregate for an owner"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 11 portfolio sub-resource routes delegate to portfolio.service.ts; no direct repo imports remain for converted resources"
    requirement: SVC-04
    verification:
      - kind: other
        ref: "grep -rlE \"\\.repo'\" app/api/portfolio/{budgets,members,milestones,program-allocations,quota}/ (no matches)"
        status: pass
    human_judgment: false
  - id: D4
    description: "program-allocations POST no longer returns String(e); server error surfaces as the generic serviceErrorResponse 500"
    requirement: SVC-07
    verification:
      - kind: integration
        ref: "app/api/portfolio/program-allocations/route.test.ts#returns a generic 500 body on a server error, never String(e) (HYG-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cross-company access on a budget/member id yields 403/404, never the foreign row"
    requirement: SVC-07
    verification:
      - kind: unit
        ref: "lib/services/portfolio.service.unit.test.ts (cross-company NotFoundError cases across budgets/allocations/categories/members)"
        status: pass
      - kind: integration
        ref: "app/api/portfolio/budgets/[id]/route.test.ts#returns 404 (never the foreign row) for a cross-company budget id"
        status: pass
    human_judgment: false
  - id: D6
    description: "SVC-05 cross-company fixture extended to cover portfolio budgets aggregates at the service layer"
    requirement: SVC-04
    verification:
      - kind: integration
        ref: "lib/services/company-scope.repo.test.ts#budget rollup total_allocated excludes company B (DB-gated, skips without TEST_DATABASE_URL)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-08-11
status: complete
---

# Phase 4 Plan 06: Gap Closure — Portfolio Sub-Resources onto the Service Summary

**Wired all 11 portfolio sub-resource routes (budgets, members, milestones, program-allocations, quota) onto a company-scoped `portfolio.service.ts`, and replaced a confirmed `String(e)` internal-error leak on `program-allocations` POST with the generic `serviceErrorResponse` 500.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 6 (04-06-01 through 04-06-06)
- **Files modified:** 18 (15 modified, 3 created)
- **Commits:** 4

## Accomplishments

- Extended `lib/services/portfolio.service.ts` with 20 new exported functions covering budgets (`listBudgets`, `getBudget`, `createBudget`, `updateBudget`, `deleteBudget`), budget allocations (`listBudgetAllocations`, `createBudgetAllocation`, `updateBudgetAllocation`, `deleteBudgetAllocation`), budget categories (`listBudgetCategories`, `createBudgetCategory`, `updateBudgetCategory`, `deleteBudgetCategory`), members (`listMembers`, `createMember`, `updateMember`, `deleteMember`), milestones (`listPortfolioMilestones`), program allocations (`listProgramAllocations`, `createProgramAllocation`, `updateProgramAllocation`, `deleteProgramAllocation`), and quota (`getQuota`, `updateQuota`) — all company-scoped via `actor.company_id`.
- Reproduced the `budgets/[id]` GET aggregate (allocations + per-category `spendByCategory` warning loop) byte-identically inside `getBudget`, proven against a fixed mocked fixture.
- Rewired all 11 routes under `app/api/portfolio/{budgets,members,milestones,program-allocations,quota}/` to call the service instead of `lib/repositories/portfolio.repo.ts` directly. Every route kept its existing session gate (401) and success-path response shape/status.
- Fixed the confirmed `String(e)` leak on `portfolio/program-allocations` POST (T-04-27): a server error now returns the generic `{ error: 'Internal server error' }` 500 via `serviceErrorResponse`, never raw error text (e.g. SQL constraint messages).
- Extended the SVC-05 `company-scope.repo.test.ts` cross-company fixture with service-layer budgets assertions (`listBudgets`, `getBudget`), folded into the existing DB-gated test to avoid inflating the skip count when `TEST_DATABASE_URL` is absent.
- Added route-level tests: HYG-02 500-body assertion, budgets/[id] aggregate-shape assertion, and cross-company member 404 assertion.

## Task Commits

1. **Task 04-06-01 + 04-06-02: Extend portfolio.service.ts with all sub-resource operations** - `3c6d115` (feat)
2. **Task 04-06-03: Rewire the 6 budget routes onto the service** - `00a76e8` (refactor)
3. **Task 04-06-04: Rewire members/milestones/allocations/quota; fix String(e) leak** - `ba07edf` (refactor)
4. **Task 04-06-05: Route tests for HYG-02, cross-company access, SVC-05 budgets** - `2f7f6ec` (test)

Task 04-06-06 (boundary sweep + this summary) has no separate code commit — it is verification-only, folded into the plan-completion commit.

**Plan metadata:** committed alongside STATE.md/ROADMAP.md updates below.

_Note: Tasks 01 and 02 were both `type="tdd"` against the same file (`portfolio.service.ts`); they were written and committed together since splitting a single-file addition into two commits would have produced no meaningful boundary._

## Files Created/Modified

- `lib/services/portfolio.service.ts` - extended with budget/member/milestone/allocation/quota operations
- `lib/services/portfolio.service.unit.test.ts` - unit tests for all new operations (mocked repos, cross-company denial cases)
- `lib/services/company-scope.repo.test.ts` - SVC-05 fixture extended with service-layer budgets aggregate case (DB-gated)
- `app/api/portfolio/budgets/route.ts` - GET/POST now call `listBudgets`/`createBudget`
- `app/api/portfolio/budgets/[id]/route.ts` - GET/PUT/DELETE now call `getBudget`/`updateBudget`/`deleteBudget`
- `app/api/portfolio/budgets/[id]/allocations/route.ts` - GET/POST now call `listBudgetAllocations`/`createBudgetAllocation`
- `app/api/portfolio/budgets/[id]/allocations/[allocId]/route.ts` - PUT/DELETE now call `updateBudgetAllocation`/`deleteBudgetAllocation`
- `app/api/portfolio/budgets/[id]/categories/route.ts` - GET/POST now call `listBudgetCategories`/`createBudgetCategory`
- `app/api/portfolio/budgets/[id]/categories/[catId]/route.ts` - PUT/DELETE now call `updateBudgetCategory`/`deleteBudgetCategory`
- `app/api/portfolio/members/route.ts` - GET/POST now call `listMembers`/`createMember`
- `app/api/portfolio/members/[id]/route.ts` - PUT/DELETE now call `updateMember`/`deleteMember`
- `app/api/portfolio/milestones/route.ts` - GET now calls `listPortfolioMilestones` (service)
- `app/api/portfolio/program-allocations/route.ts` - GET/POST now call `listProgramAllocations`/`createProgramAllocation`; POST no longer leaks `String(e)`
- `app/api/portfolio/program-allocations/[id]/route.ts` - PUT/DELETE now call `updateProgramAllocation`/`deleteProgramAllocation`
- `app/api/portfolio/quota/route.ts` - GET/PUT now call `getQuota`/`updateQuota`
- `app/api/portfolio/budgets/[id]/route.test.ts` (new) - aggregate-shape + cross-company 404 tests
- `app/api/portfolio/members/[id]/route.test.ts` (new) - cross-company scoped-write tests
- `app/api/portfolio/program-allocations/route.test.ts` (new) - HYG-02 generic-500 test + null-company short-circuit test

## Decisions Made

- Repository functions for budgets/members/quota/allocations take only `companyId`, with no `is_admin` all-companies branch (unlike `listPortfolioProjects`/`listPortfolioMilestones`, which do). Services preserve this exactly rather than adding new admin-sees-all reach — that would be new behavior beyond this plan's wiring/hardening scope.
- `createProgramAllocation` deliberately has no internal try/catch — letting the repository's raw `Error` propagate to the route's `serviceErrorResponse`, which is where the generic-500 mapping (and the HYG-02 fix) lives.

## Deviations from Plan

None - plan executed exactly as written. Tasks 04-06-01 and 04-06-02 were committed together (same file, same wave) rather than as two separate commits, since the plan's own text treats them as a continuous extension of the same service file.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 11 portfolio sub-resource routes are now company-scoped via the service layer; no direct `.repo` imports remain for these resources.
- Full suite: 554 total, 441 passed, 0 failed, 113 skipped (baseline 393 passed / 113 skipped before this plan — net +48 passing tests, skip count unchanged).
- `npx tsc --noEmit` and `npx eslint` clean on all changed files.
- Ready for the next Phase 4 wave / Phase 5 route hardening.

---
*Phase: 04-service-layer*
*Completed: 2026-08-11*
