# Phase 5: Route Thinning & Validation - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 7 new files / 0 modified
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/http/with-auth.ts` | wrapper (HOF) | request-response | `app/api/projects/[id]/risks/route.ts` `mapError` + `lib/api-errors.ts` `serviceErrorResponse` | structural (no HOF exists) |
| `lib/http/with-project-access.ts` | wrapper (HOF) | request-response | git-history `checkAccess` in `app/api/projects/[id]/route.ts` + `lib/services/access.ts` `assertProjectAccess` | structural |
| `lib/http/with-program-access.ts` | wrapper (HOF) | request-response | `lib/services/programs.service.ts:21` `assertProgramAccess` | structural |
| `app/api/<resource>/schema.ts` (x~30) | schema/validation | transform | `lib/integrations/jira/schemas.ts`, `lib/integrations/resend/client.ts:59` | exact (idiom match) |
| wrapped-route target (converted `app/api/projects/[id]/**`) | controller | request-response | `app/api/projects/[id]/risks/route.ts` (current before-shape) | exact |
| wrapper unit tests | test | request-response | `lib/services/risks.service.unit.test.ts` + `lib/api-errors.test.ts` | exact |
| `actorOf` helper (absorbed into wrapper) | utility | transform | duplicated byte-identically in 31 route files | exact |

**Confirmed by grep (2026-08-11):**
- `function actorOf(` → **31 files**, identical body `return { company_id: user.company_id, is_admin: user.is_admin };` in **31/31**.
- `getSessionFromRequest(req)` → **134 occurrences across 73 files** (85 total route.ts per scout).
- The `actorOf + getSessionFromRequest + try/catch + mapError` shape is byte-identical in all 31 — `app/api/projects/[id]/risks/route.ts` (fullest, with `UnknownColumnError` dual-mapper) and `app/api/portfolio/budgets/route.ts` (simplest, no repo-error branch) are the two poles.

---

## Pattern Assignments

### `lib/http/with-auth.ts` (wrapper/HOF, request-response)

**Analog:** `mapError` local helper in `app/api/projects/[id]/risks/route.ts` lines 13-17 + `serviceErrorResponse` in `lib/api-errors.ts` lines 41-59.

**Why:** No existing HOF in the codebase — `withAuth` is greenfield. Its entire value is absorbing (a) the session resolution + `actorOf` + `await params` prologue and (b) the try/catch error-mapping tail that every one of the 31 identical routes carries. Those two pieces are the exact code to harvest.

**The tail the wrapper absorbs** (`app/api/projects/[id]/risks/route.ts:13-17`):
```typescript
function mapError(e: unknown) {
  // Rejected column must stay a 400 naming the column, not a generic 500.
  if (e instanceof UnknownColumnError) return repoErrorResponse(e);
  return serviceErrorResponse(e);
}
```

**The error mapper the wrapper calls, not reimplements** (`lib/api-errors.ts:41-59`):
```typescript
export function serviceErrorResponse(e: unknown) {
  if (e instanceof ForbiddenError) {
    // Never echo the message — it could name a resource the caller cannot see.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (e instanceof NotFoundError) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (e instanceof ValidationError) {
    const body: { error: string; field?: string } = { error: e.message };
    if (e.field !== undefined) body.field = e.field;
    return NextResponse.json(body, { status: 400 });
  }
  if (e instanceof ConflictError) {
    return NextResponse.json({ error: e.message }, { status: 409 });
  }
  console.error('Unexpected service error', e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

**Copy:** the `instanceof UnknownColumnError` first-check ordering (T-04-25 contract — a rejected column must stay a 400 naming the column, never the generic 403/500); the `serviceErrorResponse` call as the fallthrough. The wrapper's catch must preserve the dual-mapper ordering for the ~12 allowlist-gated write routes.

**Change:** the prologue the wrapper adds. The route currently does (risks `GET`, lines 19-28):
```typescript
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await listRisks(id, actorOf(user)));
  } catch (e) {
    return mapError(e);
  }
}
```
This whole block becomes one wrapped call; `ctx.user` replaces the `user` local, `ctx.actor` replaces `actorOf(user)`, `ctx.params.id` replaces `await params`. The wrapper owns the `getSessionFromRequest` → 401 return.

**Do not change:** the 401 body `{ error: 'Unauthorized' }` status 401, the 201 status on POST/PUT create, `{ ok: true }` for DELETE. `integrationErrorResponse` is NOT added here (report routes call it in their own catch — wrapper must not auto-add it, per CONTEXT line 47).

---

### `lib/http/with-project-access.ts` (wrapper/HOF, request-response)

**Analog:** the deleted inline `checkAccess` from `app/api/projects/[id]/route.ts` (commit `66de1b4~1`, before Phase 4-05 deleted it) + `assertProjectAccess` in `lib/services/access.ts` + `assertProgramAccess` in `lib/services/programs.service.ts:21` (the return-the-row idiom the flip mirrors).

**Why:** `withProjectAccess` re-houses the exact ownership semantics that inline `checkAccess` had before Phase 4-05 routed projects through `projects.service`. `assertProjectAccess` already encodes those same rules (admin bypass → NotFound → company_id OR customer_company_id → null-company CR-01); the wrapper just calls it and hands the row to the handler.

**The semantics being re-housed** (original inline checkAccess, `git show 66de1b4~1:"app/api/projects/[id]/route.ts"`):
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

**The current signature to flip** (`lib/services/access.ts:22-25`):
```typescript
export async function assertProjectAccess(
  projectId: number | string,
  actor: AccessActor,
): Promise<void> {
```
Flipped to `Promise<ProjectAccessRow>` (or the project row) — one-line change. The `projectAccessRow` it calls already returns the tenancy row (`lib/repositories/projects.repo.ts:36-44`):
```typescript
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

**The return-the-row idiom to mirror** (`lib/services/programs.service.ts:21-40`):
```typescript
export async function assertProgramAccess(programId: number | string, actor: AccessActor) {
  if (actor.is_admin) {
    const row = await getProgramRepo(programId);
    if (!row) throw new NotFoundError('Not found', 'program');
    return row;
  }

  const row = await getProgramRepo(programId);
  if (!row) throw new NotFoundError('Not found', 'program');

  const companyId = (row as { company_id: number | null }).company_id;
  if (actor.company_id !== null) {
    if (companyId !== actor.company_id) throw new ForbiddenError();
    return row;
  }

  // Null-company actor: only fully unassigned programs.
  if (companyId === null) return row;
  throw new ForbiddenError();
}
```

**Copy:** the ownership decision order from `assertProjectAccess` (admin bypass, NotFound, company_id OR customer_company_id, null-company only when both columns null); the return-row tail from `assertProgramAccess`. Note `assertProgramAccess`'s admin branch does NOT skip the existence query (it returns the row either way) — that is the exact shape the flipped `assertProjectAccess` needs.

**Change:** nothing about the rules — only that the wrapper hands the resolved row to the handler in `ctx` so project routes needing the row (e.g. `projects/[id]/route.ts` GET) don't re-fetch. `AccessActor = { company_id: number | null; is_admin: number | boolean }` (`lib/services/access.ts:5-8`) is the actor type the wrapper's `ctx.actor` carries.

---

### `lib/http/with-program-access.ts` (wrapper/HOF, request-response)

**Analog:** `assertProgramAccess` in `lib/services/programs.service.ts:21-40` (excerpted above).

**Why:** Program/customer scope has ONE company_id column on the `customers` table — the SQL and rules genuinely differ from project scope (CONTEXT line 34), so this is a separate wrapper, not a parameterized one. `assertProgramAccess` already returns the row, so this wrapper needs no access.ts flip — it just calls and hands the row to the handler.

**Copy:** the full function body above. The wrapper pattern mirrors `withProjectAccess` exactly; only the assert function and the id-param name differ.

**Change:** nothing — `assertProgramAccess` already returns the row. This wrapper is `withProjectAccess` with `assertProgramAccess` substituted.

---

### `app/api/<resource>/schema.ts` (schema/validation, transform)

**Analog:** `lib/integrations/jira/schemas.ts` (richest: nullable, optional, `.or()`, `.array`), `lib/integrations/resend/client.ts:59` (inline `z.object().passthrough().safeParse`), `app/api/admin/companies/route.ts:26` (the pre-existing 400 body shape to return on failure).

**Why:** CONTEXT line 37 requires schemas live adjacent to the route, mirroring the `lib/integrations/*/schemas.ts` idiom (schema next to consumer). All 3 integration clients use `safeParse`; zero `.parse()` calls in the codebase — Phase 5 must match.

**The schema idiom** (`lib/integrations/jira/schemas.ts:1-42`, excerpt):
```typescript
import { z } from 'zod';

