import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPmDashboard } = vi.hoisted(() => ({
  getPmDashboard: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/spec-dashboards.service', () => ({ getPmDashboard }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

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

const viewerSession = {
  ...cpmoSession,
  id: 3,
  username: 'viewer',
  roles: ['viewer'] as const,
};

const nullCompanyCpmoSession = {
  id: 99,
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

function jsonReq(url = 'http://localhost/api/dashboards/pm') {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({}) };

describe('GET /api/dashboards/pm', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(401);
    expect(getPmDashboard).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session (D-09, D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(getPmDashboard).not.toHaveBeenCalled();
  });

  it('returns 403 for null company_id even with cpmo role (D-09, D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nullCompanyCpmoSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(getPmDashboard).not.toHaveBeenCalled();
  });

  it('returns 200 for pm session (D-09)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    getPmDashboard.mockResolvedValue({
      filters: {},
      projects: [{ id: 10, name: 'Alpha' }],
      actions: { weekly: [], milestones: [], raid: [] },
    });

    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(1);
    expect(getPmDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 2, company_id: 5 }),
    );
  });

  it('returns 200 for cpmo session — service still scopes by actor user_id (D-09)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getPmDashboard.mockResolvedValue({
      filters: {},
      projects: [],
      actions: { weekly: [], milestones: [], raid: [] },
    });

    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(200);
    expect(getPmDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, company_id: 5 }),
    );
  });
});
