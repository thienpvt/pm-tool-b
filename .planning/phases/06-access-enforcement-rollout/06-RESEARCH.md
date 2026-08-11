# Phase 6: Access Enforcement Rollout - Research

**Researched:** 2026-08-11
**Domain:** Route-level access enforcement (401/403), shadow-mode rollout, test matrix
**Confidence:** HIGH

## Summary

Phase 6 closes the last genuinely-live IDORs in the codebase (8 multi-tenant routes with no session check, including anonymous bare-id DELETEs), converts the ROUTE-03/04 residue routes (3 projects/[id] report routes + export/import/config/parse neighbors) onto the Phase 5 wrappers, and proves it with a table-driven 401/403 test matrix plus a proxy.ts runtime finding. The critical architectural facts: `withAuth` unconditionally `req.json()`s POST/PUT/PATCH (blocking the 3 formData routes until `opts.rawBody` lands), the 8 IDOR tables have NO `company_id` column (so 401 is the ceiling for this milestone), and proxy.ts is compiled but never dispatched (empty `sortedMiddleware` in the standalone manifest) so route-level enforcement is the only enforcement line.

**Primary recommendation:** Ship the substrate FIRST (Q1 shadow flag inside the two wrappers + `opts.rawBody` in withAuth), then gate the 8 live IDORs (shadow-first), then convert the 3+3+8 residue routes (enforcing immediately), then land the one table-driven 401 spec + 403 additions for the 3 report routes, then record the proxy finding. Env-var gate must be read per-request, not at module load, so a deploy can toggle shadow mode without a rebuild.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session gate (401) | API tier — `withAuth` / `getSessionFromRequest` | — | Session cookie → DB row; the wrapper owns the 401 wire shape |
| Project ownership assert (403/404) | API tier — `withProjectAccess` | Service tier — `assertProjectAccess` | Wrapper composes the service assert; the assert returns the row (Phase 5 flip) |
| Program/customer ownership assert | API tier — `withProgramAccess` | Service tier — `assertProgramAccess` | Same shape as project; one company_id column |
| Tenant isolation (no IDOR) | Database / Storage — `company_id` columns | API tier — 401 gate | 8 IDOR tables have NO company_id column → this milestone's ceiling is 401; scoping is v2 |
| Shadow-mode log | API tier — wrapper catch + console.error | — | Railway surfaces deploy logs; no log-sink to build |
| Pre-route redirect gate | Proxy tier — `proxy.ts` | — | Dead (never dispatched); must NOT be relied on for any Phase 6 denial |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | installed (vitest.config.ts) | Route unit tests | Existing node/jsdom project split; baseline 592/479/0/113 |
| `next/server` NextRequest | Next.js 16.2.4 | Minimal request construction in tests | Already the template in `projects/[id]/risks/route.test.ts` |
| `vi.hoisted` + `vi.mock` | vitest | Module mocks for `@/lib/auth`, repos, `@/lib/db` | Proves 401 fires BEFORE the repo/service is touched; no DB needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/auth` getSessionFromRequest | in-repo | Mocked to null for 401 assertions | Every 401 case in the table |
| `@/lib/services/access` assertProjectAccess / assertProgramAccess | in-repo | Throws ForbiddenError/NotFoundError — the shadow catch target | Shadow unit tests spy the console.error |
| `lib/api-errors.ts` serviceErrorResponse | in-repo | The existing structured console.error shape to mirror | Shadow log line format |
| `@/lib/repositories/_helpers` UnknownColumnError | in-repo | 400-on-unknown-column tail (T-04-25) | Only where a route hits the wrapper catch tail |

No new external packages. No package legitimacy concerns — this phase installs nothing.

## Architecture Patterns

### System Architecture Diagram

```
                     HTTP request
                         │
                         ▼
              ┌───────────────────────┐
              │   proxy.ts (DEAD —    │  compiled to middleware.js but never
              │  never dispatched)    │  dispatched (empty sortedMiddleware).
              └───────────────────────┘  NOT an enforcement line.
                         │
                         ▼
              ┌───────────────────────┐
              │  withAuth (Q1/Q2)     │──401──> { error:'Unauthorized' }   (null session)
              │  · session resolve    │──400──> { error:'Invalid JSON' }   (malformed body)
              │  · actorOf            │──500──> serviceErrorResponse(e)    (catch tail)
              │  · params await       │
              │  · req.json()         │  opts.rawBody:true → skips parse (formData routes)
              │  · shadow catch (NEW) │──flag shadow → console.error + ALLOW (re-throw off)
              └──────────┬────────────┘
                         │ ctx.user / ctx.actor / ctx.params / ctx.body
              ┌──────────▼────────────┐
              │ withProjectAccess /   │──403/404──> from assertProjectAccess /
              │ withProgramAccess     │             assertProgramAccess (ForbiddenError/
              └──────────┬────────────┘             NotFoundError) via withAuth catch
                         │ ctx.project / ctx.program (the authorized row)
              ┌──────────▼────────────┐
              │  Route handler        │
              │  (GET/POST/PUT/DELETE)│
              └──────────┬────────────┘
                         │ service layer
              ┌──────────▼────────────┐
              │  repos / db (mocked   │  unit tests mock @/lib/auth + repos;
              │  in tests; live PG)   │  no DB in default tier
              └───────────────────────┘
