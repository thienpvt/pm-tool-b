import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertCompanyWrite,
  listProjects,
  getDashboardFilters,
  upsertDashboardFilters,
  getActivePrimaryAssignment,
  listOverdueMilestones,
  listHighOpenRaid,
  listTechnologyCouncilIssues,
  auditLogFn,
  listWeeklyPeriods,
  listPeriodShellsRepo,
  isWeeklyReportOverdue,
} = vi.hoisted(() => ({
  assertCompanyWrite: vi.fn(),
  listProjects: vi.fn(),
  getDashboardFilters: vi.fn(),
  upsertDashboardFilters: vi.fn(),
  getActivePrimaryAssignment: vi.fn(),
  listOverdueMilestones: vi.fn(),
  listHighOpenRaid: vi.fn(),
  listTechnologyCouncilIssues: vi.fn(),
  auditLogFn: vi.fn(),
  listWeeklyPeriods: vi.fn(),
  listPeriodShellsRepo: vi.fn(),
  isWeeklyReportOverdue: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertCompanyWrite }));
vi.mock('@/lib/repositories/projects.repo', () => ({ listProjects }));
vi.mock('@/lib/repositories/dashboard-filter-state.repo', () => ({
  getDashboardFilters,
  upsertDashboardFilters,
}));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ getActivePrimaryAssignment }));
vi.mock('@/lib/services/raid-masters.service', () => ({
  listOverdueMilestones,
  listHighOpenRaid,
  listTechnologyCouncilIssues,
}));
vi.mock('@/lib/services/audit.service', () => ({ auditLog: auditLogFn }));
vi.mock('@/lib/repositories/weekly-periods.repo', () => ({ listWeeklyPeriods }));
vi.mock('@/lib/repositories/weekly-reports.repo', () => ({ listPeriodShellsRepo }));
vi.mock('./weekly-reports.service', () => ({ isWeeklyReportOverdue }));
vi.mock('@/lib/export/dashboard-portfolio', () => ({
  generatePortfolioDashboardXlsx: vi.fn(async () => Buffer.from('xlsx')),
  generatePortfolioDashboardPdf: vi.fn(async () => Buffer.from('%PDF')),
  PORTFOLIO_EXPORT_CONTENT_TYPE: {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
  },
  PORTFOLIO_EXPORT_FILENAME: {
    xlsx: 'portfolio-dashboard.xlsx',
    pdf: 'portfolio-dashboard.pdf',
  },
}));

import { ForbiddenError, ValidationError } from './errors';
import {
  clearPortfolioDashboardFilters,
  exportPortfolioDashboard,
  getPmDashboard,
  getPortfolioDashboard,
  savePortfolioDashboardFilters,
} from './spec-dashboards.service';

const cpmoActor = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['cpmo'] as const,
  user_id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  email: 'cpmo@acme.com',
  status: 'active' as const,
};

const pmActor = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'] as const,
  user_id: 7,
  username: 'pm',
  display_name: 'Pat PM',
  email: 'pm@acme.com',
  status: 'active' as const,
};

const mockProjects = [
  {
    id: 10,
    name: 'Alpha',
    project_code: 'A-01',
    portfolio_year: 2026,
    customer_id: 1,
    program_name: 'Prog A',
    stage: 'L2',
    status: 'Active',
    rag: 'Green',
    classification: 'Strategic',
    weekly_report_enabled: true,
    progress_pct: 40,
  },
  {
    id: 11,
    name: 'Beta',
    project_code: 'B-01',
    portfolio_year: 2026,
    customer_id: 2,
    program_name: 'Prog B',
    stage: 'L3',
    status: 'Active',
    rag: 'Amber',
    classification: 'Run',
    weekly_report_enabled: false,
    progress_pct: 60,
  },
  {
    id: 12,
    name: 'Closed',
    project_code: 'C-01',
    portfolio_year: 2026,
    customer_id: 1,
    program_name: 'Prog A',
    stage: 'L2',
    status: 'Closed',
    rag: 'Green',
    classification: 'Strategic',
    weekly_report_enabled: true,
    progress_pct: 100,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  assertCompanyWrite.mockImplementation(() => undefined);
  getDashboardFilters.mockResolvedValue({ filters: {}, updated_at: null });
  upsertDashboardFilters.mockResolvedValue(undefined);
  listProjects.mockResolvedValue(mockProjects);
  getActivePrimaryAssignment.mockResolvedValue(null);
  listOverdueMilestones.mockResolvedValue([]);
  listHighOpenRaid.mockResolvedValue({ records: [], count: 0 });
  listTechnologyCouncilIssues.mockResolvedValue([]);
  auditLogFn.mockResolvedValue(undefined);
  listWeeklyPeriods.mockResolvedValue([]);
  listPeriodShellsRepo.mockResolvedValue([]);
  isWeeklyReportOverdue.mockReturnValue(false);
});

