import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listJqlPresets, createJqlPreset, deleteJqlPreset } = vi.hoisted(() => ({
  listJqlPresets: vi.fn(),
  createJqlPreset: vi.fn(),
  deleteJqlPreset: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/jira-mapping.service', () => ({
  listJqlPresets,
  createJqlPreset,
  deleteJqlPreset,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { ForbiddenError } from '@/lib/services/errors';
import { GET, POST } from './route';
import { DELETE } from './[id]/route';

/**
 * Route-level proof of the withAuth session gate on jira/jql-presets.
 * Had NO session check before Phase 6 — anonymous read/create + anonymous
 * bare-id DELETE (T-06-05/T-06-06).
 */
describe('GET/POST /api/jira/jql-presets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5,
    company_name: 'Acme', is_admin: 0, onboarding_completed: 1,
  };

  const params = (id = '1') => ({ params: Promise.resolve({ id }) });

  function req(method: string, url = 'http://localhost/api/jira/jql-presets', body?: unknown) {
    return new NextRequest(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  it('GET returns 401 with no session, service not called', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(req('GET'), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(listJqlPresets).not.toHaveBeenCalled();
  });

  it('POST returns 401 with no session, service not called', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(req('POST', undefined, { name: 'x', jql: 'project = A' }), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createJqlPreset).not.toHaveBeenCalled();
  });

  it('GET preserves the context query param for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const rows = [{ id: 1, name: 'p', jql: 'project = A', context: 'timeline' }];
    listJqlPresets.mockResolvedValue(rows);

    const res = await GET(req('GET', 'http://localhost/api/jira/jql-presets?context=timeline'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(rows);
    expect(listJqlPresets).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 5 }),
      'timeline',
    );
  });

  it('POST creates for an owner with 201', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const created = { id: 2, name: 'p2', jql: 'project = B', context: '' };
    createJqlPreset.mockResolvedValue(created);

    const res = await POST(req('POST', undefined, { name: 'p2', jql: 'project = B' }), params());

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(created);
    expect(createJqlPreset).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 5 }),
      'p2',
      'project = B',
      '',
      10,
    );
  });

  it('POST ignores company_id in body and stamps session company', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const created = { id: 3, name: 'p3', jql: 'project = C', context: '' };
    createJqlPreset.mockResolvedValue(created);

    const res = await POST(
      req('POST', undefined, { name: 'p3', jql: 'project = C', company_id: 999 }),
      params(),
    );

    expect(res.status).toBe(201);
    expect(createJqlPreset).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 5 }),
      'p3',
      'project = C',
      '',
      10,
    );
  });
});

describe('DELETE /api/jira/jql-presets/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5,
    company_name: 'Acme', is_admin: 0, onboarding_completed: 1,
  };

  const foreignSession = {
    id: 3, username: 'bob', display_name: 'Bob', company_id: 9,
    company_name: 'Other', is_admin: 0, onboarding_completed: 1,
  };

  const params = (id = '1') => ({ params: Promise.resolve({ id }) });

  function req(method: string, url = 'http://localhost/api/jira/jql-presets/1') {
    return new NextRequest(url, { method });
  }

  it('returns 401 with no session — the anonymous bare-id DELETE is closed (T-06-05)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await DELETE(req('DELETE'), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(deleteJqlPreset).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company preset (TENANT-01)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    deleteJqlPreset.mockRejectedValue(new ForbiddenError());

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(deleteJqlPreset).toHaveBeenCalledWith('1', expect.objectContaining({ company_id: 9 }));
  });

  it('returns { ok: true } for an authenticated caller (shape preserved)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    deleteJqlPreset.mockResolvedValue({ changes: 1 });

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteJqlPreset).toHaveBeenCalledWith('1', expect.objectContaining({ company_id: 5 }));
  });
});
