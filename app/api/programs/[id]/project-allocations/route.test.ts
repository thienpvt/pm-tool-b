import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProgramRepo, projectAccessRow, getProjectPmIdentity, programProjectAllocationsRepo, upsertProgramProjectAllocationRepo } =
  vi.hoisted(() => ({
    getProgramRepo: vi.fn(),
    projectAccessRow: vi.fn(),
    getProjectPmIdentity: vi.fn(),
    programProjectAllocationsRepo: vi.fn(),
    upsertProgramProjectAllocationRepo: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({ projectAccessRow, getProjectPmIdentity }));
vi.mock('@/modules/portfolio/backend/repositories/programs.repo', () => ({
  getProgram: getProgramRepo,
  listProgramProjects: vi.fn(),
  updateProgram: vi.fn(),
  deleteProgram: vi.fn(),
  programProjectAllocations: programProjectAllocationsRepo,
  upsertProgramProjectAllocation: upsertProgramProjectAllocationRepo,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

/**
 * Route-level proof of the T-04-22 live write IDOR fix (and the adjacent GET read
 * leak): both the program row and the project must be owned by the caller before
 * anything is read or written. Mocks sit at the repository boundary so the real
 * assertProgramAccess/assertProjectAccess logic runs under test.
 */
describe('GET/POST /api/programs/[id]/project-allocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'ava@example.com' });
  });

  const params = () => ({ params: Promise.resolve({ id: '3' }) });

  function getReq() {
    return new NextRequest('http://localhost/api/programs/3/project-allocations');
  }

  function postReq(body: unknown) {
    return new NextRequest('http://localhost/api/programs/3/project-allocations', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
    is_admin: 0, onboarding_completed: 1,
    roles: ['cpmo'], status: 'active', email: 'ava@example.com',
  };
  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  describe('GET', () => {
    it('returns 401 without a session', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(null);
      const res = await GET(getReq(), params());
      expect(res.status).toBe(401);
      expect(getProgramRepo).not.toHaveBeenCalled();
    });

    it('returns 403 for a foreign program without leaking program info', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
      getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme Program' });

      const res = await GET(getReq(), params());

      expect(res.status).toBe(403);
      expect(programProjectAllocationsRepo).not.toHaveBeenCalled();
    });

    it('returns allocations for an owner', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
      getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme Program' });
      programProjectAllocationsRepo.mockResolvedValue({
        program: { name: 'Acme Program', allocated_headcount: 4 },
        projects: [{ project_id: 1, project_name: 'Rollout', allocated_headcount: 2 }],
      });

      const res = await GET(getReq(), params());

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        program_id: 3,
        program_name: 'Acme Program',
        portfolio_allocated: 4,
        projects: [{ project_id: 1, project_name: 'Rollout', allocated_headcount: 2 }],
      });
    });
  });

  describe('POST', () => {
    it('returns 401 without a session', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(null);
      const res = await POST(postReq({ project_id: 1 }), params());
      expect(res.status).toBe(401);
      expect(upsertProgramProjectAllocationRepo).not.toHaveBeenCalled();
    });

    it('returns 400 when project_id is absent', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
      const res = await POST(postReq({}), params());
      expect(res.status).toBe(400);
      expect(upsertProgramProjectAllocationRepo).not.toHaveBeenCalled();
    });

    it('returns 403 when the program is another tenant\'s, without calling the upsert', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
      getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme Program' });

      const res = await POST(postReq({ project_id: 1, allocated_headcount: 2 }), params());

      expect(res.status).toBe(403);
      expect(projectAccessRow).not.toHaveBeenCalled();
      expect(upsertProgramProjectAllocationRepo).not.toHaveBeenCalled();
    });

    it('returns 403 when the project is another tenant\'s, without calling the upsert', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
      getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme Program' });
      projectAccessRow.mockResolvedValue({ company_id: 9, customer_company_id: null });

      const res = await POST(postReq({ project_id: 1, allocated_headcount: 2 }), params());

      expect(res.status).toBe(403);
      expect(upsertProgramProjectAllocationRepo).not.toHaveBeenCalled();
    });

    it('upserts and clamps headcount for an owner of both program and project', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
      getProgramRepo.mockResolvedValue({ id: 3, company_id: 5, name: 'Acme Program' });
      projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
      upsertProgramProjectAllocationRepo.mockResolvedValue(42);

      const res = await POST(postReq({ project_id: 1, allocated_headcount: -5 }), params());

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ id: 42, project_id: 1, allocated_headcount: 0 });
      expect(upsertProgramProjectAllocationRepo).toHaveBeenCalledWith('3', 1, 0);
    });
  });
});
