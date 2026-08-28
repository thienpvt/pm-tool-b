import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getPmDashboardFilters,
  savePmDashboardFilters,
  clearPmDashboardFilters,
} = vi.hoisted(() => ({
  getPmDashboardFilters: vi.fn(),
  savePmDashboardFilters: vi.fn(),
  clearPmDashboardFilters: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/dashboards/backend/services/spec-dashboards.service', () => ({
  getPmDashboardFilters,
  savePmDashboardFilters,
  clearPmDashboardFilters,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST, PUT } from './route';

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

function jsonReq(method: string, body?: unknown, url = 'http://localhost/api/dashboards/pm/filters') {
  return new NextRequest(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({}) };

describe('GET /api/dashboards/pm/filters', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(401);
    expect(getPmDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(403);
    expect(getPmDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 200 with filters for pm session (D-07)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    getPmDashboardFilters.mockResolvedValue({
      filters: { stage: 'L2' },
      updated_at: '2026-08-26T00:00:00Z',
    });

    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filters).toEqual({ stage: 'L2' });
    expect(getPmDashboardFilters).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 2, company_id: 5 }),
    );
  });
});

describe('PUT /api/dashboards/pm/filters', () => {
  it('returns 403 for viewer session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await PUT(jsonReq('PUT', { stage: 'L2' }), ctx);
    expect(res.status).toBe(403);
    expect(savePmDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 200 and persists filters for pm session (D-07)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    savePmDashboardFilters.mockResolvedValue(undefined);

    const res = await PUT(jsonReq('PUT', { stage: 'L2' }), ctx);
    expect(res.status).toBe(200);
    expect(savePmDashboardFilters).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 2, company_id: 5 }),
      { stage: 'L2' },
    );
  });
});

describe('POST /api/dashboards/pm/filters', () => {
  it('returns 403 for viewer session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST(jsonReq('POST', { action: 'clear' }), ctx);
    expect(res.status).toBe(403);
    expect(clearPmDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 200 for clear action on pm session (D-07)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    clearPmDashboardFilters.mockResolvedValue(undefined);

    const res = await POST(jsonReq('POST', { action: 'clear' }), ctx);
    expect(res.status).toBe(200);
    expect(clearPmDashboardFilters).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 2, company_id: 5 }),
    );
  });
});