describe('spec-dashboards.service source (D-01)', () => {
  it('does not import portfolio.service', () => {
    const src = readFileSync(resolve(__dirname, 'spec-dashboards.service.ts'), 'utf8');
    expect(src).not.toMatch(/portfolio\.service/);
  });

  it('does not import weekly-tracking.service (D-10)', () => {
    const src = readFileSync(resolve(__dirname, 'spec-dashboards.service.ts'), 'utf8');
    expect(src).not.toMatch(/weekly-tracking\.service/);
  });
});

describe('getPortfolioDashboard', () => {
  it('calls assertCompanyWrite before listProjects (D-12)', async () => {
    const order: string[] = [];
    assertCompanyWrite.mockImplementation(() => {
      order.push('assertCompanyWrite');
    });
    listProjects.mockImplementation(async () => {
      order.push('listProjects');
      return mockProjects;
    });

    await getPortfolioDashboard(cpmoActor);

    expect(order).toEqual(['assertCompanyWrite', 'listProjects']);
  });

  it('throws ForbiddenError without listing when assertCompanyWrite fails (D-12)', async () => {
    assertCompanyWrite.mockImplementation(() => {
      throw new ForbiddenError();
    });

    await expect(getPortfolioDashboard(cpmoActor)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listProjects).not.toHaveBeenCalled();
  });

  it('returns live-master KPI tiles, list, filters, charts, drilldowns (D-01, D-02, D-03)', async () => {
    getActivePrimaryAssignment.mockImplementation(async (projectId: number) =>
      projectId === 10
        ? { user_id: 7, role: 'primary', display_name: 'Pat PM' }
        : null,
    );

    const result = await getPortfolioDashboard(cpmoActor);

    expect(result.filters).toEqual({});
    expect(result.kpis.active_count).toBe(2);
    expect(result.kpis.on_track_count).toBe(1);
    expect(result.kpis.watch_act_count).toBe(1);
    expect(result.charts).toBeDefined();
    expect(result.list).toHaveLength(3);
    expect(result.list[0]).toMatchObject({
      id: 10,
      name: 'Alpha',
      pm_user_id: 7,
      pm_name: 'Pat PM',
    });
    expect(result.drilldowns).toEqual({
      overdue_milestones: [],
      high_raid: [],
      technology_council: [],
    });
    expect(listProjects).toHaveBeenCalledWith(5);
    expect(getDashboardFilters).toHaveBeenCalledWith(1, 'portfolio');
  });

  it('overdue tile is distinct projects; drill-down is per milestone (D-05)', async () => {
    listOverdueMilestones.mockResolvedValue([
      { project_id: 10, milestone_id: 1, name: 'M1' },
      { project_id: 10, milestone_id: 2, name: 'M2' },
      { project_id: 99, milestone_id: 3, name: 'Other' },
    ]);

    const result = await getPortfolioDashboard(cpmoActor);

    expect(result.kpis.overdue_milestone_project_count).toBe(1);
    expect(result.drilldowns.overdue_milestones).toHaveLength(2);
  });

  it('high_open_raid_count is filtered record length not distinct projects (D-05)', async () => {
    listHighOpenRaid.mockResolvedValue({
      records: [
        { id: 1, project_id: 10, entity_type: 'risk' },
        { id: 2, project_id: 10, entity_type: 'issue' },
        { id: 3, project_id: 99, entity_type: 'risk' },
      ],
      count: 3,
    });

    const result = await getPortfolioDashboard(cpmoActor);

    expect(result.kpis.high_open_raid_count).toBe(2);
    expect(result.drilldowns.high_raid).toHaveLength(2);
    expect(result.drilldowns.high_raid.map((r: { id: number }) => r.id)).toEqual([1, 2]);
  });

  it('technology_council_count equals drill-down length for filtered set (D-05)', async () => {
    listTechnologyCouncilIssues.mockResolvedValue([
      { id: 1, project_id: 10 },
      { id: 2, project_id: 11 },
      { id: 3, project_id: 99 },
    ]);

    const result = await getPortfolioDashboard(cpmoActor);

    expect(result.kpis.technology_council_count).toBe(2);
    expect(result.drilldowns.technology_council).toHaveLength(2);
  });

  it('stored stage filter shrinks kpis, list, and overdue drill-down together (D-07, PDSH-05)', async () => {
    getDashboardFilters.mockResolvedValue({
      filters: { stage: 'L2' },
      updated_at: '2026-08-26T00:00:00Z',
    });
    listOverdueMilestones.mockResolvedValue([
      { project_id: 10, milestone_id: 1 },
      { project_id: 11, milestone_id: 2 },
    ]);

    const result = await getPortfolioDashboard(cpmoActor);

    expect(result.filters).toEqual({ stage: 'L2' });
    expect(result.list.map((p) => p.id)).toEqual([10, 12]);
    expect(result.kpis.active_count).toBe(1);
    expect(result.drilldowns.overdue_milestones).toHaveLength(1);
    expect(result.drilldowns.overdue_milestones[0].project_id).toBe(10);
  });
});

