# Phase 5: Route Thinning & Validation - Research

**Researched:** 2026-08-11
**Domain:** Next.js App Router route boundary (shared auth/access wrapper + Zod request validation)
**Confidence:** HIGH

## Summary

Phase 5 deletes the 31-route `actorOf + getSessionFromRequest + 401 + try/catch + mapError` boilerplate by introducing `lib/http/` wrappers, and replaces inline body validation with Zod schemas. The locked scope is deliberately narrow: build the mechanism, prove it on the 18 files under `app/api/projects/[id]/**` (the 11 named resources plus nested sub-routes and `projects/[id]/route.ts` itself), and wire Zod into the ~16 non-converted routes that have inline validation today — all while preserving every frozen 400/403/404/500 body.

Three findings shape the plan:

1. **The wrapper's catch tail can be one unified shape.** All 18 in-scope routes either already use the dual mapper `UnknownColumnError → repoErrorResponse, else serviceErrorResponse` (8 routes) or throw `UnknownColumnError` never (the other 10), so one catch tail is behavior-preserving for the whole converted tree. No per-route error-mapper override is needed inside Phase 5 scope.

2. **`assertProjectAccess`'s return-row flip has a hidden contract cost.** Today the admin branch returns early with no DB query (T-04-03 "no ownership query"). Returning the row forces the admin branch to fetch `projectAccessRow` too. Wire behavior stays identical (nonexistent project still 404s with body `{ error: 'Not found' }` — `serviceErrorResponse` ignores the `resource` label), but two `access.unit.test.ts` assertions flip (`resolves.toBeUndefined()` and `projectAccessRow` not-called) and the T-04-03 order comment must be updated. The plan must call this out as an intentional, wire-identical contract change.

3. **Malformed-JSON 400 is the one sanctioned freeze exception.** Today a bad body in, e.g., risks POST reaches the catch as a thrown `req.json()` reject and maps to a generic 500. The wrapper turns that into `400 { error: 'Invalid JSON' }` — the same pattern already shipped on the 3 report routes (WR-05). It is a strictly-better behavior change that must be flagged in commit messages (HYG-02).

**Primary recommendation:** Build `lib/http/with-auth.ts` (one catch tail, `opts.schema` + `opts.badRequest` for freeze-preserving 400s), `withProjectAccess`/`withProgramAccess` as thin compositions over it, flip `assertProjectAccess` to return the row, then convert the 18 `projects/[id]/**` routes and wire schemas into the ~16 inline-validation routes. No new packages — `zod ^4.4.3` and the existing `lib/api-errors.ts` mappers are the entire stack.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Wrappers live in a new **`lib/http/`** directory. Files: `lib/http/with-auth.ts`, `lib/http/with-project-access.ts`, plus a shared `lib/http/actor.ts` or inline type if needed.
- **`withAuth(handler)`** where handler receives `(req: NextRequest, ctx)` and `ctx = { user: SessionUser, actor: AccessActor, params: any, body?: unknown }`. The wrapper absorbs: session resolution (`getSessionFromRequest` → 401 on missing), `actorOf`, `await params` (Next 16 async params), the try/catch → error-mapping tail. Handler body becomes one line.
- **Change `assertProjectAccess` to return the project row** instead of `void`. Mirrors `assertProgramAccess`. Callers ignore the return so nothing breaks.
- **Two wrappers, not a parameterized one**: `withProjectAccess` (project — company_id OR customer_company_id) and `withProgramAccess` (program/customer — one company_id column).
- Schemas live **adjacent to the route**: `app/api/<resource>/schema.ts`, mirroring the `lib/integrations/*/schemas.ts` idiom. No central `lib/schemas/` tree.
- **`safeParse`**, matching the existing idiom; zero `.parse()` calls. On failure, return the route's pre-existing 400 response shape — do not invent a new error body.
- **Core scope validation**: validate resources that HAVE inline validation today (roughly 30 schemas). Defer report/export/auth payload schemas to their owning phases.
- **No duplicate enum checks**: trust the service for CAPEX/OPEX already in `budget.service.ts:56`. Zod catches shape/required-field errors; services keep business-rule enums.
- **`proxy.ts` untouched.** ROUTE-11 stays open to Phase 6.
- **Frozen error strings preserved verbatim**: `'Name required'`, Vietnamese Jira strings, `MISSING_DATA`/`MISSING_FIELDS`, `Lỗi kết nối Jira: ...`, Jira "fields route" 503 variants.
- **Frozen behavior contracts**: T-04-25 (`UnknownColumnError` → 400 naming columns), `force500` split on the 3 report routes, `validation`-escapes-force500, Jira upstream-status passthrough, `integrationErrorResponse` NOT auto-added to non-integration routes.
- **Phase 5 rollout scope**: build the wrapper + convert the `app/api/projects/[id]/**` tree as ROUTE-03 names it (activities, risks, issues, meetings, escalations, team, documents, bugs, holidays, milestones, budget). Full 73-route rollout with shadow-mode is Phase 6.

### Claude's Discretion

All three grey areas accepted at the recommended answer; no open discretion items beyond ordinary implementation choices within these constraints.

### Deferred Ideas (OUT OF SCOPE)

