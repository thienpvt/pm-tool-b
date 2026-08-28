import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('jira module split contract (24-08)', () => {
  it('D-06: JiraSyncDialog is importable from modules/jira/ui', async () => {
    const mod = await import('@/modules/jira/ui/JiraSyncDialog');
    expect(typeof mod.default).toBe('function');
  });

  it('D-06: BugImportDialog is importable from modules/jira/ui', async () => {
    const mod = await import('@/modules/jira/ui/BugImportDialog');
    expect(typeof mod.default).toBe('function');
  });

  it('P2: app/api/jira/search/route.ts re-exports POST from module route', () => {
    const source = readUtf8('app/api/jira/search/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*POST\s*\}\s*from\s*['"]@\/modules\/jira\/backend\/routes\/jira\/search\/route['"]/,
    );
  });

  it('P3 ENF-01: app/api/import/resource-plan/[id]/route.ts contains withProjectAccess(', () => {
    const source = readUtf8('app/api/import/resource-plan/[id]/route.ts');
    expect(source).toContain('withProjectAccess(');
  });

  it('D-06: ImportMappingDialog is importable from modules/jira/ui/timeline-import', async () => {
    const mod = await import('@/modules/jira/ui/timeline-import/ImportMappingDialog');
    expect(typeof mod.default).toBe('function');
  });

  it('S1: import-mapping.service exposes listTimelineMappings from module path', async () => {
    const mod = await import('@/modules/jira/backend/services/import-mapping.service');
    expect(typeof mod.listTimelineMappings).toBe('function');
  });

  it('S1: jira-mapping.service exposes listJqlPresets from module path', async () => {
    const mod = await import('@/modules/jira/backend/services/jira-mapping.service');
    expect(typeof mod.listJqlPresets).toBe('function');
  });

  const p2JiraRoutes = [
    {
      shell: 'app/api/jira/fields/route.ts',
      target: '@/modules/jira/backend/routes/jira/fields/route',
      methods: 'GET',
    },
    {
      shell: 'app/api/jira/jql-presets/route.ts',
      target: '@/modules/jira/backend/routes/jira/jql-presets/route',
      methods: 'GET, POST',
    },
    {
      shell: 'app/api/jira/jql-presets/[id]/route.ts',
      target: '@/modules/jira/backend/routes/jira/jql-presets/[id]/route',
      methods: 'DELETE',
    },
    {
      shell: 'app/api/jira/sync-mappings/route.ts',
      target: '@/modules/jira/backend/routes/jira/sync-mappings/route',
      methods: 'GET, POST',
    },
    {
      shell: 'app/api/jira/test/route.ts',
      target: '@/modules/jira/backend/routes/jira/test/route',
      methods: 'GET, POST',
    },
    {
      shell: 'app/api/import-mapping/route.ts',
      target: '@/modules/jira/backend/routes/import-mapping/route',
      methods: 'GET, POST',
    },
    {
      shell: 'app/api/import-mapping/[id]/route.ts',
      target: '@/modules/jira/backend/routes/import-mapping/[id]/route',
      methods: 'DELETE, PUT',
    },
    {
      shell: 'app/api/bug-import-mapping/route.ts',
      target: '@/modules/jira/backend/routes/bug-import-mapping/route',
      methods: 'GET, POST',
    },
    {
      shell: 'app/api/bug-import-mapping/[id]/route.ts',
      target: '@/modules/jira/backend/routes/bug-import-mapping/[id]/route',
      methods: 'DELETE',
    },
    {
      shell: 'app/api/parse-file-headers/route.ts',
      target: '@/modules/jira/backend/routes/parse-file-headers/route',
      methods: 'POST',
    },
  ] as const;

  it.each(p2JiraRoutes)('P2: $shell re-exports from module route', ({ shell, target }) => {
    const source = readUtf8(shell);
    expect(source).toMatch(
      new RegExp(`from\\s*['"]${target.replace(/\//g, '\\/')}['"]`),
    );
  });

  it('P3 ENF-01: app/api/import/resource-plan/[id]/route.ts imports module handler', () => {
    const source = readUtf8('app/api/import/resource-plan/[id]/route.ts');
    expect(source).toContain('withProjectAccess(');
    expect(source).toContain('modules/jira/backend/routes/import/resource-plan/[id]/handlers');
  });
});
