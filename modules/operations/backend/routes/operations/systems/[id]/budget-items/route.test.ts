import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listBudgetItemsForSystem, createBudgetItemForSystem } = vi.hoisted(() => ({
  listBudgetItemsForSystem: vi.fn(),
  createBudgetItemForSystem: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/operations/backend/services/operations.service', () => ({
  listBudgetItemsForSystem,
  createBudgetItemForSystem,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

const session = {
  id: 1,
  username: 'ops',
  display_name: 'Ops User',
  company_id: 5,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: [] as const,
  status: 'active' as const,
  email: 'ops@acme.com',
};

function jsonReq(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/operations/systems/42/budget-items', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

const ctx = { params: Promise.resolve({ id: '42' }) };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/operations/systems/[id]/budget-items', () => {
  it('returns 401 without session and does not call service', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(401);
    expect(listBudgetItemsForSystem).not.toHaveBeenCalled();
  });

  it('returns 404 when service returns null', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    listBudgetItemsForSystem.mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
    expect(listBudgetItemsForSystem).toHaveBeenCalledWith(session, '42');
  });

  it('returns 200 and calls listBudgetItemsForSystem with session user', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    listBudgetItemsForSystem.mockResolvedValue([{ id: 1, name: 'Item' }]);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 1, name: 'Item' }]);
    expect(listBudgetItemsForSystem).toHaveBeenCalledWith(session, '42');
  });
});

describe('POST /api/operations/systems/[id]/budget-items', () => {
  it('returns 401 without session and does not call service', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(jsonReq('POST', { name: 'New Item' }), ctx);
    expect(res.status).toBe(401);
    expect(createBudgetItemForSystem).not.toHaveBeenCalled();
  });
});
