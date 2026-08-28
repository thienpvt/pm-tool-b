import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCompanyWeeklyConfig, upsertCompanyWeeklyConfig } = vi.hoisted(() => ({
  getCompanyWeeklyConfig: vi.fn(),
  upsertCompanyWeeklyConfig: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/weekly/backend/services/weekly-reports.service', () => ({
  getCompanyWeeklyConfig,
  upsertCompanyWeeklyConfig,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, PUT } from './route';

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
  roles: ['pm'] as const,
};

function jsonReq(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/weekly-periods/config', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({}) };

describe('GET /api/weekly-periods/config', () => {
  it('returns 401 without session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(401);
  });

  it('returns 403 for pm', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(403);
  });

  it('returns 200 for cpmo', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getCompanyWeeklyConfig.mockResolvedValue({ due_weekday: 5, due_time_utc: '18:00:00' });
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(200);
    expect(getCompanyWeeklyConfig).toHaveBeenCalled();
  });
});

describe('PUT /api/weekly-periods/config', () => {
  it('returns 401 without session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await PUT(jsonReq('PUT', { due_weekday: 5, due_time_utc: '18:00:00' }), ctx);
    expect(res.status).toBe(401);
  });

  it('returns 403 for pm', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await PUT(jsonReq('PUT', { due_weekday: 5, due_time_utc: '18:00:00' }), ctx);
    expect(res.status).toBe(403);
  });

  it('returns 200 for cpmo upsert', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    upsertCompanyWeeklyConfig.mockResolvedValue(undefined);
    const res = await PUT(jsonReq('PUT', { due_weekday: 4, due_time_utc: '17:00:00' }), ctx);
    expect(res.status).toBe(200);
    expect(upsertCompanyWeeklyConfig).toHaveBeenCalled();
  });
});
