---
phase: 20-api-contract-leftover-routes
plan: 02
subsystem: api
tags: [jira, withAuth, zod, vitest, nextjs]

requires:
  - phase: 20-api-contract-leftover-routes
    provides: withAuth Invalid JSON pattern from plan 01 (D-03)
provides:
  - Jira search POST migrated to withAuth + jiraSearchSchema
  - Malformed JSON returns 400 { error: 'Invalid JSON' }
  - Debug custom-field console.log removed from success path
affects: [20-api-contract-leftover-routes]

actuals:
  tokens: 2084
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "withAuth + colocated schema.ts for Jira search POST"
    - "vi.hoisted mocks for credentials and searchIssues in route tests"

key-files:
  created:
    - app/api/jira/search/schema.ts
    - app/api/jira/search/route.test.ts
  modified:
    - app/api/jira/search/route.ts

key-decisions:
  - "jql is optional in schema with handler guard so {} body returns frozen 'jql là bắt buộc' under Zod 4"
  - "Freeze tests for company/creds/jql shipped in RED commit with task 1 tests"

patterns-established:
  - "Jira integration routes: withAuth schema + credential block before searchIssues"

requirements-completed: [JIRA-01]

coverage:
  - id: D1
    description: Malformed POST to /api/jira/search returns 400 { error: 'Invalid JSON' } via withAuth
    requirement: JIRA-01
    verification:
      - kind: unit
        ref: "app/api/jira/search/route.test.ts#returns 400 Invalid JSON for malformed POST body (D-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: Success path does not log issue field payloads
    requirement: JIRA-01
    verification:
      - kind: unit
        ref: "app/api/jira/search/route.test.ts#returns 200 on success without dumping issue field payloads (JIRA-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: Null company_id 401, missing creds 503, missing jql 400 preserve pre-plan shapes
    requirement: JIRA-01
    verification:
      - kind: unit
        ref: "app/api/jira/search/route.test.ts#returns 401 when session company_id is null"
        status: pass
      - kind: unit
        ref: "app/api/jira/search/route.test.ts#returns 503 when Jira credentials are missing"
        status: pass
      - kind: unit
        ref: "app/api/jira/search/route.test.ts#returns 400 jql là bắt buộc for empty body"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 02: Jira Search withAuth Summary

**Jira search POST uses withAuth + schema for Invalid JSON 400 and drops the custom-field debug log (JIRA-01, D-03)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-28T07:19:00Z
- **Completed:** 2026-08-28T07:24:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Migrated `POST /api/jira/search` to `withAuth(..., { schema: jiraSearchSchema })`
- Malformed JSON returns `{ error: 'Invalid JSON' }` at 400 (D-03)
- Removed first-issue custom-field `console.log` dump (JIRA-01)
- Preserved Vietnamese 401 (null company) and 503 (missing creds) responses
- Preserved `jql là bắt buộc` 400 for missing/empty jql

## Task Commits

Each task was committed atomically:

1. **Task 20-02-01 RED+tests:** `cd7b216` (test) — Invalid JSON, no-dump, and freeze cases
2. **Task 20-02-01 GREEN:** `ae98758` (feat) — withAuth migration, schema, dump removal
3. **Task 20-02-03:** Covered by commits above — freeze tests included in RED; no route tweak needed beyond schema optional-jql adjustment

**Plan metadata:** `eec411d` (docs: complete plan)

## Files Created/Modified

- `app/api/jira/search/schema.ts` — `jiraSearchSchema` with jql validation
- `app/api/jira/search/route.test.ts` — six route-level contract tests
- `app/api/jira/search/route.ts` — `withAuth` handler; debug log removed

## Decisions Made

- Made `jql` optional in Zod schema so `{}` hits the handler's frozen `jql là bắt buộc` check (Zod 4 returns a generic message for missing required strings)
- Included task-2 freeze tests in the RED commit to avoid a redundant test-only commit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod 4 missing-field message for empty body**
- **Found during:** Task 20-02-01 GREEN
- **Issue:** `{}` body returned `{ error: 'Invalid input: expected string, received undefined' }` instead of frozen `jql là bắt buộc`
- **Fix:** `jql` optional in schema; handler `if (!jql)` preserves freeze message
- **Files modified:** app/api/jira/search/schema.ts
- **Verification:** `npx vitest run app/api/jira/search/route.test.ts` — 6/6 pass
- **Committed in:** ae98758

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal schema tweak preserves behavior freeze; no credential/client edits.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | cd7b216 test(20-02): red jira search json 400 and no dump | Pass |
| GREEN | ae98758 feat(20-02): jira search withAuth and drop field dump | Pass |
| REFACTOR | — | Skipped (not needed) |

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- JIRA-01 satisfied for jira/search route
- Ready for remaining phase 20 plans and phase verification

## Self-Check: PASSED

- FOUND: app/api/jira/search/route.ts
- FOUND: app/api/jira/search/schema.ts
- FOUND: app/api/jira/search/route.test.ts
- FOUND: cd7b216
- FOUND: ae98758

---
*Phase: 20-api-contract-leftover-routes*
*Completed: 2026-08-28*