const jiraUser = z.object({ displayName: z.string() }).nullable();
const jiraOption = z.object({ name: z.string() }).nullable();

const jiraIssueSchema = z.object({
  key: z.string(),
  id: z.union([z.string(), z.number()]),
  fields: z.object({
    summary: z.string(),
    issuetype: z.object({ name: z.string() }),
    status: z.object({ name: z.string() }),
    assignee: jiraUser,
    reporter: jiraUser,
    priority: jiraOption,
    labels: z.array(z.string()),
    components: z.array(z.object({ name: z.string() })),
    parent: z.object({ key: z.string() }).optional(),
    customfield_10014: z.string().nullable().optional(),            // Epic Link (classic)
    customfield_10015: z.string().nullable().optional(), // Start date (Jira Cloud)
    customfield_10016: z.number().nullable().optional(),            // Story Points
    customfield_10020: z.array(z.object({ name: z.string(), state: z.string() })).or(z.string()).nullable().optional(), // Sprint
    resolution: z.object({ name: z.string() }).nullable().optional(),
    created: z.string(),
    duedate: z.string().nullable().optional(),
  }).passthrough(),
}).passthrough();
```

**The safeParse call pattern** (`lib/integrations/resend/client.ts:59-63`):
```typescript
const parsed = z.object({ id: z.string() }).passthrough().safeParse(data);
if (!parsed.success) {
  throw new IntegrationError({ kind: 'validation', service: 'resend', cause: parsed.error });
}
return parsed.data.id;
```

**The 400 body shape to return on failure** (`app/api/admin/companies/route.ts:25-26`):
```typescript
const { name } = await req.json();
if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
```
Also `app/api/programs/[id]/project-allocations/route.ts:48`:
```typescript
if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });
```

**Copy:** the `import { z } from 'zod'` + `z.object(...)` + `.safeParse(data)` + `if (!parsed.success)` branch idiom; the nullable/optional/.or()/.array shaping from jira/schemas.ts. The 400 failure body must reuse the route's pre-existing shape (`{ error: '<frozen string>', status: 400 }`) — do not invent a new error body (CONTEXT line 39).

**Change:** the route-facing schemas validate request bodies (not upstream responses), so `.passthrough()` is generally NOT wanted — Phase 5 schemas are strict where the route reads fields, unlike the integration schemas which must pass through. No CAPEX/OPEX enum (service owns it, CONTEXT line 41); report/export/auth payloads deferred to owning phases.

---

### Wrapped-route example (conversion target)

**Analog (before):** `app/api/projects/[id]/risks/route.ts` — full current source, the fullest of the 31 identical-shape routes.

**Full current source** (`app/api/projects/[id]/risks/route.ts:1-67`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { createRisk, deleteRisk, listRisks, updateRisk } from '@/lib/services/risks.service';

type Params = { params: Promise<{ id: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

function mapError(e: unknown) {
  // Rejected column must stay a 400 naming the column, not a generic 500.
  if (e instanceof UnknownColumnError) return repoErrorResponse(e);
  return serviceErrorResponse(e);
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await listRisks(id, actorOf(user)));
  } catch (e) {
    return mapError(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    return NextResponse.json(await createRisk(id, actorOf(user), body), { status: 201 });
  } catch (e) {
    return mapError(e);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { id: rowId, ...fields } = body;
    return NextResponse.json(await updateRisk(id, actorOf(user), rowId, fields));
  } catch (e) {
    return mapError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  try {
    await deleteRisk(id, actorOf(user), searchParams.get('rowId') ?? '');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mapError(e);
  }
}
```

