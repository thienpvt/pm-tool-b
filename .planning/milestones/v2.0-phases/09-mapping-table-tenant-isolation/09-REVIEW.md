---
phase: 09-mapping-table-tenant-isolation
reviewed: 2026-08-26T00:10:00Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - lib/db.ts
  - lib/db-mapping-tenant.ts
  - lib/db.mapping-tenant-migration.integration.test.ts
  - lib/repositories/import-mapping.repo.ts
  - lib/repositories/import-mapping.repo.unit.test.ts
  - lib/repositories/import-mapping.repo.test.ts
  - lib/services/import-mapping.service.ts
  - lib/services/import-mapping.service.unit.test.ts
  - app/api/import-mapping/route.ts
  - app/api/import-mapping/[id]/route.ts
  - app/api/import-mapping/route.test.ts
  - test/repo-db.ts
  - app/api/bug-import-mapping/route.ts
  - app/api/bug-import-mapping/[id]/route.ts
  - app/api/bug-import-mapping/route.test.ts
  - lib/repositories/jira-config.repo.ts
  - lib/repositories/jira-config.repo.unit.test.ts
  - lib/services/jira-mapping.service.ts
  - lib/services/jira-mapping.service.unit.test.ts
  - app/api/jira/jql-presets/route.ts
  - app/api/jira/jql-presets/[id]/route.ts
  - app/api/jira/jql-presets/route.test.ts
  - app/api/jira/sync-mappings/route.ts
  - app/api/jira/sync-mappings/route.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: findings
---

# Phase 9: Code Review Report

**Reviewed:** 2026-08-26T00:10:00Z  
**Depth:** deep  
**Files Reviewed:** 24  
**Status:** findings

## Summary

Deep review of all Phase 9 production files across three plans (timeline, bug, and Jira mapping tenant isolation). Core TENANT-01 requirements are implemented correctly:

- **403 vs 404:** `assertCompanyRow` checks missing row → `NotFoundError` before company mismatch → `ForbiddenError`; route tests confirm `{ error: 'Forbidden' }` on cross-company DELETE/PUT.
- **company_id stamp:** All create/save paths derive tenant from `requireCompanyId(actor)`; Zod schemas exclude `company_id`; routes never pass body tenant fields to services.
- **SQL scoping:** List/mutate/eviction queries bind `WHERE company_id = ?` (and `context` for JQL); sync eviction DELETE scopes both outer and inner subquery by `company_id`.
- **Backfill:** Multi-company path uses `CROSS JOIN companies` + `DELETE … WHERE company_id IS NULL`; single-company path uses `SELECT id FROM companies LIMIT 1` (not hardcoded id 1). Integration tests assert no NULL rows and distinct companies.
- **Eviction:** Bug cap (5), JQL cap (10), and sync keep-5 all delete only within the session company.

No cross-tenant isolation bypass or mass-assignment vector was found. Five non-blocking quality gaps remain (migration robustness, update duplicate-name handling, test coverage).

## Warnings

### WR-01: `updateTimelineMapping` lacks duplicate-name guard on rename

**File:** `lib/services/import-mapping.service.ts:51-59`  
**Issue:** `createTimelineMapping` pre-checks `findTimelineMappingByName`, but `updateTimelineMapping` does not. Renaming a template to a name already used by another row in the same company hits the DB unique index and surfaces as an unhandled error → HTTP 500 instead of 409 `ConflictError`.  
**Fix:**
```typescript
export async function updateTimelineMapping(
  id: number | string,
  actor: AccessActor,
  name: string,
  mappingsJson: string,
) {
  const row = await getTimelineMappingById(id);
  assertCompanyRow(actor, row);
  const companyId = requireCompanyId(actor);
  const existing = await findTimelineMappingByName(companyId, name);
  if (existing && existing.id !== Number(id)) {
    throw new ConflictError('Template name already exists');
  }
  return updateTimelineMappingRepo(companyId, id, name, mappingsJson);
}
```

### WR-02: Mapping tenancy backfill is not transactional

**File:** `lib/db-mapping-tenant.ts:71-98`  
**Issue:** Multi-company backfill runs `INSERT … CROSS JOIN companies` then `DELETE … WHERE company_id IS NULL` without a transaction. If the DELETE fails after INSERT succeeds, NULL rows remain alongside duplicated rows; a retry re-runs CROSS JOIN and multiplies row counts. Not a tenant-isolation leak, but risks data duplication on partial failure.  
**Fix:** Wrap the backfill block in `BEGIN` / `COMMIT` (or `pool.connect()` + `client.query('BEGIN')`) so INSERT+DELETE is atomic per table.

### WR-03: Migration completion flag set despite swallowed index failures

**File:** `lib/db-mapping-tenant.ts:116-140`  
**Issue:** `CREATE UNIQUE INDEX` failures are caught and ignored (`catch { /* index exists */ }`), yet the settings flag is still written when `remainingNull === 0`. A failed unique-index creation leaves the table without the DB constraint while migration appears complete; duplicate names within a company would only be caught by app-level pre-checks (race-vulnerable).  
**Fix:** Only insert the settings flag after verifying the index exists (e.g. query `pg_indexes`) or re-throw on unexpected index creation errors instead of swallowing all failures.

## Info

### IN-01: No explicit test that POST `company_id` in body is ignored

**File:** `app/api/import-mapping/route.test.ts` (and sibling route tests)  
**Issue:** Tenant stamping is proven indirectly (service called with session actor), but no route test sends `{ company_id: 999, … }` in the body and asserts the service still receives the session company. Low risk because Zod strips unknown keys and services never read body tenant fields.  
**Fix:** Add one POST test per mapping route with `company_id: 999` in body; assert service mock receives `actor.company_id` from session, not 999.

### IN-02: Sync eviction unit test does not assert inner subquery `company_id` bind

**File:** `lib/repositories/jira-config.repo.unit.test.ts:81-90`  
**Issue:** Test checks DELETE SQL contains `WHERE company_id = ?` once, but `saveJiraSyncMapping` binds `companyId` twice (outer + inner subquery). The implementation is correct; the test would not catch a regression that dropped the inner predicate.  
**Fix:** Assert `db.run` second call receives `[companyId, companyId]` bind args, or normalize SQL and expect two `company_id = ?` occurrences.

---

_Reviewed: 2026-08-26T00:10:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_

## REVIEW COMPLETE

**Status:** findings
