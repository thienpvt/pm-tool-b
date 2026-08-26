---
phase: 10-users-roles-server-authorization
reviewed: 2026-08-26T02:14:00+07:00
depth: deep
files_reviewed: 67
files_reviewed_list:
  - app/admin/page.tsx
  - app/api/admin/resource-audit/route.ts
  - app/api/admin/users/route.ts
  - app/api/admin/users/schema.ts
  - app/api/auth/login/route.ts
  - app/api/auth/me/route.ts
  - app/api/auth/session/extend/route.ts
  - app/api/portfolio/budgets/[id]/allocations/[allocId]/route.ts
  - app/api/portfolio/budgets/[id]/allocations/route.ts
  - app/api/portfolio/budgets/[id]/categories/[catId]/route.ts
  - app/api/portfolio/budgets/[id]/categories/route.ts
  - app/api/portfolio/budgets/[id]/route.ts
  - app/api/portfolio/budgets/route.ts
  - app/api/portfolio/bug-assignees/route.ts
  - app/api/portfolio/members/[id]/route.ts
  - app/api/portfolio/members/route.ts
  - app/api/portfolio/milestones/route.ts
  - app/api/portfolio/program-allocations/[id]/route.ts
  - app/api/portfolio/quota/route.ts
  - app/api/portfolio/report/generate-email/route.ts
  - app/api/portfolio/report/route.ts
  - app/api/portfolio/report/send-email/route.ts
  - app/api/portfolio/roadmap/epics/route.ts
  - app/api/portfolio/roadmap/route.ts
  - app/api/portfolio/route.ts
  - app/api/programs/[id]/project-allocations/route.ts
  - app/api/programs/route.ts
  - app/api/projects/[id]/project-report/generate-email/route.ts
  - app/api/projects/[id]/project-report/route.ts
  - app/api/projects/[id]/report/route.ts
  - app/api/projects/route.ts
  - app/api/resources/route.ts
  - components/layout/Sidebar.tsx
  - lib/auth.ts
  - lib/db-roles.ts
  - lib/db.ts
  - lib/http/with-auth.ts
  - lib/http/with-role.ts
  - lib/repositories/audit.repo.ts
  - lib/repositories/auth.repo.ts
  - lib/repositories/portfolio.repo.ts
  - lib/repositories/programs.repo.ts
  - lib/repositories/projects.repo.ts
  - lib/repositories/resources.repo.ts
  - lib/repositories/users.repo.ts
  - lib/services/access.ts
  - lib/services/activities.service.ts
  - lib/services/audit.service.ts
  - lib/services/budget-items.service.ts
  - lib/services/budget.service.ts
  - lib/services/bugs.service.ts
  - lib/services/documents.service.ts
  - lib/services/escalations.service.ts
  - lib/services/holidays.service.ts
  - lib/services/import-mapping.service.ts
  - lib/services/issues.service.ts
  - lib/services/jira-mapping.service.ts
  - lib/services/meetings.service.ts
  - lib/services/milestones.service.ts
  - lib/services/portfolio-report.service.ts
  - lib/services/portfolio.service.ts
  - lib/services/programs.service.ts
  - lib/services/projects.service.ts
  - lib/services/risks.service.ts
  - lib/services/roadmap.service.ts
  - lib/services/team.service.ts
  - lib/services/users.service.ts
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-08-26T02:14:00+07:00  
**Depth:** deep  
**Files Reviewed:** 67 (084e8d3..507b159, Phase 9 complete through plan 10-11 + fixture commit)  
**Status:** issues_found

## Summary

Phase 10 delivers a solid authorization spine: `toAccessActor`, role-aware `assertProjectAccess` / `assertProjectWriteAccess` / `assertCompanyWrite`, CPMO-scoped user admin, login and mid-session status eviction in `getSessionUser`, and broad product mutator gating. Cross-company tenant asserts compose correctly with role checks; D-23 leftover routes (`operations/**`, platform admin) were not flagged.

Two **session/lifecycle gaps** remain around lock/deactivate and session extend. Lock/unlock service functions exist and are tested, but the shipped admin UI and `PUT /api/admin/users` route bypass them via generic `updateUser`, breaking USER-05 metadata and immediate session revocation on lock.

Product authz (Viewer POST → 403, PM unassigned → 403, CPMO company scope, unique credentials, audit on create/update/deactivate) is otherwise wired as intended.

## Critical Issues

### CR-01: Session extend bypasses user status gate (D-10)

**File:** `lib/auth.ts:92-103`, `app/api/auth/session/extend/route.ts:4-9`  
**Issue:** `POST /api/auth/session/extend` calls `extendSession`, which only checks that the session row exists and is unexpired. It never joins `users` or verifies `status === 'active'`. After an admin locks or deactivates a user, the victim can keep their session alive indefinitely by calling extend every ~7 days without ever hitting `getSessionUser` (the only place non-active status is enforced). This violates D-10 (“cannot obtain or keep a session”) for locked/inactive accounts.  
**Fix:**

