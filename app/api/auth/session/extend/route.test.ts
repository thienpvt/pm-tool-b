import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { extendSession } = vi.hoisted(() => ({
  extendSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  extendSession,
  SESSION_COOKIE_NAME: 'pm_session',
  unauthorized: () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}));

import { POST } from './route';

function extendReq(sessionId?: string) {
  const req = new NextRequest('http://localhost/api/auth/session/extend', { method: 'POST' });
  if (sessionId !== undefined) {
    req.cookies.set('pm_session', sessionId);
  }
  return req;
}

describe('POST /api/auth/session/extend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 { ok: true } without rotating the pm_session cookie', async () => {
    extendSession.mockResolvedValue(true);

    const req = extendReq('session-abc');
    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(extendSession).toHaveBeenCalledWith('session-abc');
    expect(res.cookies.get('pm_session')).toBeUndefined();
  });

  it('returns 401 when the cookie is missing', async () => {
    const res = await POST(extendReq());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(extendSession).not.toHaveBeenCalled();
  });

  it('returns 401 when extendSession fails', async () => {
    extendSession.mockResolvedValue(false);

    const res = await POST(extendReq('expired-session'));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(extendSession).toHaveBeenCalledWith('expired-session');
  });
});
