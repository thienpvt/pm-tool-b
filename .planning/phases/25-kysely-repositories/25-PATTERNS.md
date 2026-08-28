# Phase 25: Kysely Repositories - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 48 (6 new/modified infra + 40 repo conversions + 2 test harness extensions)
**Analogs found:** 46 / 48

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db/kysely.ts` | factory | request-response | `lib/db.ts` (`getDb` singleton) | exact |
| `lib/db/database.ts` | model | transform | `migrations/0001-baseline-schema.sql` | role-match |
| `lib/db.ts` (`getPool`) | utility | request-response | `lib/db.ts` (`getDb` init block) | exact |
| `lib/db-tx.ts` (`txKyselyTarget`) | middleware | event-driven | `lib/db-tx.ts` (`txQueryTarget`) | exact |
| `lib/repositories/_kysely-helpers.ts` | utility | transform | `lib/repositories/_helpers.ts` | exact |
| `lib/repositories/_kysely-helpers.test.ts` | test | transform | `lib/repositories/_helpers.test.ts` | exact |
| `test/repo-db.ts` (`testKysely`) | test utility | request-response | `test/repo-db.ts` (`testDb`) | exact |
| `modules/audit/backend/repositories/audit.repo.ts` | service | CRUD | `modules/audit/backend/repositories/audit.repo.ts` (self) | exact |
| `modules/dashboards/backend/repositories/dashboard-filter-state.repo.ts` | service | CRUD | `modules/dashboards/backend/repositories/dashboard-filter-state.repo.ts` | exact |
| `lib/repositories/auth.repo.ts` | service | CRUD | `lib/repositories/auth.repo.ts` | exact |
| `lib/repositories/settings.repo.ts` | service | CRUD | `lib/repositories/settings.repo.ts` | exact |
| `modules/projects/backend/repositories/projects.repo.ts` | service | CRUD | `modules/projects/backend/repositories/projects.repo.ts` | exact |
| `modules/projects/backend/repositories/activities.repo.ts` | service | CRUD | `modules/projects/backend/repositories/activities.repo.ts` | exact |
| `modules/projects/backend/repositories/{risks,issues,meetings,escalations,team}.repo.ts` | service | CRUD | `modules/projects/backend/repositories/projects.repo.ts` | exact |
| `modules/weekly/backend/repositories/weekly-periods.repo.ts` | service | CRUD + batch | `modules/weekly/backend/repositories/weekly-periods.repo.ts` | exact |
| `modules/weekly/backend/repositories/weekly-reports.repo.ts` | service | CRUD + batch | `modules/weekly/backend/repositories/weekly-periods.repo.ts` | role-match |
| Remaining 28 `*.repo.ts` files | service | CRUD | Nearest module repo with same shape (read-only vs upsert vs join) | partial |
| `modules/audit/backend/repositories/audit.repo.test.ts` | test | CRUD | `modules/audit/backend/repositories/audit.repo.test.ts` | exact |
| `modules/projects/backend/repositories/projects.repo.test.ts` | test | CRUD | `modules/projects/backend/repositories/projects.repo.test.ts` | exact |
| `package.json` (deps + `codegen:db`) | config | batch | existing `package.json` scripts | role-match |

## Pattern Assignments

### `lib/db/kysely.ts` (factory, request-response)

**Analog:** `lib/db.ts` — singleton lazy init after migrate-assert + seed

**Imports pattern** (mirror `lib/db.ts:1-4, 112-143`):

```typescript
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from '@/lib/db/database';
import { getPool } from '@/lib/db';
import { txKyselyTarget } from '@/lib/db-tx';
```

**Singleton factory pattern** (lines 112-143 of `lib/db.ts`):

```typescript
let _client: DbClient | null = null;
let _pool: Pool | null = null;

export async function getDb(): Promise<DbClient> {
  if (_client) return _client;
  // ... assertMigrated, seedAuthData, assign _pool + _client
}
```

**Target `getKysely()` shape:**

```typescript
let _kysely: Kysely<Database> | null = null;

