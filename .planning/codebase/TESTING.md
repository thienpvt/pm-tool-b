# Testing Patterns

**Analysis Date:** 2026-08-29

## Test Framework

**Runner:**
- Vitest 4.1.10 — dual-project harness in `vitest.config.ts`
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect`
- `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveClass`) via `test/setup-jsdom.ts`
- `@testing-library/react` for component tests (`render`, `screen`, `fireEvent`, `waitFor`)

**Run Commands:**
```bash
npm test              # vitest run — both node + jsdom projects
npm run test:watch    # vitest — watch mode
npm run lint          # ESLint on app/api routes (companion quality gate)
npm run build         # next build — compile-time typecheck
npm run migrate       # schema migrations (CI runs before tests)
```

## Vitest 4 Harness — Node + Jsdom Projects

**Config (`vitest.config.ts`):**
```typescript
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '@': path.resolve(__dirname, '.') } },
        test: {
          name: 'node',
          environment: 'node',
          include: ['{lib,app,eslint,modules}/**/*.test.ts'],
          exclude: ['lib/log.test.ts'],
        },
      },
      {
        resolve: { alias: { '@': path.resolve(__dirname, '.') } },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: [
            '{components,app,modules}/**/*.test.tsx',
            '{components,app,modules}/**/*.component.test.tsx',
          ],
          setupFiles: ['./test/setup-jsdom.ts'],
        },
      },
    ],
  },
});
```

**Project split:**
- **node** — all `*.test.ts` under `lib/`, `app/`, `eslint/`, and `modules/` (services, repos, routes, HTTP wrappers, contract tests)
- **jsdom** — all `*.test.tsx` and `*.component.test.tsx` under `components/`, `app/`, and `modules/` (React component/page tests)

**Jsdom setup (`test/setup-jsdom.ts`):**
```typescript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

## Test File Organization

**Location:** Co-located with source — no separate `__tests__/` tree for application code. Shared test utilities live in `test/`.

**Naming conventions (prescriptive — match existing patterns):**

| Pattern | Scope | Example |
|---------|-------|---------|
| `*.unit.test.ts` | Service unit tests with mocked deps | `modules/projects/backend/services/milestones.service.unit.test.ts` |
| `*.repo.test.ts` | Repository integration tests against real Postgres | `modules/projects/backend/repositories/milestones.repo.test.ts` |
| `route.test.ts` | API route handler tests (mocked session/DB or repo boundary) | `app/api/projects/route.test.ts` |
| `route.access.test.ts` | Route-level access-control proofs (real assert + service) | `app/api/projects/[id]/risks/route.access.test.ts` |
| `*.test.ts` | Pure lib, HTTP wrapper, or cross-cutting specs | `lib/api-errors.test.ts`, `lib/http/route-401-matrix.test.ts` |
| `*.component.test.tsx` | Module page or dialog integration tests (jsdom) | `modules/projects/ui/milestones/page.component.test.tsx` |
| `*.test.tsx` | Simple component smoke tests (jsdom) | `components/ui/badge.test.tsx` |
| `*-module-split.test.ts` | Structural contract tests for layer reorg | `modules/projects/backend/projects-module-split.test.ts` |
| `*.contract.test.ts` | Cross-module wiring / export contract proofs | `modules/weekly/backend/services/nit-01-exports.contract.test.ts` |
| `*.integration.test.ts` | DB migration / tenancy backfill against Postgres | `lib/db.mapping-tenant-migration.integration.test.ts` |

**Approximate inventory (284 test files):**

| Suffix / pattern | Count |
|------------------|-------|
| `*.unit.test.ts` | 84 |
| `*.repo.test.ts` | 41 |
| `*.component.test.tsx` | 23 |
| `route.access.test.ts` | 8 |
| `*.integration.test.ts` | 2 |
| `*.contract.test.ts` | 1 |
| Other `*.test.ts(x)` (routes, lib, wrappers, split tests) | 125 |

