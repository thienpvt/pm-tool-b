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

Decision IDs below are the locked set for plan coverage (D-01..D-24).

### Roles & Mapping from v1.0

- **D-01:** Spec roles are **CPMO**, **PM**, **Viewer**. Permissions are the **union** of assigned roles (USER-03).
- **D-02:** Backfill: existing `is_admin = 1` users become CPMO; all other existing users become PM (preserves current write access). Do not silently make everyone Viewer.
- **D-03:** Keep `is_admin` as a break-glass/compat flag for leftover platform routes, but **authorization truth is `roles[]`**. New product checks must not use that flag as a cross-tenant bypass. Do not set the flag from the CPMO role (a company CPMO is not a platform operator).
- **D-04:** A user may hold multiple roles. Empty roles after update is invalid — at least one role required.

### Account Lifecycle

- **D-05:** Status: Active / Inactive / Locked (USER-04). Only Active can log in (AUTH-06).
- **D-06:** Locked username and email cannot be reused on another account (USER-02).
- **D-07:** Soft-delete / deactivate: never physically DELETE a user who has generated business data (USER-06). History still shows display name. Use `status = inactive` plus `deleted_at` (existing-pattern analog). Physical DELETE is forbidden for all users this phase.
- **D-08:** USER-05: lock, unlock, and other user-record changes record who and when (start `auditLog` here; Phase 18 completes coverage).

### Session & Login

- **D-09:** Keep scrypt + DB sessions (`lib/auth.ts`). AUTH-01/03 already exist — extend, don't replace.
- **D-10:** Inactive/Locked: reject at login AND reject session resolution if status changes mid-session (cannot obtain or keep a session).
- **D-11:** Session expiry stays 7 days. Extending a valid session refreshes `expires_at` in place without dropping or rotating the `pm_session` cookie (AUTH-02). Dedicated `POST /api/auth/session/extend`. Do not invent a separate draft token.
- **D-12:** Unique username and unique email at create/update (case-insensitive email).

### Server Authorization (AUTH-04, AUTH-05)

- **D-13:** **CPMO:** full **company** portfolio (all projects in `actor.company_id`). Remove the global admin bypass on `assertProjectAccess` / `listProjects`. CPMO in company A cannot read company B.
- **D-14:** **PM:** view and update only assigned projects. Interim match (locked): if `projects.pm_email` is non-empty, case-insensitive equality with `users.email`; otherwise trim+lower `projects.pm_name` equals `display_name`, else `username`. Single seam `assertPmWriteAccess` — Phase 11 replaces the lookup only.
- **D-15:** **Viewer:** read only — all mutating methods 403. Hiding UI is not access control.
- **D-16:** Company isolation from v1.0 (`withProjectAccess` / `company_id`) stays. Role checks **compose** with tenant checks, never replace them (Pitfall 10). Order: tenant assert, then Viewer-deny, then PM write.
- **D-17:** Prefer extending `lib/services/access.ts` + thin `withRole` / service asserts over a new wrapper family. Keep `withAuth` / `withProjectAccess`.

### UI

- **D-18:** `workflow.ui_phase` is false — no UI-SPEC this phase. Admin user screens and nav visibility may be updated enough that a CPMO can manage users; Viewer must not see mutate controls. Server tests are the gate.

### Testing

- **D-19:** Vitest 4. Role matrix: Viewer POST → 403; PM on unassigned project → 403; CPMO company-scoped → 200; Inactive/Locked login → reject. Cross-company 403 must not regress. TDD for authz I/O (role assert, login status, unique constraints).

### Locked planner recommendations (from research + discuss)

- **D-20:** USER-01 "unit" filter is `company_id` (no separate unit column).
- **D-21:** Split platform `/api/admin/companies` (and demo/Jira/RAG config) on the existing break-glass flag from **CPMO company user admin** (`/api/admin/users` via `roles` includes `cpmo` + session company).
- **D-22:** Schema stays in the `getDb()` migrate loop (dedicated helper, settings-flag backfill). No Prisma and no external migrate CLI.
- **D-23:** AUTH-05 product-surface carve-out. Leftover v1.0 ops/admin/config stay session+tenant this phase: `app/api/operations/**` and platform `/api/admin/companies` (demo/Jira/RAG config stay on the break-glass flag per D-21). Do not add CPMO/PM/Viewer write asserts on that leftover set. Product APIs still get role write asserts: nested project mutators (including `importActivities`, `linkEpic`, `unlinkEpic`), company-scoped programs/portfolio/import-mapping/jira-mapping, and AI POSTs under `app/api/projects/[id]/report`, `app/api/projects/[id]/project-report`, `app/api/projects/[id]/project-report/generate-email`, `app/api/portfolio/report`, `app/api/portfolio/report/generate-email`, and `app/api/portfolio/report/send-email`.
- **D-24:** Closed AUTH-04/AUTH-05 remainder after plan-checker iteration 3. Do not invent additional product surfaces this phase. Must cover all of:
  1. `app/api/programs/route.ts` GET+POST peel `toAccessActor(user)` (not `{ company_id, is_admin }`).
  2. `createExpense` and `deleteExpense` call `assertProjectWriteAccess` (same bar as budget-item CRUD).
  3. D-14 nested GET: for PM-only actors (`has pm`, not `cpmo`, not `viewer`), run the D-14 matcher inside `assertProjectAccess` / `withProjectAccess` after tenant match so nested list/get inherit assignment. Viewer-only and CPMO stay company-scoped; `pm+viewer` union stays company-read.
  4. `POST /api/admin/resource-audit` is a product portfolio-member write (`addMissingTeamMembersToPortfolio`) — gate with `assertCompanyWrite` after session; Viewer 403. Not D-23 leftover.
  5. `listResourceMembers` drop leftover-flag all-rows; pass `actor.company_id` only.
  6. Remaining two-field actor peels owned by 10-10: `app/api/programs/route.ts`, `app/api/portfolio/milestones/route.ts`, `app/api/portfolio/report/route.ts` GET, `app/api/portfolio/roadmap/epics/route.ts`, plus the portfolio actorOf files already listed in 10-10.
  7. `lib/http/with-auth.test.ts` and `lib/http/with-program-access.test.ts` expect `toAccessActor` fields including `roles`.
  Explicitly still D-23 leftover (do not gate with CPMO/PM/Viewer this phase): `app/api/operations/**`, `/api/admin/companies`, `/api/admin/jira-config/**`, `/api/admin/rag-config/**`, `/api/jira/search` (session + company credentials only), public `demo-requests`.

### the agent's Discretion

- Table names (`user_roles` vs join table), email uniqueness SQL, and whether admin UI is a new page vs extending `/admin` — planner locked: `user_roles` join table, `UNIQUE(LOWER(email))` partial index, extend existing `/admin` Users tab.

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
