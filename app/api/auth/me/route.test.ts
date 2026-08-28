import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionFromRequest } = vi.hoisted(() => ({
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest }));

import { GET } from './route';

const sessionUser = {
  id: 1,
  username: 'ava',
  display_name: 'Ava',
  company_id: 5,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: ['cpmo', 'pm'] as const,
  status: 'active' as const,
  email: 'ava@example.com',
};

function meReq() {
  return new NextRequest('http://localhost/api/auth/me', { method: 'GET' });
}

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when there is no session', async () => {
    getSessionFromRequest.mockResolvedValue(null);

    const res = await GET(meReq());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toBeNull();
  });

  it('returns roles and status with existing profile fields', async () => {
    getSessionFromRequest.mockResolvedValue(sessionUser);

    const res = await GET(meReq());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: 1,
      username: 'ava',
      display_name: 'Ava',
      company_id: 5,
      company_name: 'Acme',
      is_admin: 0,
      onboarding_completed: 1,
      roles: ['cpmo', 'pm'],
      status: 'active',
    });
  });
});