```

### Pattern 1: Shadow-mode flag inside the wrapper (Q1)

**What:** ~6 lines in `withAuth` (the single shared path both `withProjectAccess` and `withProgramAccess` compose through) that, when `process.env.ACCESS_ENFORCEMENT === 'shadow'`, catch `ForbiddenError`/`NotFoundError` from the assert, emit a structured console.error line, and allow the request through — instead of re-throwing to the 403/404 tail.

**Why it belongs in `withAuth`, not the two access wrappers:** both access wrappers delegate the assert call into `withAuth`'s try/catch (verified in `with-project-access.ts:26-30` and `with-program-access.ts:29-34`). The 401/500 tails and the shadow catch live in ONE place — no doubled sync surface. Placing the catch there means the shadow flag is a *call-site opt* by construction: only the routes whose handlers are wrapped in the access wrappers AND that the operator chooses to gate under shadow run through the catch. The 18 already-enforcing routes are ALSO wrapped — so shadow cannot be purely "route type"; it must be per-deploy selection.

**(a) Exact code change** — inside `withAuth`'s catch tail (after the UnknownColumnError check, before `serviceErrorResponse`):

```typescript
} catch (e) {
  if (e instanceof UnknownColumnError) return repoErrorResponse(e);
  if (process.env.ACCESS_ENFORCEMENT === 'shadow' && (e instanceof ForbiddenError || e instanceof NotFoundError)) {
    console.error(
      `[shadow-access] path=${req.url} method=${req.method} user=${user.id} company=${user.company_id} target=${params.id} kind=${e instanceof ForbiddenError ? 'forbidden' : 'not-found'}`,
    );
    // shadow mode: log the would-be denial, allow the request through.
    // Re-throw when flag is off (enforce) — handled by the next line.
    return handler(req, { user, actor, params, body: body as TBody });
  }
  return serviceErrorResponse(e);
}
```

Note: `req` and `user` are in scope at the catch site (withAuth already resolved `user` before the try). `params.id` is the target id for the access wrappers; for plain withAuth there is no target — use `req.nextUrl.pathname` as `target`.

**(b) Scope to Phase 6's NEW-denial routes, not the 18 already-enforcing:** this is an *operator decision at deploy time*, recorded as a task, not a code toggle. Concretely:
- The 8 IDOR routes get wrapped in `withAuth`/`withProjectAccess` — they are NEW denials → gate them under shadow by setting `ACCESS_ENFORCEMENT=shadow` at deploy, review logs, flip to enforce next cycle.
- The 3 report routes + 8 export/import/config/parse conversions are wrapper *refactors* that preserve existing 401/403s (Phase 4/5 sanctioned behavior) → ship enforcing, never shadowed.
- The 18 already-wrapped routes are untouched. They are NOT shadowable by any env flip because their denials are already live (CONTEXT: shadow applied ONLY to Phase 6 NEW-denial routes).
- **Ponytail-lazy resolution:** a single global env flag is the only mechanism — it is scoped by *deployment sequence* (shadow deploy covers the 8 first, enforce deploy flips all), not by per-route code. Do NOT build per-call-site opt plumbing; the operator flipping the env var is the scope mechanism. `ponytail:` the residual "shadow covers the 18 too on a misconfigured deploy" as an operator-check on the log review, add per-route granularity if a deploy ever needs it.

**(c) Structured log line format:** single-line JSON-flavored key=value, mirroring the `serviceErrorResponse` console.error shape in `lib/api-errors.ts`. Fields: `path` (req.nextUrl.pathname or req.url), `method`, `user.id`, `user.company_id`, `target` (the id param being asserted), `kind` (`forbidden` | `not-found`). Railway surfaces deploy logs; no log-sink to build.

**(d) Testing:** a unit test on the wrapper (not per-route):
- shadow on + cross-company → handler executes, console.error called with the structured line, status 200 (or the handler's normal shape) — NOT 403.
- shadow off → 403 returned, handler NOT called.
- Spy `console.error` via `vi.spyOn(console, 'error')`; restore in afterEach. Mock `@/lib/auth` + `@/lib/repositories/projects.repo` (projectAccessRow) exactly like the risks route test. No DB.
- Because shadow is one env read at the top of the catch, the test just sets `process.env.ACCESS_ENFORCEMENT = 'shadow'` / deletes it and deletes it after. No `vi.resetModules` needed since the read is per-request.

**Per-request read (NOT module-load):** YES — the getenv must be inside the catch handler, not hoisted to module scope. `withAuth`'s closure is captured once at import; a `const SHADOW = process.env.ACCESS_ENFORCEMENT === 'shadow'` at module top would freeze the value at server boot and a deploy toggling the env var would need a rebuild to flip. Per-request read in the catch tail lets the operator flip `ACCESS_ENFORCEMENT` in the container env and just restart the server.

### Pattern 2: `opts.rawBody` in withAuth (formData blocker)

**What:** extend `WrapperOptions` with `rawBody?: boolean`. When true, skip the auto `req.json()` on POST/PUT/PATCH entirely (body stays `undefined`).

```typescript
export type WrapperOptions<TBody = unknown> = {
  schema?: z.ZodType<TBody>;
  badRequest?: (error: z.ZodError<TBody>) => NextResponse;
  /** Skip the auto req.json() on POST/PUT/PATCH so the handler can
   *  consume formData / stream the body itself (import/resource-plan,
   *  export/ppt, parse-file-headers). */
  rawBody?: boolean;
};
// in the body branch:
} else if (!opts?.rawBody && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
```

Sequence: MUST land BEFORE converting any formData route. `export/ppt/[id]`'s generator already does `req.json().catch(() => ({}))` so with `rawBody` its handler flow is unchanged. Verified root cause: `with-auth.ts:77-83` unconditionally parses on POST/PUT/PATCH when no schema.

### Pattern 3: Table-driven 401 spec (Q2)

**What:** ONE `app/api/route-401.spec.ts` (or small set by wrapper type) asserting 401-with-null-session across ~45 routes.

**(a) Wrapper types behave the same on null session:** `withAuth` short-circuits at line 55-56 (`if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`) BEFORE any params await, body parse, assert, or handler call. `withProjectAccess` and `withProgramAccess` both delegate to `withAuth`, so ALL wrapped routes 401 identically with `{ error: 'Unauthorized' }` and their assert/repo/service is NOT called. The 55 raw `getSessionFromRequest` routes return the same shape (the existing 401 boilerplate, see CLAUDE.md error-handling section). So a single table keyed on `{ route, method, expected: 401, preassert: repo-not-called }` covers both kinds. The 401 assertion NEVER needs body/params — a null session short-circuits before params are read.

**(b) The formData/param-dependent routes:** for the 401 assertion, params and body are irrelevant — 401 fires before `await rawCtx.params`. So the table entry just needs `params: Promise.resolve({ id: '1' })` (a dummy for any route with an `[id]`) and no body. The 401 case for import/resource-plan, export/ppt, parse-file-headers, config GET runs WITHOUT the formData present — which is exactly the point (no session → 401 → never reach parsing). The rawBody routes only need body attention in their non-401 tests, which stay in their own route test files.

**(c) Enumeration without a drifting manual list:** do NOT hand-maintain 45 entries. Options ranked:
1. A single static table with a `// keep in sync with app/api tree` header AND a drift-check test that globs `app/api/**/route.ts`, intersects with the wrapped/known-public set, and fails when a route lacks a 401 entry. This is the pragmatic default — a manifest of routes the 401 spec covers, verifiable by grep.
2. Fully-dynamic glob through `app/api/**/route.ts` at test time + reflect over each module's GET/POST/etc. exports. Risk: public routes (5), health, auth endpoints would falsely assert 401, and route handler signatures differ (some destructure, some take `ctx`). Reflection over heterogeneous handlers is the most expensive test to maintain. Rejected as primary.
Recommendation: static table + drift-check glob test. The drift-check is the invariant guard the plan needs.

**(d) Default tier (no DB):** yes. The risks test template (`route.test.ts:5-25`) shows `vi.hoisted` + `vi.mock('@/lib/auth')` + repo mocks. The 401 spec adds `vi.mock('@/lib/db', ...)` for routes whose module import pulls in `@/lib/db` at load — the 55 raw routes and the wrapper modules import `getSessionFromRequest` (mocked) but the route modules themselves may import `getDb()`/repos. Mock `@/lib/db` to a no-op `getDb` returning a mock client so module load never touches a real Pool. `projects` vitest config runs the `node` project over `{lib,app}/**/*.test.ts` — `route-401.spec.ts` under `app/api/` is picked up automatically; no config change.

### Pattern 4: 403 matrix for the 8 + 21 (Q3)

- ROUTE-09 ("403 cross-company project_id on projects/[id]/**") does NOT apply to the 8 multi-tenant routes: they have NO tenancy column and no project id in scope — their gate is withAuth 401, and the residual cross-tenant risk is RECORDED (not fixed) per CONTEXT (v2 `company_id` migration).
- 403 applies to the 21 `projects/[id]` routes where ownership matters. 18 are already wrapped and have tests (verified in the risks template: the `returns 403 for a cross-company project` case at `route.test.ts:73-82`). The 3 report routes (report, project-report, project-report/generate-email) need a 403 test added as part of their conversion — no test file exists today.
- `project-allocations` POST keeps the body-field `assertProjectAccess(project_id)` inline (a body value a wrapper can't reach); its test files already have 401+403 coverage.

### Pattern 5: Next 16.2.4 proxy convention — findings (Q4)

- The `proxy` export name IS honored by Next 16.2.4. The official docs (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` and `03-file-conventions/proxy.md`) state: "Starting with Next.js 16, Middleware is now called Proxy" and "The file must export a single function, either as a default export or named `proxy`." `proxy.ts`'s named `export function proxy` is the correct convention.
- The manifest discrepancy is therefore NOT a naming-convention bug. The scout found `middleware.js` compiles but `middleware`/`sortedMiddleware` are empty in the standalone `middleware-manifest.json` — that is a *standalone-output* dispatch gap, not a "rename your export" fix.
- **There is no one-line change in scope.** The docs list no `experimental.proxy` opt-in and no config key that re-enables dispatch for standalone; the only lever is the codemod/migration surface which moves between `middleware` and `proxy` file/export names (already correct here). Making proxy.ts actually dispatch would require either a Next standalone fix/opt-in (outside behavior freeze) or shipping `redirects` in `next.config.ts` (which is behavior-affecting and outside this phase's scope).
- **Phase 6 scope: RECORD, don't fix.** The plan's task is: (1) static check — inspect `.next/server/middleware-manifest.json` post-build for empty `middleware`/`sortedMiddleware`; (2) local prod runtime check — `npm run build && node .next/standalone/server.js`, `curl -i /portfolio` no-cookie, expecting 307 if proxy were live vs 200 (dead); (3) write `06-PROXY-FINDING.md` concluding "route-level enforcement is the only enforcement line; proxy.ts is dead code; nothing catches the 8 ungated routes upstream." This is the ROUTE-11 confirmation, deliberately NOT a fix.

### Pattern 6: Plan slicing (Q5)

Dependencies force a serial spine with one parallel fan-out. Recommended plans:

| # | Plan | depends_on | Serial/Parallel |
|---|------|-----------|-----------------|
| P1 | Substrate: `opts.rawBody` + shadow flag in wrappers + wrapper-shadow unit tests | — | Serial start |
| P2 | Gate the 8 live IDORs (withAuth 401, shadow-first) — includes parse-file-headers formData | P1 (rawBody) | Serial (highest value, the security point of the phase) |
| P3 | Convert 3 projects/[id] report routes to withProjectAccess (enforcing) + their 403 tests | P1 | Parallel to P2 |
| P4 | Convert 8 export/import/config/parse routes (3 push-assert + 3 inline-assert + import/resource-plan formData + config GET) | P1 (rawBody before the formData ones) | Parallel to P2 |
| P5 | Convert 3 program routes to withProgramAccess | P1 | Parallel to P2 |
| P6 | One table-driven 401 spec + drift-check glob test | P2, P3, P4, P5 (route set stable) | Serial last (the invariant proves the conversions) |
| P7 | proxy.ts static + runtime finding → `06-PROXY-FINDING.md` | — | Parallel anywhere; independent |

The formData blocker ordering: `rawBody` (P1) MUST precede P2's parse-file-headers and P4's import/resource-plan + export/ppt conversions — those routes 400 'Invalid JSON' today if wrapped before rawBody lands. P6's 401 spec must come after the conversions so the covered set is stable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 45 individual 401 test files | 45 route-401 files | ONE table-driven spec + drift-check glob | Per-route files drift; a single invariant table grows with the route set |
| Shadow wrapper class | A separate `withShadow` wrapper | ~6-line catch inside `withAuth` | Doubles the sync surface; the access wrappers already delegate through withAuth |
| Shadow scoping per-route code | A per-call-site opt mechanism | Deploy-sequence env-flag control (operator flips `ACCESS_ENFORCEMENT`) | The 18 already-enforcing routes stay untouched; scope by which deploy carries the flag |
| Proxy dispatch fix | A next.config change to revive proxy.ts | Record the deadness in 06-PROXY-FINDING.md | Outside behavior freeze; route-level is the enforcement line |
| Tenancy scoping for 7 tables | Inventing a company filter on tables with no column | Record residual risk as v2 (`company_id` migration) | Fabricating scoping on a column that doesn't exist is worse than an explicit 401 ceiling |

**Key insight:** every "don't" here is about scope discipline — the phase's risk is doing MORE than the freeze allows, not less. The 8 live IDORs are the only place new denials appear; everything else is a behavior-preserving refactor plus proof.

## Common Pitfalls

### Pitfall 1: Shadow flag hoisted to module scope
**What goes wrong:** `const SHADOW = process.env.ACCESS_ENFORCEMENT === 'shadow'` at module top freezes the value at boot; a deploy toggling the env var requires a rebuild.
**Why it happens:** the env read is trivially hoistable.
**How to avoid:** read the env INSIDE the catch handler, per request.
**Warning signs:** shadow tests that pass only after `vi.resetModules()`.

### Pitfall 2: Wrapping a formData route before rawBody lands
**What goes wrong:** `withAuth`'s auto `req.json()` throws on multipart → 400 'Invalid JSON' before the handler runs.
**Why it happens:** `with-auth.ts:77-83` parses POST/PUT/PATCH unconditionally when no schema.
**How to avoid:** P1 rawBody first; sequence-verify the plan's depends_on.
**Warning signs:** import/resource-plan tests failing with 400 instead of reaching the handler.

### Pitfall 3: The 401 spec asserting 401 on public/auth routes
**What goes wrong:** the drift-check glob catches login, health, landing — false failures.
**Why it happens:** public routes legitimately return non-401.
**How to avoid:** maintain the explicit public-routes allowlist (5) + auth endpoints in the spec's skip set; the drift test only asserts presence of an entry, not 401-ness, for those.
**Warning signs:** drift test failing on `app/api/auth/login`.

### Pitfall 4: Params awaited where the 401 test can't supply them
**What goes wrong:** a 401 test that tries to construct a real body/params for a formData route.
**Why it happens:** mistaking the 401 path for the happy path.
**How to avoid:** remember `withAuth` 401s BEFORE `await rawCtx.params` — a dummy `params: Promise.resolve({ id: '1' })` suffices for every 401 case.
**Warning signs:** any 401 test that imports formData.

### Pitfall 5: Misreading the proxy finding as a naming bug
**What goes wrong:** "proxy compiles but isn't dispatched → rename the export to default/middleware" — a fix that changes nothing because the export name is already correct.
**Why it happens:** middleware→proxy rename is new in Next 16.
**How to avoid:** cite the docs (named `proxy` is honored); classify the gap as standalone dispatch, not convention.
**Warning signs:** a PR that renames `proxy` to `middleware`.

## Runtime State Inventory

> Include this section for rename/refactor/migration phases only. Omit entirely for greenfield phases.

Not a rename/refactor/migration phase — Phase 6 is route-level enforcement + tests. No runtime-state audit required. No tables, service config, OS registrations, secrets, or build artifacts carry a renamed string.

## Code Examples

### withAuth catch tail with shadow flag (Q1)

```typescript
} catch (e) {
  if (e instanceof UnknownColumnError) return repoErrorResponse(e);
  if (
    process.env.ACCESS_ENFORCEMENT === 'shadow' &&
    (e instanceof ForbiddenError || e instanceof NotFoundError)
  ) {
    console.error(
      `[shadow-access] path=${req.nextUrl.pathname} method=${req.method} user=${user.id} company=${user.company_id} target=${'id' in params ? params.id : req.nextUrl.pathname} kind=${e instanceof ForbiddenError ? 'forbidden' : 'not-found'}`,
    );
    return handler(req, { user, actor, params, body: body as TBody });
  }
  return serviceErrorResponse(e);
}
```

### Wrapper-shadow unit test (Q1)

```typescript
// lib/http/with-auth.test.ts (or shadow.test.ts)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getSessionFromRequest } = vi.hoisted(() => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSessionFromRequest }));
vi.mock('@/lib/repositories/projects.repo', () => ({
  projectAccessRow: vi.fn().mockResolvedValue({ company_id: 5, customer_company_id: null }),
}));
// import AFTER the mocks
import { withProjectAccess } from './with-project-access';

const session = { id: 2, company_id: 5, is_admin: 0 } as never;

describe('shadow mode (Q1)', () => {
  afterEach(() => { delete process.env.ACCESS_ENFORCEMENT; vi.restoreAllMocks(); });

  it('shadow on: cross-company is allowed and logged', async () => {
    process.env.ACCESS_ENFORCEMENT = 'shadow';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getSessionFromRequest.mockResolvedValue({ ...session, company_id: 9 }); // foreign
    const handler = withProjectAccess(() => NextResponse.json({ ok: true }), {} as never);
    const res = await handler(
      new NextRequest('http://localhost/api/projects/7/x', { method: 'GET' }),
      { params: Promise.resolve({ id: '7' }) },
    );
    expect(res.status).toBe(200); // allowed through in shadow
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[shadow-access]'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('kind=forbidden'));
  });

  it('shadow off: cross-company is denied 403 and handler not called', async () => {
    const handler = withProjectAccess(() => NextResponse.json({ ok: true }), {} as never);
    const res = await handler(
      new NextRequest('http://localhost/api/projects/7/x', { method: 'GET' }),
      { params: Promise.resolve({ id: '7' }) },
    );
    expect(res.status).toBe(403);
  });
});
```

### Table-driven 401 spec skeleton (Q2)

```typescript
// app/api/route-401.spec.ts — one spec, ~45 rows, null-session invariant.
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const { getSessionFromRequest } = vi.hoisted(() => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSessionFromRequest }));
vi.mock('@/lib/db', () => ({ getDb: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })) }));

