import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteSession } = vi.hoisted(() => ({
  deleteSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  deleteSession,
  SESSION_COOKIE_NAME: 'pm_session',
}));

import { POST } from './route';

function logoutReq(sessionId?: string) {
  const req = new NextRequest('http://localhost/api/auth/logout', { method: 'POST' });
  if (sessionId !== undefined) {
    req.cookies.set('pm_session', sessionId);
  }
  return req;
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteSession.mockResolvedValue(undefined);
  });

  it('deletes the session and clears pm_session when a cookie is present', async () => {
    const res = await POST(logoutReq('session-abc'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteSession).toHaveBeenCalledWith('session-abc');
    expect(res.cookies.get('pm_session')?.value).toBe('');
    expect(res.cookies.get('pm_session')?.maxAge).toBe(0);
  });

  it('returns { ok: true } and clears the cookie when no session cookie is present', async () => {
    const res = await POST(logoutReq());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteSession).not.toHaveBeenCalled();
    expect(res.cookies.get('pm_session')?.value).toBe('');
    expect(res.cookies.get('pm_session')?.maxAge).toBe(0);
  });
});
