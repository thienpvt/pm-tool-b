import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

const root = resolve(__dirname, '..');

const CLIENT_DIRECTIVE = /^['"]use client['"]/m;

function stripBom(source: string): string {
  return source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
}

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
  {
    route: 'app/page.tsx',
    moduleImport: 'modules/portfolio/ui/home/PortfolioHomePage',
  },
  {
    route: 'app/admin/page.tsx',
    moduleImport: 'modules/admin/ui/AdminPage',
  },
  {
    route: 'app/documents/catalog/page.tsx',
    moduleImport: 'modules/documents/ui/catalog/DocumentCatalogPage',
  },
  {
    route: 'app/documents/compliance/page.tsx',
    moduleImport: 'modules/documents/ui/compliance/DocumentCompliancePage',
  },
  {
    route: 'app/portfolio/report/page.tsx',
    moduleImport: 'modules/reports/ui/portfolio-report/PortfolioReportPage',
  },
  {
    route: 'app/portfolio/resources/page.tsx',
    moduleImport: 'modules/portfolio/ui/resources/PortfolioResourcesPage',
  },
  {
    route: 'app/portfolio/roadmap/page.tsx',
    moduleImport: 'modules/portfolio/ui/roadmap/RoadmapPage',
  },
  {
    route: 'app/programs/page.tsx',
    moduleImport: 'modules/portfolio/ui/programs/ProgramsPage',
  },
  {
    route: 'app/resources/page.tsx',
    moduleImport: 'modules/portfolio/ui/members/ResourcesMembersPage',
  },
  {
    route: 'app/projects/page.tsx',
    moduleImport: 'modules/projects/ui/list/ProjectsListPage',
  },
  {
    route: 'app/projects/new/page.tsx',
    moduleImport: 'modules/projects/ui/new/NewProjectPage',
  },
  {
    route: 'app/weekly/tracking/page.tsx',
    moduleImport: 'modules/weekly/ui/tracking/WeeklyTrackingPage',
  },
  {
    route: 'app/projects/[id]/page.tsx',
    moduleImport: 'modules/projects/ui/hub/ProjectHubPage',
  },
  {
    route: 'app/projects/[id]/analysis/page.tsx',
    moduleImport: 'modules/projects/ui/analysis/ProjectAnalysisPage',
  },
  {
    route: 'app/projects/[id]/budget/page.tsx',
    moduleImport: 'modules/projects/ui/budget/ProjectBudgetPage',
  },
  {
    route: 'app/projects/[id]/bugs/page.tsx',
    moduleImport: 'modules/projects/ui/bugs/ProjectBugsPage',
  },
  {
    route: 'app/projects/[id]/communication/page.tsx',
    moduleImport: 'modules/projects/ui/communication/ProjectCommunicationPage',
  },
  {
    route: 'app/projects/[id]/dashboard/page.tsx',
    moduleImport: 'modules/projects/ui/dashboard/ProjectDashboardPage',
  },
  {
    route: 'app/projects/[id]/document-checklist/page.tsx',
    moduleImport: 'modules/documents/ui/checklist/ProjectChecklistPage',
  },
  {
    route: 'app/projects/[id]/documents/page.tsx',
    moduleImport: 'modules/projects/ui/documents/ProjectDocumentsPage',
  },
  {
    route: 'app/projects/[id]/milestones/page.tsx',
    moduleImport: 'modules/projects/ui/milestones/MilestonesPage',
  },
  {
    route: 'app/projects/[id]/report/page.tsx',
    moduleImport: 'modules/reports/ui/project-report/ProjectReportPage',
  },
  {
    route: 'app/projects/[id]/reports/page.tsx',
    moduleImport: 'modules/reports/ui/project-reports-list/ProjectReportsListPage',
  },
  {
    route: 'app/projects/[id]/resources/page.tsx',
    moduleImport: 'modules/projects/ui/resources/ProjectResourcesPage',
  },
  {
    route: 'app/projects/[id]/risks/page.tsx',
    moduleImport: 'modules/projects/ui/risks/ProjectRisksPage',
  },
  {
    route: 'app/projects/[id]/timeline/page.tsx',
    moduleImport: 'modules/projects/ui/timeline/TimelinePage',
  },
  {
    route: 'app/projects/[id]/weekly-reports/[reportId]/page.tsx',
    moduleImport: 'modules/weekly/ui/report/WeeklyReportEditorPage',
  },
  {
    route: 'app/weekly/reports/[projectId]/[reportId]/page.tsx',
    moduleImport: 'modules/weekly/ui/report/WeeklyReportEditorPage',
  },
];