- `proxy.ts` runtime confirmation (ROUTE-11) → Phase 6.
- Shadow-mode enforcement rollout (ROUTE-08) → Phase 6.
- Full 73-route rollout + 401/403 everywhere test matrix (ROUTE-09, ROUTE-10) → Phase 6.
- Import/export/config hard rollout (ROUTE-04) → Phase 6.
- Report/export/auth payload schemas → owning phases (report POST stays ad-hoc-cast by design).
- CAPEX/OPEX enum in Zod → not added (services own the business-rule enum).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTE-01 | `lib/http/with-auth.ts` resolves the session, returns 401 on missing/invalid session, passes authorized context into the handler | Proposed source in Architecture Patterns; verified `getSessionFromRequest` in `lib/auth.ts:47-51`; `SessionUser` shape at `lib/auth.ts:23-31` |
| ROUTE-02 | `withProjectAccess` loads the project, verifies company match, hands the authorized project to the handler | Composes `assertProjectAccess` (`lib/services/access.ts:22-41`), which the flip changes to return `ProjectAccessRow` (`lib/repositories/projects.repo.ts:30-33`); ctx gains `project` |
| ROUTE-05 | Route handler contains only parse, authorize, call service, respond — no SQL, no external call, no business logic | The 18 converted handlers become 1-line service calls; grep gate (no `getSessionFromRequest`/`actorOf`/`try/catch` in converted files) |
| ROUTE-06 | Every request body validated against an explicit Zod schema at the route boundary before reaching a service | `opts.schema` on the wrapper for tree A (18 routes); in-place `safeParse` swap for tree B (~16 routes); per-route `schema.ts` files; `zod ^4.4.3` verified |
| ROUTE-07 | Wrapper maps typed service errors to 403/404/400, generic message for unexpected errors instead of `String(e)` | Wrapper catch tail: `UnknownColumnError → repoErrorResponse`, else `serviceErrorResponse` (`lib/api-errors.ts:41-59`); generic `'Internal server error'` 500; kills the last `String(e)` in `app/api/resources/route.ts` |
| ROUTE-12 | No dynamic SQL column assignment built from request keys in `app/api/**` | Already true post-Phase 2 (repos own `buildUpdate` allowlists); converted handlers add no SQL — grep gate re-verifies |

</phase_requirements>

## Summary (continued)

**Verification trail (this session):** All scout facts re-verified against source. 85 `route.ts` files confirmed; 73 import `getSessionFromRequest`; 31 define `actorOf`; 8 of those 31 carry the `UnknownColumnError` dual-mapper (`projects/[id]/route.ts`, risks, activities, issues, meetings, escalations, team, `programs/route.ts`). Test baseline confirmed by running `npx vitest run`: **99 test files, 573 tests, 460 passed, 113 skipped** (the 113 include DB-gated suites that skip without `TEST_DATABASE_URL`). `zod@4.4.3` verified on npm registry, `[VERIFIED]` + package-legitimacy `OK`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session resolution → 401 | API (route wrapper) | — | Session already checked per-route; the wrapper centralizes the identical 401 tail. `proxy.ts` stays untouched (route-level enforcement confirmed sufficient). |
| Tenant-ownership assert | API (route wrapper) + Service | — | `assertProjectAccess`/`assertProgramAccess` stay in services (SVC-04 frozen); the wrapper invokes them before the handler, so a handler has no code path to project data without the assert running. Double-assert (wrapper + service) is intentional defense-in-depth this milestone. |
| Body validation | API (route boundary) | — | Zod `safeParse` at the wrapper (tree A) or in-place (tree B) — before any service call. Services keep business-rule enums (CAPEX/OPEX). |
| Error → HTTP mapping | API (wrapper catch) | — | `lib/api-errors.ts` owns the mapping; the wrapper calls it, never reimplements. |
| Business logic / SQL | Service / Repository | — | Already moved in Phases 2/4; wrapper deletion of route boilerplate cannot reintroduce it (grep gate). |
| HTTP response construction | API (handler) | — | Handlers keep status-code logic (201 vs 200, `{ ok: true }`, document `201:200` conditional). Wrapper normalizes only session/params/parse/catch. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.4.3 (installed; registry 4.4.3, published 2026-05-04) | Boundary request validation via `safeParse` | Already a dependency; codebase idiom is `safeParse` + adjacent `schemas.ts` (3 integration clients); zero `.parse()` calls; `[VERIFIED: npm registry]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | present (Phase 1) | Wrapper + converted-route tests | Every plan in the wave graph; `vi.hoisted` mock idiom already established |
| `lib/api-errors.ts` | — | `serviceErrorResponse` / `repoErrorResponse` | The wrapper's entire catch tail — never reimplement |
| `lib/auth.ts` | — | `getSessionFromRequest`, `SessionUser` | The wrapper's session resolution — never reimplement |
| `lib/services/access.ts` | — | `assertProjectAccess` (flipped to return row) | `withProjectAccess` composition |
| `lib/services/programs.service.ts` | — | `assertProgramAccess` (already returns row) | `withProgramAccess` composition |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Two wrappers (`withProjectAccess`/`withProgramAccess`) | One parameterized `withAccess(scope, idParam)` | Locked decision: the SQL and rules genuinely differ; config would hide that. Rejected in CONTEXT. |
| Central `lib/schemas/` tree | Adjacent `app/api/<resource>/schema.ts` | Locked decision: schema next to consumer matches integration idiom. |
| Wrapper reimplementing error mapping | Call `serviceErrorResponse` | `lib/api-errors.ts` is the frozen single home of HTTP-code mapping; wrapper must call it, not copy it. |
| Wrapper adding `integrationErrorResponse` | Leave it out | Locked: `integrationErrorResponse` is NOT auto-added; report routes keep their own catch with `force500`. Verified no in-scope service throws `IntegrationError`. |

**Installation:** No new packages. `zod ^4.4.3` already in `package.json`.

**Version verification:** `npm view zod version` → `4.4.3`; published 2026-05-04; package-legitimacy verdict `OK` (254M weekly downloads, github.com/colinhacks/zod, no postinstall). `[VERIFIED: npm registry]`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| zod | npm | ~4.5 yrs (4.4.3 published 2026-05-04) | 254M/wk | github.com/colinhacks/zod | OK | Approved (existing dependency, no new install) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Phase 5 installs no new packages. The only external runtime dependency touched is the already-installed `zod`. All other "dependencies" are existing in-repo modules.*

## Architecture Patterns

### System Architecture Diagram

```
Browser / client component
   │  fetch('/api/projects/[id]/risks', { body })
   ▼