**After-shape (target, what every project-scoped route converts to):**
```typescript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { createRisk, deleteRisk, listRisks, updateRisk } from '@/lib/services/risks.service';

export const GET = withAuth(withProjectAccess(async (req, ctx) => {
  return NextResponse.json(await listRisks(ctx.project.id, ctx.actor));
}));

export const POST = withAuth(withProjectAccess(async (req, ctx) => {
  return NextResponse.json(await createRisk(ctx.project.id, ctx.actor, ctx.body), { status: 201 });
}));
// PUT/DELETE analogous — no getSessionFromRequest, no actorOf, no try/catch, no mapError.
```
Contract per CONTEXT line 32: handler receives `(req: NextRequest, ctx)` with `ctx = { user, actor, params, body? }`; `withProjectAccess` additionally supplies the authorized project row. The DELETE query-param extraction (`searchParams.get('rowId')`) stays handler-side — the wrapper absorbs session/auth/try-catch only.

---

### Wrapper unit tests

**Analog:** `lib/services/risks.service.unit.test.ts:1-25` (vi.hoisted + vi.mock idiom) + `lib/api-errors.test.ts` (mapper tests).

**Why:** The wrapper has two testable seams — the session/mapError prologue (assert 401 on no session, assert error mapping) and the ownership handoff (assert `withProjectAccess` passes the row through). Both analogs are already in-repo.

