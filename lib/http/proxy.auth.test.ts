/// <reference types="vite/client" />
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '../../proxy';

function req(path: string, cookie?: string): NextRequest {
  const r = new NextRequest(`http://localhost${path}`);
  if (cookie) r.cookies.set('pm_session', cookie);
  return r;
}

describe('proxy auth contract (PROXY-01)', () => {
  it('returns JSON 401 for unauthenticated /api/* (D-01, D-02)', async () => {
    const res = proxy(req('/api/projects'));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('redirects unauthenticated page requests to /login (PROXY-01)', () => {
    const res = proxy(req('/projects'));
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('passes through PUBLIC /api/health without JSON 401 (PROXY-01)', () => {
    const res = proxy(req('/api/health'));
    expect(res.status).not.toBe(401);
  });

  it('passes through PUBLIC /api/auth/login without JSON 401 (PROXY-01)', () => {
    const res = proxy(req('/api/auth/login'));
    expect(res.status).not.toBe(401);
  });

  it('does not JSON 401 API requests with pm_session cookie (PROXY-01)', () => {
    const res = proxy(req('/api/projects', 'any-session'));
    expect(res.status).not.toBe(401);
  });

  it('redirects unauthenticated / to /landing (PROXY-01)', () => {
    const res = proxy(req('/'));
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toContain('/landing');
  });
});
