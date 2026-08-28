# Testing Patterns

**Analysis Date:** 2026-08-25

## Test Framework

**Runner:**
- Vitest 4.1.10 — dual-project harness in `vitest.config.ts`
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect`
- `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveClass`) via `test/setup-jsdom.ts`

**Run Commands:**
```bash
npm test              # vitest run — both node + jsdom projects
npm run test:watch    # vitest — watch mode
npm run lint          # ESLint (companion quality gate)
npm run build         # next build — compile-time typecheck
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
          include: ['{lib,app}/**/*.test.ts'],
        },
      },
      {
        resolve: { alias: { '@': path.resolve(__dirname, '.') } },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: [
            '{components,app}/**/*.test.tsx',
            '{components,app}/**/*.component.test.tsx',
          ],
          setupFiles: ['./test/setup-jsdom.ts'],
        },
      },
    ],
  },
});
```

**Project split:**
- **node** — all `*.test.ts` under `lib/` and `app/` (services, repos, routes, HTTP wrappers, pure lib)
- **jsdom** — all `*.test.tsx` and `*.component.test.tsx` under `components/` and `app/` (React component/page tests)

**Jsdom setup (`test/setup-jsdom.ts`):**
```typescript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

## Test File Organization

**Location:** Co-located with source — no separate `__tests__/` or `tests/` tree for application code. Shared test utilities live in `test/`.

**Naming conventions (prescriptive — match existing patterns):**

| Pattern | Scope | Example |
|---------|-------|---------|
| `*.unit.test.ts` | Service/integration unit tests with mocked deps | `lib/services/projects.service.unit.test.ts` |
| `*.repo.test.ts` | Repository integration tests against real Postgres | `lib/repositories/projects.repo.test.ts` |
| `route.test.ts` | API route handler tests (mocked session/DB or repo boundary) | `app/api/projects/route.test.ts` |
| `route.access.test.ts` | Route-level access-control proofs (service + assert run for real) | `app/api/projects/[id]/route.access.test.ts` |
| `*.test.ts` | Pure lib, HTTP wrapper, or cross-cutting specs | `lib/api-errors.test.ts`, `lib/http/route-401-matrix.test.ts` |
| `*.component.test.tsx` | Page or dialog integration tests (jsdom) | `app/projects/[id]/report/page.component.test.tsx` |
| `*.test.tsx` | Simple component smoke tests (jsdom) | `components/ui/badge.test.tsx` |

**Approximate inventory (121 test files, ~840 test cases):**
- 38 `*.unit.test.ts` — services, integrations, export builders, repo unit tests
- 19 `*.repo.test.ts` — repository Postgres integration
- 45 `route.test.ts` — API route handler tests
- 2 `route.access.test.ts` — dedicated access-control suites
- 7 `*.component.test.tsx` — decomposed page tests
- Remaining `*.test.ts(x)` — HTTP wrappers, api-errors, status-weights, badge, route-401-matrix, db

**Structure:**
```
lib/
  services/
    projects.service.ts
    projects.service.unit.test.ts    # mocked repos + access
  repositories/
    projects.repo.ts
    projects.repo.test.ts            # real Postgres (skipIf !hasTestDb)
  http/
    with-auth.ts
    with-auth.test.ts                # wrapper contract tests
app/
  api/projects/
    route.ts
    route.test.ts                    # route handler with mocked getDb
  projects/[id]/report/
    page.tsx
    page.component.test.tsx          # jsdom page test
components/ui/
  badge.tsx
  badge.test.tsx
test/
  db.ts                              # TEST_DATABASE_URL guard
  repo-db.ts                         # TestDbClient + DDL + seed helpers
  setup-jsdom.ts                     # RTL cleanup
```

## Test Structure

**Suite organization (service unit test — canonical):**
```typescript
// lib/services/projects.service.unit.test.ts
const { assertProjectAccess, getProjectRepo, ... } = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  getProjectRepo: vi.fn(),
  // ...
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/projects.repo', () => ({ getProject: getProjectRepo, ... }));

import { getProject } from './projects.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

describe('projects.service', () => {
  describe('getProject', () => {
    it('asserts access before reading', async () => { ... });
    it('throws NotFoundError when the repository returns undefined', async () => { ... });
  });
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
// app/api/projects/[id]/route.access.test.ts
const { projectAccessRow, getProjectRepo, ... } = vi.hoisted(() => ({ ... }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow, getProject: getProjectRepo, ... }));
// Real assertProjectAccess + projects.service run; repos mocked
```

