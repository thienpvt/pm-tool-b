# Phase 10: Users, Roles & Server Authorization - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Deliver PR-01 and PR-02: admins manage users and roles; CPMO, PM, and Viewer sessions are enforced on every API and screen. This is the authorization foundation for every later v2.0 phase.

**Requirements:** USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06

**In:** user list/search/filter; unique username+email; multi-role union; Active/Inactive/Locked; lock/unlock with actor+time; soft-delete (no physical delete if business data); login/session/logout; Inactive/Locked cannot obtain a session; session extend without losing draft; server-side CPMO/PM/Viewer enforcement (not UI-only).

**Out:** L0–L5 project master, PM assignment windows (Phase 11), weekly reports, dashboards, document templates, full append-only audit coverage (Phase 18 — but USER-05 and user-record mutations must record actor/time now as the incremental audit start).

</domain>

<decisions>
## Implementation Decisions

### Roles & Mapping from v1.0

- Spec roles are **CPMO**, **PM**, **Viewer**. Permissions are the **union** of assigned roles (USER-03).
- Backfill: existing `is_admin = 1` users become CPMO; all other existing users become PM (preserves current write access). Do not silently make everyone Viewer.
- Keep `is_admin` as a derived/compat flag if needed for leftover routes, but **authorization truth is `roles[]`**. New checks must not rely on `is_admin` alone.
- A user may hold multiple roles. Empty roles after update is invalid — at least one role required.

### Account Lifecycle

- Status: Active / Inactive / Locked (USER-04). Only Active can log in (AUTH-06).
- Locked username and email cannot be reused on another account (USER-02).
- Soft-delete / deactivate: never physically DELETE a user who has generated business data (USER-06). History still shows display name. Prefer Inactive or a `deleted_at` flag — planner picks the existing-pattern analog.
- USER-05: lock, unlock, and other user-record changes record who and when (start `auditLog` here; Phase 18 completes coverage).

### Session & Login

- Keep scrypt + DB sessions (`lib/auth.ts`). AUTH-01/03 already exist — extend, don't replace.
- Inactive/Locked: reject at login AND reject session resolution if status changes mid-session (cannot obtain or keep a session).
- Session expiry stays 7 days unless spec demands otherwise; extending a valid session refreshes `expires_at` without dropping cookies (AUTH-02). Do not invent a separate "draft token."
- Unique username and unique email at create/update (case-insensitive email recommended).

### Server Authorization (AUTH-04, AUTH-05)

- **CPMO:** full company portfolio (all company projects).
- **PM:** view and update only assigned projects. Until Phase 11 assignment windows land, treat current project PM identity (`projects.pm_*` / existing owner field — planner confirms analog) as the assignment. Document this as interim; Phase 11 replaces it with `assertPmWriteAccess`.
- **Viewer:** read only — all mutating methods 403. Hiding UI is not access control.
- Company isolation from v1.0 (`withProjectAccess` / `company_id`) stays. Role checks **compose** with tenant checks, never replace them (Pitfall 10).
- Prefer extending `lib/services/access.ts` + thin `withRole` / service asserts over a new wrapper family. Keep `withAuth` / `withProjectAccess`.

### UI

- `workflow.ui_phase` is false — no UI-SPEC this phase. Admin user screens and nav visibility may be updated enough that a CPMO can manage users; Viewer must not see mutate controls. Server tests are the gate.

### Testing

- Vitest 4. Role matrix: Viewer POST → 403; PM on unassigned project → 403; CPMO company-scoped → 200; Inactive/Locked login → reject.
- Cross-company 403 must not regress.
- TDD for authz I/O (role assert, login status, unique constraints).

### the agent's Discretion

- Table names (`user_roles` vs join table), email uniqueness SQL, exact session-refresh endpoint, and whether admin UI is a new page vs extending an existing members/admin screen.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth.ts` — SessionUser, scrypt, sessions, `company_id`
- `lib/http/with-auth.ts`, `with-project-access.ts`
- `lib/services/access.ts` — `assertProjectAccess` 403/404 ordering
- `lib/repositories/auth.repo.ts` — login user rows
- Admin/user routes if present under `app/api/`

### Established Patterns
- Route → service → repository; ForbiddenError → 403
- Vitest role/tenant fixtures from v1.0 403 tests
- Schema in `getDb()` migrate loop (DATA-01 deferred)

### Integration Points
- Login `/api/auth/login`, session cookie `pm_session`
- Every `withAuth` / `withProjectAccess` consumer must eventually see roles
- Phase 11 will replace interim PM assignment with windows — keep a single `assertPmWriteAccess` seam even if the lookup is interim

</code_context>

<specifics>
## Specific Ideas

Pitfall 8: do not ship UI hiding without matching API 403 tests. Pitfall 1/10: tenant + role together. Incremental audit from this phase on user mutations (USER-05).

</specifics>

<deferred>
## Deferred Ideas

- Full PM assignment history and collaborator windows — Phase 11
- Weekly-report Viewer rules beyond mutate-deny — later phases
- Complete AUDIT-01 coverage — Phase 18
- Replacing Jira/AI/export
- DATA-01 migrations out of getDb()

</deferred>
