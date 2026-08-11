---
phase: 05-route-thinning-validation
plan: 02
subsystem: api
tags: [nextjs, route-handler, auth-wrapper, tenant-isolation]

requires:
  - phase: 05-route-thinning-validation
    provides: "05-01's lib/http/with-auth.ts, with-project-access.ts wrappers + risks/route.ts reference conversion"
provides:
  - "17 converted app/api/projects/[id]/** route.ts files (parent + 9 single-nesting resources + 7 milestones/budget-tree files) — all wrapped in withProjectAccess, zero local getSessionFromRequest/actorOf/try-catch remaining"
  - "The full 18-file projects/[id]/** tree (17 here + risks from 05-01) is now uniformly one-line-per-handler"
affects: [05-03]

actuals:
  tokens: 11564
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "withProjectAccess<Params> explicit generic instantiation for multi-param routes (milestoneId, itemId, expId) — TParams extends { id: string } & Record<string, string>"
    - "Service-typed body casts (BudgetItemBody, ExpenseBody) replace Record<string, unknown> where the service signature is narrower than a generic body bag"
    - "GET on projects/[id] calls getProject(params.id, actor) directly rather than trusting ctx.project (full row vs tenancy-only row distinction, per plan note)"

key-files:
  created: []
  modified:
    - app/api/projects/[id]/route.ts
    - app/api/projects/[id]/activities/route.ts
    - app/api/projects/[id]/activities/import/route.ts
    - app/api/projects/[id]/issues/route.ts
    - app/api/projects/[id]/meetings/route.ts
    - app/api/projects/[id]/escalations/route.ts
    - app/api/projects/[id]/team/route.ts
    - app/api/projects/[id]/documents/route.ts
    - app/api/projects/[id]/bugs/route.ts
    - app/api/projects/[id]/holidays/route.ts
    - app/api/projects/[id]/milestones/route.ts
    - app/api/projects/[id]/milestones/[milestoneId]/route.ts
    - app/api/projects/[id]/milestones/[milestoneId]/epics/route.ts
    - app/api/projects/[id]/budget/route.ts
    - app/api/projects/[id]/budget/[itemId]/route.ts
    - app/api/projects/[id]/budget/[itemId]/expenses/route.ts
    - app/api/projects/[id]/budget/[itemId]/expenses/[expId]/route.ts

key-decisions:
  - "No test file edits were needed. The admin-bypass assertion in route.access.test.ts (projectAccessRow expected to be called) and the budget/[itemId]/route.test.ts admin fixture were already flipped in 05-01's collateral fix, so all 17 conversions dropped in against already-correct test expectations."
  - "budget/[itemId]/route.ts PUT and budget/[itemId]/expenses/route.ts POST needed BudgetItemBody/ExpenseBody casts instead of Record<string, unknown> — tsc caught that these two services have narrower required-field signatures (name/type, description) than the generic body bag every other converted route uses."

requirements-completed: [ROUTE-05, ROUTE-12]

coverage:
  - id: D1
    description: "Parent route + 9 single-nesting resources (activities, activities/import, issues, meetings, escalations, team, documents, bugs, holidays) converted to withProjectAccess with zero getSessionFromRequest/actorOf/try-catch"
    requirement: "ROUTE-05"
    verification:
      - kind: unit
        ref: "app/api/projects/[id]/{route,activities,activities/import,issues,meetings,escalations,team,documents,bugs,holidays}/*.test.ts — 43 tests, 0 failed"
        status: pass
      - kind: other
        ref: "grep -cE \"getSessionFromRequest|function actorOf|try \\{\" on each of the 10 route.ts files → 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Milestones and budget sub-trees (7 files) converted, including 2-param (milestoneId, itemId) and 3-param (id+itemId+expId) routes, with explicit withProjectAccess<Params> generic instantiation"
    requirement: "ROUTE-05"
    verification:
      - kind: unit
        ref: "app/api/projects/[id]/{milestones,budget}/**/*.test.ts — 28 tests, 0 failed"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit exits 0 — ctx.params.milestoneId/itemId/expId all type-check"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full suite holds baseline exactly (0 failed, 113 skipped) and ROUTE-12 grep gate is clean across app/api/**"
    requirement: "ROUTE-12"
    verification:
      - kind: unit
        ref: "full suite: 592 total / 479 passed / 0 failed / 113 skipped"
        status: pass
      - kind: other
        ref: "grep -rE \"Object\\.keys\\(body\\)\" app/api/ — only 2 pre-existing test-assertion matches in app/api/admin/rag-config/[companyId]/route.test.ts (unrelated to dynamic SQL column assignment, out of this plan's scope)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-11
status: complete
---

# Phase 5 Plan 2: Route Thinning — Project Tree Conversion Summary

