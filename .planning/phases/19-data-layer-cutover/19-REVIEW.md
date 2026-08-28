---
phase: 19-data-layer-cutover
reviewed: 2026-08-28T06:10:00Z
depth: deep
files_reviewed: 38
files_reviewed_list:
  - lib/migrate/plan.ts
  - lib/migrate/runner.ts
  - lib/migrate/assertMigrated.ts
  - lib/migrate/plan.test.ts
  - lib/migrate/runner.test.ts
  - lib/migrate/assertMigrated.test.ts
  - lib/migrate/baseline-content.test.ts
  - lib/migrate/data-fixes.test.ts
  - scripts/migrate.ts
  - migrations/0001-baseline-schema.sql
  - migrations/README.md
  - lib/db.ts
  - lib/db.getDb.boot.unit.test.ts
  - lib/db-roles.ts
  - lib/db-roles.ddl.unit.test.ts
  - lib/db-mapping-tenant.ts
  - lib/db-raid-masters.ts
  - lib/db-documents.ddl.unit.test.ts
  - lib/db-dashboards.ddl.unit.test.ts
  - lib/db-fiscal-budget.ddl.unit.test.ts
  - scripts/data-fixes/run-sql-fix.ts
  - scripts/data-fixes/01-users-onboarding-completed.ts
  - scripts/data-fixes/02-portfolio-members-member-type.ts
  - scripts/data-fixes/03-projects-company-id-sync.ts
  - scripts/data-fixes/04-activities-jira-parent-repair.ts
  - scripts/data-fixes/backfill-weighted-completion.ts
  - scripts/data-fixes/backfill-user-roles.ts
  - scripts/data-fixes/backfill-pm-assignments.ts
  - scripts/data-fixes/backfill-raid-masters.ts
  - scripts/data-fixes/backfill-mapping-tenant.ts
  - scripts/data-fixes/README.md
  - test/repo-db.ts
  - Dockerfile
  - .dockerignore
  - railway.json
  - docker-compose.yml
  - k8s-migrate-job.yaml
  - .github/workflows/test.yml
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-08-28T06:10:00Z
**Depth:** deep
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Deep review of the Phase 19 data-layer cutover: migrate engine, 0001 baseline SQL, operator data-fix scripts, slim `getDb`, and deploy/CI wiring. **`getDb` no longer calls boot DDL or `migrate*` helpers** — the boot scan test and source inspection confirm cutover intent is met. Advisory lock is present in `runMigrations` / `computePendingMigrations`. Origin v1.0 SQL was not copied; 0001 is regenerated from v2.0 sources.

**Ship blocker:** `0001-baseline-schema.sql` cannot be applied on a fresh database. Running `npm run migrate` against empty Postgres 17 fails with `syntax error at or near "ALTER"`. CI (`.github/workflows/test.yml`) and all Docker/Railway start paths depend on this migration succeeding first.

Secondary concern: `assertMigrated` legacy brownfield probe allows production boot without a `schema_migrations` ledger, bypassing the checksum contract until an operator manually runs migrate.

## Critical Issues

### CR-01: 0001 baseline SQL missing semicolons — migrate fails on fresh DB

**File:** `migrations/0001-baseline-schema.sql:351-360` (first failure site; pattern repeats through Part 3)
**Issue:** The runner executes the entire file as one multi-statement query (`client.query(file.sql)` inside `BEGIN`/`COMMIT`). PostgreSQL requires `;` terminators between statements. Part 1 ends with a `CREATE TABLE` closing `)` **without** a semicolon immediately before Part 2's first `ALTER TABLE`. Part 3 concatenates exported DDL fragments (from `MAPPING_TENANT_DDL`, `ROLES_AUDIT_DDL`, etc.) with newlines but no semicolons between adjacent statements.

**Verified:** `npm run migrate` against fresh Postgres 17 (`pm_tool_test`) exits 1 with:
`Migration 0001-baseline-schema.sql failed: syntax error at or near "ALTER"`.

Content tests (`baseline-content.test.ts`) scan for table names and fingerprints but never execute the SQL, so this was not caught in CI design.

**Fix:**
```sql
-- After every statement in 0001, including Part 1 CREATE TABLE closings:
    );

-- Part 2 continues
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id ...

-- Part 3: join exported DDL with semicolons when generating, e.g.
ALTER TABLE timeline_import_mappings ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_timeline_import_mappings_company_unique
   ON timeline_import_mappings (company_id, name);
```

Regenerate 0001 from TypeScript DDL exports with `;` appended to each fragment, or add a generation step that inserts terminators. Re-run `npm run migrate` on a scratch DB to confirm green.

### CR-02: Legacy brownfield probe bypasses ledger and checksum enforcement

**File:** `lib/migrate/assertMigrated.ts:28-42`
**Issue:** When `schema_migrations` is missing but `companies` has rows, `assertMigrated` resolves successfully and the app boots. No ledger is stamped, no checksum validation runs, and deploy/CI migrate steps may never run on that database. Phase 19-04 claims "fail closed on unmigrated DBs" and "dual-writer prohibition resolved," but brownfield databases on the old boot path silently skip the migration contract.

