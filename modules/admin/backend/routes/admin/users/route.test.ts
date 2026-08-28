import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listUsers, createUser, updateUser, deactivateUser } = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/admin/backend/services/users.service', () => ({ listUsers, createUser, updateUser, deactivateUser }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST, PUT, DELETE } from './route';

const cpmoSession = {
  id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  company_id: 5,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: ['cpmo'] as const,
  status: 'active' as const,
  email: 'cpmo@acme.com',
};

const pmSession = {
  ...cpmoSession,
  id: 2,
  username: 'pm',
  roles: ['pm'] as const,
};

function jsonReq(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/users', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({}) };

describe('GET /api/admin/users', () => {
  it('returns 401 without session (D-19)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(401);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('returns 403 for non-cpmo session (D-21)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(403);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('returns 200 for cpmo and calls listUsers (D-21)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    listUsers.mockResolvedValue([{ id: 10, username: 'u1' }]);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 10, username: 'u1' }]);
    expect(listUsers).toHaveBeenCalled();
  });
});

describe('POST /api/admin/users', () => {
  it('returns 401 without session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(
      jsonReq('POST', {
        username: 'new',
        password: 'password1',
        email: 'new@acme.com',
        roles: ['pm'],
      }),
      ctx,
    );
    expect(res.status).toBe(401);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('returns 403 for non-cpmo', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await POST(
      jsonReq('POST', {
        username: 'new',
        password: 'password1',
        email: 'new@acme.com',
        roles: ['pm'],
      }),
      ctx,
    );
    expect(res.status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('returns 201 for cpmo create', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    createUser.mockResolvedValue({ id: 10, username: 'new' });
    const res = await POST(
      jsonReq('POST', {
        username: 'new',
        password: 'password1',
        email: 'new@acme.com',
        roles: ['pm'],
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/users', () => {
  it('returns 401 without session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/users?id=10', { method: 'DELETE' }),
      ctx,
    );
    expect(res.status).toBe(401);
    expect(deactivateUser).not.toHaveBeenCalled();
  });

  it('returns 403 for non-cpmo', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/users?id=10', { method: 'DELETE' }),
      ctx,
    );
    expect(res.status).toBe(403);
    expect(deactivateUser).not.toHaveBeenCalled();
  });

  it('calls deactivateUser not deleteAdminUser (D-07)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    deactivateUser.mockResolvedValue({ id: 10, status: 'inactive' });
    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/users?id=10', { method: 'DELETE' }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(deactivateUser).toHaveBeenCalledWith(expect.objectContaining({ user_id: 1 }), '10');
  });
});