**Structure:**
```
modules/
  projects/
    backend/
      services/
        milestones.service.ts
        milestones.service.unit.test.ts    # mocked repos + access
      repositories/
        milestones.repo.ts
        milestones.repo.test.ts            # real Postgres (skipIf !hasTestDb)
      routes/projects/[id]/
        handlers.ts
        route.ts                             # may have route.test.ts co-located in app/api
      projects-module-split.test.ts          # re-export + PageChrome contract
    ui/
      milestones/
        MilestonesPage.tsx
        page.component.test.tsx              # jsdom page test
app/
  api/projects/
    route.ts                                 # re-export from module
    route.test.ts                            # route handler with mocked session
  projects/[id]/milestones/
    page.tsx                                 # PageChrome shell (no test here)
lib/
  http/
    with-auth.ts
    with-auth.test.ts                        # wrapper contract tests
  services/
    access.unit.test.ts
    errors.unit.test.ts
components/ui/
  badge.tsx
  badge.test.tsx
test/
  db.ts                                      # TEST_DATABASE_URL guard
  repo-db.ts                                 # TestDbClient + DDL + seed helpers
  setup-jsdom.ts                             # RTL cleanup
eslint/
  rules/
    require-auth-wrapper.test.ts             # custom ESLint rule tests
```

## Test Structure

**Suite organization (service unit test — canonical):**
```typescript
// modules/projects/backend/services/milestones.service.unit.test.ts
const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listMilestonesRepo,
  auditLog,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listMilestonesRepo: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog }));
vi.mock('@/modules/projects/backend/repositories/milestones.repo', () => ({
  listMilestones: listMilestonesRepo,
  // ...
}));

import { listMilestones } from './milestones.service';
import { ForbiddenError, NotFoundError } from '@/lib/services/errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

describe('milestones.service', () => {
  it('asserts access before listing', async () => { ... });
});
```

**Route test pattern:**
```typescript
// app/api/projects/route.test.ts
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));

import { GET } from './route';

beforeEach(() => {
  vi.mocked(getSessionFromRequest).mockReset();
  vi.mocked(getDb).mockReset();
});

describe('GET /api/projects', () => {
  it('returns 401 when there is no session', async () => { ... });
});
```

**Route access test pattern (real service, mocked repo boundary):**
```typescript
// app/api/projects/[id]/risks/route.access.test.ts
const { projectAccessRow, createRiskRepo } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  createRiskRepo: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/modules/projects/backend/repositories/risks.repo', () => ({ createRisk: createRiskRepo, ... }));
// Real assertProjectAccess + service run; repos mocked
```

**Repository integration test pattern:**
```typescript
// modules/projects/backend/repositories/milestones.repo.test.ts
vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));
vi.mock('@/lib/db/kysely', () => ({ getKysely: vi.fn(async () => testKysely()) }));

describe.skipIf(!hasTestDb)('milestones.repo', () => {
  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('Milestones Suite');
  });
  it('creates a milestone and reads it back scoped to the project', async () => { ... });
});
```

**Component test pattern:**
```typescript
// modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboards/portfolio' }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('PortfolioDashboardPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url) => { /* fixture JSON per URL */ }));
  });
  it('renders KPI tiles after load', async () => {
    render(<PortfolioDashboardPage />);
    await waitFor(() => expect(screen.getByText(/Active Projects/)).toBeInTheDocument());
  });
});
```

**Module split contract test pattern:**
```typescript
// modules/projects/backend/projects-module-split.test.ts
it('P2: app/api/projects/route.ts re-exports GET and POST from module route', () => {
  const source = readUtf8('app/api/projects/route.ts');
  expect(source).toMatch(/export\s*\{\s*GET\s*,\s*POST\s*\}\s*from\s*['"]@\/modules\/projects\/backend\/routes\/projects\/route['"]/);
});
```

**Patterns:**
- Use `vi.hoisted()` for mock fns referenced inside `vi.mock()` factories
- `beforeEach`: `vi.clearAllMocks()` or per-mock `mockReset()` / `mockResolvedValue`
- `afterEach`: `vi.restoreAllMocks()` when spying on `console.error`
- Import handler/service under test AFTER mocks are registered
- Assert HTTP status + JSON body shape, not error message leakage
- Next.js 16 async params: `{ params: Promise.resolve({ id: '7' }) }`

## Mocking

**Framework:** Vitest `vi.mock`, `vi.fn`, `vi.spyOn`, `vi.stubGlobal`, `vi.hoisted`, `vi.mocked`

**What to mock by layer:**

| Layer under test | Mock at boundary | Do NOT mock |
|------------------|------------------|-------------|
| Service unit | repositories, `assertProjectAccess`, cross-module services (`auditLog`) | The service function itself |
| Route (default) | `getSessionFromRequest`, `getDb` or repo fns | Service logic when proving access wiring |
| Route access | repo fns (`projectAccessRow`, CRUD) | `assertProjectAccess`, service module |
| Repo integration | `getDb` → `testDb()`, `getKysely` → `testKysely()` | Kysely query builder internals |
| Integration client | global `fetch` via `vi.stubGlobal` | Credential encoding logic |
| Component/page | `next/navigation`, `fetch`, heavy child components, `sonner` | The page component under test |
| HTTP wrapper | `getSessionFromRequest` only | Error class instanceof checks |

