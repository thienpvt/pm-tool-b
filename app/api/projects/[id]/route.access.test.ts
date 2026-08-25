import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, getProjectRepo, updateProjectRepo, deleteProjectRepo } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  getProjectRepo: vi.fn(),
  updateProjectRepo: vi.fn(),
  deleteProjectRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({
  projectAccessRow,
  getProject: getProjectRepo,
  updateProject: updateProjectRepo,
  deleteProject: deleteProjectRepo,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { DELETE, GET, PATCH } from './route';

/**
 * Route-level proof that GET/PATCH/DELETE now go through `projects.service.ts` and
 * the canonical `assertProjectAccess`, replacing the file-local `checkAccess` (T-04-24).
 * Mocks sit at the repository boundary (`projectAccessRow` + CRUD) so the real service
 * and the real `assertProjectAccess` logic run under test — same convention as
 * `app/api/projects/[id]/risks/route.test.ts`.
 */
describe('GET/PATCH/DELETE /api/projects/[id] access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  };

  const adminSession = { ...ownerSession, username: 'root', is_admin: 1, company_id: null };
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

  it('returns 200 with the project for an owner on GET', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    const project = { id: 7, name: 'Acme Rollout' };
    getProjectRepo.mockResolvedValue(project);

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(project);
    expect(getProjectRepo).toHaveBeenCalledWith('7');
  });

  it('returns 200 for an admin regardless of company', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(adminSession as never);
    // Post-flip (05-01): the admin branch of assertProjectAccess now fetches the
    // row too (mirrors assertProgramAccess) so it has something to return —
    // wire behavior is unchanged, but the query now happens.
    projectAccessRow.mockResolvedValue({ company_id: 9, customer_company_id: null });
    const project = { id: 7, name: 'Acme Rollout' };
    getProjectRepo.mockResolvedValue(project);

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
    expect(projectAccessRow).toHaveBeenCalledWith('7');
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

  it('PATCH returns the updated row for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    const updated = { id: 7, name: 'Renamed' };
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

  it('PATCH rejects company_id with 400 naming the column, not 403/404/500 (T-04-25)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    updateProjectRepo.mockRejectedValue(new UnknownColumnError(['company_id']));

    const res = await PATCH(req('PATCH', { company_id: 99 }), params());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ columns: ['company_id'] });
  });

  it('DELETE returns { ok: true } for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
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