**Component test pattern:**
```typescript
// app/projects/[id]/report/page.component.test.tsx
vi.mock('next/navigation', () => ({ useParams: () => ({ id: '1' }) }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url, init) => { /* route fixtures */ }));
});

describe('ProjectReportPage', () => {
  it('renders after load', async () => {
    render(<ProjectReportPage />);
    await waitFor(() => expect(screen.getByText(/Project Status Report/)).toBeInTheDocument());
  });
});
```

**Patterns:**
- Use `vi.hoisted()` for mock fns referenced inside `vi.mock()` factories
- `beforeEach`: `vi.clearAllMocks()` or per-mock `mockReset()` / `mockResolvedValue`
- `afterEach`: `vi.restoreAllMocks()` when spying on `console.error`
- Import handler under test AFTER mocks are registered
- Assert HTTP status + JSON body shape, not error message leakage

## Mocking

**Framework:** Vitest `vi.mock`, `vi.fn`, `vi.spyOn`, `vi.stubGlobal`, `vi.hoisted`

**What to mock by layer:**

| Layer under test | Mock at boundary | Do NOT mock |
|------------------|------------------|-------------|
| Service unit | repositories, `assertProjectAccess` | The service function itself |
| Route (default) | `getSessionFromRequest`, `getDb` or repo fns | Service logic when proving access wiring |
| Route access | repo fns (`projectAccessRow`, CRUD) | `assertProjectAccess`, service module |
| Integration client | global `fetch` via `vi.stubGlobal` | Credential encoding logic |
| Component/page | `next/navigation`, `fetch`, heavy child components | The page component under test |
| HTTP wrapper | `getSessionFromRequest` only | Error class instanceof checks |

**Common mock targets:**
```typescript
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow: vi.fn(), ... }));
vi.stubGlobal('fetch', fetchMock);  // integration clients
vi.spyOn(console, 'error').mockImplementation(() => undefined);  // suppress + assert logging
```

**What NOT to mock:**
- Pure functions: `lib/status-weights.ts`, `lib/repositories/_helpers.ts` `buildUpdate`
- Typed error classes — use real `instanceof` checks
- `UnknownColumnError`, `ForbiddenError`, etc. — construct real instances in tests

## Fixtures and Factories

**Postgres test infrastructure (`test/db.ts`, `test/repo-db.ts`):**
- `TEST_DATABASE_URL` env var required for repo integration tests
- Database name must end in `_test` (safety guard in `test/db.ts`)
- `testDb()` returns a `DbClient` adapter over a real Postgres pool — mirrors `lib/db.ts` placeholder rewriting (`?` → `$n`, `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`)
- `setupRepoTables()` — minimal DDL matching production column sets
- `seedProject(name, opts?)` — creates test rows
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
};

