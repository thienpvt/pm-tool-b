---
phase: 06-access-enforcement-rollout
plan: 01
subsystem: api
tags: [withAuth, access-control, shadow-mode, nextjs, vitest]

requires:
  - phase: 05-access-wrappers
    provides: withAuth, withProjectAccess, withProgramAccess, assertProjectAccess (returns row), assertProgramAccess (returns row)
provides:
  - "opts.rawBody on withAuth — skips the wrapper's auto req.json() on POST/PUT/PATCH so formData/multipart handlers can consume the request themselves"
  - "ACCESS_ENFORCEMENT shadow flag in withAuth's catch tail — per-request env read, log-only enforcement for ForbiddenError/NotFoundError"
  - "Shadow-deny re-entry in withProjectAccess/withProgramAccess — assert-only try/catch, handler invoked with project/program undefined on shadow-deny"
affects: [06-02-gate-live-idors, 06-03-report-routes, 06-04-conversions]

actuals:
  tokens: 5620
  tasks: 4
  commits: 3
requirements-completed: [ROUTE-08]

tech-stack:
  added: []
  patterns:
    - "Shadow-mode env flag read inside the request-handling closure (never module scope) so an operator deploy toggles enforcement without a rebuild"
    - "Access wrapper try/catch scoped to ONLY the ownership assert call, never the inner handler call — keeps assert-thrown errors distinguishable from handler-thrown errors so shadow mode can never soften an arbitrary bug"

key-files:
  created: []
  modified:
    - lib/http/with-auth.ts
    - lib/http/with-auth.test.ts
    - lib/http/with-project-access.ts
    - lib/http/with-project-access.test.ts
    - lib/http/with-program-access.ts
    - lib/http/with-program-access.test.ts

key-decisions:
  - "Shadow re-entry mechanism: withAuth exports isAccessShadowMode() and logAccessShadowDenial() helpers; withAuth's own catch tail uses them for routes with no access wrapper, and withProjectAccess/withProgramAccess each wrap ONLY their assert call in a local try/catch that calls the same helpers — avoiding a duplicated shadow implementation while keeping the assert-throw path structurally separate from the handler-throw path (no re-run of the assert, no risk of softening a handler bug)."
  - "rawBody only affects the no-schema POST/PUT/PATCH auto-parse branch; a schema set alongside rawBody still parses/validates unchanged (config error case explicitly out of scope per plan)."
  - "Structured shadow log fields: method, path (nextUrl.pathname), userId, companyId, errorKind (constructor.name), targetId (params.id when present) — single console.error call prefixed '[ACCESS-SHADOW]'."

patterns-established:
  - "Any future access wrapper (a third resource type) should follow the same assert-only try/catch shape shown in withProjectAccess/withProgramAccess rather than adding a new shadow mechanism."

