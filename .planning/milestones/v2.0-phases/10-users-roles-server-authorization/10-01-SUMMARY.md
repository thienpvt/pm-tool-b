---
phase: 10-users-roles-server-authorization
plan: 01
subsystem: auth
tags: [roles, scrypt, vitest, postgres, access-control, session]

requires: []
provides:
  - migrateUsersRolesAndAudit in getDb migrate loop
  - SessionUser.roles/status/email with getSessionUser active gate
  - AccessActor + toAccessActor + assertCanMutate in lib/services/access.ts
  - Login status gate (inactive/locked → 401, no session)
  - Viewer POST createRisk 403 route proof
affects: [10-02, 10-03, 10-10]

actuals:
  tokens: 18500
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Settings-flag idempotent DDL/backfill (db-roles.ts mirrors db-mapping-tenant.ts)"
    - "toAccessActor peels full actor from SessionUser in withAuth"
    - "Tenant assert then assertCanMutate in mutating services"

key-files:
  created:
    - lib/db-roles.ts
    - app/api/auth/login/route.test.ts
    - app/api/projects/[id]/risks/route.access.test.ts
    - lib/db-roles.backfill.unit.test.ts
  modified:
    - lib/auth.ts
    - lib/services/access.ts
    - lib/http/with-auth.ts
    - lib/services/risks.service.ts
    - app/api/auth/login/route.ts
    - lib/db.ts
    - lib/repositories/auth.repo.ts
    - test/repo-db.ts

key-decisions:
  - "AccessActor canonical type lives in lib/services/access.ts; with-auth imports toAccessActor"
  - "Role strings stored lowercase: cpmo, pm, viewer"
  - "Backfill skips null company_id users; does not mutate is_admin from roles"

patterns-established:
  - "assertCanMutate throws ForbiddenError for viewer-only; composes after assertProjectAccess"
  - "Login and getSessionUser both reject non-active status with same denial semantics"

requirements-completed: [AUTH-01, AUTH-04, AUTH-05, AUTH-06, USER-03, USER-04]

coverage:
  - id: D1
    description: "Inactive/Locked login returns 401 without session cookie"
    requirement: AUTH-06
    verification:
      - kind: unit
        ref: app/api/auth/login/route.test.ts#returns 401 with generic body for inactive user
        status: pass
      - kind: unit
        ref: app/api/auth/login/route.test.ts#returns 401 with generic body for locked user
        status: pass
    human_judgment: false
  - id: D2
    description: "Active login still sets pm_session cookie"
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: app/api/auth/login/route.test.ts#returns 200 and sets pm_session
        status: pass
    human_judgment: false
  - id: D3
    description: "SessionUser.roles reach ctx.actor via toAccessActor"
    requirement: USER-03
    verification:
      - kind: unit
        ref: lib/http/with-auth.test.ts#passes user, actor, params, and body
        status: pass
      - kind: unit
        ref: lib/http/with-program-access.test.ts#hands the resolved program row
        status: pass
    human_judgment: false
  - id: D4
    description: "Viewer-only POST createRisk returns 403 Forbidden"
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: app/api/projects/[id]/risks/route.access.test.ts#returns 403 Forbidden for a viewer-only
        status: pass
    human_judgment: false
  - id: D5
    description: "Role backfill maps is_admin=1→cpmo, else pm; idempotent"
    requirement: USER-04
    verification:
      - kind: unit
        ref: lib/db-roles.backfill.unit.test.ts
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-26
status: complete
---

# Phase 10 Plan 01: Auth Spine Tracer Summary

**Roles schema in getDb, login status gate, SessionUser.roles on AccessActor, and Viewer createRisk 403 — end-to-end authorization spine before expanding mutators**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-26T01:22:00+07:00
- **Completed:** 2026-08-26T01:25:00+07:00
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Added `migrateUsersRolesAndAudit` (users status/email columns, `user_roles`, `audit_logs`, idempotent backfill) wired into `getDb()` after mapping tenancy migration
- Extended `SessionUser` with `roles`, `status`, `email`; `getSessionUser` deletes session and returns null for non-active users
- Login rejects inactive/locked with existing 401 body; active login unchanged
- Canonical `AccessActor` + `toAccessActor` + `assertCanMutate`; `withAuth` builds full actor; `createRisk` calls `assertCanMutate` after tenant check
- Route-level Viewer POST risks 403 test proves server-side mutate deny (not UI-only)

## Task Commits

1. **Task 10-01-01 RED:** `029ea27` (test) — failing login status, assertCanMutate, viewer risks 403, actor roles tests
2. **Task 10-01-01 GREEN:** `435bc9f` (feat) — auth spine production implementation
3. **Task 10-01-02:** `db3d984` (test) — backfill idempotency and cpmo/pm mapping unit tests

## Files Created/Modified

- `lib/db-roles.ts` — Idempotent DDL + `backfillUserRoles` with `roles_backfill_v1` flag
- `lib/services/access.ts` — Extended `AccessActor`, `hasRole`, `toAccessActor`, `assertCanMutate`
- `lib/auth.ts` — Session roles aggregation, mid-session status invalidation
- `lib/http/with-auth.ts` — Uses `toAccessActor(user)` instead of two-field inline actor
- `app/api/auth/login/route.ts` — Status gate before `createSession`
- `app/api/projects/[id]/risks/route.access.test.ts` — Viewer POST 403 proof

## Decisions Made

- `AccessActorSource` type in access.ts avoids auth ↔ access circular import while keeping `toAccessActor` in access.ts
- Login uses `user?.status ?? 'active'` for pre-migration compatibility
- Backfill implemented in task 1 tracer; task 2 adds hermetic mocked-pool unit tests only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest 4 on this project does not accept `-x` CLI flag; ran without it
- `npm install` required on fresh checkout before tests could run

## Next Phase Readiness

- Spine shape locked for plans 10-02 (session extend / me), 10-03 (CPMO/PM assignment asserts), 10-10 (remaining two-field actor peels)
- `assertProjectAccess` admin bypass unchanged (10-03 owns D-13 inversion)

## Self-Check: PASSED

- lib/db-roles.ts: FOUND
- app/api/auth/login/route.test.ts: FOUND
- app/api/projects/[id]/risks/route.access.test.ts: FOUND
- lib/db-roles.backfill.unit.test.ts: FOUND
- Commits 029ea27, 435bc9f, db3d984: FOUND

---
*Phase: 10-users-roles-server-authorization*
*Completed: 2026-08-26*
