# Phase 20: API Contract & Leftover Routes - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 24
**Analogs found:** 22 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `proxy.ts` | middleware (edge) | request-response | Self (lines 6–37) + `lib/http/with-auth.ts:92` | exact |
| `proxy.test.mjs` / `proxy.test.ts` | test | request-response | `proxy.matcher.test.mjs` | exact |
| `app/api/jira/search/route.ts` | route | request-response | `app/api/jira/jql-presets/route.ts` + self (Jira creds block) | exact |
| `app/api/jira/search/route.test.ts` | test | request-response | `app/api/jira/jql-presets/route.test.ts` | role-match |
| `eslint/rules/require-auth-wrapper.ts` | config (lint rule) | transform | RESEARCH skeleton + `eslint.config.mjs` flat config | partial (no prior rule) |
| `eslint/route-wrapper-allowlist.json` | config | — | RESEARCH allowlist entries | partial (new file) |
| `eslint.config.mjs` | config | transform | Self + `eslint-config-next` spread | exact |
| `.github/workflows/test.yml` | config | batch | Self (migrate + test steps) | exact |
| `lib/services/operations.service.ts` | service | CRUD | `lib/services/holidays.service.ts` + `app/api/operations/systems/route.ts` | role-match |
| `lib/services/settings.service.ts` | service | CRUD | `lib/services/import-mapping.service.ts` (thin repo pass-through) | role-match |
| `lib/services/admin-platform.service.ts` | service | CRUD | `lib/services/users.service.ts` (repo + typed errors) | role-match |
| `app/api/operations/**/route.ts` (×8) | route | CRUD | `app/api/operations/systems/route.ts` (D-23 session gate) | exact |
| `app/api/admin/companies/route.ts` | route | CRUD | Self + `app/api/admin/demo-requests/route.ts` | exact |
| `app/api/admin/demo-requests/route.ts` | route | CRUD | Self (repo-direct today) | exact |
| `app/api/admin/resource-audit/route.ts` | route | CRUD | Self (mixed: session + `assertCompanyWrite`) | exact |
| `app/api/admin/jira-config/[companyId]/route.ts` | route | CRUD | Self (`requireAdmin` helper) | exact |
| `app/api/admin/rag-config/[companyId]/route.ts` | route | CRUD | `app/api/admin/jira-config/[companyId]/route.ts` | exact |
| `app/api/config/route.ts` | route | CRUD | Self (already `withAuth`; swap repo → service) | exact |
| `app/api/config/route.test.ts` | test | request-response | Self + `app/api/admin/users/route.test.ts` (mock service not repo) | exact |
| `app/api/import-mapping/route.ts` | route | CRUD | Self (already service-backed) | exact (verify only) |
| `app/api/bug-import-mapping/route.ts` | route | CRUD | `app/api/import-mapping/route.ts` | exact (verify only) |
| `app/api/jira/sync-mappings/route.ts` | route | CRUD | `app/api/jira/jql-presets/route.ts` | exact (verify only) |
| `app/api/jira/jql-presets/route.ts` | route | CRUD | Self | exact (verify only) |
| `app/api/projects/[id]/**/route.ts` (ENF-01 scope) | route | request-response | `app/api/projects/[id]/benefits/route.ts` | exact |

---

## Pattern Assignments

### `proxy.ts` (middleware, request-response)

**Analog:** Self + `lib/http/with-auth.ts:92`

**Imports pattern** (lines 1–2):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { REQUEST_ID_HEADER, logRequest, newRequestId } from '@/lib/log';
```

**PUBLIC allowlist — keep before unauthenticated branch** (lines 4, 27):
```typescript
const PUBLIC = ['/login', '/landing', '/api/auth/', '/api/health', '/api/demo-requests'];
// ...
if (PUBLIC.some(p => pathname.startsWith(p))) return withId();
```

**Core PROXY-01 change — insert inside `if (!session?.value)` before page redirect** (lines 29–33 today):
```typescript
if (!session?.value) {
  if (pathname === '/') return NextResponse.redirect(new URL('/landing', req.url));
  // NEW: API paths get JSON 401, not HTML redirect
  if (isApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL('/login', req.url);
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}
```

**Reuse `isApi` already computed** (line 12):
```typescript
const isApi = pathname.startsWith('/api/');
```

**Error string must match `withAuth`** (`lib/http/with-auth.ts:92`):
```typescript
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

**Matcher config — do not change** (lines 39–47):
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|woff|woff2|ttf|otf|eot)$).*)',
  ],
};
```

---

### `proxy.test.mjs` / `proxy.test.ts` (test, request-response)

**Analog:** `proxy.matcher.test.mjs`

**Matcher regression pattern — extract pattern from source, don't duplicate** (lines 1–17):
```javascript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./proxy.ts', import.meta.url), 'utf8');
const m = src.match(/matcher:\s*\[\s*'([^']+)'/);
assert.ok(m, 'could not find matcher pattern in proxy.ts');
const pattern = m[1].replace(/\\\\/g, '\\');
const re = new RegExp(`^${pattern}$`);
```

**Behavioral tests to add (PROXY-01)** — follow RESEARCH example:
```javascript
import { NextRequest } from 'next/server';
import { proxy } from './proxy.ts';

