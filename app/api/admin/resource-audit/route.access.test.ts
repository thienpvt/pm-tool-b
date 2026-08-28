import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { addMissingTeamMembersToPortfolio } = vi.hoisted(() => ({
  addMissingTeamMembersToPortfolio: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/admin.repo', () => ({
  resourceAudit: vi.fn(async () => ({
    company: { id: 5, name: 'Acme' },
    inPortfolioNotInTeams: [],
    inTeamsNotInPortfolio: [],
  })),
  addMissingTeamMembersToPortfolio,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

describe('POST /api/admin/resource-audit access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addMissingTeamMembersToPortfolio.mockResolvedValue([]);
  });

  function req() {
    return new NextRequest('http://localhost/api/admin/resource-audit', { method: 'POST' });
  }

  const cpmoSession = {
    id: 2,
    username: 'cpmo',
    display_name: 'CPMO',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 1,
    onboarding_completed: 1,
    roles: ['cpmo'],
    status: 'active',
    email: 'cpmo@example.com',
  };

  const viewerSession = {
    ...cpmoSession,
    username: 'viewer',
    is_admin: 0,
    roles: ['viewer'],
  };

  it('returns 403 for viewer-only session and does not call addMissingTeamMembersToPortfolio (D-24)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession);
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect(addMissingTeamMembersToPortfolio).not.toHaveBeenCalled();
  });

  it('returns 200 for CPMO and calls addMissingTeamMembersToPortfolio with actor company', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession);
    addMissingTeamMembersToPortfolio.mockResolvedValue([{ id: 1, name: 'New' }]);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(addMissingTeamMembersToPortfolio).toHaveBeenCalledWith(5);
    await expect(res.json()).resolves.toEqual({ added: 1, members: [{ id: 1, name: 'New' }] });
  });
});
