import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listSettings, setSettings } = vi.hoisted(() => ({
  listSettings: vi.fn(),
  setSettings: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/services/settings.service', () => ({ listSettings, setSettings }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

describe('GET /api/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  const params = () => ({ params: Promise.resolve({}) });
  const req = () => new NextRequest('http://localhost/api/config');

  const ownerSession = {
    id: 2,
    username: 'ava',
    display_name: 'Ava',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
  };

  it('returns 401 with no session (HYG-02: was previously anonymous)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(req(), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(listSettings).not.toHaveBeenCalled();
  });

  it('returns masked settings for a session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    listSettings.mockResolvedValue([
      { key: 'anthropic_api_key', value: 'sk-secret' },
      { key: 'other_setting', value: 'plain' },
    ]);

    const res = await GET(req(), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      anthropic_api_key: '***',
      anthropic_api_key_set: 'true',
      other_setting: 'plain',
    });
  });
});

describe('POST /api/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = () => ({ params: Promise.resolve({}) });
  function req(body: unknown = { some_key: 'value' }) {
    return new NextRequest('http://localhost/api/config', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const adminSession = {
    id: 1,
    username: 'admin',
    display_name: 'Admin',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 1,
    onboarding_completed: 1,
  };
  const nonAdminSession = { ...adminSession, id: 2, is_admin: 0 };

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(req(), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(setSettings).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin session (in-handler gate preserved)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nonAdminSession as never);
    const res = await POST(req(), params());
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(setSettings).not.toHaveBeenCalled();
  });

  it('persists settings for an admin session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(adminSession as never);
    const res = await POST(req({ some_key: 'value' }), params());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(setSettings).toHaveBeenCalledWith({ some_key: 'value' });
  });
});