export async function getKysely(): Promise<Kysely<Database>> {
  const tx = txKyselyTarget();
  if (tx) return tx;
  if (_kysely) return _kysely;
  const pool = await getPool();
  _kysely = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  return _kysely;
}
```

**Rules:** Call `getPool()` (which awaits `getDb()`) — never `new Pool()`. Lazy singleton matches `_client`. Transaction path via ALS takes precedence over pool singleton.

---

### `lib/db.ts` — `getPool()` export (utility, request-response)

**Analog:** `lib/db.ts` existing singleton block

**Core pattern** (lines 112-143):

```typescript
let _pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  await getDb(); // ensures assertMigrated + seedAuthData ran
  if (!_pool) throw new Error('Database pool is not initialized');
  return _pool;
}
```

**Placement:** Add immediately after `getDb()` in the singleton section. Do not export `_pool` directly.

---

### `lib/db/database.ts` (model, transform)

**Analog:** `migrations/0001-baseline-schema.sql` (hand-author fallback); `lib/db.ts` row types (lines 145-191) for naming conventions

**Codegen path (preferred, D-03):**

```bash
npx kysely-codegen --out-file lib/db/database.ts
```

**Hand-author fallback pattern** — table names match migration verbatim:

```typescript
// From migrations/0001-baseline-schema.sql:7-20
export interface Database {
  companies: CompaniesTable;
  users: UsersTable;
  audit_logs: AuditLogsTable;
  projects: ProjectsTable;
  // ... all tables referenced by *.repo.ts
}

export interface AuditLogsTable {
  id: Generated<number>;
  company_id: number | null;
  actor_id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  before: Json | null;
  after: Json | null;
  created_at: ColumnType<Date, never, never>;
}
```

**Rules:** Column names snake_case matching SQL. Use `Generated<T>` for SERIAL/BIGSERIAL. JSONB columns as `Json | null`. No global int8 parser (STACK.md). Check generated file into git.

---

### `lib/db-tx.ts` — `txKyselyTarget()` (middleware, event-driven)

**Analog:** `lib/db-tx.ts` — `txQueryTarget` ALS pattern

**Existing ALS pattern** (lines 1-11):

```typescript
const txStore = new AsyncLocalStorage<PoolClient>();

export function txQueryTarget(fallback: Queryable): Queryable {
  return txStore.getStore() ?? fallback;
}
```

**Extend `runInTransactionOnPool`** (lines 18-37) — store ephemeral Kysely alongside PoolClient:

```typescript
// After BEGIN, inside txStore.run:
const txKysely = new Kysely<Database>({
  dialect: new PostgresDialect({ pool: singleClientPoolAdapter(client) }),
});
return txKyselyStore.run(txKysely, () => fn(client));
```

**`txKyselyTarget()`:** Return ALS Kysely or `undefined`. `getKysely()` checks this first.

**When required:** Before Wave 8 (`weekly-periods.repo.ts`, `weekly-reports.repo.ts`). Existing call sites use `runInTransaction` from `lib/db.ts:116-120`.

---

### `lib/repositories/_kysely-helpers.ts` (utility, transform)

**Analog:** `lib/repositories/_helpers.ts` — `buildUpdate` + `UnknownColumnError`

**Reuse error class** (lines 10-18 of `_helpers.ts`):

```typescript
export class UnknownColumnError extends Error {
  readonly columns: string[];
  constructor(columns: string[]) {
    super(columns.length ? `Unknown column(s): ${columns.join(', ')}` : 'No updatable columns provided');
    this.name = 'UnknownColumnError';
    this.columns = columns;
  }
}
```

**Mirror `buildUpdate` semantics** (lines 32-48):

```typescript
export function pickAllowed<T extends Record<string, unknown>>(
  allowlist: readonly string[],
  fields: Record<string, unknown>,
): Partial<T> {
  const keys = Object.keys(fields);
  const unknown = keys.filter(k => !allowlist.includes(k));
  if (unknown.length) throw new UnknownColumnError(unknown);
  const columns = allowlist.filter(c => keys.includes(c));
  if (!columns.length) throw new UnknownColumnError([]);
  return Object.fromEntries(columns.map(c => [c, fields[c]])) as Partial<T>;
}
```

**Compile-time narrow type (D-04):**

```typescript
import type { Updateable } from 'kysely';
type ProjectUpdate = Pick<Updateable<Database['projects']>, typeof PROJECT_COLUMNS[number]>;
```

**Test analog:** Copy test cases from `_helpers.test.ts` — same assertions, `pickAllowed` instead of `buildUpdate`.

---

### `modules/audit/backend/repositories/audit.repo.ts` (service, CRUD) — W0 tracer

**Analog:** Current `audit.repo.ts` (self) — read-heavy + append-only insert, no `buildUpdate`

**Imports (keep export types, swap DB access):**

```typescript
import { getKysely } from '@/lib/db/kysely';
```

**Insert pattern** (current lines 33-46 → Kysely):

```typescript
// Before (lines 33-46):
await db.run(
  `INSERT INTO audit_logs (actor_id, company_id, entity_type, entity_id, action, before, after)
   VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)`,
  input.actor_id, input.company_id, input.entity_type, input.entity_id, input.action,
  input.before === null ? null : JSON.stringify(input.before),
  input.after === null ? null : JSON.stringify(input.after),
);