const EXCLUDED_ROUTES = [
  'app/login/page.tsx',
  'app/landing/page.tsx',
  'app/operations/page.tsx',
  'app/operations/[id]/page.tsx',
  'app/portfolio/budget/page.tsx',
] as const;

const MODULE_SHELL_IMPORTS = [
  '@/components/layout/PageChrome',
  '@/components/layout/PageLoadingShell',
  '@/components/layout/PageErrorShell',
] as const;

/** Tailwind font-weight utilities outside D-06 allowlist (400/600 only). */
const FORBIDDEN_FONT_WEIGHTS =
  /\bfont-(thin|extralight|light|medium|bold|extrabold|black)\b/;

const PROJECT_ID_ROUTES = CHROME_ROUTES.filter(
  r => /\/\[id\](?:\/|$)/.test(r.route),
).map(r => r.route);

const WEEKLY_REPORT_PROJECT_ROUTE = 'app/weekly/reports/[projectId]/[reportId]/page.tsx';

const MODULE_PAGES_NO_SIDEBAR: { path: string; label: string }[] = [
  { path: 'modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx', label: 'PortfolioDashboardPage' },
  { path: 'modules/dashboards/ui/pm/PmDashboardPage.tsx', label: 'PmDashboardPage' },
  { path: 'modules/weekly/ui/periods/WeeklyPeriodsPage.tsx', label: 'WeeklyPeriodsPage' },
  { path: 'modules/audit/ui/AuditLogPage.tsx', label: 'AuditLogPage' },
  { path: 'modules/portfolio/ui/home/PortfolioHomePage.tsx', label: 'PortfolioHomePage' },
  { path: 'modules/admin/ui/AdminPage.tsx', label: 'AdminPage' },
  { path: 'modules/documents/ui/catalog/DocumentCatalogPage.tsx', label: 'DocumentCatalogPage' },
  { path: 'modules/documents/ui/compliance/DocumentCompliancePage.tsx', label: 'DocumentCompliancePage' },
  { path: 'modules/reports/ui/portfolio-report/PortfolioReportPage.tsx', label: 'PortfolioReportPage' },
  { path: 'modules/portfolio/ui/resources/PortfolioResourcesPage.tsx', label: 'PortfolioResourcesPage' },
  { path: 'modules/portfolio/ui/roadmap/RoadmapPage.tsx', label: 'RoadmapPage' },
  { path: 'modules/portfolio/ui/programs/ProgramsPage.tsx', label: 'ProgramsPage' },
  { path: 'modules/portfolio/ui/members/ResourcesMembersPage.tsx', label: 'ResourcesMembersPage' },
  { path: 'modules/projects/ui/list/ProjectsListPage.tsx', label: 'ProjectsListPage' },
  { path: 'modules/projects/ui/new/NewProjectPage.tsx', label: 'NewProjectPage' },
  { path: 'modules/weekly/ui/tracking/WeeklyTrackingPage.tsx', label: 'WeeklyTrackingPage' },
  { path: 'modules/projects/ui/hub/ProjectHubPage.tsx', label: 'ProjectHubPage' },
  { path: 'modules/projects/ui/analysis/ProjectAnalysisPage.tsx', label: 'ProjectAnalysisPage' },
  { path: 'modules/projects/ui/budget/ProjectBudgetPage.tsx', label: 'ProjectBudgetPage' },
  { path: 'modules/projects/ui/bugs/ProjectBugsPage.tsx', label: 'ProjectBugsPage' },
  { path: 'modules/projects/ui/communication/ProjectCommunicationPage.tsx', label: 'ProjectCommunicationPage' },
  { path: 'modules/projects/ui/dashboard/ProjectDashboardPage.tsx', label: 'ProjectDashboardPage' },
  { path: 'modules/documents/ui/checklist/ProjectChecklistPage.tsx', label: 'ProjectChecklistPage' },
  { path: 'modules/projects/ui/documents/ProjectDocumentsPage.tsx', label: 'ProjectDocumentsPage' },
  { path: 'modules/projects/ui/milestones/MilestonesPage.tsx', label: 'MilestonesPage' },
  { path: 'modules/reports/ui/project-report/ProjectReportPage.tsx', label: 'ProjectReportPage' },
  { path: 'modules/reports/ui/project-reports-list/ProjectReportsListPage.tsx', label: 'ProjectReportsListPage' },
  { path: 'modules/projects/ui/resources/ProjectResourcesPage.tsx', label: 'ProjectResourcesPage' },
  { path: 'modules/projects/ui/risks/ProjectRisksPage.tsx', label: 'ProjectRisksPage' },
  { path: 'modules/projects/ui/timeline/TimelinePage.tsx', label: 'TimelinePage' },
  { path: 'modules/weekly/ui/report/WeeklyReportEditorPage.tsx', label: 'WeeklyReportEditorPage' },
];

