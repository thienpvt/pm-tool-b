import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listOperationsSystems, createOperationsSystem } = vi.hoisted(() => ({
  listOperationsSystems: vi.fn(),
  createOperationsSystem: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/operations.service', () => ({
  listOperationsSystems,
  createOperationsSystem,
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
  return new NextRequest('http://localhost/api/operations/systems', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

const ctx = { params: Promise.resolve({}) };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/operations/systems', () => {
  it('returns 401 without session and does not call service', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(401);
    expect(listOperationsSystems).not.toHaveBeenCalled();
  });

  it('returns 200 and calls listOperationsSystems with session user', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    listOperationsSystems.mockResolvedValue([{ id: 1, name: 'Sys' }]);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 1, name: 'Sys' }]);
    expect(listOperationsSystems).toHaveBeenCalledWith(session);
  });
});

describe('POST /api/operations/systems', () => {
  it('returns 401 without session and does not call service', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(jsonReq('POST', { name: 'New Sys' }), ctx);
    expect(res.status).toBe(401);
    expect(createOperationsSystem).not.toHaveBeenCalled();
  });

  it('returns 201 for valid body and calls createOperationsSystem', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    createOperationsSystem.mockResolvedValue({ id: 10, name: 'New Sys' });
    const res = await POST(jsonReq('POST', { name: 'New Sys' }), ctx);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: 10, name: 'New Sys' });
    expect(createOperationsSystem).toHaveBeenCalledWith(session, {
      name: 'New Sys',
      description: undefined,
      project_id: undefined,
      go_live_date: undefined,
      status: undefined,
    });
  });
});
