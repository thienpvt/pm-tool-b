import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listPortfolioProjects,
  riskCountsByProject,
  issueCountsByProject,
  activityCompletionByProject,
  listPrograms,
} = vi.hoisted(() => ({
  listPortfolioProjects: vi.fn(),
  riskCountsByProject: vi.fn(),
  issueCountsByProject: vi.fn(),
  activityCompletionByProject: vi.fn(),
  listPrograms: vi.fn(),
}));

vi.mock('@/lib/repositories/portfolio.repo', () => ({
  listPortfolioProjects,
  riskCountsByProject,
  issueCountsByProject,
  activityCompletionByProject,
}));
vi.mock('@/lib/repositories/programs.repo', () => ({ listPrograms }));

import { getPortfolioSummary } from './portfolio.service';

const FIXED_NOW = new Date('2026-06-15T12:00:00Z').getTime();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  riskCountsByProject.mockResolvedValue([]);
  issueCountsByProject.mockResolvedValue([]);
  activityCompletionByProject.mockResolvedValue([]);
  listPrograms.mockResolvedValue([]);
  listPortfolioProjects.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const scoped = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const admin = { company_id: 5 as number | null, is_admin: 1 as number | boolean };

describe('portfolio.service getPortfolioSummary', () => {
  it('passes company scope for a non-admin actor', async () => {
    await getPortfolioSummary(scoped);
    expect(listPortfolioProjects).toHaveBeenCalledWith(5, false);
    expect(listPrograms).toHaveBeenCalledWith(5, false);
  });

  it('passes admin bypass to repository list calls', async () => {
    await getPortfolioSummary(admin);
    expect(listPortfolioProjects).toHaveBeenCalledWith(5, true);
    expect(listPrograms).toHaveBeenCalledWith(5, true);
  });

  it('computes inline RAG thresholds verbatim (open_risks >= 3 → red, <=14 days → amber)', async () => {
    listPortfolioProjects.mockResolvedValue([
      { id: 1, name: 'red-risks', current_phase: 'Execution', end_date: '2026-12-31', customer_id: null },
      { id: 2, name: 'amber-deadline', current_phase: 'Execution', end_date: '2026-06-20', customer_id: null },
      { id: 3, name: 'green', current_phase: 'Execution', end_date: '2026-12-31', customer_id: null },
      { id: 4, name: 'closing-ignores', current_phase: 'Closing', end_date: '2020-01-01', customer_id: null },
    ]);
    riskCountsByProject.mockResolvedValue([
      { project_id: 1, open: 3, total: 3 },
      { project_id: 2, open: 0, total: 0 },
      { project_id: 3, open: 0, total: 0 },
      { project_id: 4, open: 5, total: 5 },
    ]);
    issueCountsByProject.mockResolvedValue([]);
    activityCompletionByProject.mockResolvedValue([]);

    const result = await getPortfolioSummary(scoped);
    const byId = Object.fromEntries(result.projects.map((p: { id: number }) => [p.id, p]));
    expect(byId[1].rag).toBe('red');
    expect(byId[2].rag).toBe('amber');
    expect(byId[3].rag).toBe('green');
    expect(byId[4].rag).toBe('green'); // Closing skips RAG escalation
  });

  it('slices programBar to top 10 by project count', async () => {
    const programs = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `P${i + 1}` }));
    // 11 programs with 1 project each, plus one with 5 → top is the fat one then first 9 of the rest
    const projects = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: 100 + i,
        name: `fat-${i}`,
        current_phase: 'Execution',
        end_date: null,
        customer_id: 1,
      })),
      ...Array.from({ length: 11 }, (_, i) => ({
        id: 200 + i,
        name: `thin-${i}`,
        current_phase: 'Execution',
        end_date: null,
        customer_id: i + 2, // programs 2..12
      })),
    ];
    listPrograms.mockResolvedValue(programs);
    listPortfolioProjects.mockResolvedValue(projects);

    const result = await getPortfolioSummary(scoped);
    expect(result.programBar).toHaveLength(10);
    expect(result.programBar[0]).toMatchObject({ name: 'P1', count: 5 });
    // Remaining slots are count=1 programs, sorted stable by the sort (count desc)
    expect(result.programBar.every((b: { count: number }) => b.count >= 1)).toBe(true);
  });

  it('returns identical KPI rollups for a fixed fixture', async () => {
    listPortfolioProjects.mockResolvedValue([
      { id: 1, name: 'A', current_phase: 'Execution', end_date: '2026-12-31', customer_id: 10 },
      { id: 2, name: 'B', current_phase: 'Closing', end_date: '2026-12-31', customer_id: 10 },
      { id: 3, name: 'C', current_phase: 'Planning', end_date: null, customer_id: null },
    ]);
    listPrograms.mockResolvedValue([{ id: 10, name: 'Prog' }]);
    riskCountsByProject.mockResolvedValue([
      { project_id: 1, open: 2, total: 4 },
      { project_id: 2, open: 1, total: 1 },
    ]);
    issueCountsByProject.mockResolvedValue([
      { project_id: 1, open: 1, total: 2 },
    ]);
    activityCompletionByProject.mockResolvedValue([
      { project_id: 1, avg_pct: 40.4, total: 10, done: 4 },
      { project_id: 2, avg_pct: 100, total: 5, done: 5 },
      { project_id: 3, avg_pct: 10, total: 2, done: 0 },
    ]);

    const result = await getPortfolioSummary(scoped);

    expect(result.kpi).toEqual({
      totalProjects: 3,
      totalPrograms: 1,
      totalOpenRisks: 3, // 2 + 1 + 0
      totalOpenIssues: 1,
      avgCompletion: Math.round((40 + 100 + 10) / 3), // Math.round of avg_pct values
      activeProjects: 2, // Execution + Planning
    });
    expect(result.phaseDist).toEqual([
      { phase: 'Initiation', count: 0 },
      { phase: 'Planning', count: 1 },
      { phase: 'Execution', count: 1 },
      { phase: 'Closing', count: 1 },
    ]);
    expect(result.noProgramProjects).toHaveLength(1);
    expect(result.programs[0].projects).toHaveLength(2);
    expect(result.projects.find((p: { id: number }) => p.id === 1)).toMatchObject({
      open_risks: 2,
      total_risks: 4,
      open_issues: 1,
      total_issues: 2,
      completion_pct: 40,
      total_activities: 10,
      done_activities: 4,
    });
  });
});
