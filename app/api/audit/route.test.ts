import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listAuditLogs } = vi.hoisted(() => ({
  listAuditLogs: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/audit.service', () => ({ listAuditLogs }));

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

function jsonReq(url = 'http://localhost/api/audit') {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({}) };

describe('GET /api/audit', () => {
  it('returns 401 without session (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(401);
    expect(listAuditLogs).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(listAuditLogs).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(listAuditLogs).not.toHaveBeenCalled();
  });

  it('returns 200 with audit rows for cpmo company_id 5 (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    listAuditLogs.mockResolvedValue([
      {
        id: 1,
        company_id: 5,
        actor_id: 1,
        entity_type: 'user',
        entity_id: '10',
        action: 'create',
        before: null,
        after: { username: 'new' },
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].company_id).toBe(5);
    expect(listAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, company_id: 5 }),
      expect.any(Object),
    );
  });
});
