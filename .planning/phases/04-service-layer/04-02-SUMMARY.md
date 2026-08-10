---
phase: 04-service-layer
plan: 02
subsystem: services
tags: [export, access-control, multi-tenant, security, tdd]

requires:
  - phase: 04-01
    provides: [assertProjectAccess, ForbiddenError, NotFoundError, serviceErrorResponse]
provides:
  - "Session + ownership gate on all six previously-unauthenticated export/import routes"
  - "Actor-parameterized generateProjectPlan / generateKickoffPPT / generateWordDoc"
  - "Admin-only config POST (anthropic_api_key write path)"
affects: [04-03 orchestration services, 04-04 thin resource sweep, ship gate]

actuals:
  tokens: 25941
  tasks: 5
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Export generators take actor as second arg and assert before first repo read"
    - "Thin-wrapper routes call assertProjectAccess in-handler (no service extraction)"
    - "serviceErrorResponse replaces String(e) on export routes"

key-files:
  created:
    - lib/export/excel.unit.test.ts
    - lib/export/ppt.unit.test.ts
    - lib/export/word.unit.test.ts
    - app/api/export/excel/[id]/route.test.ts
    - app/api/export/ppt/[id]/route.test.ts
    - app/api/export/word/[id]/[type]/route.test.ts
    - app/api/export/weekly-report/[id]/route.test.ts
    - app/api/export/resource-plan/[id]/route.test.ts
    - app/api/import/resource-plan/[id]/route.test.ts
  modified:
    - lib/export/excel.ts
    - lib/export/ppt.ts
    - lib/export/word.ts
    - app/api/export/excel/[id]/route.ts
    - app/api/export/ppt/[id]/route.ts
    - app/api/export/word/[id]/[type]/route.ts
    - app/api/export/weekly-report/[id]/route.ts
    - app/api/export/resource-plan/[id]/route.ts
    - app/api/import/resource-plan/[id]/route.ts
    - app/api/config/route.ts

key-decisions:
  - "Keep generators in lib/export/ — assert bolted on, no file move"
  - "weekly-report / resource-plan export+import stay thin wrappers (locked resolution)"
  - "word/ppt signatures place actor second after projectId, shifting extras/docType right"

patterns-established:
  - "Generator defense-in-depth: assert lives inside the service, not only the route"
  - "Route peels session → actor { company_id, is_admin } before calling generator"

requirements-completed: [SVC-06, SVC-07]

coverage:
  - id: D1
    description: "excel/ppt/word generators require actor and assert access before repo reads"
    requirement: SVC-06
    verification:
      - kind: unit
        ref: lib/export/excel.unit.test.ts
        status: pass
      - kind: unit
        ref: lib/export/ppt.unit.test.ts
        status: pass
      - kind: unit
        ref: lib/export/word.unit.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Six export/import routes return 401 unauthenticated and 403 cross-company"
    requirement: SVC-07
    verification:
      - kind: unit
        ref: app/api/export/excel/[id]/route.test.ts
        status: pass
      - kind: unit
        ref: app/api/export/ppt/[id]/route.test.ts
        status: pass
      - kind: unit
        ref: app/api/export/word/[id]/[type]/route.test.ts
        status: pass
      - kind: unit
        ref: app/api/export/weekly-report/[id]/route.test.ts
        status: pass
      - kind: unit
        ref: app/api/export/resource-plan/[id]/route.test.ts
        status: pass
      - kind: unit
        ref: app/api/import/resource-plan/[id]/route.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "config POST requires authenticated admin; GET masking unchanged"
    requirement: SVC-07
    verification:
      - kind: other
        ref: "grep getSessionFromRequest + is_admin in app/api/config/route.ts POST"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-10
status: complete
---

# Phase 4 Plan 2: Close Unauthenticated Export/Import Leaks Summary

Six project-scoped export/import routes and the three document generators now require a session-bearing actor and assert company ownership before any data leaves the server; config POST is admin-only.

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-10T16:18:32Z
- **Completed:** 2026-08-10T16:24:20Z
- **Tasks:** 5/5
- **Files modified:** 19

