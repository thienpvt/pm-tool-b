import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUserByUsername } = vi.hoisted(() => ({
  findUserByUsername: vi.fn(),
}));
const { verifyPassword, createSession } = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock('@/lib/repositories/auth.repo', () => ({ findUserByUsername }));
vi.mock('@/lib/auth', () => ({
  verifyPassword,
  createSession,
  SESSION_COOKIE_NAME: 'pm_session',
}));

import { POST } from './route';

function loginReq(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const activeUser = {
  id: 1,
  username: 'ava',
  password_hash: 'salt:hash',
  display_name: 'Ava',
  company_id: 5,
  is_admin: 0,
  onboarding_completed: 1,
  status: 'active',
  email: 'ava@example.com',
};

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when username or password is missing', async () => {
    const res = await POST(loginReq({ username: 'ava' }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Username and password required' });
    expect(createSession).not.toHaveBeenCalled();
  });

  it('returns 200 and sets pm_session for an active user with valid password', async () => {
    findUserByUsername.mockResolvedValue(activeUser);
    verifyPassword.mockReturnValue(true);
    createSession.mockResolvedValue('session-abc');

    const res = await POST(loginReq({ username: 'ava', password: 'secret' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(createSession).toHaveBeenCalledWith(1);
    expect(res.cookies.get('pm_session')?.value).toBe('session-abc');
  });

  it('returns 401 with generic body for inactive user without creating a session', async () => {
    findUserByUsername.mockResolvedValue({ ...activeUser, status: 'inactive' });
    verifyPassword.mockReturnValue(true);

    const res = await POST(loginReq({ username: 'ava', password: 'secret' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid username or password' });
    expect(createSession).not.toHaveBeenCalled();
  });

  it('returns 401 with generic body for locked user without creating a session', async () => {
    findUserByUsername.mockResolvedValue({ ...activeUser, status: 'locked' });
    verifyPassword.mockReturnValue(true);

    const res = await POST(loginReq({ username: 'ava', password: 'secret' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid username or password' });
    expect(createSession).not.toHaveBeenCalled();
  });

  it('returns 401 for bad password without creating a session', async () => {
    findUserByUsername.mockResolvedValue(activeUser);
    verifyPassword.mockReturnValue(false);

    const res = await POST(loginReq({ username: 'ava', password: 'wrong' }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid username or password' });
    expect(createSession).not.toHaveBeenCalled();
  });
});