**The mock setup idiom to copy** (`lib/services/risks.service.unit.test.ts:1-25`):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { assertProjectAccess, listRisksRepo, createRiskRepo, updateRiskRepo, deleteRiskRepo } = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  listRisksRepo: vi.fn(),
  createRiskRepo: vi.fn(),
  updateRiskRepo: vi.fn(),
  deleteRiskRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/risks.repo', () => ({
  listRisks: listRisksRepo,
  createRisk: createRiskRepo,
  updateRisk: updateRiskRepo,
  deleteRisk: deleteRiskRepo,
}));

import { createRisk, deleteRisk, listRisks, updateRisk } from './risks.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };
```

**The mapper-test shape to copy** (`lib/api-errors.test.ts:47-72`):
```typescript
describe('serviceErrorResponse', () => {
  it('maps ForbiddenError to 403 without leaking the message', async () => {
    const res = serviceErrorResponse(new ForbiddenError('you cannot see project 42'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(JSON.stringify(body)).not.toContain('project 42');
    expect(JSON.stringify(body)).not.toContain('you cannot see');
  });

  it('maps NotFoundError to 404', async () => {
    const res = serviceErrorResponse(new NotFoundError('missing', 'project'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'Not found' });
  });
  // ... ValidationError → 400 with optional field, unknown → 500 without String(e)
});
```

**Copy:** `vi.hoisted` + `vi.mock('@/lib/services/access', () => ({ assertProjectAccess }))` to stub the assert; the owner/foreign actor fixture shape; the assert-driven tests ("asserts access before calling", "does not call the repository when access is denied", "propagates ForbiddenError for a cross-company actor"). The wrapper tests add: (a) no session → 401 with `{ error: 'Unauthorized' }`; (b) `UnknownColumnError` → 400 naming columns, never 500/403; (c) `assertProjectAccess` mocked to resolve a row → handler receives the row in ctx; (d) `assertProjectAccess` mocked to reject ForbiddenError → 403 body `{ error: 'Forbidden' }`, message never leaked.

**Change:** note `risks.service.unit.test.ts:24` currently stubs `assertProjectAccess.mockResolvedValue(undefined)` — after the Phase-5 flip, it resolves a row, so the service tests update `mockResolvedValue(undefined)` → `mockResolvedValue({ company_id: 5, customer_company_id: null })` or similar.

---

### `actorOf` helper (absorbed into `withAuth`)

**Analog:** duplicated in 31 route files, byte-identical body.

**Excerpt** (`app/api/projects/[id]/risks/route.ts:9-11`):
```typescript
function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}
```

**Confirmed byte-identical across** (grep, 2026-08-11) — all 31 have exactly `return { company_id: user.company_id, is_admin: user.is_admin };`:
- `app/api/projects/[id]/route.ts:9-11`, `.../risks/route.ts:9-11`, `.../issues/route.ts`, `.../meetings/route.ts`, `.../escalations/route.ts`, `.../team/route.ts`, `.../documents/route.ts`, `.../bugs/route.ts`, `.../holidays/route.ts`, `.../milestones/**`, `.../activities/**`, `.../budget/**`
- `app/api/portfolio/budgets/**`, `.../portfolio/members/**`, `.../portfolio/program-allocations/**`, `.../portfolio/quota/route.ts`
- `app/api/programs/[id]/route.ts`, `.../programs/[id]/project-allocations/route.ts`

**Change:** delete from all 31; `withAuth` computes `actorOf` once from the resolved session and sets `ctx.actor`. The parameter type is exactly `AccessActor`'s shape — the wrapper can type `ctx.actor` as `AccessActor` from `@/lib/services/access` and drop the local `{ company_id: number | null; is_admin: number }` annotations.

---

## Shared Patterns

### Session + actor prologue
**Source:** every one of the 31 identical routes (`app/api/projects/[id]/risks/route.ts:19-22`)
**Apply to:** `lib/http/with-auth.ts` (absorbed), then all wrapped routes
```typescript
const { id } = await params;
const user = await getSessionFromRequest(req);
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

### Error mapping tail
**Source:** `lib/api-errors.ts:41-59` (`serviceErrorResponse`), `repoErrorResponse` lines 21-27, and the local `mapError` dual-mapper ordering
**Apply to:** `lib/http/with-auth.ts` catch; all wrapped routes
```typescript
function mapError(e: unknown) {
  if (e instanceof UnknownColumnError) return repoErrorResponse(e); // T-04-25: 400 naming columns
  return serviceErrorResponse(e);
}
```
The wrapper calls these — never reimplements the status mapping.

### Zod validation
**Source:** `lib/integrations/resend/client.ts:59-63`, `lib/integrations/jira/schemas.ts`
**Apply to:** all `app/api/<resource>/schema.ts` files and their route consumers
```typescript
const parsed = schema.safeParse(body);
if (!parsed.success) return NextResponse.json({ error: '<route-specific frozen string>' }, { status: 400 });
```

### Ownership assert
**Source:** `lib/services/access.ts:22-41` (project), `lib/services/programs.service.ts:21-40` (program — already returns row)
**Apply to:** `withProjectAccess`, `withProgramAccess`, and every project/program-scoped wrapped route

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/http/with-auth.ts` | HOF | request-response | No HOF exists anywhere in the codebase — greenfield. Closest structural analogs are the `mapError` helper tail and `serviceErrorResponse` mapper it absorbs. Pattern shape (typed `(req, ctx) => Promise<NextResponse>` handler) comes from CONTEXT line 32, not an existing file. |

## Metadata

**Analog search scope:** `app/api/**` (routes), `lib/api-errors.ts`, `lib/services/` (access.ts, programs.service.ts), `lib/repositories/projects.repo.ts`, `lib/integrations/*/schemas.ts`, `lib/integrations/resend/client.ts`, unit tests (`*.test.ts`), git history (`git show 66de1b4~1` for the deleted `checkAccess`)
**Files scanned:** ~25 (route analogs, error mappers, services, schemas, tests, git history)
**Pattern extraction date:** 2026-08-11

**Grep evidence:**
- `function actorOf(` → 31 files; identical body → 31/31
- `getSessionFromRequest(req)` → 134 occurrences in 73 files
- 31 routes share the identical `actorOf + getSessionFromRequest + try/catch + mapError` shape; `risks/route.ts` is the fullest (dual-mapper), `portfolio/budgets/route.ts` the simplest (serviceErrorResponse only, no `await params`)
