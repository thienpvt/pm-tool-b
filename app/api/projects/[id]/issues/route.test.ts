import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  listIssuesRepo,
  createIssueRepo,
  updateIssueRepo,
  findIssueByCode,
  getIssueRepo,
  deactivateIssueRepo,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  listIssuesRepo: vi.fn(),
  createIssueRepo: vi.fn(),
  updateIssueRepo: vi.fn(),
  findIssueByCode: vi.fn(),
  getIssueRepo: vi.fn(),
  deactivateIssueRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/modules/projects/backend/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/modules/projects/backend/repositories/issues.repo', () => ({
  listIssues: listIssuesRepo,
  createIssue: createIssueRepo,
  updateIssue: updateIssueRepo,
  findIssueByCode,
  getIssue: getIssueRepo,
  deactivateIssue: deactivateIssueRepo,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { DELETE, GET } from './route';

const owner = {
  id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
  is_admin: 0, onboarding_completed: 1, roles: ['pm'], status: 'active', email: 'ava@example.com',
};
const foreign = { ...owner, company_id: 9 };

describe('GET/DELETE /api/projects/[id]/issues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActivePmAssignment.mockResolvedValue(true);
    findIssueByCode.mockResolvedValue(undefined);
  });

  const params = { params: Promise.resolve({ id: '7' }) };
  const req = (method: string, url = 'http://localhost/api/projects/7/issues') =>
    new NextRequest(url, { method });

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    expect((await GET(req('GET'), params)).status).toBe(401);
  });

  it('returns 403 for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreign as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    expect((await GET(req('GET'), params)).status).toBe(403);
    expect(listIssuesRepo).not.toHaveBeenCalled();
  });

  it('returns 200 list for owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(owner as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    listIssuesRepo.mockResolvedValue([{ id: 1 }]);
    const res = await GET(req('GET'), params);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 1 }]);
  });

  it('DELETE returns { ok: true } and deactivates for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(owner as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getIssueRepo.mockResolvedValue({ id: 1, status: 'Open' });
    deactivateIssueRepo.mockResolvedValue({ id: 1, status: 'deactivated' });

    const res = await DELETE(
      req('DELETE', 'http://localhost/api/projects/7/issues?rowId=1'),
      params,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deactivateIssueRepo).toHaveBeenCalledWith('7', '1');
  });
});
