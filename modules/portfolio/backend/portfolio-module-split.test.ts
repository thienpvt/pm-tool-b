import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('portfolio module split contract (24-05)', () => {
  it('S1: portfolio.service exposes getPortfolioSummary from module path', async () => {
    const mod = await import('@/modules/portfolio/backend/services/portfolio.service');
    expect(typeof mod.getPortfolioSummary).toBe('function');
  });

  it('P1: app/page.tsx re-exports PortfolioHomePage from module path', () => {
    const source = readUtf8('app/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/portfolio\/ui\/home\/PortfolioHomePage['"]/,
    );
  });

  it('P2: app/api/portfolio/route.ts re-exports GET from module route', () => {
    const source = readUtf8('app/api/portfolio/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*\}\s*from\s*['"]@\/modules\/portfolio\/backend\/routes\/portfolio\/route['"]/,
    );
  });

  it('P3 ENF-01: app/api/programs/[id]/route.ts contains withProgramAccess(', () => {
    const source = readUtf8('app/api/programs/[id]/route.ts');
    expect(source).toContain('withProgramAccess(');
  });

  it('D-11: app/portfolio/report/page.tsx re-exports from modules/reports (Wave 7)', () => {
    const source = readUtf8('app/portfolio/report/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/reports\/ui\/portfolio-report\/PortfolioReportPage['"]/,
    );
  });

  const p1PortfolioPages = [
    {
      shell: 'app/portfolio/budget/page.tsx',
      target: '@/modules/portfolio/ui/budget/PortfolioBudgetPage',
    },
    {
      shell: 'app/portfolio/roadmap/page.tsx',
      target: '@/modules/portfolio/ui/roadmap/RoadmapPage',
    },
    {
      shell: 'app/portfolio/resources/page.tsx',
      target: '@/modules/portfolio/ui/resources/PortfolioResourcesPage',
    },
    {
      shell: 'app/programs/page.tsx',
      target: '@/modules/portfolio/ui/programs/ProgramsPage',
    },
    {
      shell: 'app/resources/page.tsx',
      target: '@/modules/portfolio/ui/members/ResourcesMembersPage',
    },
  ] as const;

  it.each(p1PortfolioPages)('P1: $shell re-exports from module path', ({ shell, target }) => {
    const source = readUtf8(shell);
    expect(source).toMatch(
      new RegExp(
        `export\\s*\\{\\s*default\\s*\\}\\s*from\\s*['"]${target.replace(/\//g, '\\/')}['"]`,
      ),
    );
  });

  it('D-11: app/portfolio/report/page.tsx is a thin P1 shell (Wave 7)', () => {
    const source = readUtf8('app/portfolio/report/page.tsx');
    expect(source).not.toContain('export default function PortfolioReportPage');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/reports\/ui/,
    );
  });

  it('P2: app/api/programs/route.ts re-exports GET and POST from module route', () => {
    const source = readUtf8('app/api/programs/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*POST\s*\}\s*from\s*['"]@\/modules\/portfolio\/backend\/routes\/programs\/route['"]/,
    );
  });

  it('P2: app/api/resources/route.ts re-exports GET from module route', () => {
    const source = readUtf8('app/api/resources/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*\}\s*from\s*['"]@\/modules\/portfolio\/backend\/routes\/resources\/route['"]/,
    );
  });

  it('D-11: app/api/portfolio/report/route.ts re-exports from modules/reports (Wave 7)', () => {
    const source = readUtf8('app/api/portfolio/report/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*POST\s*\}\s*from\s*['"]@\/modules\/reports\/backend\/routes\/portfolio\/report\/route['"]/,
    );
  });

  const p3ProgramRoutes = [
    'app/api/programs/[id]/route.ts',
    'app/api/programs/[id]/project-allocations/route.ts',
  ] as const;

  it.each(p3ProgramRoutes)(
    'P3 ENF-01: %s contains withProgramAccess( and module handler import',
    (routePath) => {
      const source = readUtf8(routePath);
      expect(source).toContain('withProgramAccess(');
      expect(source).toContain('modules/portfolio/backend/routes');
    },
  );

  it('D-03: fiscal-budget project routes import fiscal-budget.service from module path', () => {
    for (const routePath of [
      'app/api/projects/[id]/fiscal-budget/route.ts',
      'app/api/projects/[id]/fiscal-budget/[budgetId]/adjustments/route.ts',
    ]) {
      const source = readUtf8(routePath);
      expect(source).toContain('@/modules/portfolio/backend/services/fiscal-budget.service');
      expect(source).not.toContain('@/lib/services/fiscal-budget.service');
    }
  });

  it('D-03: lib/services/roi.service.ts imports fiscal-budget.repo from module path', () => {
    const source = readUtf8('lib/services/roi.service.ts');
    expect(source).toContain('@/modules/portfolio/backend/repositories/fiscal-budget.repo');
    expect(source).not.toContain('@/lib/repositories/fiscal-budget.repo');
  });

  it('D-03: lib/services/projects.service.ts imports programs.repo from module path', () => {
    const source = readUtf8('lib/services/projects.service.ts');
    expect(source).toContain('@/modules/portfolio/backend/repositories/programs.repo');
    expect(source).not.toContain('@/lib/repositories/programs.repo');
  });

  it('D-03: portfolio-report.service and export/portfolio/members use module repo paths', () => {
    const reportSource = readUtf8('modules/reports/backend/services/portfolio-report.service.ts');
    expect(reportSource).toContain('@/modules/portfolio/backend/repositories/portfolio.repo');
    expect(reportSource).toContain('@/modules/portfolio/backend/repositories/programs.repo');
    expect(reportSource).not.toContain('@/lib/repositories/portfolio.repo');
    expect(reportSource).not.toContain('@/lib/repositories/programs.repo');

    const exportSource = readUtf8('modules/reports/backend/routes/export/portfolio/members/route.ts');
    expect(exportSource).toContain('@/modules/portfolio/backend/repositories/portfolio.repo');
    expect(exportSource).not.toContain('@/lib/repositories/portfolio.repo');
  });

  it('D-03: lib/http/with-program-access.ts imports programs.service from module path', () => {
    const source = readUtf8('lib/http/with-program-access.ts');
    expect(source).toContain('@/modules/portfolio/backend/services/programs.service');
    expect(source).not.toContain('@/lib/services/programs.service');
  });
});