**Common mock targets:**
```typescript
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/db/kysely', () => ({ getKysely: vi.fn(async () => testKysely()) }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({ projectAccessRow: vi.fn(), ... }));
vi.stubGlobal('fetch', fetchMock);  // integration clients + UI pages
vi.spyOn(console, 'error').mockImplementation(() => undefined);  // suppress + assert logging
```

**What NOT to mock:**
- Pure functions: `lib/status-weights.ts`, `lib/repositories/_kysely-helpers.ts` `pickAllowed`
- Typed error classes — use real `instanceof` checks
- `UnknownColumnError`, `ForbiddenError`, etc. — construct real instances in tests

## Fixtures and Factories

**Postgres test infrastructure (`test/db.ts`, `test/repo-db.ts`):**
- `TEST_DATABASE_URL` env var required for repo integration tests
- Database name must end in `_test` (safety guard in `test/db.ts`)
- `testDb()` returns a `DbClient` adapter over a real Postgres pool — mirrors `lib/db.ts` placeholder rewriting (`?` → `$n`, `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`)
- `testKysely()` returns a Kysely instance over the same test pool
- `setupRepoTables()` — minimal DDL matching production column sets
- `seedProject(name, opts?)`, `seedCompany(name)` — create test rows
- `hasTestDb` boolean — use `describe.skipIf(!hasTestDb)` to skip when no DB

**Session fixtures (inline in route tests):**
```typescript
const session = {
  id: 7,
  username: 'pm1',
  display_name: 'PM One',
  company_id: 3,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: ['cpmo'],
  status: 'active',
  email: 'pm1@example.com',
};

const ownerSession = { ...session, company_id: 5, is_admin: 0, roles: ['pm'] };
const viewerSession = { ...session, roles: ['viewer'] };
const foreignSession = { ...session, company_id: 9 };
```

**Component fixtures:**
- Define page/report payload objects inline in the test file (see `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx` `portfolioFixture`)
- Stub `fetch` to return fixture JSON per URL pattern

**Location:**
- Shared DB helpers: `test/db.ts`, `test/repo-db.ts`
- Domain fixtures: inline in test files unless reused across 3+ suites

## Coverage

**Requirements:** No enforced coverage threshold or `--coverage` script in `package.json`

**Current gate:** CI runs `npm run lint`, `npm run migrate`, then full `npm test` with Postgres service

**View Coverage (if added later):**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests (majority — no I/O):**
- Service layer: `modules/*/backend/services/*.service.unit.test.ts` — mock repos + access asserts
- Cross-cutting lib: `lib/services/access.unit.test.ts`, `lib/services/errors.unit.test.ts`
- Integration clients: `lib/integrations/*/client.unit.test.ts` — mock `fetch`, assert request shape + Zod-validated response
- Export builders: `lib/export/*.unit.test.ts`, `modules/reports/backend/**/*.unit.test.ts`
- Error mappers: `lib/api-errors.test.ts` — assert status codes, body shapes, no secret/cause leakage
- HTTP wrappers: `lib/http/with-auth.test.ts`, `with-project-access.test.ts`, `with-program-access.test.ts`, `route-401-matrix.test.ts`
- Pure lib: `lib/status-weights.test.ts`, `lib/repositories/_kysely-helpers.test.ts`
- ESLint rules: `eslint/rules/require-auth-wrapper.test.ts`

**Integration Tests (Postgres — `describe.skipIf(!hasTestDb)`):**
- Repository: `modules/*/backend/repositories/*.repo.test.ts` — real SQL/Kysely against `pm_tool_test` database
- Legacy lib repos: `lib/repositories/auth.repo.test.ts`, `settings.repo.test.ts`
- Migration backfill: `lib/db.mapping-tenant-migration.integration.test.ts`
- ~46 test files skipped locally without `TEST_DATABASE_URL`; all run in CI

**Route / API Tests:**
- Per-route `route.test.ts` under `app/api/` and `modules/*/backend/routes/` for handler behavior (401, happy path, error mapping)
- `route.access.test.ts` where access-control wiring needs isolated proof (8 suites)
- `lib/http/route-401-matrix.test.ts` — table-driven 401 invariant for every non-public route + drift check against live `app/api/**/route.ts` glob

