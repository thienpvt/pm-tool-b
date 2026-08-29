import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

const CLIENT_DIRECTIVE = /^['"]use client['"]/m;

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function expectPageChromeShell(shell: string, target: string) {
  const source = readUtf8(shell);
  expect(source).toContain('PageChrome');
  expect(source).toContain(target);
  expect(source).not.toMatch(CLIENT_DIRECTIVE);
}

describe('admin module split contract (24-09)', () => {
  it('P1: app/admin/page.tsx wraps AdminPage with PageChrome', () => {
    expectPageChromeShell('app/admin/page.tsx', 'modules/admin/ui/AdminPage');
  });

  it('D-07: companies module route uses getSessionFromRequest and requireAdmin', () => {
    const source = readUtf8('modules/admin/backend/routes/admin/companies/route.ts');
    expect(source).toContain('getSessionFromRequest');
    expect(source).toContain('requireAdmin');
  });

  it('D-07: companies module route does not import @/lib/http/with-role', () => {
    const source = readUtf8('modules/admin/backend/routes/admin/companies/route.ts');
    expect(source).not.toContain('@/lib/http/with-role');
    expect(source).not.toContain('withCpmo');
  });

  it('P4: app/api/admin/companies/route.ts re-exports HTTP methods from module route', () => {
    const source = readUtf8('app/api/admin/companies/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*POST\s*,\s*PUT\s*,\s*DELETE\s*\}\s*from\s*['"]@\/modules\/admin\/backend\/routes\/admin\/companies\/route['"]/,
    );
  });

  it('D-08: eslint allowlist still lists app/api/admin/companies/route.ts', () => {
    const allowlist = readUtf8('eslint/route-wrapper-allowlist.json');
    expect(allowlist).toContain('app/api/admin/companies/route.ts');
  });

  it('S1: users.service lives under modules/admin/backend/services', async () => {
    const mod = await import('@/modules/admin/backend/services/users.service');
    expect(typeof mod.listUsers).toBe('function');
  });

  const p2AdminRoutes = [
    {
      shell: 'app/api/admin/users/route.ts',
      target: '@/modules/admin/backend/routes/admin/users/route',
      methods: 'GET, POST, PUT, DELETE',
    },
    {
      shell: 'app/api/admin/jira-config/[companyId]/route.ts',
      target: '@/modules/admin/backend/routes/admin/jira-config/[companyId]/route',
      methods: 'GET, POST',
    },
    {
      shell: 'app/api/admin/rag-config/[companyId]/route.ts',
      target: '@/modules/admin/backend/routes/admin/rag-config/[companyId]/route',
      methods: 'GET, POST',
    },
    {
      shell: 'app/api/admin/resource-audit/route.ts',
      target: '@/modules/admin/backend/routes/admin/resource-audit/route',
      methods: 'GET, POST',
    },
    {
      shell: 'app/api/admin/demo-requests/route.ts',
      target: '@/modules/admin/backend/routes/admin/demo-requests/route',
      methods: 'GET, PUT, DELETE',
    },
  ] as const;

  it.each(p2AdminRoutes)('P2: $shell re-exports from module route', ({ shell, target }) => {
    const source = readUtf8(shell);
    expect(source).toContain(target);
  });

  const adminRouteTests = [
    'modules/admin/backend/routes/admin/companies/route.test.ts',
    'modules/admin/backend/routes/admin/demo-requests/route.test.ts',
    'modules/admin/backend/routes/admin/resource-audit/route.access.test.ts',
  ] as const;

  it.each(adminRouteTests)(
    'D-09: %s mocks admin-platform.service from module path',
    (testPath) => {
      const source = readUtf8(testPath);
      expect(source).toContain("vi.mock('@/modules/admin/backend/services/admin-platform.service'");
      expect(source).not.toContain("vi.mock('@/lib/services/admin-platform.service'");
    },
  );
});
