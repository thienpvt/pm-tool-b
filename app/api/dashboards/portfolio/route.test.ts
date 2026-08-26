import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPortfolioDashboard } = vi.hoisted(() => ({
  getPortfolioDashboard: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/spec-dashboards.service', () => ({ getPortfolioDashboard }));

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

const nullCompanyAdminSession = {
  id: 99,
  username: 'admin',
  display_name: 'Admin',
  company_id: null,
  company_name: null,
  is_admin: 1,
  onboarding_completed: 1,
  roles: [] as const,
  status: 'active' as const,
  email: 'admin@example.com',
};

function jsonReq(url = 'http://localhost/api/dashboards/portfolio') {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({}) };

describe('GET /api/dashboards/portfolio', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(401);
    expect(getPortfolioDashboard).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(getPortfolioDashboard).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(getPortfolioDashboard).not.toHaveBeenCalled();
  });

  it('returns 403 for null-company admin session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nullCompanyAdminSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(getPortfolioDashboard).not.toHaveBeenCalled();
  });

  it('returns 200 with filters, kpis, charts, list, drilldowns for cpmo (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getPortfolioDashboard.mockResolvedValue({
      filters: {},
      kpis: { active_count: 2, on_track_count: 1, watch_act_count: 1 },
      charts: { by_stage: {}, by_rag: { green: 1, amber: 1, red: 0 } },
      list: [{ id: 10, name: 'Alpha' }],
      drilldowns: { overdue_milestones: [], high_raid: [], technology_council: [] },
    });

    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis.active_count).toBe(2);
    expect(body.list).toHaveLength(1);
    expect(body.drilldowns).toBeDefined();
    expect(getPortfolioDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, company_id: 5 }),
    );
  });
});
