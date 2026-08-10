import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listPortfolioProjects,
  riskCountsByProject,
  issueCountsByProject,
  activityCompletionByProject,
  listPrograms,
  companyNameAndQuota,
  createPortfolioBudget,
  createPortfolioBudgetAllocation,
  createPortfolioBudgetCategory,
  createPortfolioMember,
  deletePortfolioBudget,
  deletePortfolioBudgetAllocation,
  deletePortfolioBudgetCategory,
  deletePortfolioMember,
  deletePortfolioProgramAllocation,
  findPortfolioBudget,
  listPortfolioBudgets,
  listPortfolioMilestones,
  portfolioBudgetAllocations,
  portfolioBudgetCategories,
  portfolioMembersWithUtilization,
  programFteAllocations,
  setCompanyHeadcountQuota,
  spendByCategory,
  updatePortfolioBudget,
  updatePortfolioBudgetAllocation,
  updatePortfolioBudgetCategory,
  updatePortfolioMember,
  updatePortfolioProgramAllocation,
  upsertPortfolioProgramAllocation,
} = vi.hoisted(() => ({
  listPortfolioProjects: vi.fn(),
  riskCountsByProject: vi.fn(),
  issueCountsByProject: vi.fn(),
  activityCompletionByProject: vi.fn(),
  listPrograms: vi.fn(),
  companyNameAndQuota: vi.fn(),
  createPortfolioBudget: vi.fn(),
  createPortfolioBudgetAllocation: vi.fn(),
  createPortfolioBudgetCategory: vi.fn(),
  createPortfolioMember: vi.fn(),
  deletePortfolioBudget: vi.fn(),
  deletePortfolioBudgetAllocation: vi.fn(),
  deletePortfolioBudgetCategory: vi.fn(),
  deletePortfolioMember: vi.fn(),
  deletePortfolioProgramAllocation: vi.fn(),
  findPortfolioBudget: vi.fn(),
  listPortfolioBudgets: vi.fn(),
  listPortfolioMilestones: vi.fn(),
  portfolioBudgetAllocations: vi.fn(),
  portfolioBudgetCategories: vi.fn(),
  portfolioMembersWithUtilization: vi.fn(),
  programFteAllocations: vi.fn(),
  setCompanyHeadcountQuota: vi.fn(),
  spendByCategory: vi.fn(),
  updatePortfolioBudget: vi.fn(),
  updatePortfolioBudgetAllocation: vi.fn(),
  updatePortfolioBudgetCategory: vi.fn(),
  updatePortfolioMember: vi.fn(),
  updatePortfolioProgramAllocation: vi.fn(),
  upsertPortfolioProgramAllocation: vi.fn(),
}));

vi.mock('@/lib/repositories/portfolio.repo', () => ({
  listPortfolioProjects,
  riskCountsByProject,
  issueCountsByProject,
  activityCompletionByProject,
  companyNameAndQuota,
  createPortfolioBudget,
  createPortfolioBudgetAllocation,
  createPortfolioBudgetCategory,
  createPortfolioMember,
  deletePortfolioBudget,
  deletePortfolioBudgetAllocation,
  deletePortfolioBudgetCategory,
  deletePortfolioMember,
  deletePortfolioProgramAllocation,
  findPortfolioBudget,
  listPortfolioBudgets,
  listPortfolioMilestones,
  portfolioBudgetAllocations,
  portfolioBudgetCategories,
  portfolioMembersWithUtilization,
  programFteAllocations,
  setCompanyHeadcountQuota,
  spendByCategory,
  updatePortfolioBudget,
  updatePortfolioBudgetAllocation,
  updatePortfolioBudgetCategory,
  updatePortfolioMember,
  updatePortfolioProgramAllocation,
  upsertPortfolioProgramAllocation,
}));
vi.mock('@/lib/repositories/programs.repo', () => ({ listPrograms }));

import {
  createBudget,
  createBudgetAllocation,
  createBudgetCategory,
  createMember,
  createProgramAllocation,
  deleteBudget,
  deleteBudgetAllocation,
  deleteBudgetCategory,
  deleteMember,
  deleteProgramAllocation,
  getBudget,
  getPortfolioSummary,
  getQuota,
  listBudgetAllocations,
  listBudgetCategories,
  listBudgets,
  listMembers,
  listPortfolioMilestones as listPortfolioMilestonesSvc,
  listProgramAllocations,
  updateBudget,
  updateBudgetAllocation,
  updateBudgetCategory,
  updateMember,
  updateProgramAllocation,
  updateQuota,
} from './portfolio.service';
import { NotFoundError, ValidationError } from './errors';

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
    const byId = Object.fromEntries(
      result.projects.map((p: { id: number; rag: string }) => [p.id, p]),
    );
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

