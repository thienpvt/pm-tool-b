/// <reference types="vite/client" />
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Table-driven, drift-checked 401 invariant (ROUTE-09/ROUTE-10, phase 06-06).
 *
 * ROUTE_MATRIX below is a static list of every non-public route.ts under
 * app/api/** plus the HTTP methods it exports. For each entry, this spec:
 *   1. Mocks getSessionFromRequest -> null (no session) and getDb -> throws
 *      (a DB reach during a 401 test is itself a bug: the wrapper 401s BEFORE
 *      any repo/service call, so nothing should ever touch the DB layer).
 *   2. Imports the route module via Vite's import.meta.glob (eager, so every
 *      route file is loaded once at spec load — a broken import anywhere
 *      fails the whole file, which is also useful signal).
 *   3. Calls each exported handler with a minimal NextRequest and a params
 *      superset (id/itemId/expId/milestoneId/allocId/catId/companyId/incId/
 *      type) — the wrapper or the route's own getSessionFromRequest check
 *      401s BEFORE params/body are ever read (with-auth.ts:94-95), so a dummy
 *      params object is sufficient for every group.
 *   4. Asserts status === 401 and the DB canary was never invoked.
 *
 * A SECOND describe block (below) is the drift check: it globs the same
 * app/api/**\/route.ts tree independently, subtracts PUBLIC_ROUTES, and
 * fails if any non-public route+method is missing from ROUTE_MATRIX. That
 * is what turns "we wrote a 401 test for each route" into "every route HAS
 * a 401 assertion, forever" (T-06-20).
 */

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type MatrixGroup =
  | 'wrapped-project'
  | 'wrapped-program'
  | 'wrapped-auth'
  | 'legacy-getSessionFromRequest';

type MatrixEntry = { path: string; methods: HttpMethod[]; group: MatrixGroup };

// ─── Public routes (excluded from the matrix — no session required) ──────────
// auth/login, auth/logout: establish/destroy the session itself.
// health: unauthenticated liveness probe (K8s/Railway).
// demo-requests: public marketing lead-capture form.
// NOTE: auth/me DOES check session (401 on none) — it is NOT public, and IS
// in ROUTE_MATRIX below (legacy-getSessionFromRequest group).
const PUBLIC_ROUTES = new Set<string>([
  '/app/api/auth/login/route.ts',
  '/app/api/auth/logout/route.ts',
  '/app/api/health/route.ts',
  '/app/api/demo-requests/route.ts',
]);

