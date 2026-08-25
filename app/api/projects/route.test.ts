import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));

import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { GET } from './route';

const session = {
  id: 7,
  username: 'pm1',
  display_name: 'PM One',
  company_id: 3,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: ['cpmo'],
  status: 'active',
  email: 'pm1@example.com',
};

function req(url = 'http://localhost/api/projects') {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.mocked(getSessionFromRequest).mockReset();
  vi.mocked(getDb).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/projects', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);

    const res = await GET(req());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual([]);
    expect(getDb).not.toHaveBeenCalled();
  });

  it('scopes the query to the caller company for a non-admin', async () => {
    const all = vi.fn().mockResolvedValue([{ id: 1, name: 'Alpha' }]);
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(getDb).mockResolvedValue({ all } as never);

    const res = await GET(req());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 1, name: 'Alpha' }]);
    const [sql, ...params] = all.mock.calls[0];
    expect(sql).toContain('company_id');
    expect(params).toContain(session.company_id);
  });

  it('scopes the query to the caller company even for an admin', async () => {
    const all = vi.fn().mockResolvedValue([]);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ ...session, is_admin: 1 } as never);
    vi.mocked(getDb).mockResolvedValue({ all } as never);

    const res = await GET(req());

    expect(res.status).toBe(200);
    const [sql, ...params] = all.mock.calls[0];
    expect(sql).toContain('WHERE');
    expect(params).toContain(session.company_id);
  });

  it('returns 500 when the db layer throws', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(getDb).mockRejectedValue(new Error('boom'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await GET(req());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Internal server error' });
    expect(errorLog).toHaveBeenCalledWith('Unexpected repository error', expect.any(Error));
  });
});
