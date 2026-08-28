import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { exportConsolidatedWeekly } = vi.hoisted(() => ({
  exportConsolidatedWeekly: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/weekly/backend/services/weekly-tracking.service', () => ({ exportConsolidatedWeekly }));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

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

function jsonReq(body: unknown, url = 'http://localhost/api/weekly-periods/1/export') {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({ periodId: '1' }) };

describe('POST /api/weekly-periods/[periodId]/export', () => {
  it('returns 401 without session (D-11)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(jsonReq({ project_ids: [100], format: 'xlsx' }), ctx);
    expect(res.status).toBe(401);
    expect(exportConsolidatedWeekly).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session (D-11)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await POST(jsonReq({ project_ids: [100], format: 'xlsx' }), ctx);
    expect(res.status).toBe(403);
    expect(exportConsolidatedWeekly).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session (D-11)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST(jsonReq({ project_ids: [100], format: 'xlsx' }), ctx);
    expect(res.status).toBe(403);
    expect(exportConsolidatedWeekly).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid format from Zod without calling the service (D-14)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    const res = await POST(jsonReq({ project_ids: [100], format: 'pdf' }), ctx);
    expect(res.status).toBe(400);
    expect(exportConsolidatedWeekly).not.toHaveBeenCalled();
  });

  it('returns 200 with xlsx Content-Type and attachment filename for cpmo (D-07)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    exportConsolidatedWeekly.mockResolvedValue({
      buffer: Buffer.from('xlsx-bytes'),
      filename: '2026-W01 consolidated.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const res = await POST(jsonReq({ project_ids: [100], format: 'xlsx' }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain('2026-W01 consolidated.xlsx');
    expect(exportConsolidatedWeekly).toHaveBeenCalledWith(
      5,
      1,
      expect.objectContaining({ user_id: 1, company_id: 5 }),
      { project_ids: [100], format: 'xlsx' },
    );
  });
});
