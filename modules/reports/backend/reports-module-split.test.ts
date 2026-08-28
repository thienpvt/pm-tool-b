import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('reports module split contract (24-07)', () => {
  it('S1: portfolio-report.service exposes getPortfolioReport from module path', async () => {
    const mod = await import('@/modules/reports/backend/services/portfolio-report.service');
    expect(typeof mod.getPortfolioReport).toBe('function');
  });

  it('D-11 P1: app/portfolio/report/page.tsx re-exports PortfolioReportPage from module path', () => {
    const source = readUtf8('app/portfolio/report/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/reports\/ui\/portfolio-report\/PortfolioReportPage['"]/,
    );
  });

  it('P2: app/api/portfolio/report/route.ts re-exports GET and POST from module route', () => {
    const source = readUtf8('app/api/portfolio/report/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*POST\s*\}\s*from\s*['"]@\/modules\/reports\/backend\/routes\/portfolio\/report\/route['"]/,
    );
  });

  it('P3 ENF-01: app/api/projects/[id]/report/route.ts contains withProjectAccess(', () => {
    const source = readUtf8('app/api/projects/[id]/report/route.ts');
    expect(source).toContain('withProjectAccess(');
  });

  it('S1: project-report.service exposes getProjectReport from module path', async () => {
    const mod = await import('@/modules/reports/backend/services/project-report.service');
    expect(typeof mod.getProjectReport).toBe('function');
    expect(typeof mod.getWeeklyProjectReport).toBe('function');
  });

  it('P1: app/projects/[id]/report/page.tsx re-exports ProjectReportPage from module path', () => {
    const source = readUtf8('app/projects/[id]/report/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/reports\/ui\/project-report\/ProjectReportPage['"]/,
    );
  });

  it('P1: app/projects/[id]/reports/page.tsx re-exports ProjectReportsListPage from module path', () => {
    const source = readUtf8('app/projects/[id]/reports/page.tsx');
    expect(source).toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/reports\/ui\/project-reports-list\/ProjectReportsListPage['"]/,
    );
  });

  const p3ProjectReportRoutes = [
    'app/api/projects/[id]/report/route.ts',
    'app/api/projects/[id]/project-report/route.ts',
    'app/api/projects/[id]/project-report/generate-email/route.ts',
  ] as const;

  it.each(p3ProjectReportRoutes)(
    'P3 ENF-01: %s contains withProjectAccess( and module handler import',
    (routePath) => {
      const source = readUtf8(routePath);
      expect(source).toContain('withProjectAccess(');
      expect(source).toContain('modules/reports/backend/routes');
    },
  );
});