const req = (path, cookie) => {
  const r = new NextRequest(`http://localhost${path}`);
  if (cookie) r.cookies.set('pm_session', cookie);
  return r;
};

// No session → API JSON 401
const apiRes = proxy(req('/api/projects'));
assert.equal(apiRes.status, 401);
assert.deepEqual(await apiRes.json(), { error: 'Unauthorized' });

// No session → page redirect to login
const pageRes = proxy(req('/projects'));
assert.ok([302, 307].includes(pageRes.status));
assert.ok(pageRes.headers.get('location')?.includes('/login'));

// PUBLIC API still passes through
const healthRes = proxy(req('/api/health'));
assert.notEqual(healthRes.status, 401);
```

Run: `node proxy.test.mjs` alongside existing `node proxy.matcher.test.mjs`.

---

### `app/api/jira/search/route.ts` (route, request-response)

**Analog:** `app/api/jira/jql-presets/route.ts` (withAuth + schema) + self (Jira credential block lines 7–24)

**Target shape — migrate to `withAuth`, preserve Jira-not-configured 401/503**:
```typescript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { integrationErrorResponse } from '@/lib/api-errors';
import { resolveJiraCredentials } from '@/lib/integrations/credentials';
import { searchIssues } from '@/lib/integrations/jira/client';
import { jiraSearchSchema } from './schema';

export const POST = withAuth(async (_req, { user, body }) => {
  // Behavior freeze: null company_id → 401 (not 503)
  if (!user.company_id) {
    return NextResponse.json(
      { error: 'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.' },
      { status: 401 },
    );
  }

  const creds = await resolveJiraCredentials(user.company_id);
  if (!creds) {
    return NextResponse.json(
      { error: 'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.' },
      { status: 503 },
    );
  }

  const { jql, nextPageToken, maxResults = 100, extraFields = [] } = body;
  if (!jql) return NextResponse.json({ error: 'jql là bắt buộc' }, { status: 400 });

  try {
    const { issues, total, nextPageToken: token } = await searchIssues(creds, {
      jql, nextPageToken, maxResults, extraFields,
    });
    // DELETE lines 46–53 debug console.log block
    return NextResponse.json({ issues, total, nextPageToken: token });
  } catch (err) {
    return integrationErrorResponse(err);
  }
}, { schema: jiraSearchSchema });
```

**Malformed JSON — automatic via `withAuth`** (`lib/http/with-auth.ts:110-118`):
```typescript
} catch {
  return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
}
```

**Do NOT touch:** `resolveJiraCredentials`, `searchIssues`, credential resolution path.

---

### `app/api/jira/search/route.test.ts` (test, request-response)

**Analog:** `app/api/jira/jql-presets/route.test.ts` + `app/api/config/route.test.ts`

**Mock pattern:**
```typescript
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/integrations/credentials', () => ({ resolveJiraCredentials: vi.fn() }));
vi.mock('@/lib/integrations/jira/client', () => ({ searchIssues: vi.fn() }));

// Malformed JSON → 400
const res = await POST(
  new NextRequest('http://localhost/api/jira/search', {
    method: 'POST',
    body: '{not json',
    headers: { 'Content-Type': 'application/json' },
  }),
  { params: Promise.resolve({}) },
);
expect(res.status).toBe(400);
await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON' });
```

Assert no `console.log` spy calls for custom fields (JIRA-01).

---

### `eslint/rules/require-auth-wrapper.ts` (config, transform)

**Analog:** RESEARCH skeleton; register in `eslint.config.mjs`

**Rule skeleton — copy from RESEARCH Pattern 2:**
```typescript
import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  name => `https://github.com/your-org/pm-tool-b/blob/master/eslint/rules/${name}.ts`,
);

