import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function listHandlerFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      listHandlerFiles(full, acc);
    } else if (entry === 'handlers.ts') {
      acc.push(full);
    }
  }
  return acc;
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

  const p1ProjectPages = [
    { shell: 'app/projects/new/page.tsx', target: '@/modules/projects/ui/new/NewProjectPage' },
    {
      shell: 'app/projects/[id]/analysis/page.tsx',
      target: '@/modules/projects/ui/analysis/ProjectAnalysisPage',
    },
    {
      shell: 'app/projects/[id]/budget/page.tsx',
      target: '@/modules/projects/ui/budget/ProjectBudgetPage',
    },
    { shell: 'app/projects/[id]/bugs/page.tsx', target: '@/modules/projects/ui/bugs/ProjectBugsPage' },
    {
      shell: 'app/projects/[id]/communication/page.tsx',
      target: '@/modules/projects/ui/communication/ProjectCommunicationPage',
    },
    {
      shell: 'app/projects/[id]/dashboard/page.tsx',
      target: '@/modules/projects/ui/dashboard/ProjectDashboardPage',
    },
    {
      shell: 'app/projects/[id]/documents/page.tsx',
      target: '@/modules/projects/ui/documents/ProjectDocumentsPage',
    },
    {
      shell: 'app/projects/[id]/resources/page.tsx',
      target: '@/modules/projects/ui/resources/ProjectResourcesPage',
    },
    { shell: 'app/projects/[id]/risks/page.tsx', target: '@/modules/projects/ui/risks/ProjectRisksPage' },
    {
      shell: 'app/projects/[id]/milestones/page.tsx',
      target: '@/modules/projects/ui/milestones/MilestonesPage',
    },
    {
      shell: 'app/projects/[id]/timeline/page.tsx',
      target: '@/modules/projects/ui/timeline/TimelinePage',
    },
  ] as const;

  it.each(p1ProjectPages)('P1: $shell re-exports from module path', ({ shell, target }) => {
    const source = readUtf8(shell);
    expect(source).toMatch(
      new RegExp(
        `export\\s*\\{\\s*default\\s*\\}\\s*from\\s*['"]${target.replace(/\//g, '\\/')}['"]`,
      ),
    );
  });

  it('Wave 7: app/projects/[id]/report/page.tsx re-exports ProjectReportPage from modules/reports', () => {
    const source = readUtf8('app/projects/[id]/report/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/reports\/ui\/project-report\/ProjectReportPage['"]/,
    );
  });

  const p3SampleRoutes = [
    'app/api/projects/[id]/milestones/route.ts',
    'app/api/projects/[id]/risks/route.ts',
    'app/api/projects/[id]/documents/route.ts',
  ] as const;

  it.each(p3SampleRoutes)(
    'P3 ENF-01: %s contains withProjectAccess( and module handler import',
    (routePath) => {
      const source = readUtf8(routePath);
      expect(source).toContain('withProjectAccess(');
      expect(source).toContain('modules/projects/backend/routes');
    },
  );

  it('D-06: weekly-reports app/api does not import projects backend routes', () => {
    const source = readUtf8('app/api/projects/[id]/weekly-reports/route.ts');
    expect(source).not.toContain('modules/projects/backend/routes');
    expect(source).toContain('modules/weekly/backend');
  });

  it('D-06: document-checklist app/api does not import projects backend routes', () => {
    const source = readUtf8('app/api/projects/[id]/document-checklist/route.ts');
    expect(source).not.toContain('modules/projects/backend/routes');
    expect(source).toContain('modules/documents/backend');
  });

  it('D-03: lib/export/word.ts imports documents.repo from module path', () => {
    const source = readUtf8('lib/export/word.ts');
    expect(source).toContain('@/modules/projects/backend/repositories/documents.repo');
    expect(source).not.toContain('@/lib/repositories/documents.repo');
  });

  it('D-03: lib/export/ppt.ts imports documents.repo from module path', () => {
    const source = readUtf8('lib/export/ppt.ts');
    expect(source).toContain('@/modules/projects/backend/repositories/documents.repo');
    expect(source).not.toContain('@/lib/repositories/documents.repo');
  });

  it('D-03: spec-dashboards.service imports raid-masters and projects.repo from module path', () => {
    const source = readUtf8('modules/dashboards/backend/services/spec-dashboards.service.ts');
    expect(source).toContain('@/modules/projects/backend/services/raid-masters.service');
    expect(source).toContain('@/modules/projects/backend/repositories/projects.repo');
  });

  const wave6BrokenHandlers = [
    'modules/projects/backend/routes/projects/[id]/bugs/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/team/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/stakeholders/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/meetings/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/dependencies/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/documents/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/benefits/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/activities/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/budget/[itemId]/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/issues/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/risks/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/holidays/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/escalations/handlers.ts',
    'modules/projects/backend/routes/projects/[id]/milestones/[milestoneId]/epics/handlers.ts',
  ] as const;

  it.each(wave6BrokenHandlers)('P3 Wave 6: %s has clean handler extraction', (handlerPath) => {
    const source = readUtf8(handlerPath);
    expect(source).not.toMatch(/import \{\s*\nimport/);
    expect(source).not.toMatch(/\},\s*\n\s*\{ schema:/);
    expect(source).not.toMatch(/(^|[^_])req\.url/);
  });

  it('P3 Wave 6: all project handlers.ts files pass extraction smoke checks', () => {
    const handlersRoot = resolve(root, 'modules/projects/backend/routes/projects/[id]');
    const handlerFiles = listHandlerFiles(handlersRoot);
    expect(handlerFiles.length).toBeGreaterThan(0);
    for (const absPath of handlerFiles) {
      const source = readFileSync(absPath, 'utf8');
      expect(source).not.toMatch(/import \{\s*\nimport/);
      expect(source).not.toMatch(/\},\s*\n\s*\{ schema:/);
      expect(source).not.toMatch(/(^|[^_])req\.url/);
    }
  });

  it('P3 MOD-02: milestones/[milestoneId]/route.ts imports schema from module path', () => {
    const source = readUtf8('app/api/projects/[id]/milestones/[milestoneId]/route.ts');
    expect(source).toContain('@/modules/projects/backend/routes/projects/[id]/milestones/schema');
    expect(source).not.toMatch(/from ['"]\.\.\/schema['"]/);
  });
});
