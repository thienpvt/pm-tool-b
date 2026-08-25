import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  getProjectPmIdentity,
  getProjectRepo,
  createRiskRepo,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  getProjectPmIdentity: vi.fn(),
  getProjectRepo: vi.fn(),
  createRiskRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({
  projectAccessRow,
  getProjectPmIdentity,
  getProject: getProjectRepo,
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));
vi.mock('@/lib/repositories/risks.repo', () => ({
  listRisks: vi.fn(),
  createRisk: createRiskRepo,
  updateRisk: vi.fn(),
  deleteRisk: vi.fn(),
  countRisks: vi.fn(),
  listOpenRisks: vi.fn(),
  listNotClosedByPriority: vi.fn(),
  RISK_COLUMNS: [],
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET as getProject } from '@/app/api/projects/[id]/route';
import { POST as postRisk } from '@/app/api/projects/[id]/risks/route';

/**
 * D-19 role matrix: representative GET allow + POST deny across Viewer/PM/CPMO.
 * Complements per-route access tests; does not replace them.
 */
describe('role matrix (D-19, AUTH-04, AUTH-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'ava@example.com' });
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  const baseSession = {
    id: 2,
    username: 'ava',
    display_name: 'Ava',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
    status: 'active' as const,
    email: 'ava@example.com',
  };

  const viewerSession = { ...baseSession, username: 'viewer', roles: ['viewer'] as const };
  const pmSession = { ...baseSession, roles: ['pm'] as const };
  const cpmoSession = { ...baseSession, username: 'cpmo', is_admin: 1, roles: ['cpmo'] as const };

  function getReq() {
    return new NextRequest('http://localhost/api/projects/7', { method: 'GET' });
  }

  function postRiskReq(body?: unknown) {
    return new NextRequest('http://localhost/api/projects/7/risks', {
      method: 'POST',
      body: JSON.stringify(body ?? { description: 'New risk' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('Viewer GET in-company project → 200 (D-19, AUTH-04)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getProjectRepo.mockResolvedValue({ id: 7, name: 'Acme Rollout' });

    const res = await getProject(getReq(), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: 7, name: 'Acme Rollout' });
  });

  it('Viewer POST risks → 403 (D-15, D-19, AUTH-05)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await postRisk(postRiskReq(), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(createRiskRepo).not.toHaveBeenCalled();
  });

  it('PM unassigned POST risks → 403 (D-14, D-19)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Bob', pm_email: 'bob@other.com' });

    const res = await postRisk(postRiskReq(), params());

    expect(res.status).toBe(403);
    expect(createRiskRepo).not.toHaveBeenCalled();
  });

  it('CPMO in-company POST risks → not 403 (D-13, D-19)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    createRiskRepo.mockResolvedValue({ id: 99, description: 'New risk' });

    const res = await postRisk(postRiskReq(), params());

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(201);
    expect(createRiskRepo).toHaveBeenCalled();
  });
});
