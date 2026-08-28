import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listCompaniesPlatform } = vi.hoisted(() => ({
  listCompaniesPlatform: vi.fn(),
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual, getSessionFromRequest: vi.fn() };
});
vi.mock('@/lib/services/admin-platform.service', () => ({
  listCompaniesPlatform,
  createCompanyPlatform: vi.fn(),
  updateCompanyPlatform: vi.fn(),
  deleteCompanyPlatform: vi.fn(),
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
  return new NextRequest('http://localhost/api/admin/companies');
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/admin/companies', () => {
  it('returns 401 without session (D-23)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect(listCompaniesPlatform).not.toHaveBeenCalled();
  });

  it('returns 403 when is_admin is 0 (D-23)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nonAdminSession as never);
    const res = await GET(getReq());
    expect(res.status).toBe(403);
    expect(listCompaniesPlatform).not.toHaveBeenCalled();
  });

  it('returns 200 for is_admin 1 and calls listCompaniesPlatform', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(adminSession as never);
    listCompaniesPlatform.mockResolvedValue([{ id: 1, name: 'Acme', user_count: 3 }]);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    expect(listCompaniesPlatform).toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual([{ id: 1, name: 'Acme', user_count: 3 }]);
  });
});
