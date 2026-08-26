---
phase: 09-mapping-table-tenant-isolation
fixed_at: 2026-08-26T00:13:00+07:00
review_path: .planning/phases/09-mapping-table-tenant-isolation/09-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-08-26T00:13:00+07:00
**Source review:** `.planning/phases/09-mapping-table-tenant-isolation/09-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

**Verification:** Focused vitest (6 files, 63 tests) passed in isolated worktree with junctioned `node_modules` from main checkout. Gates were **not** re-run in main checkout post–fast-forward.

## Fixed Issues

### WR-01: `updateTimelineMapping` lacks duplicate-name guard on rename

**Files modified:** `lib/services/import-mapping.service.ts`, `lib/services/import-mapping.service.unit.test.ts`
**Commit:** `4cf483c`
**Applied fix:** Pre-check `findTimelineMappingByName` before update; throw `ConflictError` when another row in the same company already uses the target name. Allow rename to the same name on the same row. No other mapping update paths exist (bug/Jira routes are create/delete only).

### WR-02: Mapping tenancy backfill is not transactional

**Files modified:** `lib/db-mapping-tenant.ts`
**Commit:** `346a09f`
**Applied fix:** Multi-company backfill (`INSERT … CROSS JOIN` + `DELETE … WHERE company_id IS NULL`) wrapped in `pool.connect()` + `BEGIN`/`COMMIT` with `ROLLBACK` on failure. Uses native `pg` Pool transaction API (migration already receives `Pool`, not `getDb()`).

### WR-03: Migration completion flag set despite swallowed index failures

**Files modified:** `lib/db-mapping-tenant.ts`
**Commit:** `346a09f` (same commit as WR-02 — both changes in `migrateOneTable`)
**Applied fix:** Added `uniqueIndexExists()` query against `pg_indexes`. After `CREATE UNIQUE INDEX IF NOT EXISTS`, migration returns early (no settings flag) if the index is absent. Removed blanket `catch` that swallowed index creation failures.

### IN-01: No explicit test that POST `company_id` in body is ignored

**Files modified:** `app/api/import-mapping/route.test.ts`, `app/api/bug-import-mapping/route.test.ts`, `app/api/jira/jql-presets/route.test.ts`, `app/api/jira/sync-mappings/route.test.ts`
**Commit:** `3b6f7cf`
**Applied fix:** Added POST test per mapping route sending `company_id: 999` in body; asserts service mock receives session `company_id: 5`, not 999.

### IN-02: Sync eviction unit test does not assert inner subquery `company_id` bind

**Files modified:** `lib/repositories/jira-config.repo.unit.test.ts`
**Commit:** `8cb8c37`
**Applied fix:** Assert DELETE SQL contains two `company_id = ?` predicates and `db.run` second call receives bind args `[5, 5]`.

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-08-26T00:13:00+07:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
