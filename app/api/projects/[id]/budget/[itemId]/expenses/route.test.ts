import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, listExpensesByItemRepo, getBudgetItemInProjectRepo, createExpenseRepo } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  listExpensesByItemRepo: vi.fn(),
  getBudgetItemInProjectRepo: vi.fn(),
  createExpenseRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/budget.repo', () => ({
  listExpensesByItem: listExpensesByItemRepo,
  getBudgetItemInProject: getBudgetItemInProjectRepo,
  createExpense: createExpenseRepo,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

/**
 * Route-level proof that budget/[itemId]/expenses now goes through
 * budget-items.service.ts + assertProjectAccess, replacing the file-local
 * `authorize()` (HYG-02: cross-company 401 → 403).
 */
describe('GET/POST /api/projects/[id]/budget/[itemId]/expenses access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = (itemId = '2') => ({ params: Promise.resolve({ id: '1', itemId }) });

  function req(method: string, body?: unknown) {
    return new NextRequest('http://localhost/api/projects/1/budget/2/expenses', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
    is_admin: 0, onboarding_completed: 1,
  };
  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  it('GET returns 403 (not 401) for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(403);
    expect(listExpensesByItemRepo).not.toHaveBeenCalled();
  });

  it('GET returns the expense list for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    const rows = [{ id: 9, description: 'Cloud bill' }];
    listExpensesByItemRepo.mockResolvedValue(rows);

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(rows);
  });

  it('POST returns 403 (not 401) for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await POST(req('POST', { description: 'Cloud bill' }), params());

    expect(res.status).toBe(403);
    expect(createExpenseRepo).not.toHaveBeenCalled();
  });

  it('POST returns 404 when the item belongs to a different project (scoping guard)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getBudgetItemInProjectRepo.mockResolvedValue(undefined);

    const res = await POST(req('POST', { description: 'Cloud bill' }), params('999'));

    expect(res.status).toBe(404);
    expect(createExpenseRepo).not.toHaveBeenCalled();
  });

  it('POST creates for an owner with 201', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getBudgetItemInProjectRepo.mockResolvedValue({ id: 2 });
    const created = { id: 9, description: 'Cloud bill' };
    createExpenseRepo.mockResolvedValue(created);

    const res = await POST(req('POST', { description: 'Cloud bill' }), params());

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(created);
  });
});
