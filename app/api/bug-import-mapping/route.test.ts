import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listBugMappings, createBugMapping, deleteBugMapping } = vi.hoisted(() => ({
  listBugMappings: vi.fn(),
  createBugMapping: vi.fn(),
  deleteBugMapping: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/import-mapping.service', () => ({
  listBugMappings,
  createBugMapping,
  deleteBugMapping,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { ForbiddenError } from '@/lib/services/errors';
import { GET, POST } from './route';
import { DELETE } from './[id]/route';

/**
 * Route-level proof of the withAuth session gate on bug-import-mapping.
 * These routes had NO session check before Phase 6 (T-06-05/T-06-06) —
 * the destructive bare-id DELETE wiped a tenant's template with no auth at all.
 */
describe('GET/POST /api/bug-import-mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5,
    company_name: 'Acme', is_admin: 0, onboarding_completed: 1,
  };

  const params = (id = '1') => ({ params: Promise.resolve({ id }) });

  function req(method: string, url = 'http://localhost/api/bug-import-mapping', body?: unknown) {
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
    expect(listBugMappings).not.toHaveBeenCalled();
  });

  it('POST returns 401 with no session, service not called', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(req('POST', undefined, { name: 'x', mappings_json: '{}' }), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createBugMapping).not.toHaveBeenCalled();
  });

  it('GET returns the prior list shape for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const rows = [{ id: 1, name: 'tpl', mappings_json: '{}' }];
    listBugMappings.mockResolvedValue(rows);

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(rows);
    expect(listBugMappings).toHaveBeenCalledWith(expect.objectContaining({ company_id: 5 }));
  });

  it('POST creates for an owner with 201', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const created = { id: 2, name: 'tpl2', mappings_json: '{}' };
    createBugMapping.mockResolvedValue(created);

    const res = await POST(req('POST', undefined, { name: 'tpl2', mappings_json: '{}' }), params());

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(created);
    expect(createBugMapping).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 5 }),
      'tpl2',
      '{}',
    );
  });

  it('POST rejects invalid body with 400 Missing fields, before service call', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);

    const res = await POST(req('POST', undefined, { name: '' }), params());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Missing fields' });
    expect(createBugMapping).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/bug-import-mapping/[id]', () => {
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

  function req(method: string, url = 'http://localhost/api/bug-import-mapping/1') {
    return new NextRequest(url, { method });
  }

  it('returns 401 with no session — the anonymous bare-id DELETE is closed (T-06-05)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await DELETE(req('DELETE'), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(deleteBugMapping).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company mapping', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    deleteBugMapping.mockRejectedValue(new ForbiddenError());

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns { ok: true } for an authenticated caller (shape preserved)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    deleteBugMapping.mockResolvedValue({ changes: 1 });

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteBugMapping).toHaveBeenCalledWith('1', expect.objectContaining({ company_id: 5 }));
  });
});
