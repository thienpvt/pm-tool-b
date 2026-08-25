import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listTimelineMappings,
  createTimelineMapping,
  updateTimelineMapping,
  deleteTimelineMapping,
} = vi.hoisted(() => ({
  listTimelineMappings: vi.fn(),
  createTimelineMapping: vi.fn(),
  updateTimelineMapping: vi.fn(),
  deleteTimelineMapping: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/import-mapping.service', () => ({
  listTimelineMappings,
  createTimelineMapping,
  updateTimelineMapping,
  deleteTimelineMapping,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { ForbiddenError } from '@/lib/services/errors';
import { GET, POST } from './route';
import { DELETE, PUT } from './[id]/route';

/**
 * Route-level proof of the withAuth session gate on import-mapping.
 * These routes had NO session check before Phase 6 (T-06-05/T-06-06) —
 * anonymous DELETE + anonymous write on tenant timeline templates.
 */
describe('GET/POST /api/import-mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5,
    company_name: 'Acme', is_admin: 0, onboarding_completed: 1,
  };

  const params = (id = '1') => ({ params: Promise.resolve({ id }) });

  function req(method: string, url = 'http://localhost/api/import-mapping', body?: unknown) {
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
    expect(listTimelineMappings).not.toHaveBeenCalled();
  });

  it('POST returns 401 with no session, service not called', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(req('POST', undefined, { name: 'x', mappings_json: '{}' }), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createTimelineMapping).not.toHaveBeenCalled();
  });

  it('GET returns the prior list shape for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const rows = [{ id: 1, name: 'tpl', mappings_json: '{}' }];
    listTimelineMappings.mockResolvedValue(rows);

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(rows);
    expect(listTimelineMappings).toHaveBeenCalledWith(expect.objectContaining({ company_id: 5 }));
  });

  it('POST creates for an owner with 201', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const created = { id: 2, name: 'tpl2', mappings_json: '{}' };
    createTimelineMapping.mockResolvedValue(created);

    const res = await POST(req('POST', undefined, { name: 'tpl2', mappings_json: '{}' }), params());

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(created);
    expect(createTimelineMapping).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 5 }),
      'tpl2',
      '{}',
    );
  });

  it('POST returns 400 { error: Missing fields } on schema failure', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const res = await POST(req('POST', undefined, { mappings_json: '{}' }), params());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Missing fields' });
    expect(createTimelineMapping).not.toHaveBeenCalled();
  });
});

describe('DELETE/PUT /api/import-mapping/[id]', () => {
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

  function req(method: string, url = 'http://localhost/api/import-mapping/1', body?: unknown) {
    return new NextRequest(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  it('DELETE returns 401 with no session — the anonymous DELETE hole is closed (T-06-05)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await DELETE(req('DELETE'), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(deleteTimelineMapping).not.toHaveBeenCalled();
  });

  it('PUT returns 401 with no session — the anonymous write hole is closed (T-06-05)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await PUT(req('PUT', undefined, { name: 'x', mappings_json: '{}' }), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(updateTimelineMapping).not.toHaveBeenCalled();
  });

  it('DELETE returns 403 for a cross-company mapping', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    deleteTimelineMapping.mockRejectedValue(new ForbiddenError());

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('PUT returns 403 for a cross-company mapping', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    updateTimelineMapping.mockRejectedValue(new ForbiddenError());

    const res = await PUT(req('PUT', undefined, { name: 'x', mappings_json: '{}' }), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('DELETE returns { ok: true } for an authenticated caller (shape preserved)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    deleteTimelineMapping.mockResolvedValue({ changes: 1 });

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteTimelineMapping).toHaveBeenCalledWith('1', expect.objectContaining({ company_id: 5 }));
  });

  it('PUT returns the updated row for an authenticated caller (shape preserved)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const updated = { id: 1, name: 'renamed', mappings_json: '{}' };
    updateTimelineMapping.mockResolvedValue(updated);

    const res = await PUT(req('PUT', undefined, { name: 'renamed', mappings_json: '{}' }), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(updated);
    expect(updateTimelineMapping).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ company_id: 5 }),
      'renamed',
      '{}',
    );
  });
});
