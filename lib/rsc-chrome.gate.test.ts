import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

const root = resolve(__dirname, '..');

const CLIENT_DIRECTIVE = /^['"]use client['"]/m;

/** Non-comment lines only — ignore // and block-comment * prefixes. */
function codeLines(source: string): string[] {
  return source
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('*'));
}

const LAYOUT_SHELLS = [
  'components/layout/PageChrome.tsx',
  'components/layout/PageLoadingShell.tsx',
  'components/layout/PageErrorShell.tsx',
];

const CHROME_ROUTES: { route: string; moduleImport: string }[] = [
  {
    route: 'app/dashboards/portfolio/page.tsx',
    moduleImport: 'modules/dashboards/ui/portfolio/PortfolioDashboardPage',
  },
  {
    route: 'app/dashboards/pm/page.tsx',
    moduleImport: 'modules/dashboards/ui/pm/PmDashboardPage',
  },
  {
    route: 'app/weekly/periods/page.tsx',
    moduleImport: 'modules/weekly/ui/periods/WeeklyPeriodsPage',
  },
  {
    route: 'app/audit/page.tsx',
    moduleImport: 'modules/audit/ui/AuditLogPage',
  },
];

const MODULE_PAGES_NO_SIDEBAR: { path: string; label: string }[] = [
  { path: 'modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx', label: 'PortfolioDashboardPage' },
  { path: 'modules/dashboards/ui/pm/PmDashboardPage.tsx', label: 'PmDashboardPage' },
  { path: 'modules/weekly/ui/periods/WeeklyPeriodsPage.tsx', label: 'WeeklyPeriodsPage' },
  { path: 'modules/audit/ui/AuditLogPage.tsx', label: 'AuditLogPage' },
];

export const PILOT_LOADING: { path: string; message: string }[] = [
  { path: 'app/dashboards/portfolio/loading.tsx', message: 'Loading dashboard…' },
  { path: 'app/dashboards/pm/loading.tsx', message: 'Loading dashboard…' },
  { path: 'app/weekly/periods/loading.tsx', message: 'Loading weekly periods…' },
  { path: 'app/audit/loading.tsx', message: 'Loading audit log…' },
];

describe('rsc-chrome gates (26-01, PERF-02, D-01, D-02, D-03, D-05)', () => {
  it('D-01/D-03: layout shell files exist as Server Components without client directive', () => {
    for (const rel of LAYOUT_SHELLS) {
      const full = join(root, rel);
      expect(existsSync(full), `${rel} must exist`).toBe(true);
      const source = readFileSync(full, 'utf8');
      expect(source, `${rel} must not be a Client Component`).not.toMatch(CLIENT_DIRECTIVE);
    }
  });

  it('D-01/D-02: PageChrome renders Sidebar inside min-h-screen bg-slate-50 shell', () => {
    const source = readFileSync(join(root, 'components/layout/PageChrome.tsx'), 'utf8');
    expect(source).toContain('Sidebar');
    expect(source).toMatch(/min-h-screen\s+bg-slate-50/);
    expect(source).toMatch(/<main\b/);
  });

  it('D-01: app/layout.tsx stays a Server Component', () => {
    const source = readFileSync(join(root, 'app/layout.tsx'), 'utf8');
    expect(source).not.toMatch(CLIENT_DIRECTIVE);
  });

  it('D-02: Sidebar.tsx remains a Client Component', () => {
    const source = readFileSync(join(root, 'components/layout/Sidebar.tsx'), 'utf8');
    expect(source).toMatch(CLIENT_DIRECTIVE);
  });

  it('D-05: package.json has no APM packages (datadog, newrelic)', () => {
    expect(packageJson.dependencies?.datadog).toBeUndefined();
    expect(packageJson.dependencies?.newrelic).toBeUndefined();
    expect(packageJson.devDependencies?.datadog).toBeUndefined();
    expect(packageJson.devDependencies?.newrelic).toBeUndefined();
  });

  it('PERF-02/D-03: CHROME_ROUTES are Server PageChrome wrappers', () => {
    for (const { route, moduleImport } of CHROME_ROUTES) {
      const full = join(root, route);
      expect(existsSync(full), `${route} must exist`).toBe(true);
      const source = readFileSync(full, 'utf8');
      const rel = relative(root, full).replace(/\\/g, '/');
      expect(source, `${rel} must not be a Client Component`).not.toMatch(CLIENT_DIRECTIVE);
      expect(source, `${rel} must import PageChrome`).toContain('PageChrome');
      expect(source, `${rel} must import module page`).toContain(moduleImport);
    }
  });

  it('D-03: module pages do not import layout Sidebar', () => {
    for (const { path: rel } of MODULE_PAGES_NO_SIDEBAR) {
      const source = readFileSync(join(root, rel), 'utf8');
      const lines = codeLines(source);
      const sidebarImport = lines.find(
        line =>
          line.includes("from '@/components/layout/Sidebar'") ||
          line.includes('from "@/components/layout/Sidebar"'),
      );
      expect(sidebarImport, `${rel} must not import layout Sidebar`).toBeUndefined();
    }
  });

  it('D-03/D-06: PILOT_LOADING files are Server PageChrome + PageLoadingShell wrappers', () => {
    for (const { path: rel, message } of PILOT_LOADING) {
      const full = join(root, rel);
      expect(existsSync(full), `${rel} must exist`).toBe(true);
      const source = readFileSync(full, 'utf8');
      expect(source, `${rel} must not be a Client Component`).not.toMatch(CLIENT_DIRECTIVE);
      expect(source, `${rel} must use PageChrome`).toContain('PageChrome');
      expect(source, `${rel} must use PageLoadingShell`).toContain('PageLoadingShell');
      expect(source, `${rel} must include loading copy`).toContain(message);
    }
  });
});
