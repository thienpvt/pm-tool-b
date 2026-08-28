---
phase: 10-users-roles-server-authorization
fixed_at: 2026-08-26T02:17:00+07:00
review_path: .planning/phases/10-users-roles-server-authorization/10-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-08-26T02:17:00+07:00  
**Source review:** `.planning/phases/10-users-roles-server-authorization/10-REVIEW.md`  
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (2 Critical, 2 Warning; Info IN-01 excluded)
- Fixed: 4
- Skipped: 0

**Verification:** Tests run in main checkout (isolation none). Gates: `npx vitest run lib/auth.session.unit.test.ts app/api/auth/session/extend/route.test.ts lib/services/users.service.unit.test.ts app/api/admin/users/route.test.ts` — all passed.

## Fixed Issues

### CR-01: Session extend bypasses user status gate (D-10)

**Files modified:** `lib/auth.ts`, `lib/auth.session.unit.test.ts`  
**Commit:** `1169bd3`  
**Applied fix:** `extendSession` now calls `getSessionUser` first; locked/inactive users return false and session is deleted without extending `expires_at`. Added unit tests for locked and inactive rejection.

### CR-02: Lock/unlock bypass dedicated service path (USER-05, D-08, D-10)

**Files modified:** `lib/services/users.service.ts`, `lib/services/users.service.unit.test.ts`  
**Commit:** `abf3651`  
**Applied fix:** `updateUser` routes `status: 'locked'` (from non-locked) to `lockUser` and `status: 'active'` (from locked) to `unlockUser`, so admin UI PUT lock/unlock populates `locked_at`/`locked_by`, deletes sessions on lock, and audits with `lock`/`unlock` actions.

### WR-01: Deactivate does not invalidate sessions immediately (D-10)

**Files modified:** `lib/services/users.service.ts`, `lib/services/users.service.unit.test.ts`  
**Commit:** `5249c55`  
**Applied fix:** `deactivateUser` now calls `deleteSessionsForUser(userId)` after `deactivateUserRow`, mirroring `lockUser`.

### WR-02: Admin UI shows mutate controls to PM role

**Files modified:** `app/admin/page.tsx`  
**Commit:** `f07ffeb`  
**Applied fix:** `canMutateUsers` restricted to `is_admin` break-glass or `roles.includes('cpmo')`; PM no longer sees Add/Edit/Lock/Deactivate controls.

---

_Fixed: 2026-08-26T02:17:00+07:00_  
_Fixer: Claude (gsd-code-fixer)_  
_Iteration: 1_