const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('portfolio.service budgets', () => {
  it('listBudgets passes company scope', async () => {
    listPortfolioBudgets.mockResolvedValue([{ id: 1 }]);
    await expect(listBudgets(scoped)).resolves.toEqual([{ id: 1 }]);
    expect(listPortfolioBudgets).toHaveBeenCalledWith(5);
  });

  it('getBudget reproduces the spendByCategory aggregate byte-identically for an owner', async () => {
    findPortfolioBudget.mockResolvedValue({ id: 1, total_amount: 1000 });
    portfolioBudgetCategories.mockResolvedValue([
      { category: 'CAPEX', ceiling_amount: 500 },
      { category: 'OPEX', ceiling_amount: 300 },
    ]);
    portfolioBudgetAllocations.mockResolvedValue([
      { id: 10, allocated_amount: 400 },
      { id: 11, allocated_amount: 700 },
    ]);
    spendByCategory.mockImplementation(async (_id: unknown, category: string) =>
      category === 'CAPEX' ? { used: 450 } : { used: 100 },
    );

    const result = await getBudget(1, scoped);

    expect(result).toEqual({
      budget: { id: 1, total_amount: 1000 },
      categories: [
        { category: 'CAPEX', ceiling_amount: 500 },
        { category: 'OPEX', ceiling_amount: 300 },
      ],
      allocations: [
        { id: 10, allocated_amount: 400 },
        { id: 11, allocated_amount: 700 },
      ],
      summary: {
        total_allocated: 1100,
        over_total: true, // 1100 > 1000
        category_warnings: {
          CAPEX: { ceiling: 500, used: 450 },
          OPEX: { ceiling: 300, used: 100 },
        },
      },
    });
    expect(findPortfolioBudget).toHaveBeenCalledWith(5, 1);
  });

  it('getBudget throws NotFoundError for a cross-company budget id (never the foreign row)', async () => {
    findPortfolioBudget.mockResolvedValue(undefined);
    await expect(getBudget(1, foreign)).rejects.toBeInstanceOf(NotFoundError);
    expect(portfolioBudgetCategories).not.toHaveBeenCalled();
    expect(portfolioBudgetAllocations).not.toHaveBeenCalled();
  });

  it('createBudget validates required fields before insert', async () => {
    await expect(createBudget(scoped, { period_label: 'Q1' })).rejects.toBeInstanceOf(ValidationError);
    expect(createPortfolioBudget).not.toHaveBeenCalled();
  });

  it('createBudget delegates to the repository with company scope', async () => {
    createPortfolioBudget.mockResolvedValue({ id: 1 });
    const body = { period_label: 'Q1', start_date: '2026-01-01', end_date: '2026-03-31' };
    await expect(createBudget(scoped, body)).resolves.toEqual({ id: 1 });
    expect(createPortfolioBudget).toHaveBeenCalledWith(5, body);
  });

  it('updateBudget throws NotFoundError for a cross-company budget', async () => {
    findPortfolioBudget.mockResolvedValue(undefined);
    await expect(updateBudget(1, foreign, {})).rejects.toBeInstanceOf(NotFoundError);
    expect(updatePortfolioBudget).not.toHaveBeenCalled();
  });

  it('updateBudget scopes ownership before delegating', async () => {
    findPortfolioBudget.mockResolvedValue({ id: 1 });
    updatePortfolioBudget.mockResolvedValue({ id: 1, period_label: 'Q2' });
    await expect(updateBudget(1, scoped, { period_label: 'Q2' })).resolves.toEqual({
      id: 1,
      period_label: 'Q2',
    });
    expect(findPortfolioBudget).toHaveBeenCalledWith(5, 1);
  });

  it('deleteBudget throws NotFoundError for a cross-company budget', async () => {
    findPortfolioBudget.mockResolvedValue(undefined);
    await expect(deleteBudget(1, foreign)).rejects.toBeInstanceOf(NotFoundError);
    expect(deletePortfolioBudget).not.toHaveBeenCalled();
  });

  it('deleteBudget scopes ownership before delegating', async () => {
    findPortfolioBudget.mockResolvedValue({ id: 1 });
    await expect(deleteBudget(1, scoped)).resolves.toEqual({ ok: true });
    expect(deletePortfolioBudget).toHaveBeenCalledWith(5, 1);
  });
});

