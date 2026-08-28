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
});