**Contract / Structural Tests:**
- Module split: `modules/*/backend/*-module-split.test.ts` (10 domains) — verify re-exports, PageChrome shells, handler wiring
- Cross-module exports: `*.contract.test.ts` — verify named exports and import wiring survive refactors

**Component Tests (jsdom):**
- Module pages: `modules/*/ui/**/*.component.test.tsx` (24 files) — render, wait for load, exercise primary flows
- App pages (legacy): `app/**/*.component.test.tsx` where not yet moved to modules
- UI primitives: `components/ui/badge.test.tsx` — render, variant classes, className merge
- Dialog components: `modules/jira/ui/timeline-import/ImportMappingDialog.component.test.tsx`

**E2E Tests:**
- Not used — no Playwright/Cypress dependency or scripts in `package.json`

## Common Patterns

**Async testing:**
```typescript
const res = await GET(req());
expect(res.status).toBe(401);
await expect(res.json()).resolves.toEqual([]);

await expect(listMilestones(7, owner)).rejects.toBeInstanceOf(NotFoundError);
```

**Error testing (security contracts):**
```typescript
// Forbidden message never leaks
const res = serviceErrorResponse(new ForbiddenError('you cannot see project 42'));
expect(await res.json()).toEqual({ error: 'Forbidden' });
expect(JSON.stringify(await res.json())).not.toContain('project 42');

// Integration validation cause stays server-side
const res = integrationErrorResponse(validationError('jira'));
expect(res.status).toBe(502);
expect(JSON.stringify(await res.json())).not.toContain('expected string, got number');
```

**Console spy pattern:**
```typescript
const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
// ... trigger error ...
expect(errorLog).toHaveBeenCalledWith('Unexpected repository error', expect.any(Error));
```

**Fake timers (integration clients):**
```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
```

**Next.js 16 async params:**
```typescript
const params = (id = '7') => ({ params: Promise.resolve({ id }) });
const res = await POST(req(), params());
```

## CI Pipeline

**GitHub Actions (`.github/workflows/test.yml`):**
- Triggers: push, PR to `master`, manual dispatch
- Postgres 17 service container with database `pm_tool_test`
- Node 22, `npm ci`, `npm run lint`, `npm run migrate`, `npm test`
- Env: `DATABASE_URL` and `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pm_tool_test`
- Enables all `describe.skipIf(!hasTestDb)` repo suites in CI

## Special Cases

**`lib/log.test.ts`:** Standalone Node assert script, explicitly excluded from Vitest via `vitest.config.ts` `exclude`. Run manually: `npx tsx lib/log.test.ts`.

**Drift-checked route matrix (`lib/http/route-401-matrix.test.ts`):**
- Static `ROUTE_MATRIX` literal listing every non-public route + HTTP methods
- Second describe block globs `app/api/**/route.ts`, subtracts `PUBLIC_ROUTES`, fails if matrix is stale
- When adding a new protected route: add entry to `ROUTE_MATRIX` or CI 401 test fails

**Repo tests must not call `getDb()`:**
- `getDb()` runs migration ledger + seeds default admin credentials
- Always mock `getDb` → `testDb()` and `getKysely` → `testKysely()` in repo tests

## Guidance For Adding Tests

1. **New service function:** add cases to `modules/<domain>/backend/services/<entity>.service.unit.test.ts` — mock repos, assert access order, typed error throws, audit side effects
2. **New repository write path:** add `modules/<domain>/backend/repositories/<entity>.repo.test.ts` with allowlist rejection tests; use `describe.skipIf(!hasTestDb)`; mock `getDb`/`getKysely` to test helpers
3. **New API route:** add `route.test.ts` co-located with handler (in `app/api/` or module routes) — 401 without session, happy path, error status codes; if route uses `withProjectAccess`, add `route.access.test.ts` for 403/404
4. **New protected route:** update `ROUTE_MATRIX` in `lib/http/route-401-matrix.test.ts`
5. **New Zod schema:** test invalid body returns 400 via wrapper (see `lib/http/with-auth.test.ts` schema cases)
6. **New module page with critical flow:** add `*.component.test.tsx` in jsdom project under `modules/<domain>/ui/` — mock `fetch` + `next/navigation`
7. **New integration client method:** add to `client.unit.test.ts` — mock fetch, test timeout/upstream/validation branches
8. **New app/api re-export or PageChrome shell:** extend the domain's `*-module-split.test.ts` contract suite
9. Run `npm test` locally; set `TEST_DATABASE_URL` to a `*_test` database for repo suites

---

*Testing analysis: 2026-08-29*
