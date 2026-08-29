import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, hasActivePmAssignment, getProjectRepo, updateProjectRepo, deleteProjectRepo } =
  vi.hoisted(() => ({
    projectAccessRow: vi.fn(),
    hasActivePmAssignment: vi.fn(),
    getProjectRepo: vi.fn(),
    updateProjectRepo: vi.fn(),
    deleteProjectRepo: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({
  projectAccessRow,
  getProject: getProjectRepo,
  updateProject: updateProjectRepo,
  deleteProject: deleteProjectRepo,
}));
vi.mock('@/modules/projects/backend/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }));

import { getSessionFromRequest } from '@/lib/auth';
import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { DELETE, GET, PATCH } from './route';

/**
 * Route-level proof that GET/PATCH/DELETE go through `projects.service.ts` and
 * the canonical access asserts. Mocks sit at the repository boundary so the
 * real service and access logic run under test.
 */
describe('GET/PATCH/DELETE /api/projects/[id] access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActivePmAssignment.mockResolvedValue(true);
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  function req(method: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/projects/7`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  const ownerSession = {
    id: 2,
    username: 'ava',
    display_name: 'Ava',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
    roles: ['pm'],
    status: 'active',
    email: 'ava@example.com',
  };

  const cpmoSession = {
    ...ownerSession,
    username: 'cpmo',
    is_admin: 1,
    roles: ['cpmo'],
  };

  const viewerSession = {
    ...ownerSession,
    username: 'viewer',
    roles: ['viewer'],
  };

  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };
  const nullCompanySession = { ...ownerSession, company_id: null, username: 'nobody' };

  it('returns 401 with no session on GET', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(req('GET'), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(projectAccessRow).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company project on GET', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(getProjectRepo).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing project on GET', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue(undefined);

    const res = await GET(req('GET'), params('99'));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
    expect(getProjectRepo).not.toHaveBeenCalled();
  });

  it('returns 200 with the project for an assigned PM owner on GET', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    const project = { id: 7, name: 'Acme Rollout' };
    getProjectRepo.mockResolvedValue(project);

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(project);
    expect(getProjectRepo).toHaveBeenCalledWith('7');
  });

  it('returns 403 for CPMO on a foreign-company project (D-13)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 9, customer_company_id: null });

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(403);
    expect(getProjectRepo).not.toHaveBeenCalled();
  });

  it('allows a null-company actor only for a fully-unassigned project on GET', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nullCompanySession as never);
    projectAccessRow.mockResolvedValue({ company_id: null, customer_company_id: null });
    getProjectRepo.mockResolvedValue({ id: 7, name: 'Unassigned' });

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
  });

  it('rejects a null-company actor on an assigned project on GET', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(nullCompanySession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(403);
  });

  it('PATCH returns the updated row for an assigned PM owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    const updated = { id: 7, name: 'Renamed', warnings: [] as string[] };
    updateProjectRepo.mockResolvedValue(updated);

    const res = await PATCH(req('PATCH', { name: 'Renamed' }), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(updated);
  });

  it('PATCH returns 403 for a cross-company project without calling the repo', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await PATCH(req('PATCH', { name: 'Renamed' }), params());

    expect(res.status).toBe(403);
    expect(updateProjectRepo).not.toHaveBeenCalled();
  });

  it('PATCH returns 403 for viewer-only in-company (D-15)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await PATCH(req('PATCH', { name: 'Renamed' }), params());

    expect(res.status).toBe(403);
    expect(updateProjectRepo).not.toHaveBeenCalled();
  });

  it('PATCH returns 403 for PM in-company that fails D-14 assignment (D-14)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    hasActivePmAssignment.mockResolvedValue(false);

    const res = await PATCH(req('PATCH', { name: 'Renamed' }), params());

    expect(res.status).toBe(403);
    expect(updateProjectRepo).not.toHaveBeenCalled();
  });

  it('PATCH rejects company_id with 400 naming the column, not 403/404/500 (T-04-25)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    updateProjectRepo.mockRejectedValue(new UnknownColumnError(['company_id']));

    const res = await PATCH(req('PATCH', { company_id: 99 }), params());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ columns: ['company_id'] });
  });

  it('DELETE returns { ok: true } for an assigned PM owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getProjectRepo.mockResolvedValue({ id: 7, name: 'Acme Rollout', company_id: 5 });
    deleteProjectRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('DELETE returns 403 for a cross-company project without calling the repo', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await DELETE(req('DELETE'), params());

    expect(res.status).toBe(403);
    expect(deleteProjectRepo).not.toHaveBeenCalled();
  });
});
