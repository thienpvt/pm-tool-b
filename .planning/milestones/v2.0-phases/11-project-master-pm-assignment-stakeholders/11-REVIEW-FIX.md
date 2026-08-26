---
phase: 11
fixed_at: 2026-08-26T03:08:30+07:00
review_path: .planning/phases/11-project-master-pm-assignment-stakeholders/11-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-08-26T03:08:30+07:00  
**Source review:** `.planning/phases/11-project-master-pm-assignment-stakeholders/11-REVIEW.md`  
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical, 4 Warning; Info excluded)
- Fixed: 6
- Skipped: 0

**Verification:** Unit tests run in main checkout (`workflow.use_worktrees` bypassed per isolation-none). `npx vitest run` on 4 affected test files — 55/55 passed.

## Fixed Issues

### CR-01: Primary assignment allows dual primary+collaborator for same user

**Files modified:** `lib/services/pm-assignments.service.ts`, `lib/repositories/pm-assignments.repo.ts`, `lib/services/pm-assignments.service.unit.test.ts`  
**Commit:** `7c0d149`  
**Applied fix:** Primary branch now calls `hasOverlappingPmAssignment` before swap, rejecting users who hold the opposite active role.

### CR-02: PATCH project_code uniqueness checked against actor company, not project company

**Files modified:** `lib/services/projects.service.ts`, `lib/services/projects.service.unit.test.ts`  
**Commit:** `2a04579`  
**Applied fix:** Duplicate lookup uses `current.company_id ?? actor.company_id` as owner scope; rejects projects with no `company_id`.

### WR-01: Duplicate active collaborator windows for the same user

**Files modified:** `lib/services/pm-assignments.service.ts`, `lib/repositories/pm-assignments.repo.ts`, `lib/services/pm-assignments.service.unit.test.ts`  
**Commit:** `7c0d149`  
**Applied fix:** Added `hasActivePmAssignmentForUserRole` guard before insert for both roles; partial unique index `project_pm_assignments_open_user_role_unique` in constraints migration.

### WR-02: CPMO PATCH can clear project_code with empty/whitespace

**Files modified:** `lib/services/projects.service.ts`, `lib/services/projects.service.unit.test.ts`  
**Commit:** `2a04579`  
**Applied fix:** Empty/whitespace `project_code` throws `ValidationError`; unchanged trimmed code is omitted from PATCH payload.

### WR-03: Primary swap is non-transactional — brief dual-primary window possible

**Files modified:** `lib/services/pm-assignments.service.ts`, `lib/repositories/pm-assignments.repo.ts`, `lib/services/pm-assignments.service.unit.test.ts`  
**Commit:** `7c0d149`  
**Applied fix:** Primary creates use `replaceActivePrimary` (transactional soft-end + insert); partial unique index `project_pm_assignments_one_open_primary_unique` added.

### WR-04: Stakeholder singleton enforced only in application layer (TOCTOU)

**Files modified:** `lib/db-project-master.ts`, `lib/db-project-master.ddl.unit.test.ts`, `lib/services/stakeholders.service.ts`, `lib/services/stakeholders.service.unit.test.ts`  
**Commit:** `7eab97f`  
**Applied fix:** New `project_master_constraints_v1` migration adds `project_stakeholders_singleton_open_unique` partial index; service maps Postgres `23505` to `ValidationError` for singleton roles.

---

_Fixed: 2026-08-26T03:08:30+07:00_  
_Fixer: Claude (gsd-code-fixer)_  
_Iteration: 1_
