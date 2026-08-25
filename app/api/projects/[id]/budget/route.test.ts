import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  listBudgetItems,
  listExpenses,
  activityStats,
  createBudgetItemRepo,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  listBudgetItems: vi.fn(),
  listExpenses: vi.fn(),
  activityStats: vi.fn(),
  createBudgetItemRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/lib/repositories/budget.repo', () => ({
  listBudgetItems,
  listExpenses,
  activityStats,
  createBudgetItem: createBudgetItemRepo,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

describe('GET/POST /api/projects/[id]/budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActivePmAssignment.mockResolvedValue(true);
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  function req(method: string, url = 'http://localhost/api/projects/7/budget', body?: unknown) {
    return new NextRequest(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  const ownerSession = {
    id: 2,
    username: 'ava',
    display_name: 'Ava',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
    roles: ['pm'],
    status: 'active',
    email: 'ava@example.com',
  };

  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(req('GET'), params());
    expect(res.status).toBe(401);
    expect(listBudgetItems).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company project (HYG-02 was 401)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(listBudgetItems).not.toHaveBeenCalled();
  });

  it('returns owner success body with grouped expenses and rounded completion_pct', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    listBudgetItems.mockResolvedValue([{ id: 1, name: 'A' }]);
    listExpenses.mockResolvedValue([{ id: 10, budget_item_id: 1, amount: 5 }]);
    activityStats.mockResolvedValue({ avg_pct: 33.6, total: 1 });

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [{ id: 1, name: 'A', expenses: [{ id: 10, budget_item_id: 1, amount: 5 }] }],
      completion_pct: 34,
    });
  });

  it('POST creates for an owner with 201', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    const created = { id: 2, name: 'Server', type: 'CAPEX' };
    createBudgetItemRepo.mockResolvedValue(created);

    const res = await POST(
      req('POST', undefined, { name: 'Server', type: 'CAPEX' }),
      params(),
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(created);
  });

  it('POST returns 400 for empty name', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await POST(req('POST', undefined, { name: '  ', type: 'CAPEX' }), params());

    expect(res.status).toBe(400);
    expect(createBudgetItemRepo).not.toHaveBeenCalled();
  });
});