proxy.ts (untouched; cookie-presence only, runtime unverified → ROUTE-11 Phase 6)
   │
   ▼
Route handler (wrapped) e.g. risks/route.ts
   │  export const GET = withProjectAccess(handler, { schema })
   ▼
lib/http/with-auth.ts                          lib/http/with-project-access.ts
   ├─ getSessionFromRequest(req) → 401        ├─ params = await params
   ├─ params = await params                   ├─ actor = { company_id, is_admin }
   ├─ actor = { company_id, is_admin }        └─ assertProjectAccess(params.id, actor) → project row
   ├─ opts.schema.safeParse(body) → 400            │  (ForbiddenError→403 / NotFoundError→404 via catch)
   └─ try { handler(req, ctx) }               ┌─────┘
        catch: UnknownColumnError→repoErrorResponse │
               else→serviceErrorResponse            ▼
                                         Handler: call service only
   │                                      e.g. listRisks(params.id, actor)
   ▼
lib/services/*.service.ts  →  assertProjectAccess (defense-in-depth)  →  lib/repositories/*.repo.ts
   │  throws ForbiddenError / NotFoundError / ValidationError / UnknownColumnError
   ▼
lib/api-errors.ts (serviceErrorResponse / repoErrorResponse)  →  NextResponse JSON
```

Trace of the primary use case (authenticated GET on a project sub-resource): session cookie → wrapper resolves user (401 if missing) → params awaited → access assert on `params.id` (403/404 if denied) → handler calls the service → service re-asserts (SVC-04) → repo reads scoped rows → response returned. Error at any layer flows to the single wrapper catch tail.

### Recommended Project Structure

```
lib/http/
├── with-auth.ts               # withAuth, AccessActor, HandlerContext, RouteHandler, WrapperOptions
├── with-project-access.ts     # withProjectAccess (composes withAuth + assertProjectAccess)
└── with-program-access.ts     # withProgramAccess (composes withAuth + assertProgramAccess)

app/api/projects/[id]/
├── route.ts                   # converted: GET/PATCH/DELETE via withProjectAccess
├── schema.ts                  # (new) per-resource Zod schema(s), adjacent to consumer
├── risks/
│   ├── route.ts               # converted reference (fullest pre-conversion shape)
│   └── schema.ts              # (new)
├── activities/ (+ activities/import/schema.ts)
├── issues/ (+ schema.ts)
├── meetings/ (+ schema.ts)
├── escalations/ (+ schema.ts)
├── team/ (+ schema.ts)
├── documents/ (+ schema.ts)
├── bugs/ (+ schema.ts)
├── holidays/ (+ schema.ts)
├── milestones/ (+ [milestoneId]/ + [milestoneId]/epics/, + schema.ts per dir as needed)
└── budget/ (+ [itemId]/ + [itemId]/expenses/ + [itemId]/expenses/[expId]/)
```

Tree B (non-converted routes with inline validation) keep their own `route.ts` + gain an adjacent `schema.ts`: `admin/companies`, `admin/users`, `admin/demo-requests`, `demo-requests`, `import-mapping` (route + `[id]`), `bug-import-mapping`, `jira/sync-mappings`, `jira/jql-presets`, `operations/systems` (+ `[id]`/`budget-items`/`incidents`), `portfolio/program-allocations`, `config`, `admin/rag-config`, `admin/jira-config`.

### Pattern 1: `withAuth` — the single wrapper that absorbs the 31-file boilerplate

**What:** Session resolution + `actorOf` + `await params` + `req.json()` parse + the error-mapping tail, in one place. The handler receives `(req, ctx)` with `ctx = { user, actor, params, body }`.
**When to use:** Every session-gated route in Phase 5 scope; Phase 6 rolls it to the remaining 55.
**Source:** Derived from the verified route shapes (`app/api/projects/[id]/risks/route.ts:9-66`, `app/api/portfolio/budgets/route.ts:6-28`) and `lib/api-errors.ts`. `[VERIFIED: app/api/projects/[id]/risks/route.ts:13-17]` — the `mapError` dual-mapper verbatim: `if (e instanceof UnknownColumnError) return repoErrorResponse(e); return serviceErrorResponse(e);`

```typescript
// lib/http/with-auth.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { getSessionFromRequest, type SessionUser } from '@/lib/auth';
import { repoErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { UnknownColumnError } from '@/lib/repositories/_helpers';

export type AccessActor = {
  company_id: number | null;
  is_admin: number | boolean;
};

export type HandlerContext<TParams extends Record<string, string> = Record<string, string>, TBody = unknown> = {
  user: SessionUser;
  actor: AccessActor;
  params: TParams;
  body: TBody;
};

export type RouteHandler<TParams extends Record<string, string> = Record<string, string>, TBody = unknown> = (
  req: NextRequest,
  ctx: HandlerContext<TParams, TBody>,
) => Promise<NextResponse>;

export type WrapperOptions<TBody = unknown> = {
  /** Zod schema validated at the boundary. On safeParse failure, returns the
   *  route's pre-existing 400 shape (behavior freeze) — either via `badRequest`
   *  or the first issue message. */
  schema?: z.ZodType<TBody>;
  badRequest?: (error: z.ZodError<TBody>) => NextResponse;
};

