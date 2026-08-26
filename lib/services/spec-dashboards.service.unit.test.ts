import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertCompanyWrite,
  listProjects,
  getDashboardFilters,
  getActivePrimaryAssignment,
  listOverdueMilestones,
  listHighOpenRaid,
  listTechnologyCouncilIssues,
} = vi.hoisted(() => ({
  assertCompanyWrite: vi.fn(),
  listProjects: vi.fn(),
  getDashboardFilters: vi.fn(),
  getActivePrimaryAssignment: vi.fn(),
  listOverdueMilestones: vi.fn(),
  listHighOpenRaid: vi.fn(),
  listTechnologyCouncilIssues: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertCompanyWrite }));
vi.mock('@/lib/repositories/projects.repo', () => ({ listProjects }));
vi.mock('@/lib/repositories/dashboard-filter-state.repo', () => ({ getDashboardFilters }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ getActivePrimaryAssignment }));
vi.mock('@/lib/services/raid-masters.service', () => ({
  listOverdueMilestones,
  listHighOpenRaid,
  listTechnologyCouncilIssues,
}));

import { ForbiddenError } from './errors';
import { getPortfolioDashboard } from './spec-dashboards.service';

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
  listProjects.mockResolvedValue(mockProjects);
  getActivePrimaryAssignment.mockResolvedValue(null);
  listOverdueMilestones.mockResolvedValue([]);
  listHighOpenRaid.mockResolvedValue({ records: [], count: 0 });
  listTechnologyCouncilIssues.mockResolvedValue([]);
});

describe('spec-dashboards.service source (D-01)', () => {
  it('does not import portfolio.service', () => {
    const src = readFileSync(resolve(__dirname, 'spec-dashboards.service.ts'), 'utf8');
    expect(src).not.toMatch(/portfolio\.service/);
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
