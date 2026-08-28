# Phase 19: Data Layer Cutover - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 28
**Analogs found:** 26 / 28

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/migrate/plan.ts` | utility | transform | `origin/gsd/quick-260826-ded-data-layer-migrations:lib/migrate/plan.ts` | exact |
| `lib/migrate/runner.ts` | service | batch | `origin/gsd/quick-260826-ded-data-layer-migrations:lib/migrate/runner.ts` | exact |
| `lib/migrate/assertMigrated.ts` | middleware | request-response | `origin/gsd/quick-260826-ded-data-layer-migrations:lib/migrate/assertMigrated.ts` | exact |
| `scripts/migrate.ts` | route (CLI) | file-I/O + batch | `origin/gsd/quick-260826-ded-data-layer-migrations:scripts/migrate.ts` | exact |
| `scripts/data-fixes/run-sql-fix.ts` | utility | batch | `origin/gsd/quick-260826-ded-data-layer-migrations:scripts/data-fixes/run-sql-fix.ts` | exact |
| `scripts/data-fixes/01-users-onboarding-completed.ts` | utility | batch | `origin/.../01-users-onboarding-completed.ts` + `lib/db.ts:440` | exact |
| `scripts/data-fixes/02-portfolio-members-member-type.ts` | utility | batch | `origin/.../02-portfolio-members-member-type.ts` + `lib/db.ts:448` | exact |
| `scripts/data-fixes/03-projects-company-id-sync.ts` | utility | batch | `origin/.../03-projects-company-id-sync.ts` + `lib/db.ts:475` | exact |
| `scripts/data-fixes/04-activities-jira-parent-repair.ts` | utility | batch | `origin/.../04-activities-jira-parent-repair.ts` + `lib/db.ts:489-504` | exact |
| `scripts/data-fixes/backfill-weighted-completion.ts` | utility | batch | `origin/.../backfill-weighted-completion.ts` + `lib/db.ts:backfillWeightedCompletion` | exact |
| `scripts/data-fixes/backfill-user-roles.ts` | utility | batch | `lib/db-roles.ts:backfillUserRoles` | role-match |
| `scripts/data-fixes/backfill-pm-assignments.ts` | utility | batch | `lib/db-project-master.ts` backfill fn | role-match |
| `scripts/data-fixes/backfill-raid-masters.ts` | utility | batch | `lib/db-raid-masters.ts:backfillRaidMasters` | role-match |
| `scripts/data-fixes/backfill-mapping-tenant.ts` | utility | batch | `lib/db-mapping-tenant.ts:migrateOneTable` backfill step | role-match |
| `migrations/0001-baseline-schema.sql` | migration | batch | `lib/db.ts:initPostgresSchema` + `migratePostgresSchema` + `lib/db-*.ts *_DDL` | role-match |
| `migrations/README.md` | config | — | `origin/.../migrations/README.md` | exact (adapt Part 3) |
| `lib/db.ts` | config | request-response | `origin slim getDb` + current `lib/db.ts:608-643` (remove list) | exact |
| `lib/db-mapping-tenant.ts` | config | batch | current file; drop `getDb()` call only | exact |
| `lib/db-roles.ts` | config | batch | current file; drop `getDb()` call only | exact |
| `lib/db-project-master.ts` | config | batch | current file; keep `PROJECT_MASTER_*_DDL` | exact |
| `lib/db-raid-masters.ts` | config | batch | current file; keep `RAID_MASTERS_*_DDL` | exact |
| `lib/db-weekly-reports.ts` | config | batch | current file; keep `WEEKLY_*_DDL` | exact |
| `lib/db-fiscal-budget.ts` | config | batch | current file; keep `FISCAL_BUDGET_DDL` | exact |
| `lib/db-dashboards.ts` | config | batch | current file; keep `DASHBOARDS_DDL` | exact |
| `lib/db-documents.ts` | config | batch | current file; keep `DOCUMENTS_DDL` | exact |
| `lib/migrate/plan.test.ts` | test | transform | `origin/.../lib/migrate/plan.test.ts` | exact |
| `lib/migrate/runner.test.ts` | test | batch | `origin/.../lib/migrate/runner.test.ts` | exact |
| `lib/migrate/assertMigrated.test.ts` | test | request-response | `origin/.../lib/migrate/assertMigrated.test.ts` | exact |
| `lib/migrate/data-fixes.test.ts` | test | file-I/O | `origin/.../lib/migrate/data-fixes.test.ts` | exact |
| `lib/migrate/baseline-content.test.ts` | test | transform | `lib/db-weekly-reports.ddl.unit.test.ts` + `data-fixes.test.ts` | role-match |
| `package.json` | config | — | `origin/.../package.json` (`migrate` script + `tsx`) | exact |
| `Dockerfile` | config | — | `origin/.../Dockerfile` (COPY migrations/scripts) | exact |
| `.github/workflows/test.yml` | config | batch | current file + migrate pre-step (RESEARCH Wave 0) | partial |

## Pattern Assignments

### `lib/migrate/plan.ts` (utility, transform)

**Analog:** `origin/gsd/quick-260826-ded-data-layer-migrations:lib/migrate/plan.ts`

Port verbatim — pure logic, no DB, no `fs`. Planner should copy the entire file from origin without modification.

**Imports pattern:**
```typescript
import { createHash } from 'crypto';
```

**Core pattern — filename parse + checksum + pending plan:**
```typescript
const FILENAME_RE = /^(\d{1,4})-[A-Za-z0-9_-]+\.sql$/;

