import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  insertProjectDependencyRepo,
  listProjectDependenciesRepo,
  hasOverlappingEquivalentDependencyRepo,
  getDependencyInFromProjectRepo,
  softEndDependencyRepo,
  auditLogFn,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  insertProjectDependencyRepo: vi.fn(),
  listProjectDependenciesRepo: vi.fn(),
  hasOverlappingEquivalentDependencyRepo: vi.fn(),
  getDependencyInFromProjectRepo: vi.fn(),
  softEndDependencyRepo: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/lib/repositories/project-dependencies.repo', () => ({
  insertProjectDependency: insertProjectDependencyRepo,
  listProjectDependencies: listProjectDependenciesRepo,
  hasOverlappingEquivalentDependency: hasOverlappingEquivalentDependencyRepo,
  getDependencyInFromProject: getDependencyInFromProjectRepo,
  softEndDependency: softEndDependencyRepo,
}));
vi.mock('@/lib/services/audit.service', () => ({ auditLog: auditLogFn }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, PATCH, POST } from './route';
import * as routeModule from './route';

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
  roles: ['cpmo'],
};

describe('/api/projects/[id]/dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    hasActivePmAssignment.mockResolvedValue(true);
    hasOverlappingEquivalentDependencyRepo.mockResolvedValue(false);
    auditLogFn.mockResolvedValue(undefined);
  });

  const fromParams = { params: Promise.resolve({ id: '7' }) };
  const toParams = { params: Promise.resolve({ id: '9' }) };

  function req(pathId: string, method: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/projects/${pathId}/dependencies`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  it('GET returns 401 when session is missing', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null as never);
    const res = await GET(req('7', 'GET'), fromParams);
    expect(res.status).toBe(401);
  });

  it('POST returns 201 on from project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    insertProjectDependencyRepo.mockResolvedValue({
      id: 3,
      from_project_id: 7,
      to_project_id: 9,
      dependency_type: 'FINISH_TO_START',
      need_by: '2026-12-31',
      effective_from: '2026-01-01',
      effective_to: null,
    });
    const res = await POST(
      req('7', 'POST', {
        to_project_id: 9,
        dependency_type: 'FINISH_TO_START',
        need_by: '2026-12-31',
        effective_from: '2026-01-01',
      }),
      fromParams,
    );
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ id: 3, from_project_id: 7 });
    expect(insertProjectDependencyRepo).toHaveBeenCalledWith(
      expect.objectContaining({ fromProjectId: 7, toProjectId: 9 }),
    );
  });

  it('GET on from project returns outgoing edge', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    listProjectDependenciesRepo.mockResolvedValue([
      {
        id: 3,
        from_project_id: 7,
        to_project_id: 9,
        dependency_type: 'FINISH_TO_START',
        need_by: '2026-12-31',
        effective_from: '2026-01-01',
        effective_to: null,
        direction: 'outgoing',
      },
    ]);
    const res = await GET(req('7', 'GET'), fromParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toMatchObject({ direction: 'outgoing', peer_project_id: 9 });
  });

  it('GET on to project returns incoming edge for PM with access', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    listProjectDependenciesRepo.mockResolvedValue([
      {
        id: 3,
        from_project_id: 7,
        to_project_id: 9,
        dependency_type: 'FINISH_TO_START',
        need_by: '2026-12-31',
        effective_from: '2026-01-01',
        effective_to: null,
        direction: 'incoming',
      },
    ]);
    const res = await GET(req('9', 'GET'), toParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toMatchObject({ direction: 'incoming', peer_project_id: 7 });
  });

  it('POST as viewer-only returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({
      ...ownerSession,
      roles: ['viewer'],
    } as never);
    const res = await POST(
      req('7', 'POST', {
        to_project_id: 9,
        dependency_type: 'FINISH_TO_START',
        need_by: '2026-12-31',
        effective_from: '2026-01-01',
      }),
      fromParams,
    );
    expect(res.status).toBe(403);
    expect(insertProjectDependencyRepo).not.toHaveBeenCalled();
  });

  it('POST self-link returns 400', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    const res = await POST(
      req('7', 'POST', {
        to_project_id: 7,
        dependency_type: 'FINISH_TO_START',
        need_by: '2026-12-31',
        effective_from: '2026-01-01',
      }),
      fromParams,
    );
    expect(res.status).toBe(400);
  });

  it('POST overlap returns 409', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    hasOverlappingEquivalentDependencyRepo.mockResolvedValue(true);
    const res = await POST(
      req('7', 'POST', {
        to_project_id: 9,
        dependency_type: 'BLOCKS',
        need_by: '2026-12-31',
        effective_from: '2026-01-01',
      }),
      fromParams,
    );
    expect(res.status).toBe(409);
  });

  it('POST to foreign project returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockImplementation(async (id) => {
      if (Number(id) === 9) {
        return { company_id: 99, customer_company_id: null };
      }
      return { company_id: 5, customer_company_id: null };
    });
    const res = await POST(
      req('7', 'POST', {
        to_project_id: 9,
        dependency_type: 'FINISH_TO_START',
        need_by: '2026-12-31',
        effective_from: '2026-01-01',
      }),
      fromParams,
    );
    expect(res.status).toBe(403);
  });

  it('PATCH ends dependency with 200', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getDependencyInFromProjectRepo.mockResolvedValue({
      id: 4,
      from_project_id: 7,
      to_project_id: 9,
      dependency_type: 'FINISH_TO_START',
      need_by: '2026-12-31',
      effective_from: '2026-01-01',
      effective_to: null,
    });
    softEndDependencyRepo.mockResolvedValue({
      id: 4,
      from_project_id: 7,
      to_project_id: 9,
      dependency_type: 'FINISH_TO_START',
      need_by: '2026-12-31',
      effective_from: '2026-01-01',
      effective_to: '2026-08-26',
    });
    const res = await PATCH(req('7', 'PATCH', { id: 4 }), fromParams);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ effective_to: '2026-08-26' });
  });

  it('PATCH as viewer returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({
      ...ownerSession,
      roles: ['viewer'],
    } as never);
    const res = await PATCH(req('7', 'PATCH', { id: 4 }), fromParams);
    expect(res.status).toBe(403);
    expect(softEndDependencyRepo).not.toHaveBeenCalled();
  });

  it('PATCH without id returns 400', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    const res = await PATCH(req('7', 'PATCH', {}), fromParams);
    expect(res.status).toBe(400);
  });

  it('does not export DELETE', () => {
    expect(routeModule.DELETE).toBeUndefined();
  });
});