// After:
const db = await getKysely();
await db.insertInto('audit_logs').values({
  actor_id: input.actor_id,
  company_id: input.company_id,
  entity_type: input.entity_type,
  entity_id: input.entity_id,
  action: input.action,
  before: input.before === null ? null : JSON.stringify(input.before),
  after: input.after === null ? null : JSON.stringify(input.after),
}).execute();
```

**Select with dynamic filters** (lines 48-86):

```typescript
let q = db.selectFrom('audit_logs')
  .select(['id', 'company_id', 'actor_id', 'entity_type', 'entity_id', 'action', 'before', 'after', 'created_at'])
  .where('company_id', '=', companyId);
if (filters.entity_type) q = q.where('entity_type', '=', filters.entity_type);
// ... entity_id, from, to date filters via .where()
const rows = await q.orderBy('created_at', 'desc').orderBy('id', 'desc').limit(limit).execute();
```

**No allowlist needed:** Insert takes typed input object; no PATCH body map. D-08 mass-assignment proof comes from W9b repos, not audit.

---

### `modules/projects/backend/repositories/projects.repo.ts` (service, CRUD) — buildUpdate analog

**Analog:** Self — canonical `buildUpdate` + `PROJECT_COLUMNS` allowlist

**Allowlist const** (lines 12-41):

```typescript
export const PROJECT_COLUMNS = [
  'name', 'client', 'pm_name', /* ... */
  'classification', 'governance',
] as const;
```

**Update pattern** (lines 188-194):

```typescript
// Before:
export async function updateProject(projectId: number | string, fields: Record<string, unknown>) {
  const { sql, values } = buildUpdate('projects', PROJECT_COLUMNS, fields);
  const db = await getDb();
  await db.run(`UPDATE projects SET ${sql} WHERE id = ?`, ...values, projectId);
  return getProject(projectId);
}

// After:
export async function updateProject(projectId: number | string, fields: Record<string, unknown>) {
  const picked = pickAllowed<ProjectUpdate>(PROJECT_COLUMNS, fields);
  const db = await getKysely();
  await db.updateTable('projects').set(picked).where('id', '=', Number(projectId)).execute();
  return getProject(projectId);
}
```

**Keep `PROJECT_COLUMNS` export unchanged** — tests assert tenancy exclusion (lines 54-58 of `projects.repo.test.ts`).

---

### `modules/projects/backend/repositories/activities.repo.ts` (service, CRUD) — scoped UPDATE + RETURNING

**Analog:** Self — `buildUpdate` with compound WHERE

**Update pattern** (lines 63-68):

```typescript
// Before:
const { sql, values } = buildUpdate('activities', ACTIVITY_COLUMNS, fields);
return db.get(`UPDATE activities SET ${sql} WHERE id = ? AND project_id = ? RETURNING *`, ...values, rowId, projectId);

