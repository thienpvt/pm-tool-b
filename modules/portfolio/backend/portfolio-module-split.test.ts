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

  it('D-11: app/portfolio/report/page.tsx is not yet a modules/reports re-export', () => {
    const source = readUtf8('app/portfolio/report/page.tsx');
    expect(source).not.toContain('modules/reports/ui');
  });
});