// Static table of { route, method(s) }. Grep-verifiable; drift-check glob fails
// when app/api/**/route.ts gains a route without an entry here.
const UNPROTECTED = ['/api/health', '/api/auth/login', /* + public list */];

// Cases: every route module's handler must 401 with { error: 'Unauthorized' }.
// 401 fires before params/body, so params: Promise.resolve({ id: '1' }) is enough.
// (drift-check glob: for each app/api/**/route.ts not in UNPROTECTED, expect an entry.)
```

### Risks route test — the 401/403 template (verified in repo)

Source: `app/api/projects/[id]/risks/route.test.ts:64-82` — null-session → 401 + assert/repo NOT called; foreign company → 403 + repo not called.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` (named `proxy` or default export) | Next.js 16.0.0 | The proxy export name is correct in this repo; the standalone manifest gap is a separate dispatch issue |
| Per-route 401 test files | One table-driven spec + drift-check glob | Phase 6 | ~45 files collapse to 1 invariant; new routes fail the drift check until covered |
| Boolean-return access assert | Assert-that-returns-the-row | Phase 5 | `withProjectAccess` hands `ctx.project`; shadow catch keys off ForbiddenError/NotFoundError |

**Deprecated/outdated:**
- `middleware` file convention: deprecated, renamed to `proxy` in Next 16 (docs: "The `middleware` file convention is deprecated and has been renamed to `proxy`"). This repo already uses `proxy.ts` correctly.

