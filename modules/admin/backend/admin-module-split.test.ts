import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('admin module split contract (24-09)', () => {
  it('P1: app/admin/page.tsx re-exports AdminPage from module path', () => {
    const source = readUtf8('app/admin/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/admin\/ui\/AdminPage['"]/,
    );
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
});