export function parseMigrationFile(filename: string, sql: string): MigrationFile {
  const match = FILENAME_RE.exec(filename);
  if (!match) throw new Error(`Invalid migration filename: ${filename}`);
  return {
    version: Number(match[1]),
    name: filename,
    filename,
    checksum: sha256(sql),
    sql,
  };
}

export function planPendingMigrations(
  files: MigrationFile[],
  applied: AppliedMigration[],
): { toApply: MigrationFile[]; drifted: string[] } {
  // duplicate version guard, sort by version, collect checksum drift
}
```

---

### `lib/migrate/runner.ts` (service, batch)

**Analog:** `origin/gsd/quick-260826-ded-data-layer-migrations:lib/migrate/runner.ts`

Port verbatim. Key constants and transaction-per-file pattern:

**Core pattern — advisory lock + ledger + BEGIN/COMMIT per file:**
```typescript
export const DEFAULT_LEDGER_TABLE = 'schema_migrations';
export const MIGRATION_LOCK_KEY = 1347246335;

export async function runMigrations(client: QueryableClient, files: MigrationFile[], opts?) {
  await client.query(`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
  try {
    await ensureLedgerTable(client, ledgerTable);
    const applied = await readApplied(client, ledgerTable);
    const { toApply, drifted, alreadyApplied } = summarize(files, applied);
    if (drifted.length > 0) {
      throw new Error(`Migration checksum drift detected: ${drifted.join(', ')}`);
    }
    for (const file of toApply) {
      await client.query('BEGIN');
      await client.query(file.sql);
      await client.query(
        `INSERT INTO ${ledgerTable} (version, name, checksum) VALUES (${file.version}, '${file.filename}', '${file.checksum}')`,
      );
      await client.query('COMMIT');
    }
  } finally {
    await client.query(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`).catch(() => {});
  }
}
```

**Error handling:** Failed migration → `ROLLBACK` → rethrow with filename attached. Never swallow errors (contrast current `lib/db.ts:506-508` empty catch).

---

### `lib/migrate/assertMigrated.ts` (middleware, request-response)

**Analog:** `origin/gsd/quick-260826-ded-data-layer-migrations:lib/migrate/assertMigrated.ts`

Port verbatim. No `fs` — safe for `output: 'standalone'`.

**Core pattern — ledger probe + legacy brownfield fallback:**
```typescript
const RUNBOOK_MESSAGE = 'Database schema not migrated — run "npm run migrate" first';

export async function assertMigrated(
  query: (sql: string) => Promise<{ rows: unknown[] }>,
  ledgerTable = 'schema_migrations',
): Promise<void> {
  try {
    const res = await query(`SELECT 1 FROM ${ledgerTable} LIMIT 1`);
    if (res.rows.length === 0) throw new Error(RUNBOOK_MESSAGE);
    return;
  } catch (err) {
    if (err instanceof Error && err.message === RUNBOOK_MESSAGE) throw err;
    // Ledger missing — allow legacy DB with companies table
    try {
      const probe = await query('SELECT 1 FROM companies LIMIT 1');
      if (probe.rows.length > 0) return;
    } catch { /* fresh DB */ }
    throw new Error(RUNBOOK_MESSAGE);
  }
}
```

---

### `scripts/migrate.ts` (route/CLI, file-I/O + batch)

**Analog:** `origin/gsd/quick-260826-ded-data-layer-migrations:scripts/migrate.ts`

Port structure verbatim. Requires exporting `resolveSsl` from `lib/db.ts` (currently private at lines 582-596).

**Imports pattern:**
```typescript
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { getDb, resolveSsl } from '@/lib/db';
import { parseMigrationFile, type MigrationFile } from '@/lib/migrate/plan';
import { computePendingMigrations, runMigrations } from '@/lib/migrate/runner';
```

**Core CLI pattern:**
```typescript
const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../migrations');

