import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createDocumentCatalogItem, listDocumentCatalog } = vi.hoisted(() => ({
  createDocumentCatalogItem: vi.fn(),
  listDocumentCatalog: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/documents/backend/services/document-catalog.service', () => ({
  createDocumentCatalogItem,
  listDocumentCatalog,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { ForbiddenError } from '@/lib/services/errors';
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

function getReq(url = 'http://localhost/api/document-catalog') {
  return new NextRequest(url, { method: 'GET' });
}

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/document-catalog', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({}) };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/document-catalog', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(401);
    expect(listDocumentCatalog).not.toHaveBeenCalled();
  });

  it('returns 200 for cpmo session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    listDocumentCatalog.mockResolvedValue([{ id: 1, name: 'Charter' }]);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(listDocumentCatalog).toHaveBeenCalled();
  });

  it('returns 200 for pm session with company_id (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    listDocumentCatalog.mockResolvedValue([]);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
  });

  it('returns 403 for viewer session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    listDocumentCatalog.mockRejectedValue(new ForbiddenError());
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/document-catalog', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(postReq({ name: 'Charter', stage: 'L2' }), ctx);
    expect(res.status).toBe(401);
    expect(createDocumentCatalogItem).not.toHaveBeenCalled();
  });

  it('returns 201 for cpmo session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    createDocumentCatalogItem.mockResolvedValue({ id: 10, name: 'Charter', stage: 'L2' });
    const res = await POST(postReq({ name: 'Charter', stage: 'L2' }), ctx);
    expect(res.status).toBe(201);
    expect(createDocumentCatalogItem).toHaveBeenCalled();
  });

  it('returns 403 for pm session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await POST(postReq({ name: 'Charter', stage: 'L2' }), ctx);
    expect(res.status).toBe(403);
    expect(createDocumentCatalogItem).not.toHaveBeenCalled();
  });

  it('returns 403 for null-company admin session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nullCompanyAdminSession as never);
    const res = await POST(postReq({ name: 'Charter', stage: 'L2' }), ctx);
    expect(res.status).toBe(403);
    expect(createDocumentCatalogItem).not.toHaveBeenCalled();
  });
});
