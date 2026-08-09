import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionFromRequest.mockResolvedValue({ is_admin: 1 });
    updateBudgetItem.mockResolvedValue(undefined);
  });

  it('returns 404 when the scoped update matches no child row', async () => {
    const request = new NextRequest('http://localhost/api/projects/1/budget/2', {
      method: 'PUT',
      body: JSON.stringify({ type: 'CAPEX', name: 'Foreign item' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: '1', itemId: '2' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });
});