**Converted all 17 remaining `app/api/projects/[id]/**` route files onto `withProjectAccess`, completing the 18-file locked-scope tree (combined with 05-01's `risks/route.ts`) as one-line-per-handler controllers with zero local session/auth/try-catch boilerplate.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-11T09:10:00Z
- **Completed:** 2026-08-11T09:50:00Z
- **Tasks:** 3
- **Files modified:** 17 (0 created)

## Accomplishments
- Parent `projects/[id]/route.ts` and 9 single-nesting resources (activities, activities/import, issues, meetings, escalations, team, documents, bugs, holidays) converted to the `withProjectAccess` after-shape proven by 05-01's `risks/route.ts`.
- 7 milestones/budget-tree routes converted, including the two-param (`milestoneId`, `itemId`) and three-param (`id`+`itemId`+`expId`) nested routes, each explicitly instantiating `withProjectAccess<Params>` so `ctx.params` type-checks with the extra keys.
- Every route-specific quirk preserved: `documents` POST's 201-vs-200 conditional, `bugs` GET's `list_dates=1` query branch, `holidays` POST's `{ date, name }` destructure, all DELETE handlers' query-param extraction (`rowId`/`docId`/`date`/`hid`/`activity_id`) staying handler-side.
- `projects/[id]/route.ts` GET deliberately calls `getProject(params.id, actor)` rather than trusting `ctx.project` — the service returns the full project row while `ctx.project` is only the tenancy columns (`ProjectAccessRow`), per the plan's explicit non-conflation note.
- Full 18-file `projects/[id]/**` tree (this plan's 17 + 05-01's `risks/route.ts`) confirmed free of `getSessionFromRequest`/`actorOf`/`try {` by tree-wide grep.
- Full suite held baseline exactly: 592 total / 479 passed / 0 failed / 113 skipped.

## Task Commits

1. **Task 1: Convert parent route + 9 single-nesting resources** - `4be791c` (refactor)
2. **Task 2: Convert milestones and budget sub-trees** - `7a0a64f` (refactor)
3. **Task 3: Phase-tree boundary sweep — full suite, ROUTE-12 grep, tsc, eslint** - verification only, no commit (no code changes)

## Files Created/Modified
- `app/api/projects/[id]/route.ts` - GET/PATCH/DELETE via withProjectAccess; GET calls getProject directly (full row, not ctx.project)
- `app/api/projects/[id]/activities/route.ts` - GET/POST/PUT/DELETE via withProjectAccess
- `app/api/projects/[id]/activities/import/route.ts` - POST/GET via withProjectAccess (no UnknownColumnError branch, unified catch handles it via fallthrough)
- `app/api/projects/[id]/issues/route.ts` - GET/POST/PUT/DELETE via withProjectAccess
- `app/api/projects/[id]/meetings/route.ts` - GET/POST/PUT/DELETE via withProjectAccess
- `app/api/projects/[id]/escalations/route.ts` - GET/PUT via withProjectAccess
- `app/api/projects/[id]/team/route.ts` - GET/POST/PUT/DELETE via withProjectAccess
- `app/api/projects/[id]/documents/route.ts` - GET/POST/PUT/DELETE via withProjectAccess; POST's 201/200 conditional preserved
- `app/api/projects/[id]/bugs/route.ts` - GET/POST/DELETE via withProjectAccess; GET's list_dates query branch preserved
- `app/api/projects/[id]/holidays/route.ts` - GET/POST/DELETE via withProjectAccess
- `app/api/projects/[id]/milestones/route.ts` - GET/POST via withProjectAccess
- `app/api/projects/[id]/milestones/[milestoneId]/route.ts` - PUT/DELETE via withProjectAccess<{ id, milestoneId }>
- `app/api/projects/[id]/milestones/[milestoneId]/epics/route.ts` - GET/POST/DELETE via withProjectAccess<{ id, milestoneId }>
- `app/api/projects/[id]/budget/route.ts` - GET/POST via withProjectAccess
- `app/api/projects/[id]/budget/[itemId]/route.ts` - PUT/DELETE via withProjectAccess<{ id, itemId }>, body cast to BudgetItemBody
- `app/api/projects/[id]/budget/[itemId]/expenses/route.ts` - GET/POST via withProjectAccess<{ id, itemId }>, body cast to ExpenseBody
- `app/api/projects/[id]/budget/[itemId]/expenses/[expId]/route.ts` - DELETE via withProjectAccess<{ id, itemId, expId }>

## Decisions Made
- **No test file edits needed.** The plan anticipated flipping the admin-bypass assertion in `route.access.test.ts` and adding a `projectAccessRow` mock to `budget/[itemId]/route.test.ts` — both were already done as collateral fixes in 05-01's Task 1 commit (the return-row flip's blast radius). All 71 tests across the 17 converted route/test file pairs passed unchanged against the wrapped handlers.
- **BudgetItemBody/ExpenseBody casts, not Record<string, unknown>.** `tsc --noEmit` caught that `updateBudgetItem` and `createExpense` have required fields (`name`/`type`, `description`) narrower than a generic body bag — cast to the service's own exported type instead of loosening the service signature.

## Deviations from Plan

None - plan executed exactly as written. The two anticipated test-flip edits (route.access.test.ts, budget/[itemId]/route.test.ts) turned out to already be in place from 05-01, so no test files needed touching in this plan.

## Issues Encountered
- The RTK shell hook mangles vitest's default reporter output in this environment — used `--reporter=json --outputFile=vt.json` + `node -e` parsing for every run, per the plan's environment note, and deleted the file after each read.
- ROUTE-12 grep (`Object\.keys\(body\)`) surfaced 2 matches in `app/api/admin/rag-config/[companyId]/route.test.ts` — these are test assertions comparing response object keys to an expected `configKeys` list (pre-existing since Phase 2 commit `8447672`, unrelated file outside this plan's scope), not dynamic SQL column assignment from a request body. Not a regression; logged here for visibility, no fix applied (scope boundary).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 17 files in this plan's scope, combined with 05-01's `risks/route.ts`, complete the full 18-file `projects/[id]/**` locked-scope tree conversion.
- Full suite: 592 total / 479 passed / 0 failed / 113 skipped (baseline held exactly).
- `npx tsc --noEmit` and `npx eslint` both clean on all 17 converted files and their test files.
- Ready for 05-03 (Zod schema validation wiring) — every route in this plan's scope currently passes `ctx.body` through without a schema, per the plan's explicit "body-shape-preserving pass-through only" instruction; 05-03 adds the `schema` option to each `withProjectAccess` call.

---
*Phase: 05-route-thinning-validation*
*Completed: 2026-08-11*
