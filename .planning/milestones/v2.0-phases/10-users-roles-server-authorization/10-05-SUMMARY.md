---
phase: 10-users-roles-server-authorization
plan: 05
subsystem: api
tags: [cpmo, users, audit, vitest, postgres, authorization]

requires:
  - phase: 10-users-roles-server-authorization
    provides: user_roles, audit_logs DDL, AccessActor roles from 10-01
provides:
  - CPMO-scoped users.service (list/create/update/lock/unlock/deactivate)
  - users.repo with company-scoped SQL, no DELETE FROM users
  - append-only audit.service auditLog on user mutations
  - withCpmo route wrapper and thin /api/admin/users
affects: [10-11-admin-users-ui]

actuals:
  tokens: 47000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "CPMO user admin via withCpmo + actor.company_id scope (D-21)"
    - "Soft deactivate via status inactive + deleted_at; DELETE route maps to deactivateUser (D-07)"
    - "auditLog INSERT-only on create/update/lock/unlock/deactivate (D-08)"

key-files:
  created:
    - lib/repositories/users.repo.ts
    - lib/repositories/audit.repo.ts
    - lib/services/users.service.ts
    - lib/services/audit.service.ts
    - lib/http/with-role.ts
    - app/api/admin/users/route.test.ts
  modified:
    - app/api/admin/users/route.ts
    - app/api/admin/users/schema.ts
    - lib/db.ts
    - test/repo-db.ts

key-decisions:
  - "CPMO user CRUD scoped to session company_id; platform /api/admin/companies unchanged (D-21)"
  - "Locked username/email reserved globally via findUserByUsername/findUserByEmailLower (D-06, D-12)"
  - "user_roles excluded from INSERT RETURNING id in db clients (composite PK, no id column)"

patterns-established:
  - "withRole/withCpmo composes with withAuth for role-gated admin routes"
  - "users.service assertCpmoCompany mirrors holidays assert + company scope"

requirements-completed: [USER-01, USER-02, USER-03, USER-04, USER-05, USER-06]

coverage:
  - id: D1
    description: CPMO lists/filters users within their company only
    requirement: USER-01
    verification:
      - kind: unit
        ref: lib/services/users.service.unit.test.ts#scopes list to the actor company
        status: pass
      - kind: integration
        ref: lib/repositories/users.repo.test.ts#listUsers returns only rows for the requested company
        status: pass
    human_judgment: false
  - id: D2
    description: Unique username and email including locked accounts
    requirement: USER-02
    verification:
      - kind: unit
        ref: lib/services/users.service.unit.test.ts#throws ConflictError on duplicate username
        status: pass
      - kind: unit
        ref: lib/services/users.service.unit.test.ts#createUser rejects locked user username reuse
        status: pass
    human_judgment: false
  - id: D3
    description: Multi-role union with minimum one role
    requirement: USER-03
    verification:
      - kind: unit
        ref: lib/services/users.service.unit.test.ts#throws ValidationError when roles are empty
        status: pass
    human_judgment: false
  - id: D4
    description: Active/Inactive/Locked status on create and update
    requirement: USER-04
    verification:
      - kind: unit
        ref: lib/repositories/users.repo.test.ts#listUsers filters by status and role
        status: pass
    human_judgment: false
  - id: D5
    description: Lock/unlock/deactivate record actor and time in audit_logs
    requirement: USER-05
    verification:
      - kind: unit
        ref: lib/services/audit.service.unit.test.ts#INSERTs only
        status: pass
      - kind: unit
        ref: lib/services/users.service.unit.test.ts#lockUser sets locked state, clears sessions, and audits
        status: pass
    human_judgment: false
  - id: D6
    description: DELETE deactivates user; no physical DELETE FROM users
    requirement: USER-06
    verification:
      - kind: unit
        ref: app/api/admin/users/route.test.ts#calls deactivateUser not deleteAdminUser
        status: pass
    human_judgment: false
  - id: D7
    description: /api/admin/users CPMO 200/201 vs 401/403
    requirement: USER-01
    verification:
      - kind: unit
        ref: app/api/admin/users/route.test.ts#returns 403 for non-cpmo session
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-26
status: complete
---

# Phase 10 Plan 05: CPMO User Admin API Summary

**CPMO-scoped user service with unique credentials, multi-role union, lock/unlock/deactivate audit trail, and thin /api/admin/users split from platform break-glass routes**

## Performance

- **Duration:** 12 min
- **Tasks:** 3
- **Files modified:** 13
- **Tests:** 30 passing (4 files)

## Accomplishments

- CPMO can list/search/filter users by status, role, and company unit (company_id)
- Create/update enforces unique username and lower(email), min one role, company_id from actor
- auditLog INSERT on create, update, lock, unlock, and deactivate with before/after JSON
- DELETE route calls deactivateUser (soft delete); deleteAdminUser left unused by routes
- lockUser purges sessions for locked user (D-10)

## Task Commits

1. **Task 10-05-01: CPMO user list/create/update** — `d060b67` (test RED), `a1f78ed` (feat)
2. **Task 10-05-02: Thin route + auditLog on create/update** — `a7adffd` (test RED), `99b55cc` (feat)
3. **Task 10-05-03: Lock, unlock, deactivate** — `c5e1b5c` (test RED), `163d175` (feat)

## Files Created/Modified

- `lib/repositories/users.repo.ts` — company-scoped user SQL, roles join, session purge helper
- `lib/services/users.service.ts` — assertCpmoCompany, CRUD + lifecycle with audit
- `lib/services/audit.service.ts` — append-only auditLog wrapper
- `lib/http/with-role.ts` — withCpmo/withRole on withAuth
- `app/api/admin/users/route.ts` — thin CPMO route; no admin.repo user CRUD
- `app/api/admin/users/schema.ts` — roles.min(1), email, password min 8; no is_admin/company_id

## Decisions Made

- Platform `/api/admin/companies` and D-23 leftover routes unchanged (requireAdmin break-glass)
- Self-deactivate returns frozen `{ error: 'Cannot delete yourself' }` 400 on DELETE

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] user_roles INSERT RETURNING id failure**
- **Found during:** Task 10-05-01
- **Issue:** DbClient appended `RETURNING id` to user_roles INSERT; table has composite PK, no id column
- **Fix:** Added `user_roles` to noIdTables in `lib/db.ts` and `test/repo-db.ts`
- **Files modified:** lib/db.ts, test/repo-db.ts
- **Committed in:** a1f78ed

## Issues Encountered

None beyond the user_roles RETURNING id fix above.

## User Setup Required

None.

## Next Phase Readiness

- 10-11 can wire Admin Users tab to `/api/admin/users` with CPMO session
- Platform companies admin remains on break-glass is_admin flag

## Self-Check: PASSED

- lib/repositories/users.repo.ts — FOUND
- lib/services/users.service.ts — FOUND
- lib/services/audit.service.ts — FOUND
- lib/http/with-role.ts — FOUND
- app/api/admin/users/route.ts — FOUND
- app/api/admin/users/route.test.ts — FOUND
- d060b67, a1f78ed, a7adffd, 99b55cc, c5e1b5c, 163d175 — FOUND

---
*Phase: 10-users-roles-server-authorization*
*Completed: 2026-08-26*
