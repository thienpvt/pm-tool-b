---
phase: 11-project-master-pm-assignment-stakeholders
reviewed: 2026-08-25T20:05:00Z
depth: deep
files_reviewed: 38
files_reviewed_list:
  - app/api/projects/[id]/pm-assignments/route.ts
  - app/api/projects/[id]/pm-assignments/route.test.ts
  - app/api/projects/[id]/pm-assignments/schema.ts
  - app/api/projects/[id]/stakeholders/route.ts
  - app/api/projects/[id]/stakeholders/route.test.ts
  - app/api/projects/[id]/stakeholders/schema.ts
  - app/api/projects/[id]/route.access.test.ts
  - app/api/projects/[id]/budget/route.test.ts
  - app/api/projects/[id]/budget/[itemId]/route.access.test.ts
  - app/api/projects/[id]/budget/[itemId]/expenses/route.test.ts
  - app/api/projects/[id]/budget/[itemId]/expenses/[expId]/route.test.ts
  - app/api/projects/[id]/milestones/[milestoneId]/route.test.ts
  - app/api/projects/[id]/project-report/route.test.ts
  - app/api/projects/[id]/project-report/generate-email/route.test.ts
  - app/api/projects/[id]/report/route.test.ts
  - app/api/projects/[id]/risks/route.test.ts
  - app/projects/[id]/page.tsx
  - app/projects/new/page.tsx
  - lib/db-project-master.ts
  - lib/db-project-master.backfill.unit.test.ts
  - lib/db.ts
  - lib/http/role-matrix.test.ts
  - lib/http/route-401-matrix.test.ts
  - lib/repositories/pm-assignments.repo.ts
  - lib/repositories/projects.repo.ts
  - lib/repositories/projects.repo.unit.test.ts
  - lib/repositories/stakeholders.repo.ts
  - lib/services/access.ts
  - lib/services/access.unit.test.ts
  - lib/services/pm-assignments.service.ts
  - lib/services/pm-assignments.service.unit.test.ts
  - lib/services/project-governance.ts
  - lib/services/project-governance.unit.test.ts
  - lib/services/projects.service.ts
  - lib/services/projects.service.unit.test.ts
  - lib/services/stakeholders.service.ts
  - lib/services/stakeholders.service.unit.test.ts
  - test/repo-db.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-08-25T20:05:00Z  
**Depth:** deep  
**Files Reviewed:** 38  
**Status:** issues_found

## Summary

Phase 11 delivers the intended architecture: assignment windows drive `assertPmWriteAccess` and `listProjects`, stakeholders enforce singleton roles at the service layer, project code changes are in-place UPDATEs with audit, and viewer mutators return 403 on routes tested. Two correctness gaps remain in assignment overlap (D-12) and project-code uniqueness on PATCH when CPMO tenancy is via `customer_company_id`. PM access rewire is complete in production paths; stale `getProjectPmIdentity` test mocks are leftover only.

## Critical Issues

### CR-01: Primary assignment allows dual primary+collaborator for same user

**File:** `lib/services/pm-assignments.service.ts:80-85`  
**Issue:** `hasOverlappingPmAssignment` runs only in the `collaborator` branch. Promoting a user who already holds an active collaborator window to `primary` skips the overlap check, soft-ends the *other* primary, and inserts a new primary — leaving the user active in both roles simultaneously. This violates D-12 (“A user cannot hold both roles on the same project in overlapping windows”).  
**Fix:**
```typescript
} else {
  if (await hasOverlappingPmAssignment(projectId, userId, role)) {
    throw new ValidationError(
      'User already holds the other PM role on this project',
      'user_id',
    );
  }
  const activePrimary = await getActivePrimaryAssignment(projectId);
  if (activePrimary) {
    await softEndActivePrimary(projectId);
  }
}
```

### CR-02: PATCH project_code uniqueness checked against actor company, not project company

**File:** `lib/services/projects.service.ts:116`  
**Issue:** CPMO can access a project when `customer_company_id === actor.company_id` while `project.company_id` differs. `findProjectByCompanyCode(actor.company_id!, newCode)` scopes the duplicate check to the actor’s company, but the DB unique index is `UNIQUE(company_id, LOWER(project_code))` on the **project’s** `company_id`. A code already taken within the project’s owning company can slip through and hit a DB error, or worse, allow a duplicate if the index row set differs.  
**Fix:**
```typescript
const ownerCompanyId =
  (current.company_id as number | null) ?? actor.company_id;
if (ownerCompanyId == null) {
  throw new ValidationError('project has no company_id; cannot change code', 'project_code');
}
const clash = await findProjectByCompanyCode(ownerCompanyId, newCode);
```

