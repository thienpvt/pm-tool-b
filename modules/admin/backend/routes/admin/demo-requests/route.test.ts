import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listDemoRequestsPlatform } = vi.hoisted(() => ({
  listDemoRequestsPlatform: vi.fn(),
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, getSessionFromRequest: vi.fn() };
});
vi.mock('@/modules/admin/backend/services/admin-platform.service', () => ({
  listDemoRequestsPlatform,
  updateDemoRequestPlatform: vi.fn(),
  deleteDemoRequestPlatform: vi.fn(),
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

const adminSession = {
  id: 1,
  username: 'admin',
  display_name: 'Admin',
  company_id: null,
  company_name: null,
  is_admin: 1,
  onboarding_completed: 1,
  roles: ['cpmo'] as const,
  status: 'active' as const,
  email: 'admin@example.com',
};

const nonAdminSession = {
  ...adminSession,
  is_admin: 0,
};

function getReq() {
  return new NextRequest('http://localhost/api/admin/demo-requests');
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/admin/demo-requests', () => {
  it('returns 401 without session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect(listDemoRequestsPlatform).not.toHaveBeenCalled();
  });

  it('returns 403 when is_admin is 0', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nonAdminSession as never);
    const res = await GET(getReq());
    expect(res.status).toBe(403);
    expect(listDemoRequestsPlatform).not.toHaveBeenCalled();
  });

  it('returns 200 for is_admin 1 and calls listDemoRequestsPlatform', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(adminSession as never);
    listDemoRequestsPlatform.mockResolvedValue([{ id: 1, email: 'a@example.com' }]);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    expect(listDemoRequestsPlatform).toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual([{ id: 1, email: 'a@example.com' }]);
  });
});
