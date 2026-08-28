import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listRecentJiraSyncMappings, saveJiraSyncMapping } = vi.hoisted(() => ({
  listRecentJiraSyncMappings: vi.fn(),
  saveJiraSyncMapping: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/jira-mapping.service', () => ({
  listRecentJiraSyncMappings,
  saveJiraSyncMapping,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

/**
 * Route-level proof of the withAuth session gate on jira/sync-mappings.
 * Had NO session check before Phase 6 — anonymous read/write (T-06-06).
 */
describe('GET/POST /api/jira/sync-mappings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5,
    company_name: 'Acme', is_admin: 0, onboarding_completed: 1,
  };

  const params = (id = '1') => ({ params: Promise.resolve({ id }) });

  function req(method: string, url = 'http://localhost/api/jira/sync-mappings', body?: unknown) {
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
    expect(listRecentJiraSyncMappings).not.toHaveBeenCalled();
  });

  it('POST returns 401 with no session, service not called', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(req('POST', undefined, { mappings_json: '{}' }), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(saveJiraSyncMapping).not.toHaveBeenCalled();
  });

  it('GET returns session-company list for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const rows = [{ id: 1, mappings_json: '{}', company_id: 5 }];
    listRecentJiraSyncMappings.mockResolvedValue(rows);

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(rows);
    expect(listRecentJiraSyncMappings).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 5 }),
    );
  });

  it('POST saves for an owner, preserving { ok: true } shape', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    saveJiraSyncMapping.mockResolvedValue(undefined);

    const res = await POST(req('POST', undefined, { mappings_json: '{"a":1}' }), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(saveJiraSyncMapping).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 5 }),
      '{"a":1}',
    );
  });

  it('POST ignores company_id in body and stamps session company', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    saveJiraSyncMapping.mockResolvedValue(undefined);

    const res = await POST(
      req('POST', undefined, { mappings_json: '{"b":2}', company_id: 999 }),
      params(),
    );

    expect(res.status).toBe(200);
    expect(saveJiraSyncMapping).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 5 }),
      '{"b":2}',
    );
  });

  it('POST rejects invalid body with 400 Missing mappings_json, before service call', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);

    const res = await POST(req('POST', undefined, {}), params());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Missing mappings_json' });
    expect(saveJiraSyncMapping).not.toHaveBeenCalled();
  });
});
