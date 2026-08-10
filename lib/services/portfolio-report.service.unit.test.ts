import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listPortfolioReportProjects,
  listCompanyPrograms,
  riskCountsByProject,
  issueCountsByProject,
  listPortfolioReportActivities,
  portfolioMilestoneSelection,
  milestoneDateRanges,
  companyRagConfig,
  topPortfolioRisks,
  topPortfolioIssues,
  upcomingPortfolioActivities,
  recentlyCompletedPortfolioActivities,
  completedPortfolioActivitiesBetween,
  portfolioBugCounts,
  internalPortfolioMembers,
  portfolioTeamMembers,
  companyNameAndQuota,
  portfolioMemberFte,
  portfolioProgramFillRates,
  portfolioReportMilestones,
} = vi.hoisted(() => ({
  listPortfolioReportProjects: vi.fn(),
  listCompanyPrograms: vi.fn(),
  riskCountsByProject: vi.fn(),
  issueCountsByProject: vi.fn(),
  listPortfolioReportActivities: vi.fn(),
  portfolioMilestoneSelection: vi.fn(),
  milestoneDateRanges: vi.fn(),
  companyRagConfig: vi.fn(),
  topPortfolioRisks: vi.fn(),
  topPortfolioIssues: vi.fn(),
  upcomingPortfolioActivities: vi.fn(),
  recentlyCompletedPortfolioActivities: vi.fn(),
  completedPortfolioActivitiesBetween: vi.fn(),
  portfolioBugCounts: vi.fn(),
  internalPortfolioMembers: vi.fn(),
  portfolioTeamMembers: vi.fn(),
  companyNameAndQuota: vi.fn(),
  portfolioMemberFte: vi.fn(),
  portfolioProgramFillRates: vi.fn(),
  portfolioReportMilestones: vi.fn(),
}));

vi.mock('@/lib/repositories/portfolio.repo', () => ({
  listPortfolioReportProjects,
  riskCountsByProject,
  issueCountsByProject,
  listPortfolioReportActivities,
  portfolioMilestoneSelection,
  milestoneDateRanges,
  topPortfolioRisks,
  topPortfolioIssues,
  upcomingPortfolioActivities,
  recentlyCompletedPortfolioActivities,
  completedPortfolioActivitiesBetween,
  portfolioBugCounts,
  internalPortfolioMembers,
  portfolioTeamMembers,
  companyNameAndQuota,
  portfolioMemberFte,
  portfolioProgramFillRates,
  portfolioReportMilestones,
}));
vi.mock('@/lib/repositories/programs.repo', () => ({ listCompanyPrograms }));
vi.mock('@/lib/repositories/rag-config.repo', () => ({ companyRagConfig }));

import { getPortfolioReport, monSunWeekBounds } from './portfolio-report.service';

const scoped = { company_id: 5 as number | null, is_admin: 0 as number | boolean };

function stubEmpty() {
  listPortfolioReportProjects.mockResolvedValue([]);
  listCompanyPrograms.mockResolvedValue([]);
  riskCountsByProject.mockResolvedValue([]);
  issueCountsByProject.mockResolvedValue([]);
  listPortfolioReportActivities.mockResolvedValue([]);
  milestoneDateRanges.mockResolvedValue([]);
  companyRagConfig.mockResolvedValue(null);
  topPortfolioRisks.mockResolvedValue([]);
  topPortfolioIssues.mockResolvedValue([]);
  upcomingPortfolioActivities.mockResolvedValue([]);
  recentlyCompletedPortfolioActivities.mockResolvedValue([]);
  completedPortfolioActivitiesBetween.mockResolvedValue([]);
  portfolioBugCounts.mockResolvedValue([]);
  internalPortfolioMembers.mockResolvedValue([]);
  portfolioTeamMembers.mockResolvedValue([]);
  companyNameAndQuota.mockResolvedValue({ headcount_quota: 0 });
  portfolioMemberFte.mockResolvedValue([]);
  portfolioProgramFillRates.mockResolvedValue([]);
  portfolioReportMilestones.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  stubEmpty();
});