async function main() {
  const pool = new Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });
  const client = await pool.connect();
  try {
    const files = loadMigrations();
    if (check) { /* computePendingMigrations, exit 1 if pending/drift */ return; }
    await runMigrations(client, files);
    await getDb(); // seed-if-empty after ledger exists
  } finally {
    client.release();
    await pool.end();
  }
}
```

---

### `scripts/data-fixes/run-sql-fix.ts` + individual fix scripts (utility, batch)

**Analog:** `origin/.../scripts/data-fixes/run-sql-fix.ts` and `01-users-onboarding-completed.ts`

**Shared helper pattern:**
```typescript
import { Pool } from 'pg';
import { resolveSsl } from '@/lib/db';

export async function runFix({ name, sql }: Fix): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL environment variable is required...');
  const pool = new Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });
  try {
    const result = await pool.query(sql);
    console.log(`${name}: ${result.rowCount ?? 0} rows affected`);
  } finally {
    await pool.end();
  }
}
```

**Per-script pattern (port origin 01-04 verbatim; extract SQL from current boot path):**
```typescript
import { runFix } from './run-sql-fix';

runFix({
  name: '01-users-onboarding-completed',
  sql: `UPDATE users SET onboarding_completed = 1 WHERE created_at < '2026-05-08 00:00:00' AND onboarding_completed = 0`,
}).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
```

**New v2.0 backfill scripts** — copy DML from existing migrate helpers, not origin branch:

| Script | Source function | Source file |
|--------|----------------|-------------|
| `backfill-user-roles.ts` | `backfillUserRoles` | `lib/db-roles.ts` |
| `backfill-pm-assignments.ts` | PM assignment backfill | `lib/db-project-master.ts` |
| `backfill-raid-masters.ts` | `backfillRaidMasters` | `lib/db-raid-masters.ts` |
| `backfill-mapping-tenant.ts` | `migrateOneTable` backfill step | `lib/db-mapping-tenant.ts` |

For settings-flag idempotency, wrap with the same flag read/write pattern used in migrate helpers (e.g. `readSettingsFlag` / `writeSettingsFlag` in each `lib/db-*.ts`).

---

### `migrations/0001-baseline-schema.sql` (migration, batch)

**Analog:** Current `lib/db.ts` schema arrays + `lib/db-*.ts` exported `*_DDL` constants — **NOT** origin branch SQL content (v1.0 only).

**Generation pattern — three labelled parts:**

**Part 1 — init CREATE TABLEs** from `initPostgresSchema` (`lib/db.ts:69-420`):
```sql
-- Part 1: initPostgresSchema (35 CREATE TABLE IF NOT EXISTS blocks)
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- ... remaining tables from initPostgresSchema
```

**Part 2 — legacy migrate DDL** from `migratePostgresSchema` array (`lib/db.ts:425+`):
- Include: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `DO $$` type guards
- **Strip** these DML lines (move to data-fix scripts):
  - Line 440: `UPDATE users SET onboarding_completed...`
  - Line 448: `UPDATE portfolio_members SET member_type...`
  - Line 475: `UPDATE projects SET company_id...`
  - Lines 489-504: `UPDATE activities a SET parent_id...`

**Part 3 — v2.0 DDL** concatenate exported constants (join with `\n`):

| Source | Export constants |
|--------|-----------------|
| `lib/db-roles.ts` | inline DDL from `migrateRolesDdl` |
| `lib/db-project-master.ts` | `PROJECT_MASTER_DDL`, `PROJECT_MASTER_CONSTRAINTS_DDL` |
| `lib/db-raid-masters.ts` | `RAID_MASTERS_DDL`, `RAID_MASTERS_INDEX_DDL` |
| `lib/db-weekly-reports.ts` | `WEEKLY_REPORTS_DDL`, `WEEKLY_REPORTS_INDEX_DDL`, `WEEKLY_EXPORT_LOGS_DDL` |
| `lib/db-fiscal-budget.ts` | `FISCAL_BUDGET_DDL` |
| `lib/db-dashboards.ts` | `DASHBOARDS_DDL` |
| `lib/db-documents.ts` | `DOCUMENTS_DDL` |
| `lib/db-mapping-tenant.ts` | procedural DDL → SQL fragments (company_id columns + unique indexes) |

**Validation:** Assert Part 3 includes `weekly_periods`, `audit_logs`, `user_roles`, `project_fiscal_budgets`, `document_catalog` (new `baseline-content.test.ts`).

**RAID ordering note:** Indexes in Part 3 follow DDL; operator may need `backfill-raid-masters.ts` before migrate on brownfield DBs with duplicate codes (`lib/db-raid-masters.ts:127-134`).

---

### `migrations/README.md` (config)

**Analog:** `origin/.../migrations/README.md`

Copy origin README structure; update Part description to **three parts** (add Part 3 v2.0 DDL from `lib/db-*.ts`). Keep ledger contract, brownfield stamp steps, data-fix list (extend with v2.0 backfill scripts), deploy wiring note.

---

### `lib/db.ts` (config, request-response)

**Analog:** Current boot path (`lib/db.ts:608-643`) **minus** migrate chain; origin slim `getDb()` **plus** `assertMigrated`.

**Current boot path to REMOVE** (lines 621-639):
```typescript
await initPostgresSchema(client);
await migratePostgresSchema(pool);
const { migrateMappingTableTenancy } = await import('./db-mapping-tenant');
await migrateMappingTableTenancy(pool);
const { migrateUsersRolesAndAudit } = await import('./db-roles');
await migrateUsersRolesAndAudit(pool);
const { migrateProjectMaster } = await import('./db-project-master');
await migrateProjectMaster(pool);
const { migrateRaidMasters } = await import('./db-raid-masters');
await migrateRaidMasters(pool);
const { migrateWeeklyReports } = await import('./db-weekly-reports');
await migrateWeeklyReports(pool);
const { migrateFiscalBudget } = await import('./db-fiscal-budget');
await migrateFiscalBudget(pool);
const { migrateDashboards } = await import('./db-dashboards');
await migrateDashboards(pool);
const { migrateDocuments } = await import('./db-documents');
await migrateDocuments(pool);
await backfillWeightedCompletion(pool);
```

**Target slim getDb pattern:**
```typescript
import { assertMigrated } from './migrate/assertMigrated';

