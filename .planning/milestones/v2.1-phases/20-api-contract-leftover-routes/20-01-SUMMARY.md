---
phase: 20-api-contract-leftover-routes
plan: 01
subsystem: api
tags: [proxy, middleware, vitest, auth, json-401]

requires:
  - phase: 19-data-layer-cutover
    provides: Stable app shell with external migrate; proxy unchanged until this plan
provides:
  - Edge JSON 401 for unauthenticated /api/* via pathname prefix (D-01, D-02)
  - Vitest proof in lib/http/proxy.auth.test.ts (6 cases)
  - Page redirect and PUBLIC pass-through preserved (PROXY-01)
affects: [20-02, 20-03, ENF-01, client fetch error handling]

actuals:
  tokens: 565
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pathname /api/ prefix (not Accept) selects JSON 401 at proxy edge"
    - "Same { error: 'Unauthorized' } string as withAuth"

key-files:
  created:
    - lib/http/proxy.auth.test.ts
  modified:
    - proxy.ts

key-decisions:
  - "D-01: API vs page detection uses pathname.startsWith('/api/'), never Accept header"
  - "D-02: Unauthenticated API proxy returns { error: 'Unauthorized' } matching withAuth"

patterns-established:
  - "PUBLIC.some check stays before unauthenticated branch; API 401 only after PUBLIC miss"

requirements-completed: [PROXY-01]

coverage:
  - id: D1
    description: "Unauthenticated /api/* returns JSON 401 Unauthorized (pathname prefix, D-01/D-02)"
    requirement: PROXY-01
    verification:
      - kind: unit
        ref: "lib/http/proxy.auth.test.ts#returns JSON 401 for unauthenticated /api/*"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unauthenticated non-API pages redirect to /login with from= pathname"
    requirement: PROXY-01
    verification:
      - kind: unit
        ref: "lib/http/proxy.auth.test.ts#redirects unauthenticated page requests to /login"
        status: pass
    human_judgment: false
  - id: D3
    description: "PUBLIC API paths and session cookie pass through without JSON 401"
    requirement: PROXY-01
    verification:
      - kind: unit
        ref: "lib/http/proxy.auth.test.ts#passes through PUBLIC /api/health"
        status: pass
      - kind: unit
        ref: "lib/http/proxy.auth.test.ts#does not JSON 401 API requests with pm_session cookie"
        status: pass
    human_judgment: false
  - id: D4
    description: "Static-asset matcher bypass unchanged"
    requirement: PROXY-01
    verification:
      - kind: other
        ref: "node proxy.matcher.test.mjs"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 01: Proxy JSON 401 Summary

**Edge proxy returns JSON `{ error: 'Unauthorized' }` at 401 for unauthenticated `/api/*` (pathname prefix); pages still redirect to login; PUBLIC paths unchanged.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-28T07:16:00Z
- **Completed:** 2026-08-28T07:17:10Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Added `isApi` branch in `proxy.ts` returning `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` for unauthenticated API requests (D-01, D-02, PROXY-01)
- Preserved page redirect to `/login?from=` and `/` → `/landing` behavior
- Added `lib/http/proxy.auth.test.ts` with 6 Vitest cases covering API 401, page redirect, PUBLIC pass-through, session cookie, and landing redirect
- Confirmed `proxy.matcher.test.mjs` still passes — matcher config untouched

## Task Commits

Each task was committed atomically:

1. **Task 20-01-01: End-to-end unauthenticated /api/projects JSON 401 and page login redirect** — `5131829` (test RED), `0204c45` (feat GREEN)
2. **Task 20-01-02: PUBLIC API pass-through and session cookie skip JSON 401** — `7706235` (test; no feat commit — PUBLIC order already correct from task 1)
3. **Task 20-01-03: Matcher regression still bypasses static assets** — verification only (no file changes; `node proxy.matcher.test.mjs` ok)

**Plan metadata:** pending (docs commit)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `5131829` test(20-01): red proxy json 401 and page redirect | Pass |
| GREEN | `0204c45` feat(20-01): proxy json 401 for api paths | Pass |
| REFACTOR | — | Skipped (not needed) |

Task 20-01-02 tests passed on first run (expected — PUBLIC check was already before unauthenticated branch).

## Files Created/Modified

- `lib/http/proxy.auth.test.ts` — Vitest contract tests for proxy auth behavior
- `proxy.ts` — One-line JSON 401 branch for unauthenticated `isApi` paths

## Decisions Made

- D-01: Pathname `/api/` prefix selects JSON 401; no Accept-header branching
- D-02: Error body matches `withAuth`: `{ error: 'Unauthorized' }`
- PUBLIC.some remains at line 27, before the unauthenticated block at line 29

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PROXY-01 edge contract proven; ready for plan 20-02 (Jira search / leftover routes)
- Matcher regression guard still green

## Self-Check: PASSED

- FOUND: lib/http/proxy.auth.test.ts
- FOUND: proxy.ts (isApi JSON 401 branch)
- FOUND: 5131829, 0204c45, 7706235
- Verification: `npx vitest run lib/http/proxy.auth.test.ts` — 6 passed
- Verification: `node proxy.matcher.test.mjs` — ok

---
*Phase: 20-api-contract-leftover-routes*
*Completed: 2026-08-28*
