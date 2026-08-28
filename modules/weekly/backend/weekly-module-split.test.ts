import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('weekly module split contract (24-03)', () => {
  it('S1: weekly-reports.service exposes listWeeklyPeriods from module path', async () => {
    const mod = await import('@/modules/weekly/backend/services/weekly-reports.service');
    expect(typeof mod.listWeeklyPeriods).toBe('function');
  });

  it('P2: app/api/weekly-periods/route.ts re-exports GET and POST from module route', () => {
    const source = readUtf8('app/api/weekly-periods/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*POST\s*\}\s*from\s*['"]@\/modules\/weekly\/backend\/routes\/weekly-periods\/route['"]/,
    );
  });

  it('P3: app/api/projects/[id]/weekly-reports/route.ts contains withProjectAccess(', () => {
    const source = readUtf8('app/api/projects/[id]/weekly-reports/route.ts');
    expect(source).toContain('withProjectAccess(');
    expect(source).not.toMatch(
      /export\s*\{\s*GET\s*\}\s*from\s*['"]@\/modules\/weekly\/backend\/routes\/projects\/\[id\]\/weekly-reports\/route['"]/,
    );
  });

  it('P3: app/api/export/weekly-report/[id]/route.ts contains withProjectAccess(', () => {
    const source = readUtf8('app/api/export/weekly-report/[id]/route.ts');
    expect(source).toContain('withProjectAccess(');
  });

  it('P1: app/weekly/periods/page.tsx still points at WeeklyPeriodsPage', () => {
    const source = readUtf8('app/weekly/periods/page.tsx');
    expect(source).toContain('modules/weekly/ui/periods/WeeklyPeriodsPage');
  });

  it('P1: app/projects/[id]/weekly-reports/[reportId]/page.tsx still points at WeeklyReportEditorPage', () => {
    const source = readUtf8('app/projects/[id]/weekly-reports/[reportId]/page.tsx');
    expect(source).toContain('modules/weekly/ui/report/WeeklyReportEditorPage');
  });
});