const WRAPPERS = new Set([
  'withAuth', 'withProjectAccess', 'withProgramAccess', 'withCpmo', 'withRole',
]);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export const requireAuthWrapper = createRule({
  name: 'require-auth-wrapper',
  meta: {
    type: 'problem',
    docs: { description: 'Project-scoped route handlers must use sanctioned auth wrappers' },
    schema: [],
    messages: { unwrapped: 'HTTP handler must be wrapped by withAuth/withProjectAccess/withProgramAccess/withCpmo/withRole' },
  },
  defaultOptions: [],
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        if (node.declaration?.type !== 'VariableDeclaration') return;
        for (const decl of node.declaration.declarations) {
          if (decl.id.type !== 'Identifier' || !METHODS.has(decl.id.name)) continue;
          const init = decl.init;
          const ok =
            init?.type === 'CallExpression' &&
            init.callee.type === 'Identifier' &&
            WRAPPERS.has(init.callee.name);
          if (!ok) context.report({ node: decl, messageId: 'unwrapped' });
        }
      },
    };
  },
});
```

**Project-scoped globs only** (not all `app/api/**`):
- `app/api/projects/[id]/**/route.ts`
- `app/api/export/**/[id]/**/route.ts`
- `app/api/programs/[id]/**/route.ts`
- `app/api/import/resource-plan/[id]/route.ts`

---

### `eslint/route-wrapper-allowlist.json` (config)

**Analog:** RESEARCH minimum entries

**Format — posix paths array:**
```json
[
  "app/api/health/route.ts",
  "app/api/operations/systems/route.ts",
  "app/api/operations/systems/[id]/route.ts",
  "app/api/operations/systems/[id]/budget-items/route.ts",
  "app/api/operations/systems/[id]/budget-items/[itemId]/route.ts",
  "app/api/operations/systems/[id]/expenses/route.ts",
  "app/api/operations/systems/[id]/expenses/[expId]/route.ts",
  "app/api/operations/systems/[id]/incidents/route.ts",
  "app/api/operations/systems/[id]/incidents/[incId]/route.ts",
  "app/api/admin/companies/route.ts"
]
```

Wire allowlist as `ignores` in the ESLint rule config block — not comment conventions.

---

### `eslint.config.mjs` (config, transform)

**Analog:** Self (flat config with `defineConfig`)

**Current structure** (lines 1–18):
```javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

**Add local rule block after spreads:**
```javascript
import pmToolRules from "./eslint/plugin.mjs"; // or inline plugin object
import allowlist from "./eslint/route-wrapper-allowlist.json" with { type: "json" };

// ...existing spreads...
{
  files: [
    "app/api/projects/[id]/**/route.ts",
    "app/api/export/**/[id]/**/route.ts",
    "app/api/programs/[id]/**/route.ts",
    "app/api/import/resource-plan/[id]/route.ts",
  ],
  ignores: allowlist,
  plugins: { "pm-tool": pmToolRules },
  rules: { "pm-tool/require-auth-wrapper": "error" },
},
```

---

### `.github/workflows/test.yml` (config, batch)

**Analog:** Self — add lint step after `npm ci`, before migrate

```yaml
      - run: npm ci
      - run: npm run lint
      - run: npm run migrate
```

`package.json` already has `"lint": "eslint"`.

---

### `lib/services/operations.service.ts` (service, CRUD)

**Analog:** `lib/services/holidays.service.ts` + route logic from `app/api/operations/systems/route.ts`

**Imports pattern:**
```typescript
import {
  createOperationsSystem as createOperationsSystemRepo,
  listOperationsSystems as listOperationsSystemsRepo,
  // ... other operations.repo exports used by 8 routes
} from '@/lib/repositories/operations.repo';
import type { SessionUser } from '@/lib/auth';
import { ConflictError, NotFoundError, ValidationError } from './errors';
```

**Core pattern — pass session user, delegate to repo with tenant predicates:**
```typescript
export async function listOperationsSystems(user: SessionUser) {
  return listOperationsSystemsRepo(user.company_id, Boolean(user.is_admin));
}

export async function createOperationsSystem(
  user: SessionUser,
  input: { project_id?: number; name: string; description?: string; go_live_date?: string; status?: string },
) {
  if (!input.name) throw new ValidationError('name required', 'name');
  return createOperationsSystemRepo(user.company_id, input);
}
```

