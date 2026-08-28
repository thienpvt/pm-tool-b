import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listAuditLogsRepo } = vi.hoisted(() => ({
  listAuditLogsRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/audit/backend/repositories/audit.repo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/audit/backend/repositories/audit.repo')>();
  return {
    ...actual,
    listAuditLogs: listAuditLogsRepo,
  };
});

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';
import * as routeModule from './route';

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

const nullCompanyCpmoSession = {
  ...cpmoSession,
  id: 4,
  username: 'cpmo-null',
  company_id: null,
  company_name: null,
  roles: ['cpmo'] as const,
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
    expect(listAuditLogsRepo).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(listAuditLogsRepo).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(listAuditLogsRepo).not.toHaveBeenCalled();
  });

  it('returns 403 for null-company admin session (D-05, D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nullCompanyAdminSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(listAuditLogsRepo).not.toHaveBeenCalled();
  });

  it('returns 403 for null-company cpmo session via assertCompanyWrite (D-05, D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nullCompanyCpmoSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(listAuditLogsRepo).not.toHaveBeenCalled();
  });

  it('returns 200 with audit rows for cpmo company_id 5 (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    listAuditLogsRepo.mockResolvedValue([
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
    expect(listAuditLogsRepo).toHaveBeenCalledWith(5, expect.objectContaining({ limit: 50 }));
  });

  it('never includes foreign-company rows in the JSON body (D-05, AUDIT-01)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    listAuditLogsRepo.mockResolvedValue([
      {
        id: 1,
        company_id: 5,
        actor_id: 1,
        entity_type: 'user',
        entity_id: '10',
        action: 'create',
        before: null,
        after: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.some((r: { company_id: number }) => r.company_id === 9)).toBe(false);
    expect(body.every((r: { company_id: number }) => r.company_id === 5)).toBe(true);
  });

  it('forwards entity_type, entity_id, from, to, and limit query params (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    listAuditLogsRepo.mockResolvedValue([]);

    await GET(
      jsonReq(
        'http://localhost/api/audit?entity_type=user&entity_id=10&from=2026-01-01&to=2026-01-31&limit=100',
      ),
      ctx,
    );

    expect(listAuditLogsRepo).toHaveBeenCalledWith(5, {
      entity_type: 'user',
      entity_id: '10',
      from: '2026-01-01',
      to: '2026-01-31',
      limit: 100,
    });
  });
});

describe('audit route module shape (D-04)', () => {
  it('exports GET only — no POST, PUT, PATCH, or DELETE', () => {
    expect(routeModule).toHaveProperty('GET');
    expect(routeModule).not.toHaveProperty('POST');
    expect(routeModule).not.toHaveProperty('PUT');
    expect(routeModule).not.toHaveProperty('PATCH');
    expect(routeModule).not.toHaveProperty('DELETE');
  });
});