describe('savePortfolioDashboardFilters', () => {
  it('upserts parsed filters for actor user_id and portfolio surface (D-07)', async () => {
    await savePortfolioDashboardFilters(cpmoActor, { stage: 'L2' });

    expect(assertCompanyWrite).toHaveBeenCalledWith(cpmoActor);
    expect(upsertDashboardFilters).toHaveBeenCalledWith(1, 'portfolio', { stage: 'L2' });
  });

  it('throws ValidationError on unknown filter key (D-06)', async () => {
    await expect(
      savePortfolioDashboardFilters(cpmoActor, { bogus: 'x' } as Record<string, unknown>),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(upsertDashboardFilters).not.toHaveBeenCalled();
  });

  it('save then getPortfolioDashboard applies stored blob to list (D-07, PDSH-05)', async () => {
    upsertDashboardFilters.mockImplementation(async (_uid, _surface, filters) => {
      getDashboardFilters.mockResolvedValue({
        filters,
        updated_at: '2026-08-26T00:00:00Z',
      });
    });

    await savePortfolioDashboardFilters(cpmoActor, { stage: 'L2' });
    const result = await getPortfolioDashboard(cpmoActor);

    expect(result.filters).toEqual({ stage: 'L2' });
    expect(result.list.map((p) => p.id)).toEqual([10, 12]);
    expect(result.kpis.active_count).toBe(1);
  });
});

describe('clearPortfolioDashboardFilters', () => {
  it('upserts empty object for actor user_id (D-07, PDSH-06)', async () => {
    await clearPortfolioDashboardFilters(cpmoActor);

    expect(assertCompanyWrite).toHaveBeenCalledWith(cpmoActor);
    expect(upsertDashboardFilters).toHaveBeenCalledWith(1, 'portfolio', {});
  });

  it('clear then getPortfolioDashboard uses empty filters (D-07)', async () => {
    getDashboardFilters.mockResolvedValue({ filters: {}, updated_at: '2026-08-26T00:00:00Z' });

    await clearPortfolioDashboardFilters(cpmoActor);
    const result = await getPortfolioDashboard(cpmoActor);

    expect(result.filters).toEqual({});
    expect(result.list).toHaveLength(3);
  });
});

describe('getPmDashboard', () => {
  it('calls listProjects with pmUserId actor.user_id (D-09, MDSH-01)', async () => {
    listProjects.mockResolvedValue([mockProjects[0]]);

    await getPmDashboard(pmActor);

    expect(listProjects).toHaveBeenCalledWith(5, { pmUserId: 7 });
  });

  it('returns portfolio-shaped project list rows (D-09, MDSH-01)', async () => {
    listProjects.mockResolvedValue([mockProjects[0]]);
    getActivePrimaryAssignment.mockResolvedValue({ user_id: 7, display_name: 'Pat PM' });

    const result = await getPmDashboard(pmActor);

    expect(result.projects[0]).toMatchObject({
      id: 10,
      name: 'Alpha',
      project_code: 'A-01',
      pm_user_id: 7,
      pm_name: 'Pat PM',
    });
    expect(result.filters).toEqual({});
    expect(result.actions).toEqual({ weekly: [], milestones: [], raid: [] });
    expect(getDashboardFilters).toHaveBeenCalledWith(7, 'pm');
  });

  it('maps not_submitted and draft shells to weekly actions with href (D-10, MDSH-02)', async () => {
    listProjects.mockResolvedValue([{ ...mockProjects[0], id: 10 }]);
    listWeeklyPeriods.mockResolvedValue([
      {
        id: 50,
        company_id: 5,
        iso_week: '2026-W34',
        start_date: '2026-08-18',
        end_date: '2026-08-24',
        due_at: '2026-08-22T18:00:00.000Z',
        display_name: '2026-W34',
        config_snapshot: { due_weekday: 5, due_time_utc: '18:00:00', obligation_rule_version: 1 },
        created_by: 1,
        created_at: '2026-08-18T00:00:00Z',
      },
    ]);
    listPeriodShellsRepo.mockResolvedValue([
      {
        project_id: 10,
        status: 'not_submitted',
        due_at: '2026-08-22T18:00:00.000Z',
        report_id: 100,
        first_submitted_at: null,
        first_lateness: null,
        latest_version: 0,
        rag: null,
        name: 'Alpha',
        project_code: 'A-01',
        stage: 'L2',
        pm_user_id: 7,
        pm_display_name: 'Pat PM',
      },
      {
        project_id: 10,
        status: 'draft',
        due_at: '2026-08-22T18:00:00.000Z',
        report_id: 101,
        first_submitted_at: null,
        first_lateness: null,
        latest_version: 1,
        rag: 'Green',
        name: 'Alpha',
        project_code: 'A-01',
        stage: 'L2',
        pm_user_id: 7,
        pm_display_name: 'Pat PM',
      },
      {
        project_id: 10,
        status: 'submitted',
        due_at: '2026-08-22T18:00:00.000Z',
        report_id: 102,
        first_submitted_at: '2026-08-21T10:00:00Z',
        first_lateness: null,
        latest_version: 1,
        rag: 'Green',
        name: 'Alpha',
        project_code: 'A-01',
        stage: 'L2',
        pm_user_id: 7,
        pm_display_name: 'Pat PM',
      },
    ]);
    isWeeklyReportOverdue.mockImplementation((status, _dueAt, _now) => status === 'not_submitted');

    const result = await getPmDashboard(pmActor);

    expect(result.actions.weekly).toHaveLength(2);
    expect(result.actions.weekly[0]).toMatchObject({
      project_id: 10,
      report_id: 100,
      period_id: 50,
      period_display_name: '2026-W34',
      status: 'not_submitted',
      href: '/projects/10/weekly-reports/100',
      overdue: true,
    });
    expect(result.actions.weekly[1]).toMatchObject({
      report_id: 101,
      href: '/projects/10/weekly-reports/101',
      overdue: false,
    });
  });

  it('throws ForbiddenError for viewer (D-09, D-12)', async () => {
    const viewer = { ...pmActor, roles: ['viewer'] as const };
    await expect(getPmDashboard(viewer)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listProjects).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when company_id is null (D-09, D-12)', async () => {
    const nullCompany = { ...cpmoActor, company_id: null };
    await expect(getPmDashboard(nullCompany)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listProjects).not.toHaveBeenCalled();
  });
});

describe('exportPortfolioDashboard', () => {
  it('calls auditLog with dashboard_export after successful buffer (D-08)', async () => {
    const result = await exportPortfolioDashboard(cpmoActor, { format: 'xlsx' });

    expect(result.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(result.filename).toBe('portfolio-dashboard.xlsx');
    expect(auditLogFn).toHaveBeenCalledWith({
      actor_id: 1,
      company_id: 5,
      entity_type: 'dashboard',
      entity_id: 'portfolio',
      action: 'dashboard_export',
      before: null,
      after: expect.objectContaining({ format: 'xlsx', filters: {} }),
    });
  });

  it('body.filters overrides stored filters without upserting (D-07, D-08)', async () => {
    getDashboardFilters.mockResolvedValue({
      filters: { stage: 'L2' },
      updated_at: '2026-08-26T00:00:00Z',
    });

    await exportPortfolioDashboard(cpmoActor, {
      format: 'pdf',
      filters: { status: 'Active' },
    });

    expect(upsertDashboardFilters).not.toHaveBeenCalled();
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ format: 'pdf', filters: { status: 'Active' } }),
      }),
    );
  });

  it('throws ForbiddenError when assertCompanyWrite fails (D-12)', async () => {
    assertCompanyWrite.mockImplementation(() => {
      throw new ForbiddenError();
    });

    await expect(exportPortfolioDashboard(cpmoActor, { format: 'xlsx' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(auditLogFn).not.toHaveBeenCalled();
  });
});
