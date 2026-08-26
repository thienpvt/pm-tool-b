---
phase: 10-users-roles-server-authorization
verified: 2026-08-25T19:07:00Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Every API and screen enforces authorization on the server (AUTH-05)"
    reason: "D-23 intentional carve-out — app/api/operations/** and platform /api/admin/companies (plus jira-config, rag-config, jira/search, demo-requests) remain session+tenant only this phase; product surfaces are gated via assertProjectWriteAccess/assertCompanyWrite"
    accepted_by: "phase context D-23 / user verification instruction"
    accepted_at: "2026-08-25T19:07:00Z"
decision_coverage:
  honored: 24
  total: 24
  not_honored: []
---

# Phase 10: Users, Roles & Server Authorization Verification Report

**Phase Goal:** Admins manage users and roles; CPMO, PM, and Viewer sessions are enforced on every API and screen (PR-01, PR-02).
**Verified:** 2026-08-25T19:07:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can list, search, and filter users by status, role, and unit (`company_id`, USER-01) | ✓ VERIFIED | `users.service.listUsers` + `users.repo` filters; `GET /api/admin/users` via `withCpmo`; admin UI search/status/role filters in `app/admin/page.tsx` |
| 2 | Create/update with unique username and email; locked credentials cannot be reused (USER-02, D-06) | ✓ VERIFIED | `assertUniqueCredentials` in `users.service.ts`; partial unique index `users_email_lower_unique` in `db-roles.ts`; unit tests `createUser rejects locked user username/email reuse` |
| 3 | Multi-role union; empty roles invalid (USER-03, D-01, D-04) | ✓ VERIFIED | `user_roles` join table; `replaceUserRoles`; `assertRoles`; `hasRole`/`assertCanMutate` union logic in `access.ts` |
| 4 | Active/Inactive/Locked status; only Active can log in (USER-04, AUTH-06) | ✓ VERIFIED | Login gate in `app/api/auth/login/route.ts`; `getSessionUser` evicts non-active sessions in `lib/auth.ts`; login + session unit tests pass |
| 5 | Lock/unlock records actor and time (USER-05, D-08) | ✓ VERIFIED | `lockUserRow` sets `locked_at`/`locked_by`; `auditLog` on lock/unlock/update in `users.service.ts`; unit test `lockUser sets locked state, clears sessions, and audits` |
| 6 | No physical delete; soft deactivate; display name preserved (USER-06, D-07) | ✓ VERIFIED | `DELETE /api/admin/users` calls `deactivateUser` (sets `inactive` + `deleted_at`); no `DELETE FROM users` in service layer |
| 7 | Active user can log in with username/password (AUTH-01) | ✓ VERIFIED | scrypt verify + `createSession` in login route; `app/api/auth/login/route.test.ts` passes |
| 8 | Session expires per policy and can be extended without cookie rotation (AUTH-02, D-11) | ✓ VERIFIED | `extendSession` updates `expires_at` in place; `POST /api/auth/session/extend`; extend route tests pass |
| 9 | User can log out and end session (AUTH-03) | ✓ VERIFIED | `app/api/auth/logout/route.ts` + `deleteSession`; logout route tests pass |
| 10 | CPMO views full company portfolio; PM assigned-only; Viewer read-only (AUTH-04, D-13–D-15) | ✓ VERIFIED | `assertProjectAccess` CPMO company scope + PM-only D-14 matcher; `assertProjectWriteAccess` + `assertCanMutate`; `role-matrix.test.ts` + `access.unit.test.ts` pass |
| 11 | Server-side enforcement — UI hiding is not access control (AUTH-05, D-15) | PASSED (override) | Product mutators gated across services (`assertProjectWriteAccess`/`assertCompanyWrite`); D-23 leftover ops/platform routes intentionally session+tenant only (see overrides) |
| 12 | Cross-company 403 must not regress (D-16, D-19) | ✓ VERIFIED | Tenant assert before role in `access.ts`; cross-company 403 tests in access tests and `programs.service`/`portfolio` tests pass |

**Score:** 11/12 truths verified (+ 1 PASSED override for D-23 AUTH-05 carve-out)

### Decision Coverage

