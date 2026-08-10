import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listPortfolioProjects,
  riskCountsByProject,
  issueCountsByProject,
  roadmapActivityTotals,
  roadmapPhaseStats,
  listCompanyPrograms,
} = vi.hoisted(() => ({
  listPortfolioProjects: vi.fn(),
  riskCountsByProject: vi.fn(),
  issueCountsByProject: vi.fn(),
  roadmapActivityTotals: vi.fn(),
  roadmapPhaseStats: vi.fn(),
  listCompanyPrograms: vi.fn(),
}));

vi.mock('@/lib/repositories/portfolio.repo', () => ({
  listPortfolioProjects,
  riskCountsByProject,
  issueCountsByProject,
  roadmapActivityTotals,
  roadmapPhaseStats,
}));
vi.mock('@/lib/repositories/programs.repo', () => ({ listCompanyPrograms }));

import { getRoadmap } from './roadmap.service';

const FIXED_NOW = new Date('2026-06-15T12:00:00Z').getTime();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  listPortfolioProjects.mockResolvedValue([]);
  listCompanyPrograms.mockResolvedValue([]);
  riskCountsByProject.mockResolvedValue([]);
  issueCountsByProject.mockResolvedValue([]);
  roadmapActivityTotals.mockResolvedValue([]);
  roadmapPhaseStats.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const scoped = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const admin = { company_id: 5 as number | null, is_admin: 1 as number | boolean };

describe('roadmap.service getRoadmap', () => {
  it('passes company scope for a non-admin actor', async () => {
    await getRoadmap(scoped);
    expect(listPortfolioProjects).toHaveBeenCalledWith(5, false);
    expect(listCompanyPrograms).toHaveBeenCalledWith(5, false);
  });

  it('passes admin bypass to list calls', async () => {
    await getRoadmap(admin);
    expect(listPortfolioProjects).toHaveBeenCalledWith(5, true);
    expect(listCompanyPrograms).toHaveBeenCalledWith(5, true);
  });

  it('applies inline RAG thresholds verbatim (open_risks >= 3 → red)', async () => {
    listPortfolioProjects.mockResolvedValue([
      { id: 1, name: 'r', current_phase: 'Execution', end_date: '2026-12-31', customer_id: null },
    ]);
    riskCountsByProject.mockResolvedValue([{ project_id: 1, open: 3 }]);
    const result = await getRoadmap(scoped);
    expect(result.noProgramProjects[0].rag).toBe('red');
  });
});
