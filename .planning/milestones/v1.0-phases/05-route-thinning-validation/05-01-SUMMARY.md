---
phase: 05-route-thinning-validation
plan: 01
subsystem: api
tags: [nextjs, route-handler, auth-wrapper, tenant-isolation, zod-adjacent]

requires:
  - phase: 04-service-layer
    provides: assertProjectAccess/assertProgramAccess SVC-04 asserts, serviceErrorResponse/repoErrorResponse mappers, risks.service.ts
provides:
  - lib/http/with-auth.ts — withAuth(handler, opts?) HOF absorbing session resolution, actor derivation, params await, body parse, unified error-mapping catch tail
  - lib/http/with-project-access.ts — withProjectAccess(handler, opts?) composing withAuth + assertProjectAccess, hands ctx.project
  - lib/http/with-program-access.ts — withProgramAccess(handler, opts?) composing withAuth + assertProgramAccess, hands ctx.program (zero Phase 5 consumers, built for Phase 6)
  - assertProjectAccess flipped to return Promise<ProjectAccessRow> instead of Promise<void>
  - app/api/projects/[id]/risks/route.ts as the reference conversion (one line per handler)
affects: [05-02, 05-03, phase-06-shadow-mode-rollout]

actuals:
  tokens: 8141
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "lib/http/ wrapper HOF: (req, ctx) => Promise<NextResponse> handler shape, ctx = { user, actor, params, body }"
    - "withProjectAccess/withProgramAccess compose withAuth rather than duplicating its catch tail"
    - "assertProjectAccess/assertProgramAccess both return the tenancy row (not void) so wrappers avoid a second query"

key-files:
  created:
    - lib/http/with-auth.ts
    - lib/http/with-auth.test.ts
    - lib/http/with-project-access.ts
    - lib/http/with-project-access.test.ts
    - lib/http/with-program-access.ts
    - lib/http/with-program-access.test.ts
  modified:
    - lib/services/access.ts
    - lib/services/access.unit.test.ts
    - app/api/projects/[id]/risks/route.ts
    - app/api/projects/[id]/risks/route.test.ts
    - app/api/projects/[id]/route.access.test.ts
    - app/api/projects/[id]/budget/[itemId]/route.test.ts

key-decisions:
  - "assertProjectAccess's admin branch now fetches projectAccessRow (it didn't before) so it has a row to return — wire behavior (401/403/404 bodies) is unchanged, only the internal contract changes (HYG-01)."
  - "The return-row flip's blast radius was larger than the plan's '~4 assertions' estimate: ALL 8 assertions in access.unit.test.ts needed updating (every success path resolves the row, not undefined), plus 2 collateral route test files (route.access.test.ts, budget/[itemId]/route.test.ts) whose admin-session fixtures assumed 'admin never queries'. Fixed in the same commit as the flip per HYG-01."
  - "withAuth made generic over TBody (not just TParams) so withProjectAccess/withProgramAccess's WrapperOptions<TBody> type-checks through the composition — the Pattern 1 source in RESEARCH.md was under-specified on this point."

requirements-completed: [ROUTE-01, ROUTE-02, ROUTE-07, ROUTE-05]

coverage:
  - id: D1
    description: "withAuth resolves session, returns 401 on missing session, passes { user, actor, params, body } to handler, and maps thrown errors through the unified catch tail (UnknownColumnError first, then serviceErrorResponse)"
    requirement: "ROUTE-01"
    verification:
      - kind: unit
        ref: "lib/http/with-auth.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "withProjectAccess asserts project ownership before the handler runs and hands the row to ctx.project; denied callers never reach the handler"
    requirement: "ROUTE-02"
    verification:
      - kind: unit
        ref: "lib/http/with-project-access.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "withProgramAccess mirrors withProjectAccess for program/customer scope (zero Phase 5 route consumers, built for Phase 6)"
    verification:
      - kind: unit
        ref: "lib/http/with-program-access.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "assertProjectAccess returns Promise<ProjectAccessRow>; wire behavior (401/403/404 bodies) byte-identical to before the flip"
    requirement: "ROUTE-02"
    verification:
      - kind: unit
        ref: "lib/services/access.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "risks/route.ts converted to withProjectAccess — zero getSessionFromRequest, zero actorOf, zero try/catch, zero await params remaining in the handler bodies"
    requirement: "ROUTE-05"
    verification:
      - kind: unit
        ref: "app/api/projects/[id]/risks/route.test.ts"
        status: pass
      - kind: other
        ref: "grep -v '^//' app/api/projects/[id]/risks/route.ts | grep -cE \"getSessionFromRequest|function actorOf|try \\{\" → 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "UnknownColumnError -> 400-with-columns preserved through the wrapper (T-04-25) — a rejected column on risks PUT stays 400, never 500/403"
    requirement: "ROUTE-07"
    verification:
      - kind: unit
        ref: "app/api/projects/[id]/risks/route.test.ts#PUT rejects an unknown column with 400 naming the column, never 500/403 (T-04-25)"
        status: pass
      - kind: unit
        ref: "lib/http/with-auth.test.ts#maps a thrown UnknownColumnError to 400 naming the columns, never 500/403 (T-04-25)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-11
