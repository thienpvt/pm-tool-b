---
phase: 06-access-enforcement-rollout
plan: 05
subsystem: api
tags: [access-control, withProgramAccess, withAuth, next-app-router, idor]

requires:
  - phase: 06-01
    provides: "withProgramAccess wrapper (composes withAuth + assertProgramAccess, shadow-deny path)"
provides:
  - "programs/[id] GET/PUT/DELETE wrapped by withProgramAccess"
  - "programs/[id]/project-allocations GET/DELETE/POST wrapped by withProgramAccess, with the T-04-22 inline body-field assertProjectAccess preserved on POST"
  - "portfolio/program-allocations GET/POST wrapped by plain withAuth (company-scoped, no [id] param)"
affects: [06-06, 06-VERIFICATION]

actuals:
  tokens: 3300
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Program-scoped routes drop raw getSessionFromRequest + local actorOf() plumbing in favor of withProgramAccess, matching the projects/[id] tree convention."
    - "Wrapper-level assert is additive/idempotent to a service's own internal assert (defense in depth) — never a replacement for it."
    - "A body-field ownership assert (not reachable by any route wrapper because it targets a resource named inside the JSON body, not the URL param) stays inline in the handler."

key-files:
  created: []
  modified:
    - "app/api/programs/[id]/route.ts"
    - "app/api/programs/[id]/project-allocations/route.ts"
    - "app/api/portfolio/program-allocations/route.ts"
    - "app/api/portfolio/program-allocations/route.test.ts"

key-decisions:
  - "programs/[id] GET/PUT/DELETE handlers ignore ctx.program and re-call getProgramDetail/updateProgram/deleteProgram (which self-assert) — same pattern as projects/[id]/route.ts's GET calling getProject(params.id, actor) rather than trusting ctx.project."
  - "project-allocations POST keeps assertProjectAccess(project_id, actor) as an explicit inline await after the wrapper's program-side assert already ran — the wrapper physically cannot see a body field, so removing this call would silently reopen the T-04-22 write IDOR."
  - "portfolio/program-allocations moved to plain withAuth, not withProgramAccess, because it lists/allocates across ALL of a company's programs — there is no single [id] param for a wrapper assert to key off."

patterns-established:
  - "Program-route wrapper conversion pattern: withProgramAccess for anything under programs/[id]/**, withAuth for anything company-scoped with no single program id in the path."

requirements-completed: [ROUTE-03, ROUTE-04, ROUTE-10]

coverage:
  - id: D1
    description: "programs/[id] GET/PUT/DELETE converted to withProgramAccess; response shapes preserved"
    requirement: "ROUTE-03"
    verification:
      - kind: unit
        ref: "app/api/programs/[id]/route.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "programs/[id]/project-allocations GET/DELETE/POST converted to withProgramAccess; POST's inline assertProjectAccess(body.project_id) preserved (T-04-22 two-sided write IDOR fix); allocated_headcount clamp preserved"
    requirement: "ROUTE-04"
    verification:
      - kind: unit
        ref: "app/api/programs/[id]/project-allocations/route.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "portfolio/program-allocations GET/POST converted to plain withAuth (company-scoped, no [id] param)"
    requirement: "ROUTE-10"
    verification:
      - kind: unit
        ref: "app/api/portfolio/program-allocations/route.test.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-11
status: complete
---

# Phase 6 Plan 05: Convert the Program Routes Summary