coverage:
  - id: D1
    description: "withAuth supports opts.rawBody, skipping the auto JSON parse on POST/PUT/PATCH so a handler can consume req itself; malformed JSON without rawBody still 400s"
    requirement: "ROUTE-08"
    verification:
      - kind: unit
        ref: "lib/http/with-auth.test.ts#rawBody: true skips the auto req.json() and hands the handler body: undefined on POST"
        status: pass
      - kind: unit
        ref: "lib/http/with-auth.test.ts#rawBody: true lets a non-JSON POST body reach the handler (no 400)"
        status: pass
      - kind: unit
        ref: "lib/http/with-auth.test.ts#without rawBody, malformed JSON still returns 400 Invalid JSON (WR-05 unchanged)"
        status: pass
      - kind: unit
        ref: "lib/http/with-auth.test.ts#rawBody has no effect when a schema is set — schema path still parses"
        status: pass
    human_judgment: false
  - id: D2
    description: "ACCESS_ENFORCEMENT=shadow read per-request in withAuth's catch tail: ForbiddenError/NotFoundError logged and allowed through; unset/off maps to 403/404; UnknownColumnError and arbitrary errors never softened"
    requirement: "ROUTE-08"
    verification:
      - kind: unit
        ref: "lib/http/with-auth.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow ON + ForbiddenError: logs a structured line and allows the request through"
        status: pass
      - kind: unit
        ref: "lib/http/with-auth.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow ON + NotFoundError: logs a structured line and allows the request through"
        status: pass
      - kind: unit
        ref: "lib/http/with-auth.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow OFF (unset): ForbiddenError still 403s, no shadow log, handler called once"
        status: pass
      - kind: unit
        ref: "lib/http/with-auth.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow ON + UnknownColumnError: still 400, never allowed through"
        status: pass
      - kind: unit
        ref: "lib/http/with-auth.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow ON + arbitrary Error: still 500, never allowed through"
        status: pass
      - kind: unit
        ref: "lib/http/with-auth.test.ts#ACCESS_ENFORCEMENT shadow flag > reads ACCESS_ENFORCEMENT per-request, not hoisted at module load"
        status: pass
    human_judgment: false
  - id: D3
    description: "withProjectAccess/withProgramAccess re-enter the handler on shadow-deny with project/program undefined; shadow-off still denies via 403/404; a handler-thrown error (post-assert) is never softened by the flag"
    requirement: "ROUTE-08"
    verification:
      - kind: unit
        ref: "lib/http/with-project-access.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow ON: a cross-company deny still invokes the handler, with project undefined"
        status: pass
      - kind: unit
        ref: "lib/http/with-project-access.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow OFF: a cross-company deny still 403s and never calls the handler"
        status: pass
      - kind: unit
        ref: "lib/http/with-project-access.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow ON: an unrelated handler error (post-assert) is NOT softened, still 500"
        status: pass
      - kind: unit
        ref: "lib/http/with-program-access.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow ON: a cross-company deny still invokes the handler, with program undefined"
        status: pass
      - kind: unit
        ref: "lib/http/with-program-access.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow OFF: a cross-company deny still 403s and never calls the handler"
        status: pass
      - kind: unit
        ref: "lib/http/with-program-access.test.ts#ACCESS_ENFORCEMENT shadow flag > shadow ON: an unrelated handler error (post-assert) is NOT softened, still 500"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full suite stays 0 failed / exactly 113 skipped; lib/services stays clean of next/server; tsc/eslint clean"
    verification:
      - kind: other
        ref: "node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=vt.json => 608 total / 495 passed / 0 failed / 113 pending"
        status: pass
      - kind: other
        ref: "grep -rE next/server|NextRequest|NextResponse lib/services/ => no matches"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit => exit 0"
        status: pass
      - kind: other
        ref: "npx eslint lib/http/ => exit 0"
        status: pass
    human_judgment: false

duration: 32min
completed: 2026-08-11
status: complete
---

# Phase 6 Plan 01: Substrate — rawBody + Shadow Flag Summary

**withAuth gains opts.rawBody (skip auto-parse for formData routes) and a per-request ACCESS_ENFORCEMENT shadow flag; withProjectAccess/withProgramAccess wire assert-only shadow-deny re-entry so future Phase 6 plans can gate new denials without a code change.**

## Performance

- **Duration:** ~32 min
- **Completed:** 2026-08-11T06:36:34Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments
- `opts.rawBody: true` on `withAuth` skips the wrapper's unconditional `req.json()` on POST/PUT/PATCH when no schema is set, unblocking the formData routes (`import/resource-plan/[id]`, `export/ppt/[id]`, `parse-file-headers`) that Phase 6's later plans convert. Malformed JSON without `rawBody` still 400s (WR-05 preserved); a schema set alongside `rawBody` still parses/validates.
- `ACCESS_ENFORCEMENT` shadow flag added to `withAuth`'s catch tail, read via `process.env.ACCESS_ENFORCEMENT === 'shadow'` inside the request closure (never hoisted). When on and the handler throws `ForbiddenError`/`NotFoundError`, logs a structured `[ACCESS-SHADOW]` JSON line (`method`, `path`, `userId`, `companyId`, `errorKind`, `targetId`) and re-invokes the handler instead of mapping to 403/404. `UnknownColumnError` and any other error kind are never softened.
- `withProjectAccess`/`withProgramAccess` each wrap ONLY their `assertProjectAccess`/`assertProgramAccess` call in a local try/catch (not the inner handler call). Shadow-on + Forbidden/NotFound logs via the shared helper and invokes the handler with `project`/`program: undefined`; shadow-off or any other error (including a bug in the handler itself, which this catch never touches) propagates unchanged to withAuth's tail.

