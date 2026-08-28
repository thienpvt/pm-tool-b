import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('operations module split contract (24-10)', () => {
  it('P1: app/operations/page.tsx re-exports OperationsListPage from module path', () => {
    const source = readUtf8('app/operations/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/operations\/ui\/OperationsListPage['"]/,
    );
  });

  it('P1: app/operations/[id]/page.tsx re-exports OperationsDetailPage from module path', () => {
    const source = readUtf8('app/operations/[id]/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/operations\/ui\/OperationsDetailPage['"]/,
    );
  });

  it('D-07: systems module route uses getSessionFromRequest', () => {
    const source = readUtf8('modules/operations/backend/routes/operations/systems/route.ts');
    expect(source).toContain('getSessionFromRequest');
  });

  it('D-07: systems module route does not import @/lib/http/with-role', () => {
    const source = readUtf8('modules/operations/backend/routes/operations/systems/route.ts');
    expect(source).not.toContain('@/lib/http/with-role');
    expect(source).not.toContain('withCpmo');
  });

  it('P4: app/api/operations/systems/route.ts re-exports HTTP methods from module route', () => {
    const source = readUtf8('app/api/operations/systems/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*POST\s*\}\s*from\s*['"]@\/modules\/operations\/backend\/routes\/operations\/systems\/route['"]/,
    );
  });

  it('D-08: eslint allowlist still lists app/api/operations/systems/route.ts', () => {
    const allowlist = readUtf8('eslint/route-wrapper-allowlist.json');
    expect(allowlist).toContain('app/api/operations/systems/route.ts');
  });

  const priorFeatureBackends = [
    'dashboards',
    'audit',
    'weekly',
    'documents',
    'portfolio',
    'projects',
    'reports',
    'jira',
    'admin',
  ] as const;

  it.each(priorFeatureBackends)('MOD-01 closeout: modules/%s/backend exists', (feature) => {
    expect(existsSync(resolve(root, `modules/${feature}/backend`))).toBe(true);
  });

  it('MOD-01 closeout: modules/operations/backend exists', () => {
    expect(existsSync(resolve(root, 'modules/operations/backend'))).toBe(true);
  });

  const expectedAllowlist = [
    'app/api/health/route.ts',
    'app/api/admin/companies/route.ts',
    'app/api/operations/systems/route.ts',
    'app/api/operations/systems/[id]/route.ts',
    'app/api/operations/systems/[id]/budget-items/route.ts',
    'app/api/operations/systems/[id]/budget-items/[itemId]/route.ts',
    'app/api/operations/systems/[id]/expenses/route.ts',
    'app/api/operations/systems/[id]/expenses/[expId]/route.ts',
    'app/api/operations/systems/[id]/incidents/route.ts',
    'app/api/operations/systems/[id]/incidents/[incId]/route.ts',
  ] as const;

  it('D-08: eslint allowlist JSON contents unchanged (health, companies, operations paths)', () => {
    const allowlist = JSON.parse(readUtf8('eslint/route-wrapper-allowlist.json')) as string[];
    expect(allowlist).toEqual([...expectedAllowlist]);
  });

  it('D-07 regression: admin companies module route does not import @/lib/http/with-role', () => {
    const source = readUtf8('modules/admin/backend/routes/admin/companies/route.ts');
    expect(source).not.toContain('@/lib/http/with-role');
    expect(source).not.toContain('withCpmo');
  });

  const nestedOperationsRoutes = [
    {
      shell: 'app/api/operations/systems/[id]/route.ts',
      module: 'modules/operations/backend/routes/operations/systems/[id]/route.ts',
      target: '@/modules/operations/backend/routes/operations/systems/[id]/route',
    },
    {
      shell: 'app/api/operations/systems/[id]/budget-items/route.ts',
      module: 'modules/operations/backend/routes/operations/systems/[id]/budget-items/route.ts',
      target: '@/modules/operations/backend/routes/operations/systems/[id]/budget-items/route',
    },
    {
      shell: 'app/api/operations/systems/[id]/budget-items/[itemId]/route.ts',
      module: 'modules/operations/backend/routes/operations/systems/[id]/budget-items/[itemId]/route.ts',
      target: '@/modules/operations/backend/routes/operations/systems/[id]/budget-items/[itemId]/route',
    },
    {
      shell: 'app/api/operations/systems/[id]/expenses/route.ts',
      module: 'modules/operations/backend/routes/operations/systems/[id]/expenses/route.ts',
      target: '@/modules/operations/backend/routes/operations/systems/[id]/expenses/route',
    },
    {
      shell: 'app/api/operations/systems/[id]/expenses/[expId]/route.ts',
      module: 'modules/operations/backend/routes/operations/systems/[id]/expenses/[expId]/route.ts',
      target: '@/modules/operations/backend/routes/operations/systems/[id]/expenses/[expId]/route',
    },
    {
      shell: 'app/api/operations/systems/[id]/incidents/route.ts',
      module: 'modules/operations/backend/routes/operations/systems/[id]/incidents/route.ts',
      target: '@/modules/operations/backend/routes/operations/systems/[id]/incidents/route',
    },
    {
      shell: 'app/api/operations/systems/[id]/incidents/[incId]/route.ts',
      module: 'modules/operations/backend/routes/operations/systems/[id]/incidents/[incId]/route.ts',
      target: '@/modules/operations/backend/routes/operations/systems/[id]/incidents/[incId]/route',
    },
  ] as const;

  it.each(nestedOperationsRoutes)('P4: $shell re-exports from module route', ({ shell, target }) => {
    const source = readUtf8(shell);
    expect(source).toContain(target);
  });

  it.each(nestedOperationsRoutes)('D-07: $module uses getSessionFromRequest and omits with-role', ({ module: modulePath }) => {
    const source = readUtf8(modulePath);
    expect(source).toContain('getSessionFromRequest');
    expect(source).not.toContain('@/lib/http/with-role');
    expect(source).not.toContain('withCpmo');
  });

  const operationsRouteTests = [
    'modules/operations/backend/routes/operations/systems/route.test.ts',
    'modules/operations/backend/routes/operations/systems/[id]/route.test.ts',
    'modules/operations/backend/routes/operations/systems/[id]/budget-items/route.test.ts',
    'modules/operations/backend/routes/operations/systems/[id]/expenses/route.test.ts',
    'modules/operations/backend/routes/operations/systems/[id]/incidents/route.test.ts',
  ] as const;

  it.each(operationsRouteTests)(
    'D-09: %s mocks operations.service from module path',
    (testPath) => {
      const source = readUtf8(testPath);
      expect(source).toContain("vi.mock('@/modules/operations/backend/services/operations.service'");
      expect(source).not.toContain("vi.mock('@/lib/services/operations.service'");
    },
  );
});
