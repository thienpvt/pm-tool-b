import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listWeeklyPeriods, createWeeklyPeriod } = vi.hoisted(() => ({
  listWeeklyPeriods: vi.fn(),
  createWeeklyPeriod: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/weekly-reports.service', () => ({ listWeeklyPeriods, createWeeklyPeriod }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

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

function jsonReq(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/weekly-periods', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({}) };

describe('GET /api/weekly-periods', () => {
  it('returns 401 without session (D-13)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(401);
    expect(listWeeklyPeriods).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(403);
    expect(listWeeklyPeriods).not.toHaveBeenCalled();
  });

  it('returns 200 for cpmo', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    listWeeklyPeriods.mockResolvedValue([]);
    const res = await GET(jsonReq('GET'), ctx);
    expect(res.status).toBe(200);
    expect(listWeeklyPeriods).toHaveBeenCalled();
  });
});

describe('POST /api/weekly-periods', () => {
  it('returns 401 without session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(jsonReq('POST', { iso_week: '2026-W01' }), ctx);
    expect(res.status).toBe(401);
    expect(createWeeklyPeriod).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await POST(jsonReq('POST', { iso_week: '2026-W01' }), ctx);
    expect(res.status).toBe(403);
    expect(createWeeklyPeriod).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST(jsonReq('POST', { iso_week: '2026-W01' }), ctx);
    expect(res.status).toBe(403);
    expect(createWeeklyPeriod).not.toHaveBeenCalled();
  });

  it('returns 201 for cpmo with display_name and shells (D-15)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    createWeeklyPeriod.mockResolvedValue({
      id: 1,
      iso_week: '2026-W01',
      display_name: '2026-W01 | 2025-12-29 – 2026-01-04',
      due_at: '2026-01-02T18:00:00.000Z',
      config_snapshot: { due_weekday: 5, due_time_utc: '18:00:00', obligation_rule_version: 1 },
      shells: [{ id: 10, project_id: 100, status: 'not_submitted' }],
    });
    const res = await POST(jsonReq('POST', { iso_week: '2026-W01' }), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.display_name).toBe('2026-W01 | 2025-12-29 – 2026-01-04');
    expect(body.shells).toHaveLength(1);
    expect(createWeeklyPeriod).toHaveBeenCalled();
  });
});
