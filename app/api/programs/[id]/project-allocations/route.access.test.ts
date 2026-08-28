import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getProgramRepo,
  projectAccessRow,
  getProjectPmIdentity,
  upsertProgramProjectAllocation,
} = vi.hoisted(() => ({
  getProgramRepo: vi.fn(),
  projectAccessRow: vi.fn(),
  getProjectPmIdentity: vi.fn(),
  upsertProgramProjectAllocation: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/portfolio/backend/repositories/programs.repo', () => ({
  getProgram: getProgramRepo,
  programProjectAllocations: vi.fn(async () => ({ program: { name: 'P', allocated_headcount: 0 }, projects: [] })),
  upsertProgramProjectAllocation,
}));
vi.mock('@/lib/repositories/projects.repo', () => ({
  projectAccessRow,
  getProjectPmIdentity,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

describe('POST /api/programs/[id]/project-allocations access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProgramRepo.mockResolvedValue({ id: 1, company_id: 5, name: 'Prog' });
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'ava@example.com' });
    upsertProgramProjectAllocation.mockResolvedValue(99);
  });

  const params = () => ({ params: Promise.resolve({ id: '1' }) });

  function req(body: unknown) {
    return new NextRequest('http://localhost/api/programs/1/project-allocations', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cpmoSession = {
    id: 2,
    username: 'cpmo',
    display_name: 'CPMO',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 1,
    onboarding_completed: 1,
    roles: ['cpmo'],
    status: 'active',
    email: 'cpmo@example.com',
  };

  const viewerSession = {
    ...cpmoSession,
    username: 'viewer',
    is_admin: 0,
    roles: ['viewer'],
  };

  it('returns 403 for viewer-only in-company session after tenant asserts (D-15)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession);
    const res = await POST(req({ project_id: 7, allocated_headcount: 1 }), params());
    expect(res.status).toBe(403);
    expect(upsertProgramProjectAllocation).not.toHaveBeenCalled();
  });

  it('returns 200 for CPMO after tenant and role asserts', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession);
    const res = await POST(req({ project_id: 7, allocated_headcount: 2 }), params());
    expect(res.status).toBe(200);
    expect(upsertProgramProjectAllocation).toHaveBeenCalledWith('1', 7, 2);
  });
});