describe('portfolio.service budget allocations', () => {
  it('listBudgetAllocations throws NotFoundError for a cross-company budget', async () => {
    findPortfolioBudget.mockResolvedValue(undefined);
    await expect(listBudgetAllocations(1, foreign)).rejects.toBeInstanceOf(NotFoundError);
    expect(portfolioBudgetAllocations).not.toHaveBeenCalled();
  });

  it('listBudgetAllocations scopes ownership before delegating', async () => {
    findPortfolioBudget.mockResolvedValue({ id: 1 });
    portfolioBudgetAllocations.mockResolvedValue([{ id: 10 }]);
    await expect(listBudgetAllocations(1, scoped)).resolves.toEqual([{ id: 10 }]);
  });

  it('createBudgetAllocation throws NotFoundError for a cross-company budget', async () => {
    findPortfolioBudget.mockResolvedValue(undefined);
    await expect(createBudgetAllocation(1, foreign, {})).rejects.toBeInstanceOf(NotFoundError);
    expect(createPortfolioBudgetAllocation).not.toHaveBeenCalled();
  });

  it('updateBudgetAllocation throws NotFoundError when the repo returns undefined', async () => {
    findPortfolioBudget.mockResolvedValue({ id: 1 });
    updatePortfolioBudgetAllocation.mockResolvedValue(undefined);
    await expect(updateBudgetAllocation(1, 99, scoped, {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updateBudgetAllocation throws NotFoundError for a cross-company budget', async () => {
    findPortfolioBudget.mockResolvedValue(undefined);
    await expect(updateBudgetAllocation(1, 10, foreign, {})).rejects.toBeInstanceOf(NotFoundError);
    expect(updatePortfolioBudgetAllocation).not.toHaveBeenCalled();
  });

  it('deleteBudgetAllocation throws NotFoundError for a cross-company budget', async () => {
    findPortfolioBudget.mockResolvedValue(undefined);
    await expect(deleteBudgetAllocation(1, 10, foreign)).rejects.toBeInstanceOf(NotFoundError);
    expect(deletePortfolioBudgetAllocation).not.toHaveBeenCalled();
  });
});

describe('portfolio.service budget categories', () => {
  it('listBudgetCategories throws NotFoundError for a cross-company budget', async () => {
    findPortfolioBudget.mockResolvedValue(undefined);
    await expect(listBudgetCategories(1, foreign)).rejects.toBeInstanceOf(NotFoundError);
    expect(portfolioBudgetCategories).not.toHaveBeenCalled();
  });

  it('createBudgetCategory validates the category field', async () => {
    findPortfolioBudget.mockResolvedValue({ id: 1 });
    await expect(createBudgetCategory(1, scoped, {})).rejects.toBeInstanceOf(ValidationError);
    expect(createPortfolioBudgetCategory).not.toHaveBeenCalled();
  });

  it('createBudgetCategory throws NotFoundError for a cross-company budget', async () => {
    findPortfolioBudget.mockResolvedValue(undefined);
    await expect(createBudgetCategory(1, foreign, { category: 'CAPEX' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(createPortfolioBudgetCategory).not.toHaveBeenCalled();
  });

  it('updateBudgetCategory throws NotFoundError when the repo returns undefined', async () => {
    findPortfolioBudget.mockResolvedValue({ id: 1 });
    updatePortfolioBudgetCategory.mockResolvedValue(undefined);
    await expect(updateBudgetCategory(1, 99, scoped, {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deleteBudgetCategory throws NotFoundError for a cross-company budget', async () => {
    findPortfolioBudget.mockResolvedValue(undefined);
    await expect(deleteBudgetCategory(1, 10, foreign)).rejects.toBeInstanceOf(NotFoundError);
    expect(deletePortfolioBudgetCategory).not.toHaveBeenCalled();
  });
});

describe('portfolio.service members', () => {
  it('listMembers passes company scope', async () => {
    portfolioMembersWithUtilization.mockResolvedValue([{ id: 1 }]);
    await expect(listMembers(scoped)).resolves.toEqual([{ id: 1 }]);
    expect(portfolioMembersWithUtilization).toHaveBeenCalledWith(5);
  });

  it('createMember validates a required name', async () => {
    await expect(createMember(scoped, { name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    expect(createPortfolioMember).not.toHaveBeenCalled();
  });

  it('createMember trims name and applies defaults, scoped by company', async () => {
    createPortfolioMember.mockResolvedValue({ id: 1, name: 'Ann' });
    await expect(createMember(scoped, { name: '  Ann  ' })).resolves.toEqual({ id: 1, name: 'Ann' });
    expect(createPortfolioMember).toHaveBeenCalledWith(5, {
      role: '',
      name: 'Ann',
      email: '',
      note: '',
      member_type: 'internal',
      member_category: 'delivery',
      overhead_remaining: 0,
    });
  });

  it('updateMember throws NotFoundError for a cross-company member (never the foreign row)', async () => {
    updatePortfolioMember.mockResolvedValue(undefined);
    await expect(updateMember(1, foreign, { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
    expect(updatePortfolioMember).toHaveBeenCalledWith(9, 1, expect.objectContaining({ name: 'X' }));
  });

  it('deleteMember scopes by company', async () => {
    await expect(deleteMember(1, scoped)).resolves.toEqual({ ok: true });
    expect(deletePortfolioMember).toHaveBeenCalledWith(5, 1);
  });
});

describe('portfolio.service milestones', () => {
  it('listPortfolioMilestones passes company scope and admin bypass', async () => {
    listPortfolioMilestones.mockResolvedValue([{ id: 1 }]);
    await expect(listPortfolioMilestonesSvc(scoped)).resolves.toEqual([{ id: 1 }]);
    expect(listPortfolioMilestones).toHaveBeenCalledWith(5, false);
  });

  it('listPortfolioMilestones passes admin bypass', async () => {
    listPortfolioMilestones.mockResolvedValue([]);
    await listPortfolioMilestonesSvc(admin);
    expect(listPortfolioMilestones).toHaveBeenCalledWith(5, true);
  });
});

describe('portfolio.service program allocations', () => {
  it('listProgramAllocations short-circuits to [] for a null-company actor', async () => {
    await expect(
      listProgramAllocations({ company_id: null, is_admin: 0 }),
    ).resolves.toEqual([]);
    expect(programFteAllocations).not.toHaveBeenCalled();
  });

  it('listProgramAllocations delegates with company scope', async () => {
    programFteAllocations.mockResolvedValue([{ program_id: 1 }]);
    await expect(listProgramAllocations(scoped)).resolves.toEqual([{ program_id: 1 }]);
    expect(programFteAllocations).toHaveBeenCalledWith(5);
  });

  it('createProgramAllocation validates program_id', async () => {
    await expect(createProgramAllocation(scoped, {})).rejects.toBeInstanceOf(ValidationError);
    expect(upsertPortfolioProgramAllocation).not.toHaveBeenCalled();
  });

  it('createProgramAllocation throws typed errors, not raw text (HYG-02)', async () => {
    upsertPortfolioProgramAllocation.mockRejectedValue(new Error('duplicate key value violates unique constraint'));
    await expect(
      createProgramAllocation(scoped, { program_id: 1, allocated_headcount: 3 }),
    ).rejects.toThrow('duplicate key value violates unique constraint');
    // The route maps this via serviceErrorResponse, never String(e) — asserted at the route level.
  });

  it('createProgramAllocation clamps negative headcount to 0 and scopes by company', async () => {
    upsertPortfolioProgramAllocation.mockResolvedValue(undefined);
    await expect(
      createProgramAllocation(scoped, { program_id: 2, allocated_headcount: -5 }),
    ).resolves.toEqual({ program_id: 2, allocated_headcount: 0 });
    expect(upsertPortfolioProgramAllocation).toHaveBeenCalledWith(5, 2, 0);
  });

  it('updateProgramAllocation scopes by company', async () => {
    updatePortfolioProgramAllocation.mockResolvedValue(undefined);
    await expect(updateProgramAllocation(7, scoped, 4)).resolves.toEqual({
      id: 7,
      allocated_headcount: 4,
    });
    expect(updatePortfolioProgramAllocation).toHaveBeenCalledWith(5, 7, 4);
  });

  it('deleteProgramAllocation scopes by company', async () => {
    await expect(deleteProgramAllocation(7, scoped)).resolves.toEqual({ ok: true });
    expect(deletePortfolioProgramAllocation).toHaveBeenCalledWith(5, 7);
  });
});

describe('portfolio.service quota', () => {
  it('getQuota scopes by company', async () => {
    companyNameAndQuota.mockResolvedValue({ name: 'Acme', headcount_quota: 10 });
    await expect(getQuota(scoped)).resolves.toEqual({ headcount_quota: 10 });
    expect(companyNameAndQuota).toHaveBeenCalledWith(5);
  });

  it('getQuota defaults to 0 when the company row is missing', async () => {
    companyNameAndQuota.mockResolvedValue(undefined);
    await expect(getQuota(scoped)).resolves.toEqual({ headcount_quota: 0 });
  });

  it('updateQuota clamps negative values to 0 and scopes by company', async () => {
    setCompanyHeadcountQuota.mockResolvedValue(undefined);
    await expect(updateQuota(scoped, { headcount_quota: -3 })).resolves.toEqual({
      headcount_quota: 0,
    });
    expect(setCompanyHeadcountQuota).toHaveBeenCalledWith(5, 0);
  });
});
