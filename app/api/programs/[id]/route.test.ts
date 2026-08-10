import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProgramRepo, listProgramProjects } = vi.hoisted(() => ({
  getProgramRepo: vi.fn(),
  listProgramProjects: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/programs.repo', () => ({
  getProgram: getProgramRepo,
  listProgramProjects,
  updateProgram: vi.fn(),
  deleteProgram: vi.fn(),
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

const owner = {
  id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
  is_admin: 0, onboarding_completed: 1,
};
const foreign = { ...owner, company_id: 9 };

describe('GET /api/programs/[id]', () => {
  beforeEach(() => vi.clearAllMocks());
  const params = { params: Promise.resolve({ id: '3' }) };
  const req = () => new NextRequest('http://localhost/api/programs/3');

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    expect((await GET(req(), params)).status).toBe(401);
  });

  it('returns 403 for a cross-company program', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreign as never);
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme' });
    expect((await GET(req(), params)).status).toBe(403);
    expect(listProgramProjects).not.toHaveBeenCalled();
  });

  it('returns program + projects for owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(owner as never);
    getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme' });
    listProgramProjects.mockResolvedValue([{ id: 1 }]);
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      program: { id: 3, company_id: 5, name: 'Acme' },
      projects: [{ id: 1 }],
    });
  });
});
