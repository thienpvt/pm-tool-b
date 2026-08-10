import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionFromRequest, updateBudgetItem } = vi.hoisted(() => ({
  getSessionFromRequest: vi.fn(),
  updateBudgetItem: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest }));
vi.mock('@/lib/repositories/budget.repo', () => ({
  deleteBudgetItem: vi.fn(),
  updateBudgetItem,
}));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow: vi.fn() }));

import { PUT } from './route';

describe('PUT /api/projects/[id]/budget/[itemId]', () => {
  const request = () => new NextRequest('http://localhost/api/projects/1/budget/2', {
    method: 'PUT',
    body: JSON.stringify({ type: 'CAPEX', name: 'Foreign item' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const context = () => ({ params: Promise.resolve({ id: '1', itemId: '2' }) });

  beforeEach(() => {
    vi.clearAllMocks();
    getSessionFromRequest.mockResolvedValue({ is_admin: 1 });
    updateBudgetItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 when the scoped update matches no child row', async () => {
    const response = await PUT(request(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('does not expose an unexpected repository error', async () => {
    const internalMessage = 'duplicate key violates constraint budget_items_project_id_key';
    updateBudgetItem.mockRejectedValueOnce(new Error(internalMessage));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await PUT(request(), context());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(body)).not.toContain(internalMessage);
    // Route now goes through budget-items.service.ts (serviceErrorResponse), not the
    // repository-level repoErrorResponse, so the log tag changed with it (04-05-02).
    expect(errorLog).toHaveBeenCalledWith('Unexpected service error', expect.any(Error));
  });
});
