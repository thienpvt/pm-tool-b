# Phase 4: Service Layer - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 8 new/modified file groups
**Analogs found:** 7 / 8 (1 is a greenfield-mapper analog — `serviceErrorResponse` — mapping only the sibling mappers in `lib/api-errors.ts`, which exist)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/services/errors.ts` | utility (typed errors) | error model | `lib/repositories/_helpers.ts:10-18` (`UnknownColumnError`); structure from `lib/integrations/errors.ts:8-29` (`IntegrationError`) | exact (shape) |
| `lib/services/*.service.ts` | service | CRUD / request-response | `lib/repositories/*.repo.ts` (`risks.repo.ts` representative) + `lib/integrations/anthropic/client.ts` (normalized throws) | role-match (layer sibling) |
| `lib/services/access.ts` (or `assertProjectAccess` inside errors/service) | middleware-like helper | request-response | `app/api/projects/[id]/route.ts:8-18` (`checkAccess`) + `app/api/projects/[id]/budget/route.ts:14-22` (`checkBudgetAccess`) | exact (replaces both) |
| `serviceErrorResponse(e)` in `lib/api-errors.ts` | utility (error mapper) | request-response | `repoErrorResponse` + `integrationErrorResponse` in `lib/api-errors.ts:15-108` | exact (same-file sibling) |
| `lib/services/*.service.unit.test.ts` | test | CRUD / request-response | `lib/repositories/auth.repo.unit.test.ts:1-21` (`vi.hoisted` + `vi.mock`) | exact |
| `lib/services/*.service.repo.test.ts` (SVC-05 gated) | test | CRUD | `lib/repositories/projects.repo.test.ts:1-26` (`describe.skipIf(!hasTestDb)`) | exact |
| `lib/export/{excel,ppt,word}.ts` (modified) | service | file-I/O | themselves (already service-shaped) + `app/api/export/excel/[id]/route.ts` (SVC-06 leak) | role-match |

## Pattern Assignments

### `lib/services/errors.ts` (utility, typed error model)

**Analog:** `lib/repositories/_helpers.ts:10-18` (`UnknownColumnError`) — the codebase's only bare-`Error`-subclass shape that carries a structured payload and **no HTTP status**. Exactly the SVC-03 contract.

**Imports pattern** (`lib/repositories/_helpers.ts:1`):
```typescript
// none — the error class is self-contained, no imports
```

**Core error shape** (`lib/repositories/_helpers.ts:10-18`) — copy this, rename, drop `columns` for `ValidationError` payloads:
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

**What to copy:** `extends Error`, `this.name = '...'`, `readonly` payload field(s) set in constructor, no `status` field, no `next/server` import.

**What to change:**
- Three classes: `ForbiddenError`, `NotFoundError`, `ValidationError`.
- `ForbiddenError` / `NotFoundError` are plain sentinels — the SVC-04 assert needs no payload beyond the message.
- `ValidationError` may carry a structured payload like `UnknownColumnError` (e.g. `columns` or `field`), since SVC-03 keeps `ValidationError` distinct from `UnknownColumnError` (CONTEXT: "ValidationError = a business-rule violation").

**Secondary structural analog — `lib/integrations/errors.ts:8-29` (`IntegrationError`):**
```typescript
export class IntegrationError extends Error {
  readonly kind: IntegrationErrorKind;
  readonly service: string;
  /** Upstream HTTP status when kind === 'upstream' | 'auth'. */
  readonly status?: number;          // ← SVC-03 FORBIDS this field
  readonly cause?: unknown;

  constructor(opts: { kind: IntegrationErrorKind; service: string; status?: number; cause?: unknown; message?: string }) {
    super(opts.message ?? `IntegrationError[${opts.service}:${opts.kind}]`);
    this.name = 'IntegrationError';
    this.kind = opts.kind;
    this.service = opts.service;
    this.status = opts.status;       // ← SVC-03 FORBIDS this assignment
    this.cause = opts.cause;
  }
}
```

**What to imitate:** the constructor-options-object style and the doc comment conventions (line 3-7 explain the class contract before the class). **What to omit:** the `status?: number` field entirely (lines 12, 19, 26) — CONTEXT explicitly states `IntegrationError` is NOT a suitable base because it carries HTTP status (SVC-03).

---

### `lib/services/*.service.ts` (service, CRUD/request-response)

**Analog:** `lib/repositories/risks.repo.ts` — the layer sibling with the exact module shape services should mirror (plain args, plain returns, `@/lib/db` + `./_helpers` imports only). The `lib/integrations/*/client.ts` files show the "normalized throws" half.

**Imports pattern** (`lib/repositories/risks.repo.ts:1-2`):
```typescript
import { getDb } from '@/lib/db';
import { buildUpdate } from './_helpers';
```

Services analog: import repos via `@/lib/repositories/*.repo`, import `assertProjectAccess` + errors via `./errors` or `./access` (relative, matching the `./_helpers` convention).

**Module shape / export style / comment density** (`lib/repositories/risks.repo.ts:8-22`):
```typescript
export const RISK_COLUMNS = [
  'risk_id', 'description', 'category', 'owner', 'trigger', 'mitigation', 'due_date',
  'status', 'priority', 'impact', 'affected_activity_id',
] as const;

export async function listRisks(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM risks WHERE project_id = ? ORDER BY id', projectId);
}
```

**What to copy:** named exports only (`export async function`, `export const`), plain args already-resolved scoping params (the Phase 2 contract — `projectId`, `companyId`, `isAdmin`, NOT sessions), light JSDoc only where behavior is non-obvious, no barrel imports.

**What to change:** services take **plain args and throw typed errors** — they do NOT call `getDb()` directly (they call repositories); they call `assertProjectAccess(projectId, user)` at the top of every project-scoped operation (SVC-04).

**Normalized-throws half** (`lib/integrations/anthropic/client.ts:60-70`, `mapAnthropicError`):
```typescript
function mapAnthropicError(e: unknown): IntegrationError {
  if (e instanceof APIConnectionTimeoutError) {
    return new IntegrationError({ kind: 'timeout', service: 'anthropic', cause: e });
  }
  if (e instanceof AuthenticationError) {
    return new IntegrationError({ kind: 'auth', service: 'anthropic', cause: e });
  }
  if (e instanceof APIError) {
    return new IntegrationError({ kind: 'upstream', service: 'anthropic', status: e.status, cause: e });
  }
  return new IntegrationError({ kind: 'network', service: 'anthropic', cause: e });
}
```

**What to copy:** the "throw typed error classes, never raw `Error`" discipline, and the module-level private helper + `@throws` JSDoc convention.

**Critical freeze constraint:** services must **re-throw `IntegrationError` untouched** when wrapping integration calls — never catch-and-rewrap (CONTEXT specifics line 94). The route catches both error families.

---

### `assertProjectAccess(projectId, user)` (ownership primitive)

**Analog:** the two existing file-private helpers it replaces. They **diverge on cross-company denials** — the planner must see both, because SVC-04 unifies on 403 (HYG-02 behavior change).

**Reference implementation (correct 3-way distinction)** — `app/api/projects/[id]/route.ts:8-18`:
```typescript
async function checkAccess(req: NextRequest, projectId: string) {
  const user = await getSessionFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  if (user.is_admin) return { error: null, user };

  const project = await projectAccessRow(projectId);
  if (!project) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), user: null };
  const allowed = project.company_id === user.company_id || project.customer_company_id === user.company_id;
  if (!allowed) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null };
  return { error: null, user };
}
```

**Buggy/divergent version (collapses cross-company to 401)** — `app/api/projects/[id]/budget/route.ts:14-22`:
```typescript
async function checkBudgetAccess(req: NextRequest, projectId: string) {
  const user = await getSessionFromRequest(req);
  if (!user) return null;
  if (user.is_admin) return user;
  const project = await projectAccessRow(projectId);
  if (!project) return null;
  if (project.company_id !== user.company_id && project.customer_company_id !== user.company_id) return null;
  return user;
}
```
and its caller collapses all three failures to 401 (`route.ts:27`): `if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`

**The exact divergence:** `checkAccess` distinguishes 401 (no session) / 404 (no project) / 403 (wrong company); `checkBudgetAccess` flattens all three to 401 via `return null`. CONTEXT locks the fix: missing session → 401, project not found → 404, wrong company → **403** (the milestone permits new 403s; HYG-02).

**The ownership primitive it wraps** — `lib/repositories/projects.repo.ts:30-44`:
```typescript
export type ProjectAccessRow = {
  company_id: number | null;
  customer_company_id: number | null;
};

/** Tenancy columns for an access check. Returns undefined when the project does not exist. */
export async function projectAccessRow(projectId: number | string) {
  const db = await getDb();
  return db.get<ProjectAccessRow>(
    `SELECT p.company_id, c.company_id AS customer_company_id
     FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
     WHERE p.id = ?`,
    Number(projectId)
  );
}
```

**What to copy for `assertProjectAccess(projectId, user)`:** the 3-way decision tree from `checkAccess` (401 not in scope — services take an already-authenticated `user`; the service assert throws `ForbiddenError` for missing/not-found/wrong-company since the route session gate handles 401), the dual-ownership comparison `project.company_id === user.company_id || project.customer_company_id === user.company_id`, the `is_admin` bypass preserved as-is, and the `projectAccessRow`/`ProjectAccessRow` pairing.

**What to change:** no `NextResponse` — throw `NotFoundError` (project row undefined) and `ForbiddenError` (wrong company). The `is_admin` short-circuit stays. Used by every project-scoped service method (SVC-04) instead of the route-local helpers.

---

### `serviceErrorResponse(e)` in `lib/api-errors.ts` (error mapper, third sibling)

**Analog:** the two mappers already in the same file. Same signature shape, same "mappers live outside the throwing layer" rationale.

**`repoErrorResponse`** (`lib/api-errors.ts:15-21`):
```typescript
export function repoErrorResponse(e: unknown) {
  if (e instanceof UnknownColumnError) {
    return NextResponse.json({ error: e.message, columns: e.columns }, { status: 400 });
  }
  console.error('Unexpected repository error', e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

**`integrationErrorResponse`** (`lib/api-errors.ts:31-40`, the entry pattern):
```typescript
export function integrationErrorResponse(e: unknown, opts?: { force500?: boolean }) {
  if (!(e instanceof IntegrationError)) {
    console.error('Unexpected integration error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  // ... per-kind mapping to 502/500/upstream status
}
```

**The documented rationale for mappers living outside the throwing layer** (`lib/api-errors.ts:12-13`):
```typescript
 * This lives outside `lib/repositories/` on purpose — repository modules must not import
 * `next/server` (REPO-06).
```

**What to copy for `serviceErrorResponse(e)`:** the `(e: unknown)` → `NextResponse` signature; the `instanceof` discrimination first, then `console.error` + generic 500 fallback; placement in `lib/api-errors.ts` so services never touch `next/server`.

**What to change:** map `ForbiddenError` → 403, `NotFoundError` → 404, `ValidationError` → 400, everything else → `console.error` + 500. Note the file already imports `IntegrationError` and `UnknownColumnError` across layer boundaries by design (lines 2-3) — services' `ForbiddenError`/`NotFoundError`/`ValidationError` get the same treatment.

---

### `lib/services/*.service.unit.test.ts` (test, mocked, always runs)

**Analog:** `lib/repositories/auth.repo.unit.test.ts:1-21` — the canonical `vi.hoisted` + `vi.mock` idiom, no DI:
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import { findUserByUsername, setUserPasswordHash, userPasswordHash } from './auth.repo';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth.repo', () => {
  it('loads the login row by username', async () => {
    db.get.mockResolvedValue({ id: 4, username: 'ava' });
    await expect(findUserByUsername('ava')).resolves.toMatchObject({ id: 4, username: 'ava' });
    expect(db.get).toHaveBeenCalledWith('SELECT * FROM users WHERE username = ?', 'ava');
  });
```

**What to copy:** `vi.hoisted` hoists the mock object before `vi.mock('@/lib/db', ...)`; `beforeEach(() => vi.clearAllMocks())`; `expect(...).toHaveBeenCalledWith(...)` asserts SQL fidelity.

**What to change for services:** mock the **repositories**, not `@/lib/db` — CONTEXT says `vi.mock('@/lib/repositories/projects.repo', ...)`. For `assertProjectAccess` tests, mock `@/lib/repositories/projects.repo`'s `projectAccessRow` to return cross-company rows and assert `ForbiddenError` / `NotFoundError` throws.

**Real-DB gated tier (SVC-05 cross-company fixture)** — `lib/repositories/projects.repo.test.ts:1-26`:
```typescript
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', async () => {
  const { testDb: db } = await import('../../test/repo-db');
  return { getDb: async () => db() };
});

