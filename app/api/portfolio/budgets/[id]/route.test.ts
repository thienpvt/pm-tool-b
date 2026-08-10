import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findPortfolioBudget,
  portfolioBudgetAllocations,
  portfolioBudgetCategories,
  spendByCategory,
} = vi.hoisted(() => ({
  findPortfolioBudget: vi.fn(),
  portfolioBudgetAllocations: vi.fn(),
  portfolioBudgetCategories: vi.fn(),
  spendByCategory: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/portfolio.repo', () => ({
  findPortfolioBudget,
  portfolioBudgetAllocations,
  portfolioBudgetCategories,
  spendByCategory,
  updatePortfolioBudget: vi.fn(),
  deletePortfolioBudget: vi.fn(),
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

const owner = {
  id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
  is_admin: 0, onboarding_completed: 1,
};
const foreign = { ...owner, company_id: 9, username: 'bob' };

describe('GET /api/portfolio/budgets/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  const params = { params: Promise.resolve({ id: '1' }) };
  const req = () => new NextRequest('http://localhost/api/portfolio/budgets/1');

  it('returns 401 without a session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    expect((await GET(req(), params)).status).toBe(401);
    expect(findPortfolioBudget).not.toHaveBeenCalled();
  });

  it('returns 404 (never the foreign row) for a cross-company budget id', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreign as never);
    findPortfolioBudget.mockResolvedValue(undefined);

    const res = await GET(req(), params);

    expect(res.status).toBe(404);
    expect(portfolioBudgetAllocations).not.toHaveBeenCalled();
    expect(portfolioBudgetCategories).not.toHaveBeenCalled();
  });

  it('returns the spendByCategory aggregate for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(owner as never);
    findPortfolioBudget.mockResolvedValue({ id: 1, total_amount: 1000 });
    portfolioBudgetCategories.mockResolvedValue([{ category: 'CAPEX', ceiling_amount: 500 }]);
    portfolioBudgetAllocations.mockResolvedValue([{ id: 10, allocated_amount: 600 }]);
    spendByCategory.mockResolvedValue({ used: 450 });

    const res = await GET(req(), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      budget: { id: 1, total_amount: 1000 },
      categories: [{ category: 'CAPEX', ceiling_amount: 500 }],
      allocations: [{ id: 10, allocated_amount: 600 }],
      summary: {
        total_allocated: 600,
        over_total: false,
        category_warnings: { CAPEX: { ceiling: 500, used: 450 } },
      },
    });
  });
});