**D-23: auth stays in route, NOT in service.** Route keeps:
```typescript
const user = await getSessionFromRequest(req);
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
return NextResponse.json(await listOperationsSystems(user));
```

Do NOT add `withCpmo`/`withRole`/`assertCompanyWrite` to operations routes.

---

### `lib/services/settings.service.ts` (service, CRUD)

**Analog:** `lib/services/import-mapping.service.ts` (thin repo wrapper)

```typescript
import { listSettings as listSettingsRepo, setSetting as setSettingRepo } from '@/lib/repositories/settings.repo';

export async function listSettings() {
  return listSettingsRepo();
}

export async function setSettings(entries: Record<string, unknown>) {
  for (const [key, value] of Object.entries(entries)) {
    await setSettingRepo(key, String(value));
  }
}
```

**Route stays thin — masking logic remains in route** (`app/api/config/route.ts:8-21`):
```typescript
export const GET = withAuth(async () => {
  const rows = await listSettings();
  const config = Object.fromEntries(rows.map(r => [r.key, r.value]));
  // mask anthropic_api_key — unchanged
  return NextResponse.json(config);
});
```

---

### `lib/services/admin-platform.service.ts` (service, CRUD)

**Analog:** `lib/services/users.service.ts` (repo imports + typed errors)

**Imports pattern:**
```typescript
import {
  createCompany,
  deleteCompany,
  deleteDemoRequest,
  listCompaniesWithUserCounts,
  listDemoRequests,
  resourceAudit,
  updateCompany,
  updateDemoRequest,
  addMissingTeamMembersToPortfolio,
} from '@/lib/repositories/admin.repo';
import { ConflictError } from './errors';
```

**Core pattern — platform admin functions, no role wrapper in service:**
```typescript
export async function listCompaniesPlatform() {
  return listCompaniesWithUserCounts(null, true);
}

export async function createCompanyPlatform(name: string) {
  try {
    return await createCompany(name);
  } catch {
    throw new ConflictError('Company name already exists');
  }
}
```

**Route keeps `requireAdmin` helper** (`app/api/admin/companies/route.ts:11-16`):
```typescript
async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}
```

Use `unauthorized()` / `forbidden()` from `@/lib/auth` (lines 112-121) — returns `Response` not `NextResponse`, already used by admin routes.

**resource-audit POST** — keep `assertCompanyWrite` in route, service receives `AccessActor`:
```typescript
// route
const actor = toAccessActor(user);
assertCompanyWrite(actor);
const missing = await addMissingTeamMembersToPortfolioService(actor);
// service
export async function addMissingTeamMembersToPortfolioService(actor: AccessActor) {
  return addMissingTeamMembersToPortfolio(actor.company_id);
}
```

---

### `app/api/operations/**/route.ts` (route, CRUD) — all 8 files

**Analog:** `app/api/operations/systems/route.ts`

**Session gate pattern — preserve verbatim:**
```typescript
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // call service, not repo
  return NextResponse.json(await listOperationsSystems(user));
}
```

**Zod at boundary** (lines 21-22):
```typescript
const parsed = createOperationsSystemSchema.safeParse(await req.json());
if (!parsed.success) return NextResponse.json({ error: 'name required' }, { status: 400 });
```

**Nested routes** (`[id]/route.ts`) — preserve tenant scoping via service:
```typescript
const system = await getOperationsSystemService(id, user);
if (!system) return NextResponse.json({ error: 'Not found' }, { status: 404 });
```

---

### `app/api/admin/companies/route.ts` + other admin routes (route, CRUD)

**Analog:** Self + `app/api/admin/demo-requests/route.ts`

**Companies — D-23 break-glass, no `withCpmo`:**
```typescript
export async function GET(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const companies = await listCompaniesPlatform();
  return NextResponse.json(companies);
}
```

**Jira/RAG config routes** — keep `requireAdmin` + `await params` pattern (`app/api/admin/jira-config/[companyId]/route.ts:15-21`):
```typescript
export async function GET(req: NextRequest, { params }: Params) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const { companyId } = await params;
  return NextResponse.json(await getCompanyJiraConfig(Number(companyId)));
}
```

---

### `app/api/config/route.ts` (route, CRUD)

**Analog:** Self — swap repo imports to `settings.service`

**Already correct wrapper pattern:**
```typescript
export const GET = withAuth(async () => { /* listSettings() */ });
export const POST = withAuth(async (_req, { user, body }) => {
  if (!user.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // setSettings(body)
}, { schema: configSchema }); // optional — current inline safeParse works too
```

