import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOperationsSystemDetail, updateOperationsSystemForUser, deleteOperationsSystemForUser } =
  vi.hoisted(() => ({
    getOperationsSystemDetail: vi.fn(),
    updateOperationsSystemForUser: vi.fn(),
    deleteOperationsSystemForUser: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/operations/backend/services/operations.service', () => ({
  getOperationsSystemDetail,
  updateOperationsSystemForUser,
  deleteOperationsSystemForUser,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { DELETE, GET } from './route';

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
  return new NextRequest('http://localhost/api/operations/systems/42', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

const ctx = { params: Promise.resolve({ id: '42' }) };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/operations/systems/[id]', () => {
  it('returns 401 without session and does not call service', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(401);
    expect(getOperationsSystemDetail).not.toHaveBeenCalled();
  });

  it('returns 200 with system bundle when detail exists', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    const bundle = {
      system: { id: 42, name: 'Sys' },
      budgetItems: [],
      expenses: [],
      incidents: [],
    };
    getOperationsSystemDetail.mockResolvedValue(bundle);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(bundle);
    expect(getOperationsSystemDetail).toHaveBeenCalledWith(session, '42');
  });

  it('returns 404 when detail is null', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    getOperationsSystemDetail.mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
  });
});

describe('DELETE /api/operations/systems/[id] (CR-02)', () => {
  it('returns 401 without session and does not call service', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await DELETE(jsonReq('DELETE'), ctx);
    expect(res.status).toBe(401);
    expect(deleteOperationsSystemForUser).not.toHaveBeenCalled();
  });

  it('returns 404 when delete returns false', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    deleteOperationsSystemForUser.mockResolvedValue(false);
    const res = await DELETE(jsonReq('DELETE'), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('returns 200 ok when delete succeeds', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    deleteOperationsSystemForUser.mockResolvedValue(true);
    const res = await DELETE(jsonReq('DELETE'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