## Warnings

### WR-01: Duplicate active collaborator windows for the same user

**File:** `lib/services/pm-assignments.service.ts:173-179`  
**Issue:** After overlap checks pass, nothing prevents inserting a second active `collaborator` row for the same `(project_id, user_id)`. `hasOverlappingPmAssignment` only detects the *opposite* role. Repeated POSTs can stack duplicate active windows.  
**Fix:** Before `insertPmAssignment`, query for an active row with the same `(project_id, user_id, role)` and reject with `ValidationError`, or add a partial unique index on active windows.

### WR-02: CPMO PATCH can clear `project_code` with empty/whitespace

**File:** `lib/services/projects.service.ts:111-121`  
**Issue:** When `project_code` is `''` or whitespace, the `if (newCode && …)` guard skips normalization but leaves `clone.project_code` as an empty string, which flows to `updateProjectRepo` and clears a required identity field (PROJ-01).  
**Fix:** Reject empty/whitespace codes for CPMO PATCH, or `delete clone.project_code` when `!newCode` so the field is not updated.

### WR-03: Primary swap is non-transactional — brief dual-primary window possible

**File:** `lib/services/pm-assignments.service.ts:81-87`  
**Issue:** `softEndActivePrimary` and `insertPmAssignment` run as separate statements without a transaction (unlike `endPrimaryWithCollaboratorCascade`). Concurrent CPMO requests can both observe an active primary and insert, yielding two open primaries until one is manually corrected.  
**Fix:** Wrap soft-end + insert in a single transaction (mirror `endPrimaryWithCollaboratorCascade` pattern).

### WR-04: Stakeholder singleton enforced only in application layer (TOCTOU)

**File:** `lib/services/stakeholders.service.ts:101-108`  
**Issue:** `hasActiveStakeholderForRole` + `insertStakeholder` is check-then-act without a DB constraint or transaction. Two concurrent POSTs for `sponsor` can both pass and create two active sponsors, violating D-18.  
**Fix:** Add a partial unique index on `(project_id, stakeholder_role)` for active singleton roles, or use `SELECT … FOR UPDATE` in a transaction.

## Info

### IN-01: `getProjectPmIdentity` is dead production code

**File:** `lib/repositories/projects.repo.ts:68-74`  
**Issue:** D-13 requires assignment windows as the sole access source. Production access no longer calls this helper; it remains exported alongside stale test mocks that still mock it.  
**Fix:** Remove the export (or mark deprecated) and update remaining route tests to mock `hasActivePmAssignment` only.

### IN-02: Route schemas are passthrough — no Zod field validation

**File:** `app/api/projects/[id]/pm-assignments/schema.ts:3-4`, `app/api/projects/[id]/stakeholders/schema.ts:3-4`  
**Issue:** `z.object({}).passthrough()` accepts any body; validation relies entirely on services. Not a bug today because services validate, but malformed payloads reach deeper layers than necessary.  
**Fix:** Tighten schemas (`user_id`, `role`, `stakeholder_role`, etc.) for early 400 responses.

---

## Focus-area verdicts

| Focus area | Verdict |
|------------|---------|
| Assignment window overlap | **Fail** — CR-01 dual-role gap; WR-01 duplicate collaborator; WR-03 race |
| PM access rewire completeness | **Pass** — `assertPmWriteAccess`, `assertProjectAccess` (PM-only), `listProjects` all use `hasActivePmAssignment`; no production `pm_email` fallback |
| Unique `project_code` | **Partial** — create path correct; PATCH uses wrong company scope (CR-02) |
| Stakeholder singleton | **Partial** — service check present; no DB/transaction guard (WR-04) |
| Code change not recreating project | **Pass** — `updateProjectRepo` in-place UPDATE; tests assert no `deleteProject` |
| Viewer 403 on mutators | **Pass** — `assertCanMutate` / `assertCompanyWrite` block viewer on PATCH/POST for projects, assignments, stakeholders |

---

_Reviewed: 2026-08-25T20:05:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
