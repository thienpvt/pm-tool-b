import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getPortfolioDashboardFilters,
  savePortfolioDashboardFilters,
  clearPortfolioDashboardFilters,
} = vi.hoisted(() => ({
  getPortfolioDashboardFilters: vi.fn(),
  savePortfolioDashboardFilters: vi.fn(),
  clearPortfolioDashboardFilters: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/dashboards/backend/services/spec-dashboards.service', () => ({
  getPortfolioDashboardFilters,
  savePortfolioDashboardFilters,
  clearPortfolioDashboardFilters,
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

function jsonReq(method: string, body?: unknown, url = 'http://localhost/api/dashboards/portfolio/filters') {
  return new NextRequest(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({}) };

describe('GET /api/dashboards/portfolio/filters', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(401);
    expect(getPortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(403);
    expect(getPortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(403);
    expect(getPortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 403 for null-company admin session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nullCompanyAdminSession as never);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(403);
    expect(getPortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 200 with filters and updated_at for cpmo (D-07)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getPortfolioDashboardFilters.mockResolvedValue({
      filters: { stage: 'L2' },
      updated_at: '2026-08-26T00:00:00Z',
    });

    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filters).toEqual({ stage: 'L2' });
    expect(body.updated_at).toBe('2026-08-26T00:00:00Z');
    expect(getPortfolioDashboardFilters).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, company_id: 5 }),
    );
  });
});

describe('PUT /api/dashboards/portfolio/filters', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await PUT(jsonReq('PUT', { stage: 'L2' }), ctx);
    expect(res.status).toBe(401);
    expect(savePortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await PUT(jsonReq('PUT', { stage: 'L2' }), ctx);
    expect(res.status).toBe(403);
    expect(savePortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await PUT(jsonReq('PUT', { stage: 'L2' }), ctx);
    expect(res.status).toBe(403);
    expect(savePortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 400 for unknown filter key (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    const res = await PUT(jsonReq('PUT', { unknown_key: 'x' }), ctx);
    expect(res.status).toBe(400);
    expect(savePortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 200 and persists filters for cpmo (D-07)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    savePortfolioDashboardFilters.mockResolvedValue(undefined);

    const res = await PUT(jsonReq('PUT', { stage: 'L2' }), ctx);
    expect(res.status).toBe(200);
    expect(savePortfolioDashboardFilters).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, company_id: 5 }),
      { stage: 'L2' },
    );
  });
});

describe('POST /api/dashboards/portfolio/filters', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(jsonReq('POST', { action: 'clear' }), ctx);
    expect(res.status).toBe(401);
    expect(clearPortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await POST(jsonReq('POST', { action: 'clear' }), ctx);
    expect(res.status).toBe(403);
    expect(clearPortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST(jsonReq('POST', { action: 'defaults' }), ctx);
    expect(res.status).toBe(403);
    expect(clearPortfolioDashboardFilters).not.toHaveBeenCalled();
  });

  it('returns 200 for clear action (D-07, PDSH-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    clearPortfolioDashboardFilters.mockResolvedValue(undefined);

    const res = await POST(jsonReq('POST', { action: 'clear' }), ctx);
    expect(res.status).toBe(200);
    expect(clearPortfolioDashboardFilters).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, company_id: 5 }),
    );
  });

  it('returns 200 for defaults action (D-07, PDSH-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    clearPortfolioDashboardFilters.mockResolvedValue(undefined);

    const res = await POST(jsonReq('POST', { action: 'defaults' }), ctx);
    expect(res.status).toBe(200);
    expect(clearPortfolioDashboardFilters).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, company_id: 5 }),
    );
  });
});