export const PILOT_LOADING: { path: string; message: string }[] = [
  { path: 'app/dashboards/portfolio/loading.tsx', message: 'Loading dashboard…' },
  { path: 'app/dashboards/pm/loading.tsx', message: 'Loading dashboard…' },
  { path: 'app/weekly/periods/loading.tsx', message: 'Loading weekly periods…' },
  { path: 'app/audit/loading.tsx', message: 'Loading audit log…' },
  { path: 'app/weekly/tracking/loading.tsx', message: 'Loading tracking…' },
];

describe('rsc-chrome gates (26-01–26-02, PERF-02, D-01, D-02, D-03, D-05, D-06)', () => {
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

  it('D-02: Sidebar fetches /api/auth/me on the client', () => {
    const source = readFileSync(join(root, 'components/layout/Sidebar.tsx'), 'utf8');
    expect(source).toMatch(/fetch\s*\(\s*['"]\/api\/auth\/me['"]/);
  });

  it('PERF-02: PortfolioKpiTiles stays a Client Component', () => {
    const source = readFileSync(
      join(root, 'modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx'),
      'utf8',
    );
    expect(source).toMatch(CLIENT_DIRECTIVE);
  });

  it('PERF-02: chrome module pages remain Client Components with hooks', () => {
    for (const { path: rel, label } of MODULE_PAGES_NO_SIDEBAR) {
      const source = stripBom(readFileSync(join(root, rel), 'utf8'));
      expect(source, `${label} must stay a Client Component`).toMatch(CLIENT_DIRECTIVE);
    }
  });

  it('D-02: project-scoped routes await params and forward projectId', () => {
    for (const route of PROJECT_ID_ROUTES) {
      const source = readFileSync(join(root, route), 'utf8');
      const rel = relative(root, join(root, route)).replace(/\\/g, '/');
      expect(source, `${rel} must await params`).toMatch(/await\s+params/);
      expect(source, `${rel} must forward projectId to PageChrome`).toContain('projectId');
    }
    const weeklySource = readFileSync(join(root, WEEKLY_REPORT_PROJECT_ROUTE), 'utf8');
    expect(weeklySource).toMatch(/await\s+params/);
    expect(weeklySource).toContain('projectId');
  });

  it('D-06: PageChrome outer shell uses exact preserve-existing className', () => {
    const source = readFileSync(join(root, 'components/layout/PageChrome.tsx'), 'utf8');
    expect(source).toContain('flex flex-col lg:flex-row min-h-screen bg-slate-50');
  });

  it('D-06: layout shells use only font weights 400 and 600 (no forbidden utilities)', () => {
    for (const rel of LAYOUT_SHELLS) {
      const source = readFileSync(join(root, rel), 'utf8');
      expect(source, `${rel} must not use forbidden font-weight utilities`).not.toMatch(
        FORBIDDEN_FONT_WEIGHTS,
      );
    }
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

  it('D-05/D-06: EXCLUDED routes stay client re-exports without PageChrome', () => {
    for (const route of EXCLUDED_ROUTES) {
      const full = join(root, route);
      expect(existsSync(full), `${route} must exist`).toBe(true);
      const source = readFileSync(full, 'utf8');
      const rel = relative(root, full).replace(/\\/g, '/');
      expect(source, `${rel} must remain a Client Component`).toMatch(CLIENT_DIRECTIVE);
      expect(source, `${rel} must not import PageChrome`).not.toContain('PageChrome');
    }
  });

  it('D-06: app/portfolio/budget/page.tsx is not in CHROME_ROUTES', () => {
    expect(CHROME_ROUTES.some(r => r.route === 'app/portfolio/budget/page.tsx')).toBe(false);
    const source = readFileSync(join(root, 'app/portfolio/budget/page.tsx'), 'utf8');
    expect(source).not.toContain('PageChrome');
  });

  it('D-03: chrome module pages do not import server layout shells', () => {
    for (const { path: rel } of MODULE_PAGES_NO_SIDEBAR) {
      const source = readFileSync(join(root, rel), 'utf8');
      const lines = codeLines(source);
      for (const imp of MODULE_SHELL_IMPORTS) {
        const hit = lines.find(line => line.includes(imp));
        expect(hit, `${rel} must not import ${imp}`).toBeUndefined();
      }
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
