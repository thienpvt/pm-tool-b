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
});