// After:
const picked = pickAllowed<ActivityUpdate>(ACTIVITY_COLUMNS, fields);
return db.updateTable('activities').set(picked)
  .where('id', '=', Number(rowId)).where('project_id', '=', Number(projectId))
  .returningAll().executeTakeFirst();
```

**Apply same pattern to:** `risks.repo.ts`, `issues.repo.ts`, `meetings.repo.ts`, `escalations.repo.ts`, `team.repo.ts`.

---

### `lib/repositories/auth.repo.ts` (service, CRUD) — read-only / single-column writes

**Analog:** Self — simple `get`/`run` with no allowlist

**Pattern** (lines 25-44):

```typescript
export async function findUserByUsername(username: string) {
  const db = await getKysely();
  return db.selectFrom('users').selectAll().where('username', '=', username).executeTakeFirst();
}

export async function setUserPasswordHash(userId: number | string, passwordHash: string) {
  const db = await getKysely();
  await db.updateTable('users').set({ password_hash: passwordHash }).where('id', '=', Number(userId)).execute();
}
```

**No `pickAllowed`:** Writes set explicit columns — no caller-supplied field map.

---

### `modules/dashboards/backend/repositories/dashboard-filter-state.repo.ts` (service, CRUD) — JSONB upsert

**Analog:** Self — `ON CONFLICT` upsert with JSONB

**Upsert pattern** (lines 23-38):

```typescript
// Before:
await db.run(
  `INSERT INTO dashboard_filter_state (user_id, surface, filters_json) VALUES (?, ?, ?::jsonb)
   ON CONFLICT (user_id, surface) DO UPDATE SET filters_json = excluded.filters_json, updated_at = now()`,
  userId, surface, JSON.stringify(filtersJson),
);

// After:
await db.insertInto('dashboard_filter_state')
  .values({ user_id: userId, surface, filters_json: JSON.stringify(filtersJson) })
  .onConflict(oc => oc.columns(['user_id', 'surface']).doUpdateSet({
    filters_json: eb => eb.ref('excluded.filters_json'),
    updated_at: sql`now()`,
  }))
  .execute();
```

**Secondary analog for upserts:** `weekly-periods.repo.ts:61-78` (`upsertCompanyWeeklyConfig`).

---

### `modules/weekly/backend/repositories/weekly-periods.repo.ts` (service, CRUD + batch)

**Analog:** Self — `runInTransaction` + multi-table writes

**Transaction wrapper** (lines 41-43):

```typescript
async function withPgTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return runInTransaction(fn);
}
```

**Migration rule:** Inner repo calls switch to `getKysely()` (which joins ALS tx). Do **not** rewrite services. Verify tx bridge before converting this file.

---

### `modules/audit/backend/repositories/audit.repo.test.ts` (test, CRUD)

**Analog:** Self — `vi.mock('@/lib/db')` + `testDb()` harness

**Mock pattern** (lines 1-10):

```typescript
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => testDb()),
  runInTransaction: (fn) => runInTransactionOnPool(testPool(), fn),
}));

// Add parallel mock:
vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));
```

**Harness:** Add `testKysely()` to `test/repo-db.ts` — `new Kysely<Database>({ dialect: new PostgresDialect({ pool: testPool() }) })`. Same pool, no second connection layer (D-07).

**Setup pattern** (lines 14-38): `describe.skipIf(!hasTestDb)`, `setupRepoTables()`, `seedCompany()`, `beforeEach` cleanup — unchanged.

---

### `modules/projects/backend/repositories/projects.repo.test.ts` (test, CRUD) — mass-assignment

**Analog:** Self — `UnknownColumnError` integration tests

**Critical assertions** (lines 38-52):

```typescript
it('rejects company_id and leaves the row unchanged', async () => {
  await expect(updateProject(projectId, { company_id: 99 })).rejects.toThrow(UnknownColumnError);
  const after = await testDb().get<{ company_id: number }>('SELECT company_id FROM projects WHERE id = ?', projectId);
  expect(after?.company_id).toBe(3);
});

