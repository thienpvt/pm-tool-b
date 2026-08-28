import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('projects module split contract (24-06)', () => {
  it('S1: projects.service exposes listProjects from module path', async () => {
    const mod = await import('@/modules/projects/backend/services/projects.service');
    expect(typeof mod.listProjects).toBe('function');
  });

  it('P1: app/projects/page.tsx re-exports ProjectsListPage from module path', () => {
    const source = readUtf8('app/projects/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/projects\/ui\/list\/ProjectsListPage['"]/,
    );
  });

  it('P1: app/projects/[id]/page.tsx re-exports ProjectHubPage from module path', () => {
    const source = readUtf8('app/projects/[id]/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/projects\/ui\/hub\/ProjectHubPage['"]/,
    );
  });

  it('P2: app/api/projects/route.ts re-exports GET and POST from module route', () => {
    const source = readUtf8('app/api/projects/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*POST\s*\}\s*from\s*['"]@\/modules\/projects\/backend\/routes\/projects\/route['"]/,
    );
  });

  it('P3 ENF-01: app/api/projects/[id]/route.ts contains withProjectAccess(', () => {
    const source = readUtf8('app/api/projects/[id]/route.ts');
    expect(source).toContain('withProjectAccess(');
    expect(source).toContain('modules/projects/backend/routes');
  });

  it('D-06: weekly-reports page still re-exports WeeklyReportEditorPage', () => {
    const source = readUtf8('app/projects/[id]/weekly-reports/[reportId]/page.tsx');
    expect(source).toContain('modules/weekly/ui/report/WeeklyReportEditorPage');
  });

  it('D-06: document-checklist page still re-exports ProjectChecklistPage', () => {
    const source = readUtf8('app/projects/[id]/document-checklist/page.tsx');
    expect(source).toContain('modules/documents/ui/checklist/ProjectChecklistPage');
  });
});
