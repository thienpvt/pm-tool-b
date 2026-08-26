---
phase: 10-users-roles-server-authorization
plan: 02
subsystem: auth
tags: [vitest, sessions, scrypt, pm_session, roles]

requires:
  - phase: 10-users-roles-server-authorization
    provides: SessionUser with roles/status, getSessionUser non-active gate from 10-01
provides:
  - extendSession helper updating expires_at in place (D-11)
  - POST /api/auth/session/extend without cookie rotation (AUTH-02)
  - Logout and mid-session invalidation test coverage (AUTH-03, AUTH-06, D-10)
  - GET /api/auth/me exposes roles and status (USER-03, D-01, D-05)
affects: [10-03, 10-11, sidebar-role-gating]

actuals:
  tokens: 3200
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "SESSION_DURATION_MS shared by createSession and extendSession"
    - "extendSession UPDATE ... WHERE expires_at > now returns boolean from changes count"
    - "Dedicated POST /api/auth/session/extend — no auto-extend on /me (A5, D-11)"

key-files:
  created:
    - lib/auth.session.unit.test.ts
    - app/api/auth/session/extend/route.ts
    - app/api/auth/session/extend/route.test.ts
    - app/api/auth/logout/route.test.ts
    - app/api/auth/me/route.test.ts
  modified:
    - lib/auth.ts
    - app/api/auth/me/route.ts

key-decisions:
  - "Extracted SESSION_DURATION_MS constant shared by createSession and extendSession"
  - "extend route returns unauthorized() without Set-Cookie on success — cookie value unchanged (D-11)"

patterns-established:
  - "Session extend: UPDATE in place, boolean from db.run changes, no new session id"
  - "Auth route tests mock @/lib/auth helpers via vi.hoisted partial mocks"

requirements-completed: [AUTH-02, AUTH-03, AUTH-06, USER-03]

coverage:
  - id: D1
    description: "Valid session extends 7 days without rotating pm_session cookie"
    requirement: AUTH-02
    verification:
      - kind: unit
        ref: "lib/auth.session.unit.test.ts#extendSession UPDATEs expires_at"
        status: pass
      - kind: unit
        ref: "app/api/auth/session/extend/route.test.ts#returns 200 without rotating cookie"
        status: pass
    human_judgment: false
  - id: D2
    description: "Logout deletes server session and clears browser cookie"
    requirement: AUTH-03
    verification:
      - kind: unit
        ref: "app/api/auth/logout/route.test.ts#deletes the session and clears pm_session"
        status: pass
    human_judgment: false
  - id: D3
    description: "Locked/inactive mid-session invalidates session row via getSessionUser"
    requirement: AUTH-06
    verification:
      - kind: unit
        ref: "lib/auth.session.unit.test.ts#getSessionUser locked/inactive cases"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /api/auth/me returns roles and status from SessionUser"
    requirement: USER-03
    verification:
      - kind: unit
        ref: "app/api/auth/me/route.test.ts#returns roles and status"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-26
status: complete
---

# Phase 10 Plan 02: Session Extend, Logout, and /me Roles Summary

**In-place session extend via UPDATE expires_at (same pm_session cookie), logout/mid-session invalidation tests, and /api/auth/me exposing roles and status**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-25T18:26:00Z
- **Completed:** 2026-08-25T18:27:30Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `extendSession` and `POST /api/auth/session/extend` — refreshes `expires_at` without rotating the cookie (D-11, AUTH-02)
- Backfilled unit tests for locked/inactive mid-session invalidation and logout cookie clearing (D-10, AUTH-03, AUTH-06)
- Extended `GET /api/auth/me` JSON with `roles` and `status` from SessionUser (D-01, D-05, USER-03)

## Task Commits

1. **Task 1: Extend session in place without rotating cookie**
   - `a7ba016` test(10-02): RED extendSession and session extend route tests
   - `ee0bdc6` feat(10-02): extend session in place without rotating cookie
2. **Task 2: Invalidate mid-session and prove logout**
   - `28f2964` test(10-02): logout route and mid-session invalidation tests
3. **Task 3: Expose roles and status on GET /api/auth/me**
   - `f27ee6b` test(10-02): RED me route roles and status tests
   - `d465f5b` feat(10-02): expose roles and status on GET /api/auth/me

## Files Created/Modified

- `lib/auth.ts` — `SESSION_DURATION_MS`, `extendSession`
- `lib/auth.session.unit.test.ts` — extendSession and getSessionUser status gate tests
- `app/api/auth/session/extend/route.ts` — POST extend endpoint
- `app/api/auth/session/extend/route.test.ts` — extend route tests
- `app/api/auth/logout/route.test.ts` — logout tests (production route unchanged)
- `app/api/auth/me/route.ts` — added roles and status to JSON
- `app/api/auth/me/route.test.ts` — me route tests

## Decisions Made

- Extracted `SESSION_DURATION_MS` so create and extend share the same 7-day window
- Extend success returns `{ ok: true }` with no Set-Cookie — preserves draft state in browser (D-11)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest 4 does not support `-x` flag referenced in plan verify commands; ran without it

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Session policy (extend, logout, mid-session revoke, /me roles) ready for downstream UI and admin plans
- 10-03+ can build on `/api/auth/me` roles without a second source of truth

## Self-Check: PASSED

- FOUND: `.planning/phases/10-users-roles-server-authorization/10-02-SUMMARY.md`
- FOUND: a7ba016, ee0bdc6, 28f2964, f27ee6b, d465f5b
- All 17 auth tests pass

---
*Phase: 10-users-roles-server-authorization*
*Completed: 2026-08-26*