const { PROJECT_COLUMNS, deleteProject, getProject, projectAccessRow, updateProject } =
  await import('./projects.repo');
const { UnknownColumnError } = await import('./_helpers');

describe.skipIf(!hasTestDb)('projects.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('Projects Repo', { company_id: 3 });
  });
```

**Cross-company fixture for SVC-05** — `test/repo-db.ts:243-261`:
```typescript
export async function seedCompany(name = 'Test Company'): Promise<number> {
  const result = await testDb().run('INSERT INTO companies (name) VALUES (?)', name);
  return Number(result.lastInsertRowid);
}

/** Insert a project and return its id, giving the calling suite a private scope. */
export async function seedProject(name = 'Test Project', extra: Record<string, unknown> = {}): Promise<number> {
  // Merge rather than concat: a caller passing `status` must override the default,
  // not produce `column "status" specified more than once`.
  const row: Record<string, unknown> = { name, status: 'Active', ...extra };
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await testPool().query(
    `INSERT INTO projects (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    vals,
  );
  return rows[0].id as number;
}
```

**What to copy:** `describe.skipIf(!hasTestDb)` gating (guarded by `test/db.ts:6` `hasTestDb = Boolean(TEST_DATABASE_URL)`), `setupRepoTables()` + `seedProject` in `beforeAll`, `closeTestPool()` in `afterAll`, and the `vi.mock('@/lib/db')` → `testDb` adapter so repos never call `getDb()` (avoids `initPostgresSchema`/`seedAuthData`, `test/repo-db.ts:8-13`).

**What to change for SVC-05:** seed two companies + a project in company A, then assert a service call scoped to company B throws `ForbiddenError`. `seedCompany` + `seedProject(name, { company_id })` already accept the company — no new harness (CONTEXT line 50).

---

### `lib/export/{excel,ppt,word}.ts` (modified — SVC-06 `companyId` param)

These are **already service-shaped** (CONTEXT line 83): plain args in, `Buffer` out, import repositories, never touch `next/server`. The entire SVC-06 delta is threading a `companyId` param and asserting access. No test files exist in `lib/export/` — the plan must add first coverage here.

**Current signatures + first lines (where the assert goes):**

`lib/export/excel.ts:103-105`:
```typescript
export async function generateProjectPlan(projectId: number): Promise<Buffer> {
  const project = await getProject(projectId) as Record<string, string> | undefined;
  if (!project) throw new Error('Project not found');
```

`lib/export/ppt.ts:87-97`:
```typescript
export async function generateKickoffPPT(
  projectId: number,
  extras: {
    presentation_date?: string;
    methodology?: string;
    next_steps?: string;
    agenda?: string;
  } = {}
): Promise<Buffer> {
  const project = await getProject(projectId) as Record<string, string> | undefined;
  if (!project) throw new Error('Project not found');
```

`lib/export/word.ts:74-76`:
```typescript
export async function generateWordDoc(projectId: number, docType: string, docId?: number): Promise<Buffer> {
  const project = await getProject(projectId) as Record<string, string>;
```

**What to copy:** signature shape, `Promise<Buffer>` return, the `getProject(...) as Record<...>` pattern.

**What to change:**
- Add `companyId: number | null` (and `isAdmin: boolean` if the bypass must work) as the first param after `projectId` — matching the repo convention of taking already-resolved scoping params.
- The untyped `throw new Error('Project not found')` at `excel.ts:105` and `ppt.ts:97` becomes `throw new NotFoundError(...)` (CONTEXT line 83 explicitly calls out `ppt.ts:96` → `NotFoundError`).
- The `if (!project)` check in each function is where `assertProjectAccess(projectId, user)` semantics land — either call the service assert first or convert the `!project` branch to `NotFoundError` and add the `ForbiddenError` branch via the ownership row. The 5 leaky export/import routes (`export/excel/[id]`, `export/ppt/[id]`, `export/word/[id]/[type]`, `export/weekly-report/[id]`, `export/resource-plan/[id]`, `import/resource-plan/[id]`) get fixed here in this phase (SVC-06), not deferred.

---

## Shared Patterns

### Ownership Assert (SVC-04)
**Source:** `app/api/projects/[id]/route.ts:8-18` (`checkAccess` 3-way tree) + `lib/repositories/projects.repo.ts:30-44` (`projectAccessRow`)
**Apply to:** Every project-scoped and company-scoped service method.
```typescript
const project = await projectAccessRow(projectId);
if (!project) throw new NotFoundError(`Project ${projectId} not found`);
const allowed = project.company_id === user.company_id || project.customer_company_id === user.company_id;
if (!allowed) throw new ForbiddenError(`No access to project ${projectId}`);
// is_admin bypass preserved as-is: if (user.is_admin) return ... at top
```

### Typed Error Mapping
**Source:** `lib/api-errors.ts:15-21` (`repoErrorResponse`) and `31-40` (`integrationErrorResponse` entry pattern)
**Apply to:** All service callers in route handlers.
```typescript
export function serviceErrorResponse(e: unknown) {
  if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
  if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
  if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
  console.error('Unexpected service error', e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

### IntegrationError passthrough (Phase 3 freeze)
**Apply to:** Any service wrapping an Anthropic/Jira/Resend client call. `IntegrationError` escaping a service is re-thrown untouched — never caught-and-rewrapped (CONTEXT specifics line 94). Route catches both families.

### Layer discipline
**Source:** `lib/api-errors.ts:12-13` (REPO-06 rationale), `lib/integrations/credentials.ts:4-5`
**Apply to:** `lib/services/` must not import `next/server`; services import `@/lib/db`-only collaborators (repos), relative `./errors` / `./access`, and use the `@/` alias for app-root imports.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/services/errors.ts` (exact class list) | utility | error model | No three-class typed-error module exists; assembled from `UnknownColumnError` shape + `IntegrationError` structure (minus `status`) |
| `lib/services/access.ts` (assert location) | helper | request-response | `assertProjectAccess` is net-new; assembled from `checkAccess`/`checkBudgetAccess` divergence + `projectAccessRow` |

## Metadata

**Analog search scope:** `lib/repositories/`, `lib/integrations/`, `lib/export/`, `app/api/`, `test/`
**Files scanned:** ~15
**Pattern extraction date:** 2026-08-10
