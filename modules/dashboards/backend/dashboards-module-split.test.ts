import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('dashboards module split contract (24-01)', () => {
  it('S1: spec-dashboards.service exposes getPortfolioDashboard from module path', async () => {
    const mod = await import('@/modules/dashboards/backend/services/spec-dashboards.service');
    expect(typeof mod.getPortfolioDashboard).toBe('function');
  });

  it('S2: dashboard-filter-state.repo exposes getDashboardFilters from module path', async () => {
    const mod = await import('@/modules/dashboards/backend/repositories/dashboard-filter-state.repo');
    expect(typeof mod.getDashboardFilters).toBe('function');
  });

  it('P2: app/api/dashboards/portfolio/route.ts re-exports GET from module route', () => {
    const source = readUtf8('app/api/dashboards/portfolio/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*\}\s*from\s*['"]@\/modules\/dashboards\/backend\/routes\/dashboards\/portfolio\/route['"]/,
    );
  });

  it('P1: app/dashboards/portfolio/page.tsx still points at PortfolioDashboardPage', () => {
    const source = readUtf8('app/dashboards/portfolio/page.tsx');
    expect(source).toContain('modules/dashboards/ui/portfolio/PortfolioDashboardPage');
  });

  it('P1: app/dashboards/pm/page.tsx still points at PmDashboardPage', () => {
    const source = readUtf8('app/dashboards/pm/page.tsx');
    expect(source).toContain('modules/dashboards/ui/pm/PmDashboardPage');
  });
});
