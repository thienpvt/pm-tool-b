import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createTemplateVersion,
  listEffectiveTemplates,
  getTemplate,
  retireTemplate,
} = vi.hoisted(() => ({
  createTemplateVersion: vi.fn(),
  listEffectiveTemplates: vi.fn(),
  getTemplate: vi.fn(),
  retireTemplate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/documents/backend/services/document-templates.service', () => ({
  createTemplateVersion,
  listEffectiveTemplates,
  getTemplate,
  retireTemplate,
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

const pmSession = { ...cpmoSession, id: 2, username: 'pm', roles: ['pm'] as const };
const viewerSession = { ...cpmoSession, id: 3, username: 'viewer', roles: ['viewer'] as const };

const ctx = { params: Promise.resolve({}) };

beforeEach(() => vi.clearAllMocks());

function getReq(url = 'http://localhost/api/document-templates') {
  return new NextRequest(url, { method: 'GET' });
}

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/document-templates', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('GET /api/document-templates', () => {
  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(401);
    expect(listEffectiveTemplates).not.toHaveBeenCalled();
  });

  it('returns 200 for pm session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    listEffectiveTemplates.mockResolvedValue([{ id: 1, version: 1 }]);
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    expect(listEffectiveTemplates).toHaveBeenCalled();
  });

  it('returns 403 for viewer session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    listEffectiveTemplates.mockRejectedValue(new ForbiddenError());
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/document-templates', () => {
  const body = {
    catalog_id: 1,
    name: 'Charter',
    document_type: 'charter',
    effective_date: '2026-01-01',
    template_url: 'https://conf.example.com/t',
  };

  it('returns 401 without session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(postReq(body), ctx);
    expect(res.status).toBe(401);
    expect(createTemplateVersion).not.toHaveBeenCalled();
  });

  it('returns 201 for cpmo session (D-12, DOC-03)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    createTemplateVersion.mockResolvedValue({ id: 10, version: 1, ...body });
    const res = await POST(postReq(body), ctx);
    expect(res.status).toBe(201);
    expect(createTemplateVersion).toHaveBeenCalled();
  });

  it('returns 403 for pm session (D-12)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await POST(postReq(body), ctx);
    expect(res.status).toBe(403);
    expect(createTemplateVersion).not.toHaveBeenCalled();
  });
});