// ─── The matrix ────────────────────────────────────────────────────────────
// Generated from a one-time scan of every app/api/**/route.ts file (methods
// exported + which wrapper/pattern gates the session). Kept as a literal so
// review sees exactly what's asserted — the drift check below is what keeps
// it honest over time, not a live re-scan at test time.
const ROUTE_MATRIX: MatrixEntry[] = [
  { path: '/app/api/admin/companies/route.ts', methods: ['GET', 'POST', 'PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/admin/demo-requests/route.ts', methods: ['GET', 'PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/admin/jira-config/[companyId]/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/admin/rag-config/[companyId]/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/admin/resource-audit/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/admin/users/route.ts', methods: ['GET', 'POST', 'PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/auth/change-password/route.ts', methods: ['POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/auth/complete-onboarding/route.ts', methods: ['POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/auth/me/route.ts', methods: ['GET'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/auth/session/extend/route.ts', methods: ['POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/bug-import-mapping/[id]/route.ts', methods: ['DELETE'], group: 'wrapped-auth' },
  { path: '/app/api/bug-import-mapping/route.ts', methods: ['GET', 'POST'], group: 'wrapped-auth' },
  { path: '/app/api/config/route.ts', methods: ['GET', 'POST'], group: 'wrapped-auth' },
  { path: '/app/api/export/excel/[id]/route.ts', methods: ['GET'], group: 'wrapped-project' },
  { path: '/app/api/export/portfolio/members/route.ts', methods: ['GET'], group: 'wrapped-auth' },
  { path: '/app/api/export/ppt/[id]/route.ts', methods: ['POST'], group: 'wrapped-project' },
  { path: '/app/api/export/resource-plan/[id]/route.ts', methods: ['GET'], group: 'wrapped-project' },
  { path: '/app/api/export/weekly-report/[id]/route.ts', methods: ['POST'], group: 'wrapped-project' },
  { path: '/app/api/export/word/[id]/[type]/route.ts', methods: ['GET'], group: 'wrapped-project' },
  { path: '/app/api/import-mapping/[id]/route.ts', methods: ['DELETE', 'PUT'], group: 'wrapped-auth' },
  { path: '/app/api/import-mapping/route.ts', methods: ['GET', 'POST'], group: 'wrapped-auth' },
  { path: '/app/api/import/resource-plan/[id]/route.ts', methods: ['POST'], group: 'wrapped-project' },
  { path: '/app/api/jira/fields/route.ts', methods: ['GET'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/jira/jql-presets/[id]/route.ts', methods: ['DELETE'], group: 'wrapped-auth' },
  { path: '/app/api/jira/jql-presets/route.ts', methods: ['GET', 'POST'], group: 'wrapped-auth' },
  { path: '/app/api/jira/search/route.ts', methods: ['POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/jira/sync-mappings/route.ts', methods: ['GET', 'POST'], group: 'wrapped-auth' },
  { path: '/app/api/jira/test/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/operations/systems/[id]/budget-items/[itemId]/route.ts', methods: ['PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/operations/systems/[id]/budget-items/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/operations/systems/[id]/expenses/[expId]/route.ts', methods: ['DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/operations/systems/[id]/expenses/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/operations/systems/[id]/incidents/[incId]/route.ts', methods: ['PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/operations/systems/[id]/incidents/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/operations/systems/[id]/route.ts', methods: ['GET', 'PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/operations/systems/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/parse-file-headers/route.ts', methods: ['POST'], group: 'wrapped-auth' },
  { path: '/app/api/portfolio/budgets/[id]/allocations/[allocId]/route.ts', methods: ['PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/budgets/[id]/allocations/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/budgets/[id]/categories/[catId]/route.ts', methods: ['PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/budgets/[id]/categories/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/budgets/[id]/route.ts', methods: ['GET', 'PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/budgets/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/bug-assignees/route.ts', methods: ['GET'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/members/[id]/route.ts', methods: ['PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/members/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/milestones/route.ts', methods: ['GET'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/program-allocations/[id]/route.ts', methods: ['PUT', 'DELETE'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/program-allocations/route.ts', methods: ['GET', 'POST'], group: 'wrapped-auth' },
  { path: '/app/api/portfolio/quota/route.ts', methods: ['GET', 'PUT'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/report/generate-email/route.ts', methods: ['POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/report/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/report/send-email/route.ts', methods: ['POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/roadmap/epics/route.ts', methods: ['GET'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/roadmap/route.ts', methods: ['GET'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/portfolio/route.ts', methods: ['GET'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/programs/[id]/project-allocations/route.ts', methods: ['GET', 'POST'], group: 'wrapped-program' },
  { path: '/app/api/programs/[id]/route.ts', methods: ['GET', 'PUT', 'DELETE'], group: 'wrapped-program' },
  { path: '/app/api/programs/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/projects/[id]/activities/import/route.ts', methods: ['POST', 'GET'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/activities/route.ts', methods: ['GET', 'POST', 'PUT', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/budget/[itemId]/expenses/[expId]/route.ts', methods: ['DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/budget/[itemId]/expenses/route.ts', methods: ['GET', 'POST'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/budget/[itemId]/route.ts', methods: ['PUT', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/budget/route.ts', methods: ['GET', 'POST'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/bugs/route.ts', methods: ['GET', 'POST', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/documents/route.ts', methods: ['GET', 'POST', 'PUT', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/escalations/route.ts', methods: ['GET', 'PUT'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/holidays/route.ts', methods: ['GET', 'POST', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/issues/route.ts', methods: ['GET', 'POST', 'PUT', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/meetings/route.ts', methods: ['GET', 'POST', 'PUT', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/milestones/[milestoneId]/epics/route.ts', methods: ['GET', 'POST', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/milestones/[milestoneId]/route.ts', methods: ['PUT', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/milestones/route.ts', methods: ['GET', 'POST'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/project-report/generate-email/route.ts', methods: ['POST'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/project-report/route.ts', methods: ['GET', 'POST'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/report/route.ts', methods: ['GET', 'POST'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/pm-assignments/route.ts', methods: ['GET', 'POST', 'PATCH'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/risks/route.ts', methods: ['GET', 'POST', 'PUT', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/route.ts', methods: ['GET', 'PATCH', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/stakeholders/route.ts', methods: ['GET', 'POST', 'PATCH'], group: 'wrapped-project' },
  { path: '/app/api/projects/[id]/team/route.ts', methods: ['GET', 'POST', 'PUT', 'DELETE'], group: 'wrapped-project' },
  { path: '/app/api/projects/route.ts', methods: ['GET', 'POST'], group: 'legacy-getSessionFromRequest' },
  { path: '/app/api/resources/route.ts', methods: ['GET'], group: 'legacy-getSessionFromRequest' },
];

// ─── Mocks ─────────────────────────────────────────────────────────────────
const { getSessionFromRequest, dbCanary } = vi.hoisted(() => ({
  getSessionFromRequest: vi.fn(),
  dbCanary: vi.fn(),
}));

// Preserve unauthorized()/forbidden() (used by several legacy requireAdmin
// routes) while overriding only getSessionFromRequest.
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, getSessionFromRequest };
});
// A null session must 401 BEFORE any DB access. If getDb() is ever reached
// during one of these tests, that is itself the bug the matrix exists to
// catch (T-06-21) — fail loudly rather than let a real query run.
vi.mock('@/lib/db', () => ({ getDb: dbCanary }));

// Eagerly import every route module once — a broken import anywhere in the
// tree fails this whole spec file, which is useful signal on its own.
const routeModules = import.meta.glob<Record<string, RouteFn>>('/app/api/**/route.ts', { eager: true });

type RouteFn = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;

// Superset of every dynamic segment name used anywhere under app/api/** —
// the wrapper (or the route's own getSessionFromRequest check) 401s before
// params are ever read, so one dummy object covers every route.
function dummyParams() {
  return Promise.resolve({
    id: '1',
    itemId: '1',
    expId: '1',
    milestoneId: '1',
    allocId: '1',
    catId: '1',
    companyId: '1',
    incId: '1',
    type: 'document',
  });
}

function req(method: HttpMethod, url = 'http://localhost/api/x'): NextRequest {
  return new NextRequest(url, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionFromRequest.mockResolvedValue(null);
  dbCanary.mockRejectedValue(new Error('DB reached during a 401 (no-session) test — the wrapper should have short-circuited before any repo/service call'));
});

describe('401 matrix: every non-public route denies a null session', () => {
  for (const entry of ROUTE_MATRIX) {
    describe(entry.path, () => {
      for (const method of entry.methods) {
        it(`${method} returns 401 with no session and never reaches the DB`, async () => {
          const mod = routeModules[entry.path];
          expect(mod, `route module not found for ${entry.path} — check the glob key format`).toBeDefined();
          const handler = mod[method];
          expect(handler, `${method} not exported by ${entry.path}`).toBeTypeOf('function');

          const res = await handler(req(method), { params: dummyParams() });

          expect(res.status).toBe(401);
          expect(dbCanary).not.toHaveBeenCalled();
        });
      }
    });
  }
});

// ─── Drift check (T-06-20) ─────────────────────────────────────────────────
// Independently enumerates every app/api/**/route.ts + its exported methods,
// subtracts PUBLIC_ROUTES, and fails if anything is missing from
// ROUTE_MATRIX above (or if ROUTE_MATRIX references a route/method that no
// longer exists). This is what makes "add a route, forget the 401 test"
// impossible to ship silently.
describe('401 matrix drift check', () => {
  const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  function actualRoutes(): Map<string, HttpMethod[]> {
    const map = new Map<string, HttpMethod[]>();
    for (const [key, mod] of Object.entries(routeModules)) {
      if (PUBLIC_ROUTES.has(key)) continue;
      const methods = HTTP_METHODS.filter((m) => typeof mod[m] === 'function');
      map.set(key, methods);
    }
    return map;
  }

  it('every non-public route.ts + exported method is present in ROUTE_MATRIX', () => {
    const actual = actualRoutes();
    const matrixByPath = new Map(ROUTE_MATRIX.map((e) => [e.path, new Set(e.methods)]));

    const missing: string[] = [];
    for (const [path, methods] of actual) {
      const covered = matrixByPath.get(path);
      if (!covered) {
        missing.push(`${path}: entire file missing from ROUTE_MATRIX`);
        continue;
      }
      for (const m of methods) {
        if (!covered.has(m)) missing.push(`${path}: ${m} exported but not in ROUTE_MATRIX`);
      }
    }

    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('ROUTE_MATRIX has no stale entries (route/method removed from app/api but still listed)', () => {
    const actual = actualRoutes();

    const stale: string[] = [];
    for (const entry of ROUTE_MATRIX) {
      const actualMethods = actual.get(entry.path);
      if (!actualMethods) {
        stale.push(`${entry.path}: file no longer exists (or is now public)`);
        continue;
      }
      for (const m of entry.methods) {
        if (!actualMethods.includes(m)) stale.push(`${entry.path}: ${m} listed but no longer exported`);
      }
    }

    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('auth/me is covered (it 401s — not in the public skip list)', () => {
    expect(PUBLIC_ROUTES.has('/app/api/auth/me/route.ts')).toBe(false);
    const entry = ROUTE_MATRIX.find((e) => e.path === '/app/api/auth/me/route.ts');
    expect(entry?.methods).toContain('GET');
  });

  it('the 4 public routes are excluded from both the matrix and the drift scan', () => {
    for (const publicPath of PUBLIC_ROUTES) {
      expect(ROUTE_MATRIX.some((e) => e.path === publicPath)).toBe(false);
    }
    expect(PUBLIC_ROUTES.size).toBe(4);
  });

  // Self-test (manual proof, documented per 06-06-02 acceptance criteria):
  // temporarily delete any ROUTE_MATRIX row above (e.g. comment out the
  // 'auth/me' line) and re-run this file — the first drift-check test fails
  // with "GET exported but not in ROUTE_MATRIX", proving the check is live.
});
