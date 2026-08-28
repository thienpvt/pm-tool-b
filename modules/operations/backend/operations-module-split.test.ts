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
});
