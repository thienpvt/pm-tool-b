import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { previewConsolidatedExport } = vi.hoisted(() => ({
  previewConsolidatedExport: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/weekly/backend/services/weekly-tracking.service', () => ({ previewConsolidatedExport }));

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

function jsonReq(body: unknown, url = 'http://localhost/api/weekly-periods/1/export/preview') {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({ periodId: '1' }) };

describe('POST /api/weekly-periods/[periodId]/export/preview', () => {
  it('returns 401 without session (D-11)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(jsonReq({ project_ids: [100] }), ctx);
    expect(res.status).toBe(401);
    expect(previewConsolidatedExport).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session (D-11)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await POST(jsonReq({ project_ids: [100] }), ctx);
    expect(res.status).toBe(403);
    expect(previewConsolidatedExport).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session (D-11)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST(jsonReq({ project_ids: [100] }), ctx);
    expect(res.status).toBe(403);
    expect(previewConsolidatedExport).not.toHaveBeenCalled();
  });

  it('returns 400 for empty project_ids from Zod without calling the service (D-14)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    const res = await POST(jsonReq({ project_ids: [] }), ctx);
    expect(res.status).toBe(400);
    expect(previewConsolidatedExport).not.toHaveBeenCalled();
  });

  it('returns 200 with preview payload for cpmo (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    previewConsolidatedExport.mockResolvedValue({
      period: { id: 1, display_name: '2026-W01' },
      sections: [{ project_id: 100, report_id: 10 }],
    });

    const res = await POST(jsonReq({ project_ids: [100] }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period.id).toBe(1);
    expect(body.sections).toHaveLength(1);
    expect(previewConsolidatedExport).toHaveBeenCalledWith(
      5,
      1,
      expect.objectContaining({ user_id: 1, company_id: 5 }),
      [100],
    );
  });
});