describe('monSunWeekBounds', () => {
  // Construct local-noon dates so day-of-week math matches the route's local Date usage
  // (toISOString still converts to UTC, which is what the route always did).
  function localNoon(y: number, m0: number, d: number) {
    return new Date(y, m0, d, 12, 0, 0, 0);
  }

  it('defaults a Monday input to that Mon–Sun week', () => {
    // 2026-06-15 is a Monday
    const monday = localNoon(2026, 5, 15);
    expect(monday.getDay()).toBe(1);
    const bounds = monSunWeekBounds(monday);
    const expectedStart = monSunWeekBounds(monday).start; // self-consistent
    // Start is Monday of that week; end is +6 days
    const startDate = new Date(monday);
    startDate.setDate(monday.getDate() - (monday.getDay() === 0 ? 6 : monday.getDay() - 1));
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    expect(bounds.start).toBe(startDate.toISOString().slice(0, 10));
    expect(bounds.end).toBe(endDate.toISOString().slice(0, 10));
    expect(bounds.start).toBe(expectedStart);
  });

  it('defaults a Sunday input to the prior Mon–Sun week', () => {
    // 2026-06-21 is a Sunday → week starts the prior Monday
    const sunday = localNoon(2026, 5, 21);
    expect(sunday.getDay()).toBe(0);
    const bounds = monSunWeekBounds(sunday);
    const startDate = new Date(sunday);
    startDate.setDate(sunday.getDate() - 6); // dayOfWeek===0 → subtract 6
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    expect(bounds.start).toBe(startDate.toISOString().slice(0, 10));
    expect(bounds.end).toBe(endDate.toISOString().slice(0, 10));
    // Sunday's week start equals the Monday 6 days earlier
    expect(bounds.start).toBe(monSunWeekBounds(localNoon(2026, 5, 15)).start);
  });
});

describe('getPortfolioReport', () => {
  it('uses Mon–Sun defaults when start/end are omitted', async () => {
    const result = await getPortfolioReport(scoped, {});
    // periodStart/periodEnd must be a Mon–Sun pair matching monSunWeekBounds(today)
    const expected = monSunWeekBounds(new Date());
    expect(result.periodStart).toBe(expected.start);
    expect(result.periodEnd).toBe(expected.end);
  });

  it('honours explicit start/end query params', async () => {
    const result = await getPortfolioReport(scoped, { start: '2026-01-01', end: '2026-01-07' });
    expect(result.periodStart).toBe('2026-01-01');
    expect(result.periodEnd).toBe('2026-01-07');
  });

  it('builds milestone multi-select sets and filters projects', async () => {
    portfolioMilestoneSelection.mockResolvedValue({
      projectIds: [10, 20],
      activityIds: [100, 200],
      milestones: [
        {
          id: 1, project_id: 10, name: 'M1', project_name: 'A', program_name: 'P',
          start_date: '2026-03-01', end_date: '2026-03-31',
        },
        {
          id: 2, project_id: 20, name: 'M2', project_name: 'B', program_name: 'P',
          start_date: '2026-04-01', end_date: '2026-04-30',
        },
      ],
      periodMin: '2026-03-01',
      periodMax: '2026-04-30',
    });
    listPortfolioReportProjects.mockResolvedValue([
      { id: 10, name: 'A', current_phase: 'Execution', customer_id: null, start_date: null, end_date: null },
      { id: 20, name: 'B', current_phase: 'Execution', customer_id: null, start_date: null, end_date: null },
      { id: 30, name: 'C', current_phase: 'Execution', customer_id: null, start_date: null, end_date: null },
    ]);
    listPortfolioReportActivities.mockResolvedValue([
      { id: 100, project_id: 10, no: '1.1', status: 'Done', phase: 'Execution', parent_id: null },
      { id: 200, project_id: 20, no: '1.1', status: 'Done', phase: 'Execution', parent_id: null },
      { id: 999, project_id: 30, no: '1.1', status: 'Done', phase: 'Execution', parent_id: null },
    ]);

    const result = await getPortfolioReport(scoped, { milestone_ids: '1,2' });

    expect(portfolioMilestoneSelection).toHaveBeenCalledWith([1, 2], 5, false);
    // Only projects 10 and 20 — 30 excluded by milestone set
    expect(result.projects.map((p: { id: number }) => p.id).sort()).toEqual([10, 20]);
    expect(result.kpi.totalProjects).toBe(2);
    expect(result.periodStart).toBe('2026-03-01');
    expect(result.periodEnd).toBe('2026-04-30');
    expect(result.milestoneInfo).toHaveLength(2);
    // Activities filtered to epic set (999 excluded)
    expect(result.projects.find((p: { id: number }) => p.id === 10)?.total_activities).toBe(1);
  });

  it('passes company scope for non-admin and admin branches', async () => {
    await getPortfolioReport(scoped, {});
    expect(listPortfolioReportProjects).toHaveBeenCalledWith(5, false);

    await getPortfolioReport({ company_id: 5, is_admin: 1 }, {});
    expect(listPortfolioReportProjects).toHaveBeenCalledWith(5, true);
  });
});