```typescript
// lib/auth.ts — gate extend on active user status
export async function extendSession(sessionId: string): Promise<boolean> {
  const user = await getSessionUser(sessionId);
  if (!user) return false;
  const db = await getDb();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const result = await db.run(
    'UPDATE sessions SET expires_at = ? WHERE id = ? AND expires_at > ?',
    expires, sessionId, now,
  );
  return (result.changes ?? 0) > 0;
}
```

Alternatively, have the extend route call `getSessionFromRequest` first and return 401 when status is not active.

### CR-02: Lock/unlock bypass dedicated service path (USER-05, D-08, D-10)

**File:** `app/admin/page.tsx:319-328`, `app/api/admin/users/route.ts:32-41`, `lib/services/users.service.ts:123-163`  
**Issue:** `lockUser` / `unlockUser` set `locked_at` / `locked_by`, delete sessions on lock, and audit with actions `lock` / `unlock` — but they are **not exported from any route**. The admin UI `toggleLock` and the edit-form status dropdown send `PUT /api/admin/users` with `{ id, status: 'locked' | 'active' }`, which flows through `updateUser` and only patches the `status` column. Consequences:

- `locked_at` / `locked_by` never populated on lock; not cleared on unlock via UI
- Sessions are not deleted on lock (relies on lazy eviction via `getSessionUser`, combinable with CR-01 extend bypass)
- Audit rows use action `update` instead of `lock` / `unlock`, failing USER-05 traceability

**Fix:** Route lock/unlock through the dedicated service functions, e.g. in `updateUser`:

```typescript
if (input.status === 'locked' && before.status !== 'locked') {
  return lockUser(actor, userId);
}
if (input.status === 'active' && before.status === 'locked') {
  return unlockUser(actor, userId);
}
```

Or add explicit lock/unlock endpoints and point `toggleLock` at them.

## Warnings

### WR-01: Deactivate does not invalidate sessions immediately (D-10)

**File:** `lib/services/users.service.ts:200-217`  
**Issue:** `lockUser` calls `deleteSessionsForUser`, but `deactivateUser` only sets `status = 'inactive'` and `deleted_at`. Deactivated users retain valid session rows until the next request that calls `getSessionUser`. Combined with CR-01, a deactivated user can extend their session without triggering status eviction.  
**Fix:** Call `deleteSessionsForUser(userId)` inside `deactivateUser` (mirror `lockUser`).

### WR-02: Admin UI shows mutate controls to PM role

**File:** `app/admin/page.tsx:57-61`, `424-427`  
**Issue:** `canMutateUsers` returns true for PM (`roles.includes('pm')`), so PM users see Add/Edit/Lock/Deactivate buttons. The API correctly rejects non-CPMO callers via `withCpmo`, so this is not a server authz hole, but it violates D-18 intent (“Viewer must not see mutate controls”) extended to non-admin roles and creates confusing 403 UX.  
**Fix:** Restrict `canMutateUsers` to CPMO (and platform break-glass if desired):

```typescript
function canMutateUsers(me: Me): boolean {
  if (me.is_admin) return true;
  return me.roles?.includes('cpmo') ?? false;
}
```

## Info

### IN-01: Stale `is_admin` bypass comments in portfolio services

**File:** `lib/services/portfolio.service.ts:41`, `lib/services/roadmap.service.ts:19`  
**Issue:** Doc comments still claim “is_admin bypass” on company-scoped reads, but implementation passes `actor.company_id` only with no admin all-rows branch. Misleading for future maintainers; behavior is correct.  
**Fix:** Update comments to “company-scoped via `actor.company_id` (D-13; no is_admin bypass)”.

## Narrative Findings (AI reviewer)

Review traced the authorization stack end-to-end: login status gate (`app/api/auth/login/route.ts:13-18`), mid-session eviction (`lib/auth.ts:66-70`), role union in `assertCanMutate` (`lib/services/access.ts:73-76`), CPMO company scope and PM assignment in `assertProjectAccess` (`lib/services/access.ts:94-128`), and CPMO-only company writes via `assertCompanyWrite` (`lib/services/access.ts:143-146`). Product mutators in changed services consistently call `assertProjectWriteAccess` or `assertCompanyWrite`. `listResourceMembers` is company-scoped (`lib/repositories/resources.repo.ts:13-30`). User create/update/deactivate audit correctly via `auditLog` (`lib/services/users.service.ts:111-216`). Unique username (DB `UNIQUE`) and email (`users_email_lower_unique` in `lib/db-roles.ts:67-70`) constraints satisfy D-06/D-12 at the persistence layer; `assertUniqueCredentials` provides application-level checks.

D-23 intentional carve-out (`operations/**`, `/api/admin/companies`, jira/rag config, jira search) was excluded per review scope. Test fixture updates (`toAccessActor` fields, company-scoped CPMO) were not flagged.

---

_Reviewed: 2026-08-26T02:14:00+07:00_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
