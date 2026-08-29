---
phase: 25-kysely-repositories
plan: 08
subsystem: database
tags: [kysely, portfolio, repository, postgres, tdd]

requires:
  - phase: 25-07
    provides: portfolio sibling repos converted to getKysely pattern
provides:
  - portfolio.repo.ts fully on getKysely (all exports)
  - company-scope tests with testKysely mock
affects: [25-09, portfolio services, portfolio-report]

actuals:
  tokens: 9800
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "sql template for complex aggregates; query builder for CRUD"
    - "deleteResult maps numDeletedRows to legacy { changes } shape"

key-files:
  created: []
  modified:
    - modules/portfolio/backend/repositories/portfolio.repo.ts
    - modules/portfolio/backend/repositories/portfolio.repo.test.ts

key-decisions:
  - "Three sequential slices on one 725-line file to fit context limits"
  - "reportCompanyScopeSql/idScopeSql replace string Scope helpers for Kysely fragments"
  - "listPortfolioReportActivities maps null date fields to undefined for service compatibility without service rewrite"

patterns-established:
  - "Portfolio repo: getKysely only; no getDb import remains"
  - "TDD RED test(25-08) then GREEN feat(25-08) per slice"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "All portfolio.repo.ts exports use getKysely"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/portfolio/backend/repositories/portfolio.repo.test.ts#loads via getKysely"
        status: unknown
    human_judgment: false
  - id: D2
    description: "listPortfolioProjects company-scopes via testKysely"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/portfolio/backend/repositories/portfolio.repo.test.ts#limits callers to their company projects"
        status: unknown
    human_judgment: false
  - id: D3
    description: "Budget create+list company scope"
    verification:
      - kind: unit
        ref: "modules/portfolio/backend/repositories/portfolio.repo.test.ts#createPortfolioBudget then listPortfolioBudgets"
        status: unknown
    human_judgment: false
  - id: D4
    description: "listPortfolioReportProjects company scope"
    verification:
      - kind: unit
        ref: "modules/portfolio/backend/repositories/portfolio.repo.test.ts#listPortfolioReportProjects is company-scoped"
        status: unknown
    human_judgment: false

duration: 25min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 08: portfolio.repo.ts Kysely Summary

**725-line portfolio.repo.ts converted to getKysely in three TDD slices with company-scope tests preserved**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-29T00:53:00Z
- **Completed:** 2026-08-29T01:18:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Slice A: reads, members, quota, bug counts, milestones on getKysely
- Slice B: budgets, categories, allocations, program FTE on getKysely
- Slice C: report helpers and milestone selection on getKysely
- All exported functions retain original signatures (D-06); no service/UI rewrite

## Task Commits

1. **Task 1 RED** - `9dd100c` (test)
2. **Task 1 GREEN** - `a1605f1` (feat)
3. **Task 2 RED** - `2345102` (test)
4. **Task 2 GREEN** - `4dcc09c` (feat)
5. **Task 3 RED** - `bb81290` (test)
6. **Task 3 GREEN** - `ed713d5` (feat)

## Files Created/Modified

- `modules/portfolio/backend/repositories/portfolio.repo.ts` - Full getKysely conversion
- `modules/portfolio/backend/repositories/portfolio.repo.test.ts` - testKysely mock, scope tests

## Decisions Made

- Used `sql` tagged template for complex aggregates (bug counts, FTE, report queries)
- Used query builder for straightforward CRUD (members, budgets, categories)
- Mapped nullable activity date fields to undefined in `listPortfolioReportActivities` to avoid service type breakage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] listPortfolioReportActivities null-to-undefined mapping**
- **Found during:** Task 3
- **Issue:** Kysely returns `string | null`; portfolio-report.service expects optional `string | undefined`
- **Fix:** Map null date fields in repo return
- **Files modified:** portfolio.repo.ts
- **Committed in:** ed713d5

## Issues Encountered

- Vitest suite skipped locally (no TEST_DATABASE_URL); tests structured for CI with hasTestDb gate

## User Setup Required

None

## Next Phase Readiness

- portfolio.repo.ts complete; 25-09+ can proceed with remaining module repos
- Wave verify: `npx vitest run --project node modules/portfolio/backend/repositories`

## Self-Check: PASSED

- FOUND: modules/portfolio/backend/repositories/portfolio.repo.ts
- FOUND: modules/portfolio/backend/repositories/portfolio.repo.test.ts
- FOUND: 9dd100c, a1605f1, 2345102, 4dcc09c, bb81290, ed713d5

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