const ownerSession = { ...session, company_id: 5, is_admin: 0 };
const adminSession = { ...session, is_admin: 1, company_id: null };
const foreignSession = { ...session, company_id: 9 };
```

**Component fixtures:**
- Define report/page payload objects inline in the test file (see `app/projects/[id]/report/page.component.test.tsx` `reportFixture`)
- Stub `fetch` to return fixture JSON per URL pattern

**Location:**
- Shared DB helpers: `test/db.ts`, `test/repo-db.ts`
- Domain fixtures: inline in test files unless reused across 3+ suites

## Coverage

**Requirements:** No enforced coverage threshold or `--coverage` script in `package.json`

**Current gate:** CI runs full `npm test` (~727 passing, ~113 skipped when no Postgres locally)

**View Coverage (if added later):**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests (majority — no I/O):**
- Service layer: every `lib/services/*.service.ts` has a matching `*.service.unit.test.ts`
- Integration clients: `lib/integrations/*/client.unit.test.ts` — mock `fetch`, assert request shape + Zod-validated response
- Export builders: `lib/export/*.unit.test.ts`
- Error mappers: `lib/api-errors.test.ts` — assert status codes, body shapes, no secret/cause leakage
- HTTP wrappers: `lib/http/with-auth.test.ts`, `with-project-access.test.ts`, `with-program-access.test.ts`
- Pure lib: `lib/status-weights.test.ts`, `lib/repositories/_helpers.test.ts`

**Integration Tests (Postgres — `describe.skipIf(!hasTestDb)`):**
- Repository: `lib/repositories/*.repo.test.ts` — real SQL against `pm_tool_test` database
- Route + real repo: `app/api/projects/[id]/route.test.ts` PATCH mass-assignment suite — mocks only session + `getDb`, drives real repository allowlist
- ~21 repo/db suites skipped locally without `TEST_DATABASE_URL`; all run in CI

**Route / API Tests:**
- Per-route `route.test.ts` for handler behavior (401, happy path, error mapping)
- `route.access.test.ts` where access-control wiring needs isolated proof
- `lib/http/route-401-matrix.test.ts` — table-driven 401 invariant for every non-public route + drift check against live `app/api/**/route.ts` glob

**Component Tests (jsdom):**
- Decomposed pages: `*.component.test.tsx` under `app/` — render, wait for load, exercise primary button flows
- UI primitives: `components/ui/badge.test.tsx` — render, variant classes, className merge
- Dialog components: `components/timeline/ImportMappingDialog.component.test.tsx`

**E2E Tests:**
- Not used — no Playwright/Cypress dependency or scripts

## Common Patterns

**Async testing:**
```typescript
const res = await GET(req());
expect(res.status).toBe(401);
await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });

await expect(getProject(7, owner)).rejects.toBeInstanceOf(NotFoundError);
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
const params = () => ({ params: Promise.resolve({ id: String(projectId) }) });
const res = await PATCH(req, params());
```

## CI Pipeline

**GitHub Actions (`.github/workflows/test.yml`):**
- Triggers: push, PR to `master`, manual dispatch
- Postgres 17 service container with database `pm_tool_test`
- Node 22, `npm ci`, `npm test`
- Env: `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pm_tool_test`
- Enables all `describe.skipIf(!hasTestDb)` repo suites in CI

## Special Cases

**`lib/log.test.ts`:** Standalone Node assert script (`npx tsx lib/log.test.ts`), not a Vitest suite — picked up by Vitest glob but has no `describe` blocks. Run manually for log helper verification; exclude or convert if it causes CI noise.

**Drift-checked route matrix (`lib/http/route-401-matrix.test.ts`):**
- Static `ROUTE_MATRIX` literal listing every non-public route + HTTP methods
- Second describe block globs `app/api/**/route.ts`, subtracts `PUBLIC_ROUTES`, fails if matrix is stale
- When adding a new protected route: add entry to `ROUTE_MATRIX` or CI 401 test fails

## Guidance For Adding Tests

1. **New service function:** add cases to `lib/services/<domain>.service.unit.test.ts` — mock repos, assert access order, typed error throws, `UnknownColumnError` passthrough
2. **New repository write path:** add `lib/repositories/<domain>.repo.test.ts` with allowlist rejection tests; use `describe.skipIf(!hasTestDb)`
3. **New API route:** add `route.test.ts` — 401 without session, happy path, error status codes; if route uses `withProjectAccess`, follow `route.access.test.ts` pattern for 403/404
4. **New protected route:** update `ROUTE_MATRIX` in `lib/http/route-401-matrix.test.ts`
5. **New Zod schema:** test invalid body returns 400 via wrapper (see `lib/http/with-auth.test.ts` schema cases)
6. **New page with critical flow:** add `page.component.test.tsx` in jsdom project — mock `fetch` + `next/navigation`
7. **New integration client method:** add to `client.unit.test.ts` — mock fetch, test timeout/upstream/validation branches
8. Run `npm test` locally; set `TEST_DATABASE_URL` to a `*_test` database for repo suites

---

*Testing analysis: 2026-08-25*
