---
phase: 18-append-only-audit-log
reviewed: 2026-08-26T15:44:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - app/api/audit/route.ts
  - app/api/audit/route.test.ts
  - lib/repositories/audit.repo.ts
  - lib/repositories/audit.repo.test.ts
  - lib/repositories/audit.repo.unit.test.ts
  - lib/services/audit.service.ts
  - lib/services/audit.service.unit.test.ts
  - lib/services/risks.service.ts
  - lib/services/risks.service.unit.test.ts
  - lib/services/issues.service.ts
  - lib/services/issues.service.unit.test.ts
  - lib/services/projects.service.ts
  - lib/services/projects.service.unit.test.ts
  - lib/services/milestones.service.ts
  - lib/services/milestones.service.unit.test.ts
  - lib/services/project-document-checklist.service.ts
  - lib/services/project-document-checklist.service.unit.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-08-26T15:44:00Z  
**Depth:** standard  
**Files Reviewed:** 18  
**Status:** issues_found

## Summary

Phase 18 delivers company-scoped GET `/api/audit`, append-only repo persistence, and gap-fill `auditLog` calls for RAID, project master, milestones, and document checklist mutations. The primary security controls called out in context — SQL-level `company_id` tenancy, CPMO-only read with null-company 403, repo INSERT/SELECT only, and password-free snapshots in new gap-fill code — are implemented correctly.

Two warnings remain around audit ordering on project mutations: `code_change` is logged before the DB update commits, and `delete` is logged without verifying the delete affected a row. Neither is a cross-tenant leak; both weaken the “audit only after successful write” contract from D-03.

## Warnings

### WR-01: `code_change` audit fires before `updateProjectRepo` commits

**File:** `lib/services/projects.service.ts:218-234`  
**Issue:** When a CPMO changes `project_code`, `auditLog({ action: 'code_change', ... })` runs before `updateProjectRepo`. If the repository update fails (e.g. `UnknownColumnError`, constraint violation, or transient DB error), an audit row exists for a mutation that did not persist — violating the phase rule that audit runs only after successful writes. `ConflictError` and `MandatoryIncompleteError` paths correctly skip audit because they throw earlier.  
**Fix:** Move the `code_change` block to after a successful `updateProjectRepo` return, mirroring the general `update` audit at lines 236–247:

```typescript
const row = await updateProjectRepo(projectId, governed);

if (
  isCpmo(actor) &&
  governed.project_code !== undefined &&
  governed.project_code !== current.project_code
) {
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'project',
    entity_id: String(projectId),
    action: 'code_change',
    before: { project_code: current.project_code },
    after: { project_code: row.project_code },
  });
}
```

Guard the general `update` audit with `snapshotsEqual` (already present) to avoid duplicate rows when only the code changed.

### WR-02: `deleteProject` audits even when DELETE affects zero rows

**File:** `lib/services/projects.service.ts:276-288`  
**Issue:** `deleteProject` always calls `auditLog({ action: 'delete', ... })` after `deleteProjectRepo`, without checking `result.changes`. A delete against a missing or already-removed project (0 rows) still produces a delete audit entry with `before: null` or stale snapshot data — a phantom audit not tied to a successful mutation.  
**Fix:** Only audit when the delete succeeded:

```typescript
const result = await deleteProjectRepo(projectId);
if (result.changes === 0) {
  throw new NotFoundError('Not found', 'project');
}
await auditLog({ /* ... */ });
return result;
```

Alternatively, skip `auditLog` when `result.changes === 0` if the route already maps that to 404 elsewhere.

## Info

### IN-01: `updateMilestone` logs update audit without diff guard

**File:** `lib/services/milestones.service.ts:65-73`  
**Issue:** Unlike `updateProject` and `patchChecklistItem`, `updateMilestone` always writes an `update` audit even when `before` and `after` snapshots are identical (no-op PATCH). This creates noise in the audit trail but does not leak data or block tenancy controls.  
**Fix:** Compare snapshots before calling `auditLog`, matching the `snapshotsEqual` / `checklistFieldsDiffer` pattern used elsewhere.

---

_Reviewed: 2026-08-26T15:44:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