it('names every unknown column, not just the first', async () => {
  await expect(updateProject(projectId, { company_id: 1, customer_id: 2 })).rejects.toMatchObject({
    columns: ['company_id', 'customer_id'],
  });
});
```

**Migration rule:** Tests stay green without modification if `pickAllowed` preserves `UnknownColumnError` semantics. Add `getKysely` mock alongside `getDb` mock.

**Route chain unchanged:** `with-auth.ts:124-126` → `repoErrorResponse` → 400. Do not add route-layer tests per repo.

---

### Remaining 28 `*.repo.ts` files (partial analog)

| Shape | Copy from | Notes |
|-------|-----------|-------|
| Simple SELECT by id / list | `auth.repo.ts` | `selectFrom().where().execute()` |
| Company-scoped list with JOIN | `projects.repo.ts` `listProjects` | `.leftJoin()` + `.where()` |
| Upsert ON CONFLICT | `dashboard-filter-state.repo.ts` | `.onConflict().doUpdateSet()` |
| buildUpdate PATCH | `projects.repo.ts` / `activities.repo.ts` | `pickAllowed` + `.updateTable().set()` |
| Transaction batch | `weekly-periods.repo.ts` | Requires tx ALS bridge first |
| Raw SQL fragments (CASE/ORDER BY) | Keep via `sql` template tag | e.g. `risks.repo.ts:17-30` RAID ordering |

---

## Shared Patterns

### Import alias (`@/`)

**Source:** All existing repos
**Apply to:** All new files

```typescript
import { getKysely } from '@/lib/db/kysely';
import type { Database } from '@/lib/db/database';
import { pickAllowed } from '@/lib/repositories/_kysely-helpers';
import { UnknownColumnError } from '@/lib/repositories/_helpers';
```

### Single pool — no per-repo construction

**Source:** `lib/db.ts:112-143`
**Apply to:** `getKysely()`, `testKysely()`, tx bridge

Repos call `await getKysely()` — never `new Pool()` or `new Kysely({ pool: new Pool(...) })`.

### Runtime mass-assignment guard

**Source:** `lib/repositories/_helpers.ts:32-48`
**Apply to:** All 7 buildUpdate repos + any new caller-supplied field maps

```typescript
const picked = pickAllowed<COLUMNS_TYPE>(ALLOWLIST, fields);
await db.updateTable('table').set(picked).where(...).execute();
```

### HTTP 400 mapping (unchanged — D-06)

**Source:** `lib/http/with-auth.ts:124-126`, `lib/api-errors.ts:23-26`
**Apply to:** No repo changes — routes catch `UnknownColumnError`

```typescript
if (e instanceof UnknownColumnError) return repoErrorResponse(e);
// → NextResponse.json({ error, columns }, { status: 400 })
```

### Test harness — mock both factories

**Source:** `test/repo-db.ts:68-70`, `modules/audit/backend/repositories/audit.repo.test.ts:6-10`
**Apply to:** All repo integration tests during dual-path migration

```typescript
vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()), /* runInTransaction */ }));
vi.mock('@/lib/db/kysely', () => ({ getKysely: vi.fn(async () => testKysely()) }));
```

### Transaction ALS

**Source:** `lib/db-tx.ts:6-11, 18-37`
**Apply to:** `getKysely()`, weekly wave repos

PostgresClient already joins tx via `txQueryTarget(this.pool)`. Kysely must join the same `PoolClient` via `txKyselyTarget()`.

### JSONB columns

**Source:** `audit.repo.ts:43-44`, `dashboard-filter-state.repo.ts:31`
**Apply to:** audit, dashboard, any JSONB table

Stringify objects before insert: `JSON.stringify(value)` or Kysely `json` helper. Do not rely on implicit serialization.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `package.json` `codegen:db` script | config | batch | No existing DB codegen script — follow npm script conventions in `package.json` scripts block |

## Metadata

**Analog search scope:** `lib/`, `modules/*/backend/repositories/`, `test/`, `migrations/`
**Files scanned:** ~55 (6 infra targets + 40 repos + 9 test/error files)
**Pattern extraction date:** 2026-08-28