status: complete
---

# Phase 5 Plan 1: Route Thinning Substrate Summary

**Built `lib/http/` wrapper trio (withAuth, withProjectAccess, withProgramAccess), flipped `assertProjectAccess` to return the project row, and converted `risks/route.ts` to the one-line-per-handler reference shape — the tracer every subsequent Phase 5 route conversion repeats.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-11T08:10:00Z
- **Completed:** 2026-08-11T08:55:00Z
- **Tasks:** 3
- **Files modified:** 12 (6 created, 6 modified)

## Accomplishments
- `lib/http/with-auth.ts` absorbs the `getSessionFromRequest → 401 + actorOf + await params + try/catch → mapError` boilerplate duplicated across 31 route files into one wrapper, with the T-04-25 `UnknownColumnError → repoErrorResponse` branch checked before the `serviceErrorResponse` fallthrough.
- `lib/http/with-project-access.ts` and `lib/http/with-program-access.ts` compose `withAuth` with the respective tenant-ownership assert, handing the resolved row to the handler (`ctx.project` / `ctx.program`) so a converted handler never re-fetches.
- `assertProjectAccess` now returns `Promise<ProjectAccessRow>` (mirroring `assertProgramAccess`), enabling the composition above without a second query per request.
- `app/api/projects/[id]/risks/route.ts` converted to the after-shape: each of GET/POST/PUT/DELETE is a single `NextResponse.json(await <service call>)` line, zero session/auth/try-catch code left inline.

## Task Commits

1. **Task 1: withAuth + withProjectAccess + assertProjectAccess row-flip, proven on risks/route.ts** - `761960f` (feat)
2. **Task 2: withProgramAccess substrate** - `aa13085` (feat)
3. **Task 3: Boundary sweep — full suite, tsc, eslint, baseline confirm** - verification only, no commit (no code changes)

_Note: this was a `type="tdd"` plan — Task 1 followed RED (failing wrapper tests + flipped access.unit.test.ts assertions against the current void-returning `assertProjectAccess`) then GREEN (implementation) within the single task commit, per the tracer task pattern._

## Files Created/Modified
- `lib/http/with-auth.ts` - withAuth HOF: session resolve, actor derivation, params await, body parse, unified catch tail
- `lib/http/with-auth.test.ts` - 401/handler-invocation/malformed-JSON/UnknownColumnError/typed-error-mapping/generic-500 coverage
- `lib/http/with-project-access.ts` - withProjectAccess composing withAuth + assertProjectAccess
- `lib/http/with-project-access.test.ts` - ctx.project handoff, 403/404/401 mapping
- `lib/http/with-program-access.ts` - withProgramAccess composing withAuth + assertProgramAccess (Phase 6 substrate)
- `lib/http/with-program-access.test.ts` - ctx.program handoff, 403/404/401 mapping
- `lib/services/access.ts` - assertProjectAccess return-row flip; admin branch now fetches projectAccessRow
- `lib/services/access.unit.test.ts` - all 8 assertions updated for the return-row flip (admin, owner x2, null-company)
- `app/api/projects/[id]/risks/route.ts` - converted to withProjectAccess, one line per handler
- `app/api/projects/[id]/risks/route.test.ts` - existing 401/403/404/200/201 matrix unchanged + new T-04-25 PUT test
- `app/api/projects/[id]/route.access.test.ts` - fixed admin-session fixture to expect `projectAccessRow` called (collateral from the flip)
- `app/api/projects/[id]/budget/[itemId]/route.test.ts` - fixed admin-session fixture, added `projectAccessRow` mock (collateral from the flip)