## Accomplishments

- Bolted `assertProjectAccess` into `generateProjectPlan`, `generateKickoffPPT`, `generateWordDoc` (actor second param; `NotFoundError` replaces untyped throws)
- Session-gated excel/ppt/word routes; `serviceErrorResponse` replaces `String(e)` 500s; headers byte-identical
- Thin session+assert wrappers on weekly-report, resource-plan export, resource-plan import (write path)
- Admin-only config POST (HYG-02) — previously unauthenticated write of `anthropic_api_key`
- Route + unit tests: full suite 344 total / 235 passed / 109 skipped / 0 failed

## Task Commits

1. **Task 1: Gate export generators** - `97bff34` (feat)
2. **Task 2: Rewire excel/ppt/word routes** - `879a036` (feat)
3. **Task 3: Thin wrap remaining export/import** - `7886c69` (feat)
4. **Task 4: Admin-gate config POST** - `9ad3a7d` (feat)
5. **Task 5: Route 401/403/owner tests** - `ca96ec3` (test)

## Files Created/Modified

- `lib/export/{excel,ppt,word}.ts` — actor param + assert-first + NotFoundError
- `lib/export/{excel,ppt,word}.unit.test.ts` — denied skips repos; ForbiddenError; admin Buffer
- `app/api/export/excel|ppt|word/**/route.ts` — session → actor → generator; serviceErrorResponse
- `app/api/export/weekly-report|resource-plan/**` + `app/api/import/resource-plan/**` — thin assert
- `app/api/config/route.ts` — POST 401/403 admin gate; GET masking untouched
- Six `route.test.ts` files covering 401/403/owner headers

## Decisions Made

- No relocation of export modules (CONTEXT: behavior, not file moves)
- weekly-report / resource-plan stay in-route (locked thin-wrapper resolution)
- Actor always second after `projectId` even when that shifts `extras` / `docType`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] prefer-const in excel getMonths**
- **Found during:** Task 5 (eslint on changed files)
- **Issue:** Pre-existing `let d = new Date(...)` where only mutation via `setMonth` occurs — eslint error on a file this plan touched
- **Fix:** `let` → `const`
- **Files modified:** lib/export/excel.ts
- **Commit:** ca96ec3

Otherwise: plan executed as written. Pre-existing unused-var warnings in word/excel left alone (out of scope).

### TDD Gate Compliance

- Task 1 tests + implementation in one feat commit (single-commit-per-task protocol); suite green before commit
- No separate RED commit — matches 04-01 pattern for this milestone

## Requirement Coverage

| Requirement | Evidence |
|-------------|----------|
| SVC-06 | Generators require actor; assert before first repo read; unit tests prove mocks uncalled on deny |
| SVC-07 | Six routes + config POST return 401/403; owner retains Content-Type/Disposition |

## Threat Surface

| Flag | File | Description |
|------|------|-------------|
| mitigated T-04-06 | export excel/ppt/word | Unauthenticated bulk exfiltration closed |
| mitigated T-04-07 | import/resource-plan | Unauthenticated write closed |
| mitigated T-04-08 | config POST | Credential write requires admin |
| mitigated T-04-09 | lib/export/* | Assert inside generators (defense in depth) |
| mitigated T-04-10 | export routes | serviceErrorResponse stops String(e) leak |
| none new | — | No endpoints/schemas beyond plan threat model |

## Known Stubs

None.

## Self-Check: PASSED

- [x] lib/export/excel.ts actor + assert + NotFoundError (FOUND)
- [x] lib/export/ppt.ts actor + assert + NotFoundError (FOUND)
- [x] lib/export/word.ts actor + assert (FOUND)
- [x] Six routes contain getSessionFromRequest (FOUND)
- [x] config POST admin gate (FOUND)
- [x] Unit + route tests (FOUND)
- [x] commits 97bff34, 879a036, 7886c69, 9ad3a7d, ca96ec3 (FOUND)
- [x] Full suite 0 failed / 109 skipped (FOUND)