## Validation Architecture

> nyquist_validation: not disabled — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (vitest.config.ts, projects: `node` + `jsdom`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npx vitest run` (baseline 592/479/0/113) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-08 (shadow) | shadow on → allow + log; off → deny | unit | `npx vitest run lib/http/` | ❌ Wave 0 — new wrapper-shadow test |
| ROUTE-03/04 (conversions) | 3 report routes + 8 export/import/config/parse 401/403 preserved | unit | route test files per conversion | ❌ for report/export/config; existing for wrapped siblings |
| ROUTE-09 (403 matrix) | 403 added for 3 report routes; 18/21 already covered | unit | `npx vitest run app/api/projects/` | ❌ for 3 report routes |
| ROUTE-10 (401 matrix) | ~45 routes 401 on null session | unit (default tier, no DB) | `npx vitest run app/api/route-401.spec.ts` | ❌ Wave 0 |
| ROUTE-11 (proxy) | static manifest check + local prod curl | manual / local-prod runtime | build + `node .next/standalone/server.js` + `curl -i /portfolio` | ❌ Wave 0 — `06-PROXY-FINDING.md` output |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed route>.test.ts` (quick run)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `lib/http/with-auth.test.ts` (or `shadow.test.ts`) — shadow flag unit tests (spy console.error)
- [ ] `app/api/route-401.spec.ts` — table-driven 401 spec + drift-check glob
- [ ] 3 report-route test files — 401 + 403 added (report, project-report, project-report/generate-email)
- [ ] No framework install needed — vitest already configured and green

## Security Domain

> security_enforcement: enabled (absent in config) — section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `withAuth`/`getSessionFromRequest` — null session → 401 |
| V3 Session Management | yes (existing) | cookie `pm_session` httpOnly 7d — unchanged this phase |
| V4 Access Control | yes | `withProjectAccess`/`withProgramAccess` → `assertProjectAccess`/`assertProgramAccess` (403/404) |
| V5 Input Validation | no (no new input surface) | — |
| V6 Cryptography | no | — |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anonymous IDOR (8 routes, incl. bare-id DELETE) | Information disclosure / Tampering | `withAuth` 401 gate this milestone; `company_id` migration recorded as v2 |
| Cross-tenant project_id read/write | Information disclosure | `withProjectAccess` ownership assert → 403 (21 projects/[id] routes; 18 already, 3 added) |
| Cross-tenant program_id access | Information disclosure | `withProgramAccess` → 403 (3 program routes converted) |
| Wrapper bypass via formData routes | Elevation of privilege | `opts.rawBody` so formData routes get wrapped without the auto-parse 400 |
| 403 storm on cutover | DoS (self-inflicted) | shadow-first deploy on the 8 NEW-denial routes; conversions ship enforcing |

## Sources

### Primary (HIGH confidence)
- [Verified: repo] `.planning/phases/06-access-enforcement-rollout/06-CONTEXT.md` — locked decisions: shadow flag in wrappers (not a separate wrapper), rawBody-first, 8 IDORs gated at withAuth, proxy recorded not fixed, table-driven 401 spec, 403s only on the 8.
- [Verified: repo] `lib/http/with-auth.ts:54-93` — 401 short-circuit before params/body; auto `req.json()` on POST/PUT/PATCH (lines 77-83); catch tail at 85-93 (the shadow-insertion point).
- [Verified: repo] `lib/http/with-project-access.ts:24-31` and `lib/http/with-program-access.ts:28-34` — both delegate the assert into `withAuth`'s try/catch (shadow catch placement).
- [Verified: repo] `lib/services/access.ts:25-48` — `assertProjectAccess` returns the row; throws NotFoundError (missing), ForbiddenError (cross-company); null-company CR-01 branch.
- [Verified: repo] `app/api/projects/[id]/risks/route.test.ts:64-82` — the 401/403 template: null session → 401 + assert not called; foreign → 403 + repo not called; vi.hoisted + vi.mock pattern.
- [Verified: repo] `vitest.config.ts` — node project includes `{lib,app}/**/*.test.ts`; no config change needed for the 401 spec.
- [Verified: repo] `proxy.ts` — named `proxy` export + matcher (the correct Next 16 convention).
- [CITED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md] — "The file must export a single function, either as a default export or named `proxy`"; "The `middleware` file convention is deprecated and has been renamed to `proxy`" (Next 16.0.0).
- [CITED: node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md] — "Starting with Next.js 16, Middleware is now called Proxy"; no opt-in config key documented.

### Secondary (MEDIUM confidence)
- [CITED: CLAUDE.md] — API error conventions: 401 `{ error: 'Unauthorized' }`, `forbidden()`/`unauthorized()` helpers, error shape `{ error: string }`; proxy is cookie-presence-only (DB re-checks).
- [ASSUMED] — Standalone `middleware-manifest.json` empty `middleware`/`sortedMiddleware` is a standalone-output dispatch gap rather than a config toggle (scout confirmed empty; the docs list no standalone opt-in).

### Tertiary (LOW confidence)
- [ASSUMED] — No environment availability gaps: build + `node .next/standalone/server.js` is a dev-machine check already feasible (Dockerfile + standalone output are existing project facts). Confirm `PORT=3000`/`DATABASE_URL` during the local prod proxy check.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The standalone manifest gap is a Next standalone-output dispatch issue with no config opt-in (per installed docs) | Pattern 5 | If a one-line opt-in exists, the finding's "no fix in scope" conclusion still holds (outside behavior freeze) — only the recorded reason changes |
| A2 | The 5 public routes + auth endpoints are the complete non-401 set for the drift-check allowlist | Pattern 3 | A missed public route → false drift-test failure; trivial to add to the skip list |
| A3 | `params.id` is always the target id for access-wrapper routes; plain withAuth routes use pathname | Pattern 1 | Cosmetic log-field variance only; the structured line shape is fixed by the format spec |
| A4 | The 18 already-wrapped routes remain untouched and enforcing (CONTEXT) | Pattern 1 | Contradicts a locked decision if changed — no risk to a plan that honors it |
| A5 | No new external packages — all tools in-repo | Standard Stack | No legitimacy concerns; nothing to verify on a registry |

## Open Questions

1. **Does the drift-check glob need the 5 public + auth route skip list maintained in the spec, or should the plan gate it to the session-route set only?**
   - What we know: 85 route.ts total; 73 session-routes; 12 no session check (5 public + 7 multi-tenant + parse-file-headers).
   - What's unclear: where the canonical skip list lives (spec constant vs a generated manifest).
   - Recommendation: maintain the skip list as a const in the spec with a comment; the drift-check intersects `app/api/**/route.ts` minus skips minus already-covered routes.

2. **Shadow deploy sequencing when no live DB/traffic exists to observe.**
   - What we know: shadow review is an operator task (set DATABASE_URL, deploy with `ACCESS_ENFORCEMENT=shadow`, review logs, flip).
   - What's unclear: whether Phase 6 can observe any real would-be denials on this environment.
   - Recommendation: record the operator task, don't block; unit tests prove the shadow path mechanically.

3. **`export/ppt/[id]` rawBody + `req.json().catch(() => ({}))` interplay.**
   - What we know: generator already tolerates empty body; rawBody skips the wrapper's parse.
   - What's unclear: whether the generator's own `req.json()` call is preserved when the wrapper no longer consumes the body.
   - Recommendation: the plan's P4 conversion should keep the handler's own body handling; a quick unit test verifies the 200 path survives.

## Environment Availability

> Phase 6 has no new external dependencies — all tools are in-repo (vitest, Next 16.2.4, node runtime). The only runtime check (ROUTE-11 proxy confirmation) needs a local build + standalone server.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build + `node .next/standalone/server.js` | ✓ | v20+ (Docker base; local v25.x observed) | — |
| vitest | full test suite | ✓ | configured (592/479/0/113) | — |
| PostgreSQL | local-prod proxy check | ✓ (env DATABASE_URL) | — | Skip DB; proxy check is cookie-only (no DB read) |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all in-repo, no new packages, vitest baseline verified.
- Architecture: HIGH — wrappers read directly this session; shadow placement, rawBody root cause, and catch tail verified from source.
- Pitfalls: HIGH for the four repo-verified hazards (module-scope env, formData 400, drift false-positives, params-before-401); MEDIUM for the proxy standalone dispatch classification (A1).

**Research date:** 2026-08-11
**Valid until:** 2026-09-11 (30 days — stable stack, in-repo deps, Next 16.2.4 pinned)
