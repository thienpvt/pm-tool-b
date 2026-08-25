import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, listIssuesRepo } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  listIssuesRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/issues.repo', () => ({
  listIssues: listIssuesRepo,
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  deleteIssue: vi.fn(),
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

const owner = {
  id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
  is_admin: 0, onboarding_completed: 1,
};
const foreign = { ...owner, company_id: 9 };

describe('GET /api/projects/[id]/issues', () => {
  beforeEach(() => vi.clearAllMocks());
  const params = { params: Promise.resolve({ id: '7' }) };
  const req = () => new NextRequest('http://localhost/api/projects/7/issues');

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    expect((await GET(req(), params)).status).toBe(401);
  });

  it('returns 403 for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreign as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    expect((await GET(req(), params)).status).toBe(403);
    expect(listIssuesRepo).not.toHaveBeenCalled();
  });

  it('returns 200 list for owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(owner as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    listIssuesRepo.mockResolvedValue([{ id: 1 }]);
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 1 }]);
  });
});