This is the checksum/ledger bypass called out in the phase threat model: production can run indefinitely without ever adopting the ledger.

**Fix:** Remove or gate the legacy probe behind an explicit env flag (e.g. `ALLOW_LEGACY_BOOT=1` for dev only). Production should require at least one ledger row:

```typescript
export async function assertMigrated(
  query: (sql: string) => Promise<{ rows: unknown[] }>,
  ledgerTable = 'schema_migrations',
): Promise<void> {
  const res = await query(`SELECT 1 FROM ${ledgerTable} LIMIT 1`);
  if (res.rows.length === 0) {
    throw new Error(RUNBOOK_MESSAGE);
  }
}
```

Run `npm run migrate` once on brownfield DBs before cutover (documented in `migrations/README.md`) instead of allowing indefinite bypass.

## Warnings

### WR-01: getDb leaks Pool when assertMigrated throws

**File:** `lib/db.ts:129-136`
**Issue:** `_pool` is assigned before `assertMigrated`. If the guard throws (unmigrated DB), `_client` stays `null` but `_pool` retains the first Pool. A retry calls `getDb()` again, creates a second Pool, and overwrites `_pool` without closing the first — connection leak on every failed boot attempt.

**Fix:**
```typescript
const pool = new Pool({ ... });
try {
  await assertMigrated((sql) => pool.query(sql));
  _pool = pool;
  _client = new PostgresClient(pool);
  await seedAuthData(_client);
  return _client;
} catch (err) {
  await pool.end();
  throw err;
}
```

### WR-02: computePendingMigrations swallows all ledger read errors

**File:** `lib/migrate/runner.ts:68-73`
**Issue:** The bare `catch` around `readApplied` treats **any** query failure (permissions, connection drop, timeout) as "ledger missing → nothing applied." `npm run migrate -- --check` would report all migrations pending instead of surfacing the underlying error, masking operational failures during deploy gates.

**Fix:** Catch only `42P01` / "does not exist" messages; rethrow other errors:
```typescript
} catch (err) {
  if (isMissingRelation(err)) { applied = []; }
  else { throw err; }
}
```

### WR-03: Ledger INSERT uses string interpolation instead of parameters

**File:** `lib/migrate/runner.ts:110-112`
**Issue:** `INSERT INTO ${ledgerTable} ... VALUES (${file.version}, '${file.filename}', '${file.checksum}')` interpolates filename and checksum. Filename regex and sha256 hex constrain values today, but this violates parameterized-query discipline and would break if filename rules loosen. `ledgerTable` is also interpolated unquoted in `CREATE TABLE`, `SELECT`, and `INSERT`.

**Fix:**
```typescript
await client.query(
  `INSERT INTO ${ledgerTable} (version, name, checksum) VALUES ($1, $2, $3)`,
  [file.version, file.filename, file.checksum],
);
```
Validate `ledgerTable` against `^[a-z_][a-z0-9_]*$` or use a fixed constant.

### WR-04: Test suite uses parallel DDL path unrelated to 0001

**File:** `test/repo-db.ts:79-335`
**Issue:** CI runs `npm run migrate` then `npm test`, but repository tests still call `setupRepoTables()` which applies a hand-maintained `DDL` string via semicolon splitting — a second schema writer. This duplicates tables already created by 0001 and can hide drift between migration SQL and test fixtures (e.g. column defaults, constraints). Not a production dual-writer, but undermines the cutover's single-source-of-truth goal for tests.

**Fix:** After CR-01 is fixed, migrate repo tests to rely on `npm run migrate` output only; reduce `setupRepoTables` to truncate/seed helpers or delete redundant CREATE statements.

### WR-05: baseline-content.test does not execute SQL against Postgres

**File:** `lib/migrate/baseline-content.test.ts`
**Issue:** Tests assert string presence (table names, RAID order, no DROP TABLE) but never parse or run the file against Postgres. CR-01 (missing semicolons) passed all content gates. Add an integration test (behind `TEST_DATABASE_URL`) that runs `runMigrations` with 0001 on a scratch schema.

**Fix:** Extend `runner.test.ts` or add `baseline-apply.integration.test.ts` applying real 0001 on ephemeral Postgres.

## Info

### IN-01: migrations/README.md deploy section is stale post-19-04

**File:** `migrations/README.md:102-112`
**Issue:** README still says Docker COPY and tsx wiring are "plan 19-04" future work and "Until then, run migrate from an operator machine." 19-04 shipped Dockerfile/compose/Railway/CI wiring. Operators reading this may skip container migrate steps.

**Fix:** Update deploy section to reflect current Dockerfile CMD and CI migrate step.

### IN-02: Origin v1.0 detection test is weak

**File:** `lib/migrate/baseline-content.test.ts:80-84`
**Issue:** "Not origin v1.0" assertion only checks that `weekly_periods` and `user_roles` appear — insufficient to detect accidental partial copy of origin SQL mixed with v2.0 fragments.

**Fix:** Add negative fingerprints from origin baseline (tables/columns known absent in v2.0) or compare checksum against a golden hash after CR-01 fix.

---

_Reviewed: 2026-08-28T06:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
