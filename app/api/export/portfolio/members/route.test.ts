import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listPortfolioMembers, companyNameAndQuota } = vi.hoisted(() => ({
  listPortfolioMembers: vi.fn(),
  companyNameAndQuota: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/portfolio.repo', () => ({ listPortfolioMembers, companyNameAndQuota }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

describe('GET /api/export/portfolio/members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = () => ({ params: Promise.resolve({}) });
  const req = () => new NextRequest('http://localhost/api/export/portfolio/members');

  const ownerSession = {
    id: 2,
    username: 'ava',
    display_name: 'Ava',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
  };

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(req(), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(listPortfolioMembers).not.toHaveBeenCalled();
  });

  it('returns 200 with original headers for a session (company-scoped, no project id)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    listPortfolioMembers.mockResolvedValue([]);
    companyNameAndQuota.mockResolvedValue({ name: 'Acme', headcount_quota: 10 });

    const res = await GET(req(), params());

    expect(res.status).toBe(200);
    expect(listPortfolioMembers).toHaveBeenCalledWith(5);
    expect(companyNameAndQuota).toHaveBeenCalledWith(5);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="ResourceManagement_Acme.xlsx"',
    );
  });
});