---

### `app/api/config/route.test.ts` (test)

**Analog:** Self — change mock target from repo to service

**Before (lines 4-10):**
```typescript
vi.mock('@/lib/repositories/settings.repo', () => ({ listSettings, setSetting }));
```

**After:**
```typescript
vi.mock('@/lib/services/settings.service', () => ({ listSettings, setSettings: vi.fn() }));
```

Follow `app/api/admin/users/route.test.ts:11-12` service-mock pattern.

---

### Import-mapping routes (verify only)

**Analog:** `app/api/import-mapping/route.ts`

Already service-backed — no THIN-01 code move required:
```typescript
export const GET = withAuth(async (_req, { actor }) => {
  return NextResponse.json(await listTimelineMappings(actor));
});
```

Same pattern in `bug-import-mapping`, `jira/sync-mappings`, `jira/jql-presets`. Planner: grep-verify no `@/lib/repositories/` imports remain.

---

### ENF-01 compliant project route reference

**Analog:** `app/api/projects/[id]/benefits/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { listProjectBenefits, createProjectBenefit } from '@/lib/services/benefits.service';
import { benefitCreateSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listProjectBenefits(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await createProjectBenefit(params.id, actor, body), { status: 201 }),
  { schema: benefitCreateSchema },
);
```

This is the shape ENF-01 enforces on project-scoped routes.

---

## Shared Patterns

### Authentication — JSON 401 contract

**Source:** `lib/http/with-auth.ts:91-92`
**Apply to:** `proxy.ts`, all wrapped routes, D-23 inline session routes

```typescript
const user = await getSessionFromRequest(req);
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

**D-23 platform admin** — use `unauthorized()` / `forbidden()` from `lib/auth.ts:112-121`:
```typescript
export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  });
}
```

### Error Handling — service layer

**Source:** `lib/services/errors.ts` + `lib/api-errors.ts:43-67`
**Apply to:** All new service modules

```typescript
// Service throws typed errors (no HTTP)
throw new ConflictError('Company name already exists');
throw new ValidationError('name required', 'name');

// Route catch (when not using withAuth catch tail)
return serviceErrorResponse(e);
```

### Validation — Zod at route boundary

**Source:** `app/api/projects/[id]/benefits/route.ts:20` + `withAuth` schema option
**Apply to:** Jira search (migrate), config POST, operations POST

```typescript
export const POST = withProjectAccess(handler, { schema: benefitCreateSchema });
// or inline:
const parsed = schema.safeParse(body);
if (!parsed.success) return NextResponse.json({ error: '...' }, { status: 400 });
```

### Access control — product vs platform

**Source:** `lib/http/with-role.ts:26-34` (product CPMO) vs `app/api/admin/companies/route.ts:11-16` (platform break-glass)

| Route class | Pattern | Do NOT use |
|-------------|---------|------------|
| Project-scoped | `withProjectAccess` / `withProgramAccess` | Raw session check |
| Product admin (users) | `withCpmo` | `requireAdmin` |
| Platform break-glass (companies, ops) | `requireAdmin` or inline session + `is_admin` | `withCpmo`, `withRole` |
| Company write (resource-audit POST) | `assertCompanyWrite(actor)` in route | Move to service |

### Testing — mock services not repos

**Source:** `app/api/admin/users/route.test.ts:4-12`
**Apply to:** config, ops, admin route tests after THIN-01

```typescript
const { listUsers } = vi.hoisted(() => ({ listUsers: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/users.service', () => ({ listUsers }));
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `eslint/rules/require-auth-wrapper.ts` | config | transform | No local ESLint rules exist yet — use RESEARCH skeleton + typescript-eslint docs |
| `eslint/route-wrapper-allowlist.json` | config | — | New artifact; minimum entries from RESEARCH, expand during implementation |

---

## Metadata

**Analog search scope:** `proxy.ts`, `lib/http/`, `lib/services/`, `lib/api-errors.ts`, `app/api/operations/**`, `app/api/admin/**`, `app/api/config/`, `app/api/jira/**`, `app/api/import-mapping/**`, `app/api/projects/[id]/**`, `eslint.config.mjs`, `proxy.matcher.test.mjs`, `.github/workflows/test.yml`
**Files scanned:** ~35 route/service/test files
**Pattern extraction date:** 2026-08-28