**withProgramAccess gets its first 3 consumers — programs/[id] and its project-allocations sub-route move onto the Phase 5 wrapper, and the company-scoped portfolio/program-allocations lands on plain withAuth, with the T-04-22 inline body-field assert on project-allocations POST kept exactly where it was.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-11T06:30:00Z
- **Completed:** 2026-08-11T06:55:19Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `app/api/programs/[id]/route.ts` (GET/PUT/DELETE) converted from raw `getSessionFromRequest` + local `actorOf()` to `withProgramAccess`; the service layer's own `assertProgramAccess` inside `getProgramDetail`/`updateProgram`/`deleteProgram` is untouched (defense-in-depth, matches the projects tree).
- `app/api/programs/[id]/project-allocations/route.ts` (GET/DELETE/POST) converted to `withProgramAccess` for the program-side assert. POST's `await assertProjectAccess(body.project_id, ctx.actor)` stays inline — the wrapper only ever sees `ctx.params.id` (the program), and `project_id` is a value buried in the JSON body that no wrapper mechanism can reach. Removing it would silently re-open the T-04-22 write IDOR (allocating another tenant's project into your program). The `Math.max(0, Number(allocated_headcount) || 0)` clamp is unchanged.
- `app/api/portfolio/program-allocations/route.ts` (GET/POST) converted to plain `withAuth` — this route is company-scoped (lists/allocates across all of a company's programs), so there is no single `[id]` for a program-ownership wrapper to key off.

## Task Commits

Each task was committed atomically:

1. **Task 06-05-01: Convert programs/[id] to withProgramAccess** - `ef608cf` (refactor)
2. **Task 06-05-02: Convert project-allocations + portfolio/program-allocations** - `de116bb` (refactor)
3. **Task 06-05-03: Test updates for the wrapped shape** - test file changes landed inside the shared working tree and were swept into a concurrent executor's commit `92b6ac8` (`fix(06-04): session-gate config GET + wrap portfolio/members and config in withAuth`) — see Deviations below. Content verified correct and present in `git show HEAD:app/api/portfolio/program-allocations/route.test.ts`.

**Plan metadata:** (this commit)

## Files Created/Modified
- `app/api/programs/[id]/route.ts` - GET/PUT/DELETE wrapped by withProgramAccess
- `app/api/programs/[id]/project-allocations/route.ts` - GET/DELETE/POST wrapped by withProgramAccess; POST keeps inline assertProjectAccess(body.project_id)
- `app/api/portfolio/program-allocations/route.ts` - GET/POST wrapped by plain withAuth
- `app/api/portfolio/program-allocations/route.test.ts` - updated GET/POST test calls to pass the wrapper's ctx.params stub argument (route handlers now take `(req, ctx)` via `withAuth` instead of `(req)` only)

## Decisions Made
- programs/[id] handlers ignore `ctx.program` and re-invoke the service functions directly (`getProgramDetail(params.id, actor)` etc.) rather than trusting the wrapper-provided row — mirrors `app/api/projects/[id]/route.ts`'s GET, which intentionally re-fetches the full row rather than using the wrapper's tenancy-only row.
- Kept the inline `assertProjectAccess(project_id, actor)` on project-allocations POST as a hard requirement, not a stylistic choice — it is the only line proving the allocated project is owned by the caller, since `withProgramAccess` only ever proves the program is owned.
- portfolio/program-allocations placed on `withAuth`, not `withProgramAccess`, since `assertProgramAccess` requires a single `ctx.params.id`, and this route has none (company-wide aggregate).

## Deviations from Plan

### Process note (not a Rule 1-4 auto-fix)

**1. Test-file commit landed inside a concurrent executor's commit**

This executor runs sequentially on the shared main working tree alongside 3 parallel executors (06-02/06-03/06-04) touching disjoint files. After staging the `route.test.ts` update for `app/api/portfolio/program-allocations/` with `git add`, a subsequent `git commit` by this executor found "nothing to commit" (twice) — the file's staged diff had already been swept into a concurrent executor's commit (first `17703f4`, then re-occurred and landed in `92b6ac8`, `fix(06-04): session-gate config GET + wrap portfolio/members and config in withAuth`) because git's index is shared across the working tree and commands from different agents interleaved.

- **Found during:** Task 06-05-03 (test updates)
- **Verification:** Confirmed via `git show HEAD:app/api/portfolio/program-allocations/route.test.ts` that the file's committed content is exactly the intended update (both `GET`/`POST` test calls now pass `params()` matching the wrapper signature); `node node_modules/vitest/vitest.mjs run "app/api/programs" "app/api/portfolio/program-allocations"` reports 23/23 passing, 0 failed.
- **Impact:** None on correctness — the change is present and correct in git history, just attributed to a commit message from another plan's task. No file content was lost or duplicated.

---

**Total deviations:** 1 (process/attribution only, no code correctness impact)
**Impact on plan:** All 3 routes convert cleanly with zero behavior change; the test-file commit-attribution quirk is cosmetic (shared-tree race), not a functional issue.

## Issues Encountered
- Full-suite run showed 1 failing test (`app/api/parse-file-headers/route.test.ts`) belonging to a parallel executor's in-flight work (06-02 scope, disjoint files) — not touched by this plan. Scoped run of `app/api/programs` + `app/api/portfolio/program-allocations` (this plan's actual files) is 23/23 green with 0 failed, matching the acceptance criteria for 06-05.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `withProgramAccess` now has real consumers; the wrapper substrate built in Phase 5/06-01 is proven end-to-end.
- No blockers for remaining Phase 6 waves. Full-suite skip count held at 113 for this plan's scope.

---
*Phase: 06-access-enforcement-rollout*
*Completed: 2026-08-11*
