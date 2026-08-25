import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, getProjectPmIdentity, getExpenseInItemRepo, deleteExpenseRepo } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  getProjectPmIdentity: vi.fn(),
  getExpenseInItemRepo: vi.fn(),
  deleteExpenseRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow, getProjectPmIdentity }));
vi.mock('@/lib/repositories/budget.repo', () => ({
  getExpenseInItem: getExpenseInItemRepo,
  deleteExpense: deleteExpenseRepo,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { DELETE } from './route';

/**
 * Route-level proof that budget/[itemId]/expenses/[expId] now goes through
 * budget-items.service.ts + assertProjectAccess (HYG-02: 401 -> 403), plus the
 * item-scoping guard: a foreign expense (belonging to a different item) 404s.
 */
describe('DELETE /api/projects/[id]/budget/[itemId]/expenses/[expId] access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'ava@example.com' });
  });

  const params = () => ({ params: Promise.resolve({ id: '1', itemId: '2', expId: '9' }) });

  function req() {
    return new NextRequest('http://localhost/api/projects/1/budget/2/expenses/9', { method: 'DELETE' });
  }

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
    is_admin: 0, onboarding_completed: 1,
    roles: ['pm'], status: 'active', email: 'ava@example.com',
  };
  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  it('returns 403 (not 401) for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await DELETE(req(), params());

    expect(res.status).toBe(403);
    expect(getExpenseInItemRepo).not.toHaveBeenCalled();
    expect(deleteExpenseRepo).not.toHaveBeenCalled();
  });

  it('returns 404 when the expense belongs to a different item (scoping guard)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getExpenseInItemRepo.mockResolvedValue(undefined);

    const res = await DELETE(req(), params());

    expect(res.status).toBe(404);
    expect(deleteExpenseRepo).not.toHaveBeenCalled();
  });

  it('returns { ok: true } for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getExpenseInItemRepo.mockResolvedValue({ id: 9 });
    deleteExpenseRepo.mockResolvedValue({ ok: true });

    const res = await DELETE(req(), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
