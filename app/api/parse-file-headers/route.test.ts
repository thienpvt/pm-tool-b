import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

/**
 * Route-level proof of the withAuth(rawBody) session gate on parse-file-headers.
 * Had NO session check before Phase 6 — anonymous multipart file upload + parse
 * (T-06-07). Uses opts.rawBody so the handler's own req.formData() still runs.
 */
describe('POST /api/parse-file-headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5,
    company_name: 'Acme', is_admin: 0, onboarding_completed: 1,
  };

  const params = () => ({ params: Promise.resolve({}) });

  function reqWithForm(form: FormData) {
    return new NextRequest('http://localhost/api/parse-file-headers', {
      method: 'POST',
      body: form,
    });
  }

  it('returns 401 with no session — handler formData never reached', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const form = new FormData();
    form.append('file', new File(['a,b\n1,2'], 'x.csv', { type: 'text/csv' }));

    const res = await POST(reqWithForm(form), params());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('a session-authenticated multipart POST reaches the handler and parses the CSV', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const form = new FormData();
    form.append('file', new File(['a,b\n1,2'], 'x.csv', { type: 'text/csv' }));

    const res = await POST(reqWithForm(form), params());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.columns).toEqual(['a', 'b']);
  });

  it('no-file POST still returns 400 No file (preserved) when session present', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    const form = new FormData();

    const res = await POST(reqWithForm(form), params());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'No file' });
  });
});
