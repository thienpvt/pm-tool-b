import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCompanyJiraConfigOrEmpty, getSessionFromRequest } = vi.hoisted(() => ({
  getCompanyJiraConfigOrEmpty: vi.fn(),
  getSessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  forbidden: vi.fn(),
  getSessionFromRequest,
  unauthorized: vi.fn(),
}));
vi.mock('@/lib/services/jira-config.service', () => ({
  getCompanyJiraConfigOrEmpty,
  setCompanyJiraConfigVars: vi.fn(),
}));

import { GET } from './route';

describe('GET /api/admin/jira-config/[companyId] (WR-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionFromRequest.mockResolvedValue({ is_admin: 1 });
  });

  it('returns 400 for non-numeric companyId', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/admin/jira-config/abc'),
      { params: Promise.resolve({ companyId: 'abc' }) },
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid company id' });
    expect(getCompanyJiraConfigOrEmpty).not.toHaveBeenCalled();
  });
});
