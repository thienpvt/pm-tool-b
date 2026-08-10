import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, listRisksRepo, createRiskRepo, updateRiskRepo, deleteRiskRepo } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  listRisksRepo: vi.fn(),
  createRiskRepo: vi.fn(),
  updateRiskRepo: vi.fn(),
  deleteRiskRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/risks.repo', () => ({
  listRisks: listRisksRepo,
  createRisk: createRiskRepo,
  updateRisk: updateRiskRepo,
  deleteRisk: deleteRiskRepo,
  // re-exported names the service does not use still need to exist if imported
  countRisks: vi.fn(),
  listOpenRisks: vi.fn(),
  listNotClosedByPriority: vi.fn(),
  RISK_COLUMNS: [],
}));

import { getSessionFromRequest } from '@/lib/auth';
import { DELETE, GET, POST, PUT } from './route';

/**
 * Route-level proof of the service-layer access gate on risks.
 *
 * This route previously had no session check. The suite drives the real service
 * + assertProjectAccess with mocked repositories (no DB), so it always runs in
 * the default tier and fails if the 401/403/404 wiring regresses.
 */
describe('GET/POST/PUT/DELETE /api/projects/[id]/risks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  function req(method: string, url = 'http://localhost/api/projects/7/risks', body?: unknown) {
    return new NextRequest(url, {
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

  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(req('GET'), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(projectAccessRow).not.toHaveBeenCalled();
    expect(listRisksRepo).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(listRisksRepo).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue(undefined);

    const res = await GET(req('GET'), params('99'));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found' });
    expect(listRisksRepo).not.toHaveBeenCalled();
  });

  it('returns 200 with the prior list shape for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    const rows = [{ id: 1, project_id: 7, risk_id: 'R1', description: 'slip' }];
    listRisksRepo.mockResolvedValue(rows);

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(rows);
    expect(listRisksRepo).toHaveBeenCalledWith('7');
  });

  it('POST creates for an owner with 201', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    const created = { id: 2, project_id: 7, risk_id: 'R2', description: 'new' };
    createRiskRepo.mockResolvedValue(created);

    const res = await POST(req('POST', undefined, { description: 'new' }), params());

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual(created);
  });

  it('PUT returns the updated row for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    const updated = { id: 1, status: 'Closed' };
    updateRiskRepo.mockResolvedValue(updated);

    const res = await PUT(req('PUT', undefined, { id: 1, status: 'Closed' }), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(updated);
  });

  it('DELETE returns { ok: true } for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    deleteRiskRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });

    const res = await DELETE(req('DELETE', 'http://localhost/api/projects/7/risks?rowId=1'), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
