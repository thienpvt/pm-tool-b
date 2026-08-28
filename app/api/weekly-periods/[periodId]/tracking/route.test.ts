import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPeriodTracking } = vi.hoisted(() => ({
  getPeriodTracking: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/weekly-tracking.service', () => ({ getPeriodTracking }));

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

function jsonReq(url = 'http://localhost/api/weekly-periods/1/tracking') {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({ periodId: '1' }) };

describe('GET /api/weekly-periods/[periodId]/tracking', () => {
  it('returns 401 without session (D-11)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(401);
    expect(getPeriodTracking).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(getPeriodTracking).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(getPeriodTracking).not.toHaveBeenCalled();
  });

  it('returns 200 with period, counts, and rows for cpmo (CPMO-01)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getPeriodTracking.mockResolvedValue({
      period: { id: 1, display_name: '2026-W01', iso_week: '2026-W01' },
      counts: { obligated: 1, not_submitted: 1, draft: 0, submitted: 0, overdue: 0, late: 0 },
      rows: [{ project_id: 100, report_id: 10, status: 'not_submitted' }],
    });

    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period.id).toBe(1);
    expect(body.counts.obligated).toBe(1);
    expect(body.rows).toHaveLength(1);
    expect(getPeriodTracking).toHaveBeenCalledWith(
      5,
      1,
      expect.objectContaining({ user_id: 1, company_id: 5 }),
      {},
    );
  });

  it('forwards query filters to getPeriodTracking (D-05)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getPeriodTracking.mockResolvedValue({
      period: { id: 1 },
      counts: { obligated: 0, not_submitted: 0, draft: 0, submitted: 0, overdue: 0, late: 0 },
      rows: [],
    });

    const url =
      'http://localhost/api/weekly-periods/1/tracking?status=overdue&lateness=late&pm_user_id=7&stage=L3&rag=Amber&technology_council=true';
    const res = await GET(jsonReq(url), ctx);
    expect(res.status).toBe(200);
    expect(getPeriodTracking).toHaveBeenCalledWith(
      5,
      1,
      expect.objectContaining({ company_id: 5 }),
      {
        status: 'overdue',
        lateness: 'late',
        pm_user_id: 7,
        stage: 'L3',
        rag: 'Amber',
        technology_council: true,
      },
    );
  });
});
