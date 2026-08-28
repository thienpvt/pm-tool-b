import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocumentComplianceFn } = vi.hoisted(() => ({
  getDocumentComplianceFn: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/documents/backend/services/document-compliance.service', () => ({
  getDocumentCompliance: getDocumentComplianceFn,
}));

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

function jsonReq(url = 'http://localhost/api/dashboards/document-compliance') {
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => vi.clearAllMocks());

const ctx = { params: Promise.resolve({}) };

describe('GET /api/dashboards/document-compliance', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(401);
    expect(getDocumentComplianceFn).not.toHaveBeenCalled();
  });

  it('returns 403 for pm session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(getDocumentComplianceFn).not.toHaveBeenCalled();
  });

  it('returns 403 for viewer session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(getDocumentComplianceFn).not.toHaveBeenCalled();
  });

  it('returns 403 for null-company admin session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nullCompanyAdminSession as never);
    const res = await GET(jsonReq(), ctx);
    expect(res.status).toBe(403);
    expect(getDocumentComplianceFn).not.toHaveBeenCalled();
  });

  it('returns 200 with filters and projects for cpmo (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getDocumentComplianceFn.mockResolvedValue({
      filters: { stage: 'L2' },
      projects: [
        {
          project_id: 10,
          project_code: 'PRJ-001',
          name: 'Alpha',
          stage: 'L2',
          status: 'Active',
          rag: 'Green',
          compliance: 'compliant',
        },
      ],
    });

    const res = await GET(jsonReq('http://localhost/api/dashboards/document-compliance?stage=L2'), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].compliance).toBe('compliant');
    expect(getDocumentComplianceFn).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 1, company_id: 5 }),
      { stage: 'L2' },
    );
  });
});
