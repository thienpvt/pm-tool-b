# Phase 9: Mapping Table Tenant Isolation - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 22 new/modified files
**Analogs found:** 20 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db.ts` (migrate statements) | migration | batch | `migratePostgresSchema` + `backfillWeightedCompletion` | exact |
| `lib/repositories/import-mapping.repo.ts` | repository | CRUD | `listPortfolioMembers` + current `import-mapping.repo.ts` | exact |
| `lib/repositories/jira-config.repo.ts` | repository | CRUD | `companyJiraConfig` + current `jira-config.repo.ts` | exact |
| `lib/services/import-mapping.service.ts` | service | request-response | `lib/services/holidays.service.ts` + `assertProgramAccess` | role-match |
| `lib/services/jira-mapping.service.ts` | service | request-response | `lib/services/holidays.service.ts` + `assertProgramAccess` | role-match |
| `app/api/import-mapping/route.ts` | route | request-response | `app/api/import-mapping/route.ts` → refactor to `projects.service` thin route | exact |
| `app/api/import-mapping/[id]/route.ts` | route | request-response | same as above | exact |
| `app/api/bug-import-mapping/route.ts` | route | request-response | `app/api/bug-import-mapping/route.ts` (cap/evict logic stays in service) | exact |
| `app/api/bug-import-mapping/[id]/route.ts` | route | request-response | `app/api/import-mapping/[id]/route.ts` | exact |
| `app/api/jira/jql-presets/route.ts` | route | request-response | `app/api/jira/jql-presets/route.ts` | exact |
| `app/api/jira/jql-presets/[id]/route.ts` | route | request-response | `app/api/jira/jql-presets/[id]/route.ts` | exact |
| `app/api/jira/sync-mappings/route.ts` | route | request-response | `app/api/jira/sync-mappings/route.ts` | exact |
| `lib/services/import-mapping.service.unit.test.ts` | test | — | `lib/services/holidays.service.unit.test.ts` + `lib/services/access.unit.test.ts` | exact |
| `lib/services/jira-mapping.service.unit.test.ts` | test | — | same as above | exact |
| `lib/repositories/import-mapping.repo.unit.test.ts` | test | — | `lib/repositories/tenant-scope.repo.unit.test.ts` | exact |
| `lib/repositories/import-mapping.repo.test.ts` (integration) | test | — | `lib/repositories/programs.repo.test.ts` | exact |
| `lib/db.mapping-tenant-migration.integration.test.ts` | test | — | `lib/repositories/programs.repo.test.ts` + `backfillWeightedCompletion` | role-match |
| `test/repo-db.ts` (DDL extend) | test config | — | existing `DDL` block in `test/repo-db.ts` | exact |
| `app/api/import-mapping/route.test.ts` | test | — | `app/api/export/ppt/[id]/route.test.ts` (403) + existing 401 tests | exact |
| `app/api/bug-import-mapping/route.test.ts` | test | — | same | exact |
| `app/api/jira/jql-presets/route.test.ts` | test | — | same | exact |
| `app/api/jira/sync-mappings/route.test.ts` | test | — | same (list isolation, no by-id route) | exact |

## Pattern Assignments

### `lib/db.ts` — migration + backfill (migration, batch)

**Analog:** `migratePostgresSchema` loop (lines 420–504) + conditional backfill in `backfillWeightedCompletion` (lines 511–547)

**Migration append pattern** (lines 420–504):

```typescript
async function migratePostgresSchema(pool: Pool) {
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`,
    // ... existing statements ...
    `ALTER TABLE jira_jql_presets ADD COLUMN IF NOT EXISTS context TEXT DEFAULT ''`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch { /* column already exists */ }
  }
}
```

**Backfill guard pattern** — use a settings flag or count branch before destructive UPDATE (lines 511–515):

```typescript
async function backfillWeightedCompletion(pool: Pool) {
  const FLAG = 'completion_pct_weighted_v1';
  try {
    const done = await pool.query('SELECT value FROM settings WHERE key = $1', [FLAG]);
    if (done.rows.length > 0) return;
    // ... backfill SQL ...
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
```

**Phase 9 migration order per table:** `ADD COLUMN company_id` → backfill (single-company UPDATE vs multi-company CROSS JOIN duplicate + DELETE NULL rows) → `SET NOT NULL` → `CREATE UNIQUE INDEX (company_id, name)` (add `context` for JQL presets) → `CREATE INDEX (company_id)`. Append all statements to the `migrations` array; each wrapped in the existing try/catch idempotency loop.

---

### `lib/repositories/import-mapping.repo.ts` (repository, CRUD)

**Analog:** `listPortfolioMembers` for company-scoped list; current file for CRUD shape

**Imports pattern** (lines 1–1):

```typescript
import { getDb } from '@/lib/db';
```

**Company-scoped list** — mirror `listPortfolioMembers` (portfolio.repo.ts:110–115):

```typescript
export async function listTimelineMappings(companyId: number) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM timeline_import_mappings WHERE company_id = ? ORDER BY created_at DESC',
    companyId,
  );
}
```

**Create stamps company_id from caller** — mirror `createProject` taking resolved `companyId` (projects.repo.ts:99–108):

```typescript
export async function createTimelineMapping(companyId: number, name: string, mappingsJson: string) {
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO timeline_import_mappings (name, mappings_json, company_id) VALUES (?, ?, ?)',
    name, mappingsJson, companyId,
  );
  return db.get('SELECT * FROM timeline_import_mappings WHERE id = ?', r.lastInsertRowid);
}
```

**By-id mutate with defense-in-depth** — add `AND company_id = ?` to UPDATE/DELETE (current lines 28–39):

```typescript
export async function updateTimelineMapping(
  companyId: number, id: number | string, name: string, mappingsJson: string,
) {
  const db = await getDb();
  await db.run(
    'UPDATE timeline_import_mappings SET name = ?, mappings_json = ? WHERE id = ? AND company_id = ?',
    name, mappingsJson, id, companyId,
  );
  return db.get('SELECT * FROM timeline_import_mappings WHERE id = ? AND company_id = ?', id, companyId);
}
```

**Bug mapping cap/evict** — scope `bugMappingIds` and eviction DELETE by `company_id` (current route lines 17–22 move to service; repo must filter):

```typescript
export async function bugMappingIds(companyId: number) {
  const db = await getDb();
  return db.all<{ id: number }>(
    'SELECT id FROM bug_import_mappings WHERE company_id = ? ORDER BY created_at DESC',
    companyId,
  );
}
```

Add `getTimelineMappingById(id)` / `getBugMappingById(id)` (no company filter) for service tenant assert — fetch by PK only, compare `row.company_id` in service.

---

### `lib/repositories/jira-config.repo.ts` (repository, CRUD)

**Analog:** `companyJiraConfig` (lines 9–14) for company-scoped SELECT; current JQL/sync functions for cap/evict

**Company-scoped config read** (lines 9–14):

```typescript
export async function companyJiraConfig(companyId: number | null) {
  const db = await getDb();
  return db.get<JiraConfigRow>(
    'SELECT base_url_var, email_var, token_var FROM company_jira_config WHERE company_id = ?',
    companyId,
  );
}
```

**JQL preset list/create** — add `companyId` to WHERE and INSERT (current lines 31–52):

```typescript
export async function listJqlPresets(companyId: number, context: string) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM jira_jql_presets WHERE company_id = ? AND context = ? ORDER BY created_at DESC',
    companyId, context,
  );
}

export async function createJqlPreset(
  companyId: number, name: string, jql: string, context: string, maxPresets = 10,
) {
  const db = await getDb();
  const existing = await db.all<{ id: number }>(
    'SELECT id FROM jira_jql_presets WHERE company_id = ? AND context = ? ORDER BY created_at DESC',
    companyId, context,
  );
  if (existing.length >= maxPresets) {
    await db.run('DELETE FROM jira_jql_presets WHERE id = ? AND company_id = ?',
      existing[existing.length - 1].id, companyId);
  }
  return db.get(
    `INSERT INTO jira_jql_presets (name, jql, context, company_id) VALUES (?, ?, ?, ?) RETURNING *`,
    name, jql, context, companyId,
  );
}
```

**Sync mapping eviction — critical fix** (current global DELETE lines 65–71):

```typescript
export async function saveJiraSyncMapping(companyId: number, mappingsJson: string) {
  const db = await getDb();
  await db.run(
    'INSERT INTO jira_sync_mappings (mappings_json, company_id) VALUES (?, ?)',
    mappingsJson, companyId,
  );
  await db.run(
    `DELETE FROM jira_sync_mappings
     WHERE company_id = ?
       AND id NOT IN (
         SELECT id FROM jira_sync_mappings
         WHERE company_id = ?
         ORDER BY created_at DESC LIMIT 5
       )`,
    companyId, companyId,
  );
}

export async function listRecentJiraSyncMappings(companyId: number) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM jira_sync_mappings WHERE company_id = ? ORDER BY created_at DESC LIMIT 5',
    companyId,
  );
}
```

---

### `lib/services/import-mapping.service.ts` (service, request-response)

**Analog:** `lib/services/holidays.service.ts` (thin service + assert) + `assertProgramAccess` (company-row assert, not project)

**Imports pattern** (holidays.service.ts:1–8):

```typescript
import {
  createTimelineMapping as createTimelineMappingRepo,
  deleteTimelineMapping as deleteTimelineMappingRepo,
  getTimelineMappingById,
  listTimelineMappings as listTimelineMappingsRepo,
  updateTimelineMapping as updateTimelineMappingRepo,
  // ... bug mapping imports ...
} from '@/lib/repositories/import-mapping.repo';
import type { AccessActor } from './access';
import { ConflictError, ForbiddenError, NotFoundError } from './errors';
```

**Company-row assert** — mirror `assertProgramAccess` ordering (programs.service.ts:28–34): NotFound first, then Forbidden:

```typescript
type CompanyRow = { company_id: number };

function assertCompanyRow(actor: AccessActor, row: CompanyRow | undefined) {
  if (!row) throw new NotFoundError('Not found');
  if (actor.company_id === null || row.company_id !== actor.company_id) {
    throw new ForbiddenError();
  }
}

function requireCompanyId(actor: AccessActor): number {
  if (actor.company_id === null) throw new ForbiddenError();
  return actor.company_id;
}
```

**List handler** — no admin bypass (CONTEXT A2); mirror `listProjects` service wrapper (projects.service.ts:22–24) but strict company only:

```typescript
export async function listTimelineMappings(actor: AccessActor) {
  const companyId = requireCompanyId(actor);
  return listTimelineMappingsRepo(companyId);
}
```

**Create stamps session company** — mirror `createProject` non-admin path (projects.service.ts:37–39):

```typescript
export async function createTimelineMapping(
  actor: AccessActor, name: string, mappingsJson: string,
) {
  const companyId = requireCompanyId(actor);
  try {
    return await createTimelineMappingRepo(companyId, name, mappingsJson);
  } catch (e) {
    // Map PG 23505 → ConflictError if helper added; else pre-check duplicate name
    throw e;
  }
}
```

**By-id mutate** — mirror `updateProgram` (programs.service.ts:48–55):

```typescript
export async function updateTimelineMapping(
  id: number | string, actor: AccessActor, name: string, mappingsJson: string,
) {
  const row = await getTimelineMappingById(id);
  assertCompanyRow(actor, row);
  return updateTimelineMappingRepo(actor.company_id!, id, name, mappingsJson);
}
```

**ConflictError on duplicate** — mirror holidays pre-check (holidays.service.ts:23–25):

```typescript
if (await findTimelineMappingByName(actor.company_id!, name)) {
  throw new ConflictError('Template name already exists');
}
```

---

### `lib/services/jira-mapping.service.ts` (service, request-response)

**Analog:** Same as `import-mapping.service.ts`; wrap all four Jira repo functions

Copy the same `assertCompanyRow`, `requireCompanyId`, list/create/delete patterns. JQL presets pass `context` through unchanged. Sync mappings: list + POST only (no by-id route).

---

### Route files — six `withAuth` handlers (route, request-response)

**Analog (target shape):** Keep `withAuth` wrapper; swap repo imports for service calls. Error mapping already handled by `withAuth` catch → `serviceErrorResponse`.

**Current direct-repo pattern** (`app/api/import-mapping/route.ts:1–18`) — replace repo calls:

```typescript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { createTimelineMapping, listTimelineMappings } from '@/lib/repositories/import-mapping.repo';
import { createTimelineMappingSchema } from './schema';

export const GET = withAuth(async () => {
  return NextResponse.json(await listTimelineMappings());
});

export const POST = withAuth(async (_req, { body }) => {
  const parsed = createTimelineMappingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const { name, mappings_json } = parsed.data;
  const row = await createTimelineMapping(
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row, { status: 201 });
});
```

**Target thin route** — pass `actor` to service; keep Zod/400 shapes frozen:

```typescript
import { listTimelineMappings, createTimelineMapping } from '@/lib/services/import-mapping.service';

export const GET = withAuth(async (_req, { actor }) => {
  return NextResponse.json(await listTimelineMappings(actor));
});

export const POST = withAuth(async (_req, { actor, body }) => {
  const parsed = createTimelineMappingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const { name, mappings_json } = parsed.data;
  const row = await createTimelineMapping(
    actor,
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row, { status: 201 });
});
```

**By-id route** (`app/api/import-mapping/[id]/route.ts:5–17`) — same swap:

```typescript
export const DELETE = withAuth<{ id: string }>(async (_req, { actor, params }) => {
  await deleteTimelineMapping(params.id, actor);
  return NextResponse.json({ ok: true });
});

export const PUT = withAuth<{ id: string }>(async (_req, { actor, params, body }) => {
  const { name, mappings_json } = body as { name: string; mappings_json: string | Record<string, unknown> };
  const row = await updateTimelineMapping(
    params.id, actor, name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row);
});
```

**Bug cap/evict** — move from route (`bug-import-mapping/route.ts:17–22`) into service; route becomes thin POST only.

**JQL presets** — preserve `context` query param and `MAX_PRESETS = 10` (`jql-presets/route.ts:6–21`).

**Sync mappings** — preserve `{ ok: true }` POST shape (`sync-mappings/route.ts:14–21`).

Do **not** add `withProjectAccess` — mappings are company-global config, not project-scoped.

---

### `lib/services/import-mapping.service.unit.test.ts` (test)

**Analog:** `lib/services/holidays.service.unit.test.ts` + `lib/services/access.unit.test.ts`

**Service unit test scaffold** (holidays.service.unit.test.ts:1–31):

```typescript
const { assertCompanyRow helpers mocked via repo fns } = vi.hoisted(() => ({
  listTimelineMappingsRepo: vi.fn(),
  getTimelineMappingById: vi.fn(),
  // ...
}));

vi.mock('@/lib/repositories/import-mapping.repo', () => ({ /* ... */ }));

import { deleteTimelineMapping, listTimelineMappings } from './import-mapping.service';
import { ForbiddenError, NotFoundError } from './errors';

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };
```

**Cross-company ForbiddenError** (access.unit.test.ts:46–49):

```typescript
it('throws ForbiddenError for a cross-company actor (not NotFoundError)', async () => {
  getTimelineMappingById.mockResolvedValue({ id: 1, company_id: 5, name: 'x', mappings_json: '{}' });
  await expect(updateTimelineMapping(1, foreign, 'y', '{}')).rejects.toBeInstanceOf(ForbiddenError);
  await expect(updateTimelineMapping(1, foreign, 'y', '{}')).rejects.not.toBeInstanceOf(NotFoundError);
});
```

**Null company_id on create → ForbiddenError** — mirror `requireCompanyId` test.

**Repo not called when access denied** (holidays.service.unit.test.ts:37–40):

```typescript
it('deleteTimelineMapping does not call repo when access is denied', async () => {
  getTimelineMappingById.mockResolvedValue({ id: 1, company_id: 5 });
  await expect(deleteTimelineMapping(1, foreign)).rejects.toBeInstanceOf(ForbiddenError);
  expect(deleteTimelineMappingRepo).not.toHaveBeenCalled();
});
```

---

### Route tests — cross-company 403 (test)

**Analog:** `app/api/export/ppt/[id]/route.test.ts:83–91`

After routes call services, mock **service** module (not repo). Add 403 cases alongside existing 401 tests:

```typescript
const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

it('returns 403 for a cross-company mapping', async () => {
  vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
  updateTimelineMapping.mockRejectedValue(new ForbiddenError());

  const res = await PUT(req('PUT', undefined, { name: 'x', mappings_json: '{}' }), params());

  expect(res.status).toBe(403);
  await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
});
```

Update existing tests to mock `@/lib/services/import-mapping.service` instead of `@/lib/repositories/import-mapping.repo`. Preserve all Phase 6 401 shape tests unchanged.

**Sync mappings:** no by-id route — test GET list returns only session-company rows (integration or route mock asserting service called with `actor.company_id`).

---

### `lib/repositories/import-mapping.repo.unit.test.ts` (test)

**Analog:** `lib/repositories/tenant-scope.repo.unit.test.ts`

**SQL assertion pattern** (tenant-scope.repo.unit.test.ts:24–40):

```typescript
function normalizedSql(): string {
  return db.all.mock.calls[0][0].replace(/\s+/g, ' ').trim();
}

it('listTimelineMappings filters by company_id', async () => {
  await listTimelineMappings(5);
  expect(normalizedSql()).toContain('WHERE company_id = ?');
  expect(db.all).toHaveBeenCalledWith(expect.any(String), 5);
});
```

---

### `lib/repositories/import-mapping.repo.test.ts` + migration integration (test)

**Analog:** `lib/repositories/programs.repo.test.ts`

**Two-company fixture** (programs.repo.test.ts:9–30):

```typescript
describe.skipIf(!hasTestDb)('import-mapping.repo tenant scope', () => {
  let companyA: number;
  let companyB: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyA = await seedCompany('Mapping Scope A');
    companyB = await seedCompany('Mapping Scope B');
    // seed rows per company ...
  });

  it('same template name allowed across companies', async () => {
    await createTimelineMapping(companyA, 'Standard', '{}');
    await expect(createTimelineMapping(companyB, 'Standard', '{}')).resolves.toBeDefined();
  });

  it('duplicate name within company rejected', async () => {
    await createTimelineMapping(companyA, 'Dup', '{}');
    await expect(createTimelineMapping(companyA, 'Dup', '{}')).rejects.toThrow();
  });
});
```

**Migration backfill test** (`lib/db.mapping-tenant-migration.integration.test.ts`): seed global rows + two companies in test DB, run migration SQL subset, assert no NULL `company_id`, each company lists its copy, no all-rows-on-company-1 collapse.

---

### `test/repo-db.ts` (test config)

**Analog:** existing `DDL` constant (lines 75–120)

Add four mapping tables with `company_id INTEGER REFERENCES companies(id)` to `DDL` string. Mirror production column sets from `initPostgresSchema` (db.ts:239–244, 404–415, 479–480) plus `company_id NOT NULL` for post-migration integration tests.

---

## Shared Patterns

### Authentication gate (`withAuth`)

**Source:** `lib/http/with-auth.ts:86–140`
**Apply to:** All six mapping route files — keep unchanged

```typescript
export function withAuth<TParams, TBody>(handler: RouteHandler<TParams, TBody>, opts?: WrapperOptions<TBody>) {
  return async (req, rawCtx) => {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor: AccessActor = { company_id: user.company_id, is_admin: user.is_admin };
    // ...
    try {
      return await handler(req, { user, actor, params, body });
    } catch (e) {
      if (e instanceof UnknownColumnError) return repoErrorResponse(e);
      return serviceErrorResponse(e);
    }
  };
}
```

### Error → HTTP mapping

**Source:** `lib/api-errors.ts:41–56`
**Apply to:** All service-throwing routes (via `withAuth` catch)

```typescript
export function serviceErrorResponse(e: unknown) {
  if (e instanceof ForbiddenError) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (e instanceof NotFoundError) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (e instanceof ConflictError) {
    return NextResponse.json({ error: e.message }, { status: 409 });
  }
  // ...
}
```

### Typed service errors

**Source:** `lib/services/errors.ts:11–44`
**Apply to:** All new service files

```typescript
export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}
```

### Company-scoped list (strict — no admin bypass)

**Source:** `lib/repositories/portfolio.repo.ts:110–115`
**Apply to:** All four table list repo functions

```typescript
export async function listPortfolioMembers(companyId: number | null) {
  const db = await getDb();
  return db.all<PortfolioMember>(
    'SELECT * FROM portfolio_members WHERE company_id = ? ORDER BY member_type, name',
    companyId,
  );
}
```

Note: mapping lists require non-null `companyId` at service layer (403 if null). Do not use `listProjects` admin branch — CONTEXT locks session-company-only lists even for admins.

### Tenant assert ordering (403 vs 404)

**Source:** `lib/services/access.ts:35–42` + `lib/services/programs.service.ts:28–34`
**Apply to:** All by-id service methods

```typescript
const row = await projectAccessRow(projectId);
if (!row) throw new NotFoundError('Not found', 'project');

if (actor.company_id !== null) {
  const allowed =
    row.company_id === actor.company_id || row.customer_company_id === actor.company_id;
  if (!allowed) throw new ForbiddenError();
  return row;
}
```

For mapping rows (single `company_id` column), simplify to: missing row → `NotFoundError`; wrong tenant → `ForbiddenError`.

### Integration test harness

**Source:** `test/repo-db.ts:243–246` + `lib/repositories/programs.repo.test.ts:1–7`

```typescript
vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

export async function seedCompany(name = 'Test Company'): Promise<number> {
  const result = await testDb().run('INSERT INTO companies (name) VALUES (?)', name);
  return Number(result.lastInsertRowid);
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| PG `23505` → `ConflictError` mapper | utility | transform | No `isPgUniqueViolation` helper exists; use holidays-style pre-check or add small helper in `_helpers` |
| Multi-company CROSS JOIN backfill | migration | batch | No existing duplicate-per-tenant backfill in codebase; follow RESEARCH.md algorithm (Pitfall 7) |

---

## Metadata

**Analog search scope:** `lib/db.ts`, `lib/repositories/{import-mapping,jira-config,projects,portfolio,programs}.repo.ts`, `lib/services/{access,projects,programs,holidays}.service.ts`, `lib/http/with-auth.ts`, `lib/api-errors.ts`, `app/api/{import-mapping,bug-import-mapping,jira/**}/route.ts`, `app/api/export/ppt/[id]/route.test.ts`, `test/repo-db.ts`, `lib/repositories/{tenant-scope.repo.unit,programs.repo}.test.ts`
**Files scanned:** ~35
**Pattern extraction date:** 2026-08-25