## Decisions Made
- **withAuth generic over TBody, not just TParams.** The Pattern 1 source in RESEARCH.md typed `withAuth<TParams>` only; composing it under `withProjectAccess<TParams, TBody>` with `WrapperOptions<TBody>` failed to type-check until `withAuth` also took a `TBody` generic parameter. Fixed without changing wire behavior.
- **Admin branch of `assertProjectAccess` now queries.** Required by the return-row flip — an admin bypass that returns `void` needs no query, but one that returns the row must fetch it. Wire behavior (missing-project still 404s with `{ error: 'Not found' }`) is unchanged; only the internal "no ownership query for admin" T-04-03 comment/behavior changed, and is called out as such in the flipped test names.
- **All 8 access.unit.test.ts assertions updated, not ~4.** RESEARCH.md's Pitfall 1 called out 2 admin-branch assertions as the known flip cost. In practice, every success-path assertion in the file (`resolves.toBeUndefined()`) needed to become `resolves.toEqual(row)` once the return type changed, because the flip touches every return statement, not just the admin one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 2 collateral test files broken by the return-row flip's wider-than-estimated blast radius**
- **Found during:** Task 1 (full-suite verification after the flip)
- **Issue:** `app/api/projects/[id]/route.access.test.ts`'s admin-session test asserted `projectAccessRow` was NOT called (mirroring the pre-flip "no ownership query for admin" contract); `app/api/projects/[id]/budget/[itemId]/route.test.ts`'s admin session fixture had no `projectAccessRow` mock at all, so the now-required fetch resolved `undefined` and 404'd instead of the expected 500-mapping test.
- **Fix:** Updated the admin-session test in `route.access.test.ts` to mock `projectAccessRow` and assert it IS called. Added a `projectAccessRow` mock to `budget/[itemId]/route.test.ts`'s `beforeEach`, resolving an unassigned-row shape so the admin path proceeds past the assert.
- **Files modified:** `app/api/projects/[id]/route.access.test.ts`, `app/api/projects/[id]/budget/[itemId]/route.test.ts`
- **Verification:** Both files pass; full suite green at 592/479/0/113 (skip count exactly matching the 573/460/0/113 baseline's 113).
- **Committed in:** `761960f` (Task 1 commit, same commit as the flip per HYG-01)

**2. [Rule 3 - Blocking] withAuth needed a TBody generic parameter to type-check under composition**
- **Found during:** Task 1 (tsc check after writing with-project-access.ts per the RESEARCH.md Pattern 2 source)
- **Issue:** `withAuth<TParams>` (as specified in RESEARCH.md's proposed source) only parameterized params, not body type. `withProjectAccess<TParams, TBody>` calling `withAuth<TParams>(handler, opts)` where `opts: WrapperOptions<TBody>` failed to type-check — `WrapperOptions<TBody>` is not assignable to `WrapperOptions<unknown>`.
- **Fix:** Added `TBody = unknown` as a second generic parameter to `withAuth`, propagated through `RouteHandler<TParams, TBody>` and the handler's `ctx.body: TBody` cast.
- **Files modified:** `lib/http/with-auth.ts`, `lib/http/with-project-access.ts`
- **Verification:** `npx tsc --noEmit` exits 0.
- **Committed in:** `761960f`

---

**Total deviations:** 2 auto-fixed (1 bug fix on collateral tests, 1 blocking type-generics fix)
**Impact on plan:** Both fixes necessary to land the return-row flip correctly and keep the wrapper type-safe under composition. No scope creep — no additional route.ts files were converted beyond risks/route.ts.

## Issues Encountered
- The RTK shell hook mangles vitest's default reporter output in this environment (unrelated to Phase 5 code) — used `--reporter=json --outputFile=vt.json` + `node -e` parsing for every run, per the plan's environment note, and deleted the file after each read.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The wrapper substrate (`lib/http/with-auth.ts`, `with-project-access.ts`, `with-program-access.ts`) is proven end-to-end on `risks/route.ts` and ready for the mechanical repeat across the remaining `projects/[id]/**` tree (Plans 05-02/05-03).
- `withProgramAccess` ships with zero Phase 5 consumers but full test coverage, ready for Phase 6's `programs/[id]/**` conversion.
- Full suite: 592 total / 479 passed / 0 failed / 113 skipped (baseline held exactly — skip count unchanged from the 573/460/0/113 entering baseline).

---
*Phase: 05-route-thinning-validation*
*Completed: 2026-08-11*