export function resolveSsl(databaseUrl: string): false | { rejectUnauthorized: boolean } {
  // existing lib/db.ts:582-596 — export this
}

export async function getDb(): Promise<DbClient> {
  if (_client) return _client;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required...');
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: resolveSsl(process.env.DATABASE_URL),
  });
  _pool = pool;
  const client = new PostgresClient(pool);
  await assertMigrated((sql) => pool.query(sql));
  _client = client;
  await seedAuthData(_client);
  return _client;
}
```

**Keep unchanged:** `PostgresClient`, `runInTransaction`, `seedAuthData` (`lib/db.ts:555-574`), singleton `_client`/`_pool`.

---

### `lib/db-*.ts` (config, batch)

**Analog:** Current files — keep exported `*_DDL` arrays and unit tests; remove only `getDb()` invocations.

**DDL export pattern** (`lib/db-weekly-reports.ts:3-78`):
```typescript
export const WEEKLY_REPORTS_DDL_FLAG = 'weekly_reports_ddl_v1';
export const WEEKLY_REPORTS_DDL = [
  `CREATE TABLE IF NOT EXISTS company_weekly_config (...)`,
  // ...
];
export const WEEKLY_REPORTS_INDEX_DDL = [ /* index DDL */ ];
```

**Settings-flag migrate pattern to deprecate** (remove from boot, keep for reference or delete):
```typescript
export async function migrateWeeklyReports(pool: Pool): Promise<void> {
  try {
    await migrateWeeklyReportsDdl(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
```

Planner: keep `*_DDL` exports + existing `*.ddl.unit.test.ts`; remove or `@deprecated` migrate functions to prevent re-wiring.

---

### `lib/migrate/*.test.ts` (test)

**Analog:** Origin branch test files — port verbatim for `plan.test.ts`, `runner.test.ts`, `assertMigrated.test.ts`, `data-fixes.test.ts`.

**Integration test harness pattern** (`runner.test.ts` uses `test/db.ts`):
```typescript
import { closeTestPool, hasTestDb, testPool } from '../../test/db';

describe.skipIf(!hasTestDb)('runMigrations against real Postgres', () => {
  afterAll(async () => {
    await testPool().query(`DROP TABLE IF EXISTS ${LEDGER}`);
    await closeTestPool();
  });
  // read shipped 0001, apply twice, assert idempotent
});
```

**New `baseline-content.test.ts` pattern** — extend `data-fixes.test.ts` migration integrity checks:
```typescript
it('0001 includes v2.0 table names', () => {
  const sql = readFileSync(path.join(migrationsDir(), '0001-baseline-schema.sql'), 'utf8');
  for (const table of ['weekly_periods', 'audit_logs', 'user_roles', 'project_fiscal_budgets', 'document_catalog']) {
    expect(sql).toMatch(new RegExp(table));
  }
});
```

---

### `package.json` (config)

**Analog:** `origin/.../package.json`

**Scripts addition:**
```json
"migrate": "npx tsx scripts/migrate.ts"
```

**DevDependency:**
```json
"tsx": "4.23.12"
```

---

### `Dockerfile` (config)

**Analog:** `origin/.../Dockerfile` lines 30-31

**Add to runner stage after static COPY:**
```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
```

Note: tsx not in runner stage until compile/vendor wiring — document operator-machine migrate per origin README.

---

### `.github/workflows/test.yml` (config)

**Analog:** Current `.github/workflows/test.yml` + RESEARCH Wave 0 gap

**Add migrate step before test** (no analog on origin branch yet):
```yaml
- run: npm ci
- run: npm run migrate
  env:
    DATABASE_URL: postgres://postgres:postgres@localhost:5432/pm_tool_test
- run: npm test
  env:
    TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432/pm_tool_test
```

---

## Shared Patterns

### Connection + SSL
**Source:** `lib/db.ts:582-618`
**Apply to:** `scripts/migrate.ts`, all `scripts/data-fixes/*.ts`, slim `getDb()`

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL),
});
```

Export `resolveSsl` — currently private function at `lib/db.ts:582-596`.

### Test database guard
**Source:** `test/db.ts:10-20`
**Apply to:** Integration tests in `lib/migrate/runner.test.ts`

```typescript
const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, '');
if (!dbName.endsWith('_test')) {
  throw new Error(`Refusing to run tests against database "${dbName}" — name must end in _test`);
}
```

### Auth seed (unchanged)
**Source:** `lib/db.ts:555-574`
**Apply to:** Slim `getDb()` and post-migrate CLI (`scripts/migrate.ts` calls `getDb()`)

```typescript
async function seedAuthData(db: DbClient) {
  const row = await db.get<{ c: string | number }>('SELECT COUNT(*) as c FROM users');
  if (Number(row?.c ?? 0) > 0) return;
  // INSERT OR IGNORE default company + admin user
}
```

### DDL unit test as 0001 source-of-truth
**Source:** `lib/db-weekly-reports.ddl.unit.test.ts`
**Apply to:** Verify Part 3 content matches exported constants

```typescript
const ddl = WEEKLY_REPORTS_DDL.join('\n');
expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS weekly_periods/);
expect(ddl).toMatch(/UNIQUE \(company_id, iso_week\)/);
```

Existing `lib/db-*.ddl.unit.test.ts` files remain valid — no deletion required.

### Import alias
**Source:** project convention (`@/` alias)
**Apply to:** All new TypeScript files

```typescript
import { resolveSsl } from '@/lib/db';
import { parseMigrationFile } from '@/lib/migrate/plan';
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|------|
| `lib/migrate/baseline-content.test.ts` | test | transform | New v2.0-specific assertion; compose from `data-fixes.test.ts` + DDL unit test patterns |

---

## Metadata

**Analog search scope:** `lib/`, `scripts/`, `migrations/` (origin branch via `git show`), `test/db.ts`, `Dockerfile`, `.github/workflows/test.yml`, `package.json`
**Files scanned:** ~45 (current tree + origin branch migration subset)
**Pattern extraction date:** 2026-08-28

**Critical planner note:** Origin branch `gsd/quick-260826-ded-data-layer-migrations` is the **structural** analog for runner/ledger/CLI/tests. Its `migrations/0001-baseline-schema.sql` **content** is v1.0-only and must **not** be merged — regenerate from current `lib/db.ts` + `lib/db-*.ts`.
