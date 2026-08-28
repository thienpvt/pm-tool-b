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

vi.mock('@/modules/portfolio/backend/repositories/portfolio.repo', () => ({
  listPortfolioProjects,
  riskCountsByProject,
  issueCountsByProject,
  roadmapActivityTotals,
  roadmapPhaseStats,
}));
vi.mock('@/modules/portfolio/backend/repositories/programs.repo', () => ({ listCompanyPrograms }));

import { getRoadmap } from '@/modules/portfolio/backend/services/roadmap.service';

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

const cpmoCompany5Leftover = {
  company_id: 5 as number | null,
  is_admin: 1 as number | boolean,
  roles: ['cpmo'] as const,
  user_id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  email: 'cpmo@example.com',
  status: 'active' as const,
};

describe('roadmap.service getRoadmap', () => {
  it('passes company scope only for leftover-flag CPMO company 5 (D-13)', async () => {
    await getRoadmap(cpmoCompany5Leftover);
    expect(listPortfolioProjects).toHaveBeenCalledWith(5);
    expect(listCompanyPrograms).toHaveBeenCalledWith(5);
  });

  it('scopes list calls to actor company only (D-13, AUTH-04)', async () => {
    listPortfolioProjects.mockResolvedValue([
      { id: 1, name: 'mine', current_phase: 'Execution', end_date: '2026-12-31', customer_id: 10, company_id: 5 },
    ]);
    listCompanyPrograms.mockResolvedValue([{ id: 10, name: 'Prog', company_id: 5 }]);
    const result = await getRoadmap(cpmoCompany5Leftover);
    expect(result.programs[0].projects).toHaveLength(1);
    expect(result.programs[0].projects[0].company_id).toBe(5);
    expect(listPortfolioProjects).toHaveBeenCalledWith(5);
  });

  it('applies inline RAG thresholds verbatim (open_risks >= 3 → red)', async () => {
    listPortfolioProjects.mockResolvedValue([
      { id: 1, name: 'r', current_phase: 'Execution', end_date: '2026-12-31', customer_id: null },
    ]);
    riskCountsByProject.mockResolvedValue([{ project_id: 1, open: 3 }]);
    const result = await getRoadmap(cpmoCompany5Leftover);
    expect(result.noProgramProjects[0].rag).toBe('red');
  });
});
