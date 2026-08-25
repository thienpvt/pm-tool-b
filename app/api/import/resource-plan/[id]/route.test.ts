import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

describe('POST /api/import/resource-plan/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  function req() {
    // Empty body is fine for 401/403 — assert runs before formData.
    return new NextRequest('http://localhost/api/import/resource-plan/7', {
      method: 'POST',
    });
  }

  const ownerSession = {
    id: 2,
    username: 'ava',
    display_name: 'Ava',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
  };
  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(req(), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(projectAccessRow).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company project before reading the body', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await POST(req(), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns 400 when owner uploads no file (assert passed)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    // multipart form with no file field
    const form = new FormData();
    const ownerReq = new NextRequest('http://localhost/api/import/resource-plan/7', {
      method: 'POST',
      body: form,
    });

    const res = await POST(ownerReq, params());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'No file uploaded' });
    expect(projectAccessRow).toHaveBeenCalled();
  });
});