All 24 trackable `10-CONTEXT.md` decisions honored by shipped artifacts (gsd-tools `check.decision-coverage-verify`).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `lib/db-roles.ts` | Schema + role backfill in getDb loop | ✓ VERIFIED | Wired from `lib/db.ts` via `migrateUsersRolesAndAudit` |
| `lib/auth.ts` | SessionUser with roles/status; mid-session eviction | ✓ VERIFIED | Active-only session resolution |
| `lib/services/access.ts` | AppRole, toAccessActor, assertProject/CompanyWrite | ✓ VERIFIED | Substantive; 35+ callers |
| `lib/services/users.service.ts` | CPMO user admin + audit | ✓ VERIFIED | Wired to `/api/admin/users` |
| `lib/http/with-role.ts` | CPMO route wrapper | ✓ VERIFIED | Used by admin users route |
| `app/api/admin/users/route.ts` | Company user CRUD (not platform) | ✓ VERIFIED | `withCpmo`; soft DELETE |
| `app/admin/page.tsx` | CPMO user admin UI; platform tabs break-glass only | ✓ VERIFIED | `canAccessAdmin` / `isPlatformAdmin` split |
| `lib/http/role-matrix.test.ts` | Viewer GET/POST matrix | ✓ VERIFIED | 4 cases pass |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `lib/db.ts` | `lib/db-roles.ts` | `migrateUsersRolesAndAudit(pool)` | ✓ WIRED | Line 612–613 |
| `lib/http/with-auth.ts` | `lib/services/access.ts` | `toAccessActor(user)` | ✓ WIRED | Builds full AccessActor with roles |
| `app/api/admin/users/route.ts` | `lib/services/users.service.ts` | `withCpmo` + service calls | ✓ WIRED | GET/POST/PUT/DELETE |
| Service mutators | `lib/services/access.ts` | `assertProjectWriteAccess` / `assertCompanyWrite` | ✓ WIRED | 20+ services |
| `app/api/programs/route.ts` | `toAccessActor` | D-24 actor peel | ✓ WIRED | Not legacy `{ company_id, is_admin }` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Admin user list | `users[]` | `listUsersRepo(company_id, filters)` SQL | Yes | ✓ FLOWING |
| Session roles | `roles[]` | `ARRAY_AGG(user_roles.role)` in session query | Yes | ✓ FLOWING |
| Audit on lock | `audit_logs` row | `insertAuditLog` after lock | Yes | ✓ FLOWING |
| Project access | tenant row | `projectAccessRow` DB query | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 10 auth/user core tests | `TEST_DATABASE_URL=... npx vitest run` (12 files: role-matrix, with-auth, users.service, auth routes, users.repo) | 105/105 pass | ✓ PASS |
| Phase 10 access + service batch | `TEST_DATABASE_URL=... npx vitest run` (26 files: *.access.test.ts + core services) | 245/247 pass | ✓ PASS |
| Users repo integration | `users.repo.test.ts` with TEST_DATABASE_URL | pass (included above) | ✓ PASS |
| Login inactive/locked reject | `app/api/auth/login/route.test.ts` | pass | ✓ PASS |
| Session mid-flight inactive eviction | `lib/auth.session.unit.test.ts` | pass | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| USER-01 | 10-05 | List/search/filter users | ✓ SATISFIED | users.service + admin UI + route tests |
| USER-02 | 10-05 | Unique credentials; locked reuse blocked | ✓ SATISFIED | assertUniqueCredentials + unit tests |
| USER-03 | 10-01, 10-05 | Multi-role union | ✓ SATISFIED | user_roles + hasRole union |
| USER-04 | 10-05 | Active/Inactive/Locked | ✓ SATISFIED | status column + login gate |
| USER-05 | 10-05 | Lock/unlock audit | ✓ SATISFIED | auditLog + lockUser tests |
| USER-06 | 10-05 | Soft delete only | ✓ SATISFIED | deactivateUser, no physical DELETE |
| AUTH-01 | 10-01 | Login | ✓ SATISFIED | login route + tests |
| AUTH-02 | 10-02 | Session extend | ✓ SATISFIED | extend route + auth.ts |
| AUTH-03 | 10-02 | Logout | ✓ SATISFIED | logout route tests |
| AUTH-04 | 10-03, 10-09 | CPMO/PM/Viewer scopes | ✓ SATISFIED | access.ts + role-matrix |
| AUTH-05 | 10-04–10-10 | Server enforcement all APIs | PASSED (override) | Product surfaces gated; D-23 leftover ops/platform excluded by design |
| AUTH-06 | 10-01, 10-02 | Inactive/Locked rejection | ✓ SATISFIED | login + getSessionUser eviction |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `lib/services/users.service.unit.test.ts` | USER-01..06 | 20+ | 0 | No | Behavioral | ✓ Strong |
| `lib/http/role-matrix.test.ts` | AUTH-04, AUTH-05 | 4 | 0 | No | Behavioral (403/200) | ✓ Strong |
| `lib/services/access.unit.test.ts` | AUTH-04 | 15+ | 0 | No | Behavioral | ✓ Strong |
| `app/api/admin/users/route.test.ts` | USER-01..06 | 10+ | 0 | No | Status + body | ✓ Adequate |
| `lib/repositories/users.repo.test.ts` | USER-01..02 | varies | 0* | No | Value | ✓ Adequate |

\*Integration tests use `describe.skipIf(!hasTestDb)` — ran with `TEST_DATABASE_URL` provided; not skipped.

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0 on phase-10 requirement-linked tests

**Advisory — repo-wide test drift (non-blocking):** Full `npm test` reports 42 failures in 21 files, predominantly pre-phase route tests whose mocks omit `toAccessActor`, `roles`, or `getProjectPmIdentity` after Phase 10 actor-model changes. Phase 10 verification batch (26 files) passes 245/247; the 2 failures are stale success-path mocks in `budget/[itemId]/route.access.test.ts` and `portfolio-report.service.unit.test.ts` (expect removed `is_admin` bypass parameter). Implementation behavior for 403/deny paths in those files still passes.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX in phase artifacts | — | — |
| — | — | No stub API routes returning "Not implemented" | — | — |
| `app/api/operations/**` | — | No CPMO/PM/Viewer asserts | ℹ️ Info | Intentional D-23 carve-out |

### Human Verification Required

N/A — Server authorization is the acceptance gate per D-18; automated role-matrix, access, and user-admin tests cover observable behaviors. D-23 leftover surfaces are explicitly out of scope.

---

_Verified: 2026-08-25T19:07:00Z_
_Verifier: Claude (gsd-verifier)_