export function withAuth<TParams extends Record<string, string> = Record<string, string>>(
  handler: RouteHandler<TParams>,
  opts?: WrapperOptions,
) {
  return async (req: NextRequest, rawCtx: { params: Promise<TParams> }): Promise<NextResponse> => {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = await rawCtx.params;
    const actor: AccessActor = { company_id: user.company_id, is_admin: user.is_admin };

    let body: unknown;
    if (opts?.schema) {
      try {
        const raw = await req.json();
        const parsed = opts.schema.safeParse(raw);
        if (!parsed.success) {
          if (opts.badRequest) return opts.badRequest(parsed.error);
          return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
            { status: 400 },
          );
        }
        body = parsed.data;
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    }

    try {
      return await handler(req, { user, actor, params, body });
    } catch (e) {
      // T-04-25 freeze: a rejected column stays a 400 naming the column.
      // Routes that never throw UnknownColumnError pass straight to serviceErrorResponse.
      if (e instanceof UnknownColumnError) return repoErrorResponse(e);
      return serviceErrorResponse(e);
    }
  };
}
```

### Pattern 2: `withProjectAccess` / `withProgramAccess` — thin compositions over `withAuth`

**What:** The access wrappers add the ownership assert before the handler runs, and hand the already-authorized row to the handler. `assertProjectAccess` must be flipped to return `ProjectAccessRow` (`{ company_id, customer_company_id }`, `lib/repositories/projects.repo.ts:30-33`) — locked. `assertProgramAccess` already returns the row (`lib/services/programs.service.ts:21-40`).
**When to use:** All 18 `projects/[id]/**` conversions (project); `programs/[id]` and `programs/[id]/project-allocations` in Phase 6 (program).
**Notes:**
- The assert runs inside `withAuth`'s try, so `ForbiddenError`/`NotFoundError` map to 403/404 through `serviceErrorResponse` — the same wire behavior as today's service-level assert.
- `withProgramAccess` is built in the substrate per the locked decision, but has **zero Phase 5 consumers** (programs routes convert in Phase 6). It still ships with unit tests.

```typescript
// lib/http/with-project-access.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { assertProjectAccess } from '@/lib/services/access';
import type { ProjectAccessRow } from '@/lib/repositories/projects.repo';
import { withAuth, type AccessActor, type HandlerContext, type RouteHandler, type WrapperOptions } from './with-auth';

export function withProjectAccess<
  TParams extends { id: string } & Record<string, string> = { id: string },
  TBody = unknown,
>(
  handler: (req: NextRequest, ctx: HandlerContext<TParams, TBody> & { project: ProjectAccessRow }) => Promise<NextResponse>,
  opts?: WrapperOptions<TBody>,
) {
  return withAuth(
    async (req, ctx) => {
      const project = await assertProjectAccess(ctx.params.id, ctx.actor);
      return handler(req, { ...ctx, project });
    },
    opts,
  );
}
```

`with-program-access.ts` mirrors it, importing `assertProgramAccess` from `@/lib/services/programs.service` and typing the row as its return type.

### Pattern 3: The reference conversion — risks/route.ts before and after

**Before** (`app/api/projects/[id]/risks/route.ts` — 67 lines, verified this session):

```typescript
// lines 19-28 verbatim — the boilerplate GET repeats for POST/PUT/DELETE
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

**After** (handler = parse → authorize → call service → respond, no session/SQL/error code):

```typescript
// app/api/projects/[id]/risks/route.ts
import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { createRisk, deleteRisk, listRisks, updateRisk } from '@/lib/services/risks.service';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listRisks(params.id, actor)),
);

export const POST = withProjectAccess(async (_req, { params, actor, body }) =>
  NextResponse.json(await createRisk(params.id, actor, body), { status: 201 }),
);

export const PUT = withProjectAccess(async (_req, { params, actor, body }) => {
  const { id: rowId, ...fields } = body as Record<string, unknown>;
  return NextResponse.json(await updateRisk(params.id, actor, rowId, fields));
});

export const DELETE = withProjectAccess(async (req, { params, actor }) => {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deleteRisk(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
});
```

`POST`/`PUT` then get a `schema.ts`:
```typescript
// app/api/projects/[id]/risks/schema.ts
import { z } from 'zod';

// Loose shape guard: services own business rules (CAPEX/OPEX enums, required fields).
// `.passthrough()` preserves today's accept-anything body; only top-level shape is enforced.
export const riskInputSchema = z.object({}).passthrough();
export const riskUpdateSchema = z.object({}).passthrough();
```

### Tree B wiring — replace inline checks with `safeParse`, same 400 body

**What:** For the ~16 non-converted routes with inline validation, swap `const { x } = await req.json(); if (!x) return 400 '...'` for a `safeParse` against a per-route `schema.ts`, returning the *same* 400 body. The schema encodes the frozen message via Zod issue messages (`.min(1, 'Name required')`), and `.trim()`/`.refine` matches today's `.trim()` semantics exactly.
**When to use:** Every tree B route — these are NOT wrapper-converted in Phase 5 (they keep their existing session handling); only the validation mechanism changes.

```typescript
// app/api/demo-requests/schema.ts (frozen message + trim semantics)
import { z } from 'zod';

// Matches today's `if (!full_name?.trim() || !phone?.trim() || ...) 'All fields are required'`
export const demoRequestSchema = z.object({
  full_name: z.string().trim().min(1, 'All fields are required'),
  phone: z.string().trim().min(1, 'All fields are required'),
  email: z.string().trim().min(1, 'All fields are required'),
  company_name: z.string().trim().min(1, 'All fields are required'),
});
```

```typescript
// app/api/demo-requests/route.ts (POST handler after swap)
export async function POST(req: NextRequest) {
  const parsed = demoRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { full_name, phone, email, company_name } = parsed.data;
  const id = await createDemoRequest(full_name, phone, email, company_name);
  return NextResponse.json({ id }, { status: 201 });
}
```

**Coercion-match rule:** Tree B schemas must never tighten acceptance. Where today's route coerces (`Number(allocated_headcount)`, `String(mappings_json)` via JSON.stringify, `String(value)` in config), the schema must allow the same input or the coercion must run after `safeParse`. A `z.number()` where today a numeric string passes is a freeze break.

### Anti-Patterns to Avoid

- **Normalizing the `[]`-on-401 asymmetry.** `projects/route.ts` GET, `programs/route.ts` GET, `resources/route.ts` GET return `[]` on 401; all others return `{ error: 'Unauthorized' }`. None of the 18 in-scope routes use `[]`, so the wrapper's uniform 401 body is safe *in Phase 5*. Do NOT wrap those 3 collection routes without a client-side check (Phase 6 concern).
- **Tightening tree A schemas past today's acceptance.** A strict `z.object({ name: z.string().min(1) })` on risks/activities/meetings where today an empty body reaches the service and 400s only via `UnknownColumnError` (different message) is a freeze break. Tree A schemas are shape guards (`.passthrough()`), not business validators.
- **Wrapping the 3 report routes.** `projects/[id]/report`, `projects/[id]/project-report`, `portfolio/report` keep their own catch (`IntegrationError → integrationErrorResponse(e, { force500: true })`). The wrapper must not add `integrationErrorResponse`; report POST payload schemas are deferred.
- **Adding a second body parse.** `jira/search`, `export/ppt`, `export/weekly-report`, `import/resource-plan` all read `body` after their own parse; they are out of scope — leave untouched.
- **Moving the CAPEX/OPEX enum into Zod.** `budget.service.ts:56` already throws `ValidationError('Invalid type', 'type')` → 400. A Zod enum would be a second source of truth (locked: do not add).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error → HTTP status mapping | A new mapper in `lib/http/` | `serviceErrorResponse` / `repoErrorResponse` from `lib/api-errors.ts` | Locked: mapping lives ENTIRELY in `api-errors.ts`; reimplementing re-opens T-04-25 and the 403/404/400/409 split |
| Session resolution | Re-reading the cookie + sessions table | `getSessionFromRequest` from `lib/auth.ts` | Single source; expires-at + JOIN logic already centralized |
| Tenant-ownership check | A wrapper-local `projectAccessRow` query | `assertProjectAccess` / `assertProgramAccess` | SVC-04 contract; the return-row flip is the locked enabler |
| Body validation | Regex/manual destructure-if chains | `zod` `safeParse` | Already the codebase idiom; `zod ^4.4.3` installed |
| Response body construction | Hand-rolled `Response` | `NextResponse.json` | Next 16 route convention |

**Key insight:** Every component the wrapper needs already exists as a frozen, tested unit (`api-errors.ts`, `auth.ts`, `access.ts`, `zod`). The wrapper is *composition only* — no new logic to verify beyond the composition itself. That is what makes the 18-route conversion a mechanical delete-and-replace.

## Runtime State Inventory

> Phase 5 is a route-layer refactor that renames nothing (no string, key, table, or env var changes) and persists nothing new.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB keys, collection names, IDs, or user_ids reference wrapper/schema names | None |
| Live service config | None — no external service config embeds route-handler internals | None |
| OS-registered state | None — no Task Scheduler/pm2/systemd registrations reference these routes | None |
| Secrets/env vars | None — env var names unchanged (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, Jira `*_var` names) | None |
| Build artifacts | None — no package/binary rename; `output: 'standalone'` unaffected | None |

**Canonical question answered:** After every file in the repo is updated, no runtime system still holds an old string for this phase — the phase creates new modules and edits handler internals only. The one runtime-adjacent change is HTTP behavior (malformed JSON now 400 instead of 500 on converted routes), which is intentional and flagged as a HYG-02 behavior change.

## Common Pitfalls

### Pitfall 1: The `assertProjectAccess` return-flip breaks its own unit test
**What goes wrong:** `lib/services/access.unit.test.ts:22` asserts `assertProjectAccess(1, admin)).resolves.toBeUndefined()` and line 23 asserts `projectAccessRow).not.toHaveBeenCalled()`. The flip makes both false: the admin branch must now fetch to have a row to return.
**Why it happens:** Returning `Promise<ProjectAccessRow>` forces the admin early-return (`lib/services/access.ts:26`) to become a fetch-and-return, changing the T-04-03 "no ownership query" contract.
**How to avoid:** In the substrate plan, flip the implementation AND update the test to expect the row object and to expect `projectAccessRow` to be called. Verify wire behavior is identical: `serviceErrorResponse` for `NotFoundError` returns `{ error: 'Not found' }` regardless of `resource` (`lib/api-errors.ts:46-48`), so admin + nonexistent project 404s with the same body as today's service-path 404.
**Warning signs:** `access.unit.test.ts` failing on `toBeUndefined` after the flip; the mocked-service tests (`activities.service.unit.test.ts:52` `mockResolvedValue(undefined)`) still pass because services ignore the return — only `access.unit.test.ts` is affected.

### Pitfall 2: Wrapper-normalized 401 body colliding with `[]`-on-401 routes
**What goes wrong:** If someone extends the wrapper to `projects/route.ts` GET (or `programs/route.ts` GET, `resources/route.ts` GET) in this phase, the 401 body changes from `[]` to `{ error: 'Unauthorized' }`.
**Why it happens:** Those 3 collection GETs are the asymmetry the scout flagged. They are NOT in the Phase 5 conversion list (not under `projects/[id]/`).
**How to avoid:** Keep them unconverted; the wrapper's uniform `{ error: 'Unauthorized' }` 401 is correct for all 18 in-scope routes (verified — every in-scope 401 is identical). Document the asymmetry as a Phase 6 decision with a client-side check before normalizing.
**Warning signs:** A plan that lists `projects/route.ts` in a conversion task.

### Pitfall 3: Tree A schemas that reject bodies passing today
**What goes wrong:** A strict schema on `documents` PUT (which destructures `body.id/title/content` and tolerates missing fields, `app/api/projects/[id]/documents/route.ts:46-49`) or `bugs` POST (destructures `{ bugs, snapshot_date }` without checks) turns a today-passing body into a 400.
**Why it happens:** `z.object({ id: z.number() })` requires keys the service/repo currently accept as `undefined`.
**How to avoid:** Tree A schemas are `.passthrough()` shape guards (require an object, optionally type-check fields only when present with `.optional()`). Business rules stay in services. `safeParse` failure on tree A is then reachable only for non-object bodies — which today crash `req.json()` consumers or produce `UnknownColumnError` 400s.
**Warning signs:** A schema with `.min(1)` on a tree A field where the service has no corresponding `ValidationError`.

### Pitfall 4: Double body-parse on wrapped DELETE / query-param routes
**What goes wrong:** Risks/activities/meetings/team DELETE read `rowId` from search params, not body; documents DELETE reads `docId`; bugs DELETE reads `date`; holidays DELETE reads `hid`; epics DELETE reads `activity_id`. If the wrapper tried `req.json()` on every method, empty-body DELETEs would 400.
**Why it happens:** Bodyless handlers today never call `req.json()`.
**How to avoid:** The wrapper only parses when a schema is present or the method is POST/PUT/PATCH (per the proposed source). Handlers still read query params via `new URL(req.url)`.
**Warning signs:** `DELETE` with no schema returning `400 Invalid JSON`.

### Pitfall 5: Forgetting the WR-05 malformed-JSON 400 is a behavior change
**What goes wrong:** A reviewer sees the wrapper's `'Invalid JSON'` 400 and asks whether it breaks freeze.
**Why it happens:** Today a malformed JSON body in e.g. risks POST rejects inside the handler's `try` and maps through `serviceErrorResponse` to a generic 500.
**How to avoid:** It is an intentional, strictly-better behavior change already shipped on the 3 report routes (WR-05). Each converted-route commit that enables it must be called out as a HYG-02 behavior change. It is the *only* sanctioned freeze exception in Phase 5.
**Warning signs:** A plan that lists it as a "bug fix" without the HYG-02 tag.

## Code Examples

Verified patterns from official/existing sources:

### SafeParse idiom (existing, `[VERIFIED: lib/integrations/jira/schemas.ts:1]` + consumer routes)
```typescript
import { z } from 'zod';

const parsed = someSchema.safeParse(data);
if (!parsed.success) { /* handle parsed.error */ }
```
No `.parse()` anywhere in the codebase (grep-verified). Schema files export named `z.object` schemas.

### Route test idiom (existing, `[VERIFIED: app/api/projects/[id]/route.access.test.ts:4-64]`)
```typescript
const { projectAccessRow } = vi.hoisted(() => ({ projectAccessRow: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

// Construct NextRequest directly (TEST-03), mock session, assert status + body.
```

### `serviceErrorResponse` typed-error split (existing, `[VERIFIED: lib/api-errors.ts:41-59]`)
`ForbiddenError → 403 { error: 'Forbidden' }` (message never echoed); `NotFoundError → 404 { error: 'Not found' }`; `ValidationError → 400 { error: e.message, field? }`; `ConflictError → 409 { error: e.message }`; else logged + `500 { error: 'Internal server error' }` — never `String(e)`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-route `actorOf` + `getSessionFromRequest` + 401 + `try/catch` + `mapError` (31 files) | `lib/http/` wrappers with one catch tail | Phase 5 | Handler body collapses to one line; the 401/403/404/500 split has exactly one implementation |
| `assertProjectAccess(...): Promise<void>` | `assertProjectAccess(...): Promise<ProjectAccessRow>` | Phase 5 | `withProjectAccess` hands the authorized row to handlers without a second query |
| Inline `if (!name)` destructure chains | `schema.ts` + `safeParse` | Phase 5 (tree A/B) | Validation is explicit, typed, at the boundary; frozen 400 bodies preserved via schema messages |
| `String(e)` on `resources/route.ts:12` | wrapper/`serviceErrorResponse` generic 500 | Phase 5 | ROUTE-07; last `String(e)` in the tree dies when resources converts in Phase 6 |

**Deprecated/outdated:**
- `actorOf` file-local helper (31 copies): replaced by the wrapper's `AccessActor` derivation — deleted from converted files.
- File-local `mapError` dual-mapper (8 copies): replaced by the wrapper catch tail; the `UnknownColumnError` branch is preserved.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bug-import-mapping/[id]/route.ts` is public (no session) like `bug-import-mapping/route.ts` | Route→Wrapper Mapping | If it is session-gated, it joins tree B; verification: open the file (not read this session) |
| A2 | `jira/jql-presets/[id]/route.ts` is public like `jql-presets/route.ts` | Route→Wrapper Mapping | Same as A1; out of Phase 5 scope either way |
| A3 | No in-scope service (activities/risks/issues/meetings/escalations/team/documents/bugs/holidays/milestones/budget/budget-items/projects) can throw `IntegrationError` | Standard Stack | Verified by grep (zero `IntegrationError` throws in `lib/services/*.service.ts`), so the wrapper needs no integration branch in Phase 5; if one exists, the error maps to generic 500, which the 3 report routes (unconverted) already avoid |
| A4 | Client code (app/pages) does not branch on the `[]`-on-401 body specifically | Common Pitfalls | Out of scope this phase (those 3 routes unconverted); Phase 6 must check before normalizing |
| A5 | `resources/route.ts`'s `String(e)` 500 stays until Phase 6 | State of the Art | Phase 5 converts only `projects/[id]/**`; ROUTE-07's "generic message instead of String(e)" is proven on converted routes, not every route |

**All other claims in this research were verified this session against source files or the npm registry.**

## Open Questions

1. **Tree B's auth-payload schemas — deferred or in-scope?**
   - What we know: CONTEXT Specifics estimates schemas for `auth/login` and `auth/change-password`, but the Deferred section says "Report/export/auth payload schemas → owning phases."
   - What's unclear: Which wins for the 2 auth routes.
   - Recommendation: Follow Deferred (authoritative): defer `auth/login`, `auth/change-password`, `auth/complete-onboarding` payload schemas. The ~14 remaining tree B routes (admin ×3, demo-requests, import-mapping ×2 + bug + sync-mappings + jql-presets, operations ×4, program-allocations, config, rag/jira-config) stay in scope. Confirm with the user before planning if this reading is disputed.

2. **rag-config / jira-config POST coercion vs schema**
   - What we know: Both routes apply `Number()` defaults over a `Partial<RagConfig>` body (`app/api/admin/rag-config/[companyId]/route.ts:29-40`) or `?? ''` defaults (jira-config `:28-34`). They have no inline 400 checks today.
   - What's unclear: Whether a schema adds freeze risk by rejecting inputs the `Number()` coercion accepts (e.g., `"abc"`).
   - Recommendation: Use permissive schemas (`z.object({ spi_red_threshold: z.coerce.number().optional(), ... }).passthrough()`) that keep today's coercion; if coercion must stay exact, validate shape only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | runtime + tests | ✓ | local v25.x, Docker node:20-slim | — |
| npm | install (no new deps) | ✓ | — | — |
| zod ^4.4.3 | boundary validation | ✓ | 4.4.3 | — |
| vitest | tests | ✓ | Phase 1 harness | — |
| PostgreSQL + `DATABASE_URL` | DB-gated suites only (repo/service tests) | conditional | — | 113 tests skip without it; wrapper + route unit tests run without DB |

**Missing dependencies with no fallback:** none — Phase 5 requires no new tooling.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (Phase 1 harness; `vitest.config.ts` with `node` + `jsdom` projects) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run lib/http app/api/projects/\[id\]` |
| Full suite command | `npm test` (currently 99 files / 573 tests / 460 passed / 113 skipped — the 113 are DB-gated, skip without `TEST_DATABASE_URL`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-01 | `withAuth` returns 401 `{ error: 'Unauthorized' }` on null session; handler receives `ctx`; never leaks the error message | unit (mocked `@/lib/auth`) | `npx vitest run lib/http/with-auth.test.ts` | ❌ Wave 0 |
| ROUTE-01/02 | `withProjectAccess` maps 403 (cross-company) / 404 (missing project) and passes `project` row | unit (mocked `@/lib/services/access`) | `npx vitest run lib/http/with-project-access.test.ts` | ❌ Wave 0 |
| ROUTE-02 | `assertProjectAccess` returns the row; admin fetches + returns row | unit | `npx vitest run lib/services/access.unit.test.ts` | ✅ exists — 4 assertions MUST be updated (see Pitfall 1) |
| ROUTE-05 | Converted handler contains no `getSessionFromRequest`/`actorOf`/`try-catch` — grep gate | manual/grep | `grep -rE "getSessionFromRequest|actorOf|String\\(e\\)" app/api/projects/\[id\]` | n/a |
| ROUTE-05/06 | Converted route: 401 no session, 403 cross-company, 404 missing project, 400 schema failure, handler calls service only | route unit (mock repo at `projectAccessRow` + service repos, per existing idiom) | `npx vitest run app/api/projects/\[id\]/risks/route.test.ts` | ✅ exists — updated in place |
| ROUTE-06 | `safeParse` failure returns the route's frozen 400 body (tree B) | route unit | `npx vitest run app/api/demo-requests` | ❌ Wave 0 (tree B) |
| ROUTE-07 | `UnknownColumnError → 400 naming columns`; unexpected error → generic 500 (never `String(e)`) | unit + converted-route | `npx vitest run lib/http/with-auth.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run lib/http app/api/projects/\[id\] -t <changed-file>`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work` (HYG-03)

### Wave 0 Gaps
- [ ] `lib/http/with-auth.test.ts` — covers ROUTE-01, ROUTE-07 (401 body, UnknownColumnError→400, typed-error mapping, generic-500, malformed-JSON→400, schema-failure→frozen-400)
- [ ] `lib/http/with-project-access.test.ts` — covers ROUTE-02 (403/404 mapping, project row in ctx)
- [ ] `lib/http/with-program-access.test.ts` — covers the Phase 6 wrapper now (build-time test)
- [ ] `lib/services/access.unit.test.ts` — update 4 assertions for the return-row flip (Pitfall 1)
- [ ] Converted-route tests updated in place (`route.test.ts` per resource) — assert handler never calls `getSessionFromRequest` (mock it and expect `not.toHaveBeenCalled()`), plus the 401/403/404/400 matrix
- [ ] `schema.ts`-driven frozen-400 tests for tree B routes

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Cookie session (`pm_session`) already centralized in `lib/auth.ts`; wrapper reuses it |
| V3 Session Management | no (unchanged) | Session expiry re-checked per request via `getSessionFromRequest` — preserved |
| V4 Access Control | yes | `withProjectAccess`/`withProgramAccess` invoke the SVC-04 asserts before the handler; a handler has no code path to project data without the assert running |
| V5 Input Validation | yes | `zod` `safeParse` at the route boundary (tree A via wrapper, tree B in-place); services keep business-rule enums |
| V6 Cryptography | no | No crypto touched; password hashing stays in `lib/auth.ts` |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR via tampered `project_id` param | Information Disclosure / Tampering | `withProjectAccess` asserts ownership before handler; service re-asserts (SVC-04) — double defense |
| Mass assignment / dynamic SQL columns from body keys | Tampering | ROUTE-12 grep gate; repos' `buildUpdate` allowlists (`lib/repositories/_helpers.ts:32-48`) — wrapper adds no SQL |
| Error message leakage (`String(e)`) | Information Disclosure | Wrapper catch → `serviceErrorResponse`; unexpected errors surface as generic `'Internal server error'` |
| Body injection / type confusion | Tampering | `zod` boundary validation; `safeParse` rejects non-conforming shapes before services consume them |

## Sources

### Primary (HIGH confidence)
- In-repo source files read this session: `app/api/projects/[id]/risks/route.ts`, `route.ts`, `activities/route.ts`, `activities/import/route.ts`, `issues/route.ts`, `meetings/route.ts`, `escalations/route.ts`, `team/route.ts`, `documents/route.ts`, `bugs/route.ts`, `holidays/route.ts`, `milestones/route.ts`, `milestones/[milestoneId]/route.ts`, `milestones/[milestoneId]/epics/route.ts`, `budget/route.ts`, `budget/[itemId]/route.ts`, `budget/[itemId]/expenses/route.ts`, `budget/[itemId]/expenses/[expId]/route.ts`, `projects/route.ts`, `programs/route.ts`, `programs/[id]/route.ts`, `programs/[id]/project-allocations/route.ts`, `portfolio/route.ts`, `portfolio/budgets/route.ts`, `portfolio/budgets/[id]/route.ts`, `portfolio/budgets/[id]/allocations/route.ts`, `portfolio/budgets/[id]/allocations/[allocId]/route.ts`, `portfolio/members/route.ts`, `portfolio/members/[id]/route.ts`, `portfolio/program-allocations/route.ts`, `portfolio/program-allocations/[id]/route.ts`, `portfolio/quota/route.ts`, `portfolio/milestones/route.ts`, `portfolio/bug-assignees/route.ts`, `portfolio/roadmap/epics/route.ts`, `portfolio/report/route.ts`, `projects/[id]/report/route.ts`, `projects/[id]/project-report/route.ts`, `projects/[id]/project-report/generate-email/route.ts`, `resources/route.ts`, `admin/companies/route.ts`, `admin/users/route.ts`, `admin/demo-requests/route.ts`, `admin/rag-config/[companyId]/route.ts`, `admin/jira-config/[companyId]/route.ts`, `auth/login/route.ts`, `auth/logout/route.ts`, `auth/me/route.ts`, `auth/change-password/route.ts`, `config/route.ts`, `demo-requests/route.ts`, `import-mapping/route.ts`, `import-mapping/[id]/route.ts`, `bug-import-mapping/route.ts`, `jira/sync-mappings/route.ts`, `jira/jql-presets/route.ts`, `jira/fields/route.ts`, `jira/search/route.ts`, `jira/test/route.ts`, `operations/systems/route.ts`, `operations/systems/[id]/route.ts`, `operations/systems/[id]/budget-items/route.ts`, `operations/systems/[id]/incidents/route.ts`, `export/word/[id]/[type]/route.ts`, `parse-file-headers/route.ts`
- `lib/auth.ts`, `lib/api-errors.ts`, `lib/services/access.ts`, `lib/services/errors.ts`, `lib/services/programs.service.ts`, `lib/services/risks.service.ts`, `lib/services/budget.service.ts`, `lib/services/activities.service.ts`, `lib/services/projects.service.ts`, `lib/repositories/projects.repo.ts`, `lib/repositories/_helpers.ts`, `lib/integrations/jira/schemas.ts`, `vitest.config.ts`, `package.json`
- Test files: `app/api/projects/[id]/route.access.test.ts`, `app/api/projects/[id]/activities/route.test.ts`, `lib/services/access.unit.test.ts`
- Registry: `npm view zod` (version 4.4.3, published 2026-05-04); package-legitimacy verdict `OK`
- Live run: `npx vitest run` → 99 files / 573 tests / 460 passed / 113 skipped

### Secondary (MEDIUM confidence)
- None — all load-bearing claims verified against in-repo source this session.

### Tertiary (LOW confidence)
- Assumptions A1–A5 (files/routes not read this session) — listed in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; `zod` verified on registry and by legitimacy gate; every wrapper dependency is an existing, in-repo, tested module.
- Architecture: HIGH — wrapper design derived from 30+ verified route files; the 18-route conversion list is exact; catch-tail normalization proven behavior-preserving by source inspection.
- Pitfalls: HIGH for the load-bearing ones (assertProjectAccess flip, `[]`-on-401, tree A schema strictness, double body-parse, WR-05); MEDIUM for tree B coercion edge cases (A3–A5).

**Research date:** 2026-08-11
**Valid until:** 2026-09-11 (Next.js 16 / zod 4 / React 19 stack is stable; wrapper design is codebase-internal and phase-scoped)