## Task Commits

1. **Task 1: opts.rawBody on withAuth** - `72d76b6` (feat) — RED/GREEN: added 4 tests then the `!opts?.rawBody &&` guard on the auto-parse branch.
2. **Task 2: ACCESS_ENFORCEMENT shadow flag in withAuth catch tail** - `737790b` (feat) — RED/GREEN: added 6 tests then `isAccessShadowMode()`/`logAccessShadowDenial()` exports + the catch-tail branch.
3. **Task 3: shadow-deny re-entry in withProjectAccess/withProgramAccess** - `287ce4d` (feat) — RED/GREEN: added 3 tests per wrapper then the assert-only try/catch in each.
4. **Task 4: boundary sweep + summary** - this commit (docs, plan metadata).

_TDD tasks each had a RED (failing test) confirmation before the GREEN implementation edit — no separate test commits were made since the plan grouped test+implementation per task, matching the existing with-auth.test.ts single-file convention._

## Files Created/Modified
- `lib/http/with-auth.ts` - `rawBody?: boolean` on `WrapperOptions`; `isAccessShadowMode()` + `logAccessShadowDenial()` exports; catch tail gains the shadow branch between `UnknownColumnError` and `serviceErrorResponse`.
- `lib/http/with-auth.test.ts` - 4 rawBody tests + 6 shadow-flag tests (ON/OFF, UnknownColumnError/arbitrary-error exclusion, per-request env-flip proof).
- `lib/http/with-project-access.ts` - assert-only try/catch; shadow-deny calls handler with `project: undefined`.
- `lib/http/with-project-access.test.ts` - 3 shadow tests (allow-through+log, deny-when-off, handler-error-not-softened).
- `lib/http/with-program-access.ts` - mirrors with-project-access.ts for the program/customer assert.
- `lib/http/with-program-access.test.ts` - mirrors with-project-access.test.ts.

## Decisions Made
- Shared the shadow mechanism via two exported helpers (`isAccessShadowMode`, `logAccessShadowDenial`) from `with-auth.ts` rather than duplicating the env-read/log-format in three places — the access wrappers import and call them directly.
- Kept the access-wrapper try/catch scoped to the assert call ONLY, never the handler call, so an error thrown by the route's own handler logic can never be misclassified as a would-be access denial — this was the key design choice research flagged as needing explicit code (T-06-02).

## Deviations from Plan

None - plan executed exactly as written. All 4 tasks match their `<action>`/`<acceptance_criteria>` blocks; the "combined tasks 02-03" grouping in the plan's own task 2 action text was followed (shared helpers designed together, implemented across the two commits for task 2 and task 3 respectively).

## Issues Encountered

None. `rtk proxy` was needed once to get past a benign Vite config ESM-warning; the direct `node node_modules/vitest/vitest.mjs run` invocation worked for every other run in this session (both paths produced identical exit codes/JSON reports).

## User Setup Required

None - no external service configuration required. The `ACCESS_ENFORCEMENT` shadow-mode operator rollout (deploy shadow → review Railway logs → flip to enforce) is a manual, later, per-route operator task recorded in the phase's validation doc — not part of this substrate plan.

## Next Phase Readiness
- Plans 06-02 (gate the 8 live IDORs), 06-03 (report routes), and 06-04 (conversions, including the 3 formData routes) can now use `opts.rawBody` and rely on the shadow flag being wired through both access wrappers.
- No blockers. Full suite: 608 total / 495 passed / 0 failed / 113 skipped (up from the 592/479/0/113 baseline by exactly the 16 new mocked tests this plan added).

---
*Phase: 06-access-enforcement-rollout*
*Completed: 2026-08-11*
