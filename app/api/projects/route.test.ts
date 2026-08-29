import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listProjects } = vi.hoisted(() => ({
  listProjects: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/projects/backend/services/projects.service', () => ({
  listProjects,
  createProject: vi.fn(),
}));

import { getSessionFromRequest } from '@/lib/auth';
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
  listProjects.mockReset();
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
    expect(listProjects).not.toHaveBeenCalled();
  });

  it('scopes the query to the caller company for a non-admin', async () => {
    listProjects.mockResolvedValue([{ id: 1, name: 'Alpha' }]);
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);

    const res = await GET(req());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 1, name: 'Alpha' }]);
    expect(listProjects).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: session.company_id }),
    );
  });

  it('scopes the query to the caller company even for an admin', async () => {
    listProjects.mockResolvedValue([]);
    vi.mocked(getSessionFromRequest).mockResolvedValue({ ...session, is_admin: 1 } as never);

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(listProjects).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: session.company_id }),
    );
  });

  it('returns 500 when the service layer throws', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    listProjects.mockRejectedValue(new Error('boom'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await GET(req());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Internal server error' });
    expect(errorLog).toHaveBeenCalledWith('Unexpected repository error', expect.any(Error));
  });
});
