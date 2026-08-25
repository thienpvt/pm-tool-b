import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, getProjectPmIdentity, updateBudgetItemRepo, deleteBudgetItemRepo } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  getProjectPmIdentity: vi.fn(),
  updateBudgetItemRepo: vi.fn(),
  deleteBudgetItemRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow, getProjectPmIdentity }));
vi.mock('@/lib/repositories/budget.repo', () => ({
  updateBudgetItem: updateBudgetItemRepo,
  deleteBudgetItem: deleteBudgetItemRepo,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { DELETE, PUT } from './route';

/**
 * Route-level proof that budget/[itemId] now goes through budget-items.service.ts +
 * assertProjectAccess, replacing the file-local `authorize()` that used to collapse
 * cross-company to 401 (HYG-02/T-04-23: unified on 403, matching the parent
 * budget/route.ts fixed in 04-03).
 */
describe('PUT/DELETE /api/projects/[id]/budget/[itemId] access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'ava@example.com' });
  });

  const params = () => ({ params: Promise.resolve({ id: '1', itemId: '2' }) });

  function req(method: string, body?: unknown) {
    return new NextRequest('http://localhost/api/projects/1/budget/2', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
    is_admin: 0, onboarding_completed: 1,
    roles: ['pm'], status: 'active', email: 'ava@example.com',
  };
  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  it('PUT returns 403 (not 401) for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await PUT(req('PUT', { type: 'CAPEX', name: 'Renamed' }), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(updateBudgetItemRepo).not.toHaveBeenCalled();
  });

  it('PUT returns the updated row for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    const updated = { id: 2, name: 'Renamed' };
    updateBudgetItemRepo.mockResolvedValue(updated);

    const res = await PUT(req('PUT', { type: 'CAPEX', name: 'Renamed' }), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(updated);
  });

  it('DELETE returns 403 (not 401) for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(403);
    expect(deleteBudgetItemRepo).not.toHaveBeenCalled();
  });

  it('DELETE returns { ok: true } for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    deleteBudgetItemRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
