import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  listStakeholdersRepo,
  hasActiveStakeholderForRole,
  insertStakeholderRepo,
  getStakeholderRepo,
  endStakeholderRepo,
  findUserById,
  auditLogFn,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  listStakeholdersRepo: vi.fn(),
  hasActiveStakeholderForRole: vi.fn(),
  insertStakeholderRepo: vi.fn(),
  getStakeholderRepo: vi.fn(),
  endStakeholderRepo: vi.fn(),
  findUserById: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/lib/repositories/stakeholders.repo', () => ({
  listStakeholders: listStakeholdersRepo,
  hasActiveStakeholderForRole,
  insertStakeholder: insertStakeholderRepo,
  getStakeholder: getStakeholderRepo,
  endStakeholder: endStakeholderRepo,
}));
vi.mock('@/lib/repositories/users.repo', () => ({ findUserById }));
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

const viewerSession = {
  ...ownerSession,
  username: 'viewer',
  roles: ['viewer'],
};

describe('/api/projects/[id]/stakeholders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    hasActivePmAssignment.mockResolvedValue(true);
    hasActiveStakeholderForRole.mockResolvedValue(false);
    auditLogFn.mockResolvedValue(undefined);
  });

  const params = { params: Promise.resolve({ id: '7' }) };

  function req(method: string, body?: unknown) {
    return new NextRequest('http://localhost/api/projects/7/stakeholders', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  it('GET returns 200 JSON array from listProjectStakeholders', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    listStakeholdersRepo.mockResolvedValue([{ id: 1, stakeholder_role: 'sponsor' }]);
    const res = await GET(req('GET'), params);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 1, stakeholder_role: 'sponsor' }]);
  });

  it('POST as write-access actor returns 201', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    insertStakeholderRepo.mockResolvedValue({
      id: 3,
      stakeholder_role: 'key_stakeholder',
      external_name: 'Pat',
      external_email: 'pat@example.com',
    });
    const res = await POST(
      req('POST', {
        stakeholder_role: 'key_stakeholder',
        external_name: 'Pat',
        external_email: 'pat@example.com',
      }),
      params,
    );
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ id: 3 });
  });

  it('POST as viewer-only returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST(
      req('POST', {
        stakeholder_role: 'key_stakeholder',
        external_name: 'Pat',
        external_email: 'pat@example.com',
      }),
      params,
    );
    expect(res.status).toBe(403);
    expect(insertStakeholderRepo).not.toHaveBeenCalled();
  });

  it('PATCH ends a role with 200', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    getStakeholderRepo.mockResolvedValue({
      id: 4,
      project_id: 7,
      stakeholder_role: 'key_stakeholder',
      effective_to: null,
    });
    endStakeholderRepo.mockResolvedValue({
      id: 4,
      project_id: 7,
      stakeholder_role: 'key_stakeholder',
      effective_to: '2026-08-26',
    });
    const res = await PATCH(req('PATCH', { id: 4 }), params);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ effective_to: '2026-08-26' });
  });

  it('does not export DELETE', () => {
    expect(routeModule.DELETE).toBeUndefined();
  });
});
