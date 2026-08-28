import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocumentCatalogItem, updateDocumentCatalogItem } = vi.hoisted(() => ({
  getDocumentCatalogItem: vi.fn(),
  updateDocumentCatalogItem: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/document-catalog.service', () => ({
  getDocumentCatalogItem,
  updateDocumentCatalogItem,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { ForbiddenError } from '@/lib/services/errors';
import { GET, PATCH } from './route';

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

function getReq(id = '10') {
  return new NextRequest(`http://localhost/api/document-catalog/${id}`, { method: 'GET' });
}

function patchReq(body: unknown, id = '10') {
  return new NextRequest(`http://localhost/api/document-catalog/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe('GET /api/document-catalog/[id]', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(getReq(), ctx('10'));
    expect(res.status).toBe(401);
    expect(getDocumentCatalogItem).not.toHaveBeenCalled();
  });

  it('returns 200 for pm session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    getDocumentCatalogItem.mockResolvedValue({ id: 10, name: 'Charter' });
    const res = await GET(getReq(), ctx('10'));
    expect(res.status).toBe(200);
    expect(getDocumentCatalogItem).toHaveBeenCalled();
  });

  it('returns 403 for viewer session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    getDocumentCatalogItem.mockRejectedValue(new ForbiddenError());
    const res = await GET(getReq(), ctx('10'));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/document-catalog/[id]', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await PATCH(patchReq({ name: 'Updated' }), ctx('10'));
    expect(res.status).toBe(401);
    expect(updateDocumentCatalogItem).not.toHaveBeenCalled();
  });

  it('returns 200 for cpmo session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    updateDocumentCatalogItem.mockResolvedValue({ id: 10, name: 'Updated' });
    const res = await PATCH(patchReq({ name: 'Updated' }), ctx('10'));
    expect(res.status).toBe(200);
    expect(updateDocumentCatalogItem).toHaveBeenCalled();
  });

  it('returns 403 for pm session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await PATCH(patchReq({ name: 'Updated' }), ctx('10'));
    expect(res.status).toBe(403);
    expect(updateDocumentCatalogItem).not.toHaveBeenCalled();
  });
});

describe('route exports (D-11)', () => {
  it('has no DELETE handler', async () => {
    const mod = await import('./route');
    expect(mod.DELETE).toBeUndefined();
  });
});
