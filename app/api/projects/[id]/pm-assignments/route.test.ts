import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  insertPmAssignment,
  getActivePrimaryAssignment,
  hasOverlappingPmAssignment,
  hasActivePmAssignmentForUserRole,
  replaceActivePrimary,
  syncProjectPmDisplay,
  findUserById,
  auditLogFn,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  insertPmAssignment: vi.fn(),
  getActivePrimaryAssignment: vi.fn(),
  hasOverlappingPmAssignment: vi.fn(),
  hasActivePmAssignmentForUserRole: vi.fn(),
  replaceActivePrimary: vi.fn(),
  syncProjectPmDisplay: vi.fn(),
  findUserById: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/modules/projects/backend/repositories/pm-assignments.repo', () => ({
  hasActivePmAssignment,
  listPmAssignments: vi.fn().mockResolvedValue([]),
  insertPmAssignment,
  getActivePrimaryAssignment,
  hasOverlappingPmAssignment,
  hasActivePmAssignmentForUserRole,
  replaceActivePrimary,
  syncProjectPmDisplay,
  getPmAssignmentById: vi.fn(),
  softEndPmAssignment: vi.fn(),
  endPrimaryWithCollaboratorCascade: vi.fn(),
  softEndActivePrimary: vi.fn(),
}));
vi.mock('@/lib/repositories/users.repo', () => ({ findUserById }));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: auditLogFn }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';
import * as routeModule from './route';

const cpmoSession = {
  id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  company_id: 5,
  company_name: 'Acme',
  is_admin: 0,
  onboarding_completed: 1,
  roles: ['cpmo'],
  status: 'active',
  email: 'cpmo@acme.com',
};

const pmSession = {
  ...cpmoSession,
  id: 2,
  username: 'ava',
  roles: ['pm'],
  email: 'ava@acme.com',
};

const viewerSession = {
  ...cpmoSession,
  id: 3,
  username: 'viewer',
  roles: ['viewer'],
};

describe('/api/projects/[id]/pm-assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    hasActivePmAssignment.mockResolvedValue(true);
    getActivePrimaryAssignment.mockResolvedValue(undefined);
    hasOverlappingPmAssignment.mockResolvedValue(false);
    hasActivePmAssignmentForUserRole.mockResolvedValue(false);
    findUserById.mockResolvedValue({
      id: 3,
      company_id: 5,
      display_name: 'Pat',
      email: 'pat@acme.com',
    });
    insertPmAssignment.mockResolvedValue({
      id: 10,
      project_id: 7,
      user_id: 3,
      role: 'primary',
      effective_from: '2026-08-26',
      effective_to: null,
    });
    replaceActivePrimary.mockResolvedValue({
      id: 10,
      project_id: 7,
      user_id: 3,
      role: 'primary',
      effective_from: '2026-08-26',
      effective_to: null,
    });
    auditLogFn.mockResolvedValue(undefined);
  });

  const params = { params: Promise.resolve({ id: '7' }) };

  function req(method: string, body?: unknown) {
    return new NextRequest('http://localhost/api/projects/7/pm-assignments', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  it('GET returns 401 without session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    expect((await GET(req('GET'), params)).status).toBe(401);
  });

  it('POST as viewer returns 403 (D-15, D-20)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await POST(req('POST', { user_id: 3, role: 'primary' }), params);
    expect(res.status).toBe(403);
    expect(insertPmAssignment).not.toHaveBeenCalled();
  });

  it('POST as PM returns 403 (D-15, D-20)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await POST(req('POST', { user_id: 3, role: 'primary' }), params);
    expect(res.status).toBe(403);
    expect(insertPmAssignment).not.toHaveBeenCalled();
  });

  it('POST as CPMO returns 201 (D-15, D-20)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    const res = await POST(req('POST', { user_id: 3, role: 'primary' }), params);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ id: 10, role: 'primary' });
    expect(replaceActivePrimary).toHaveBeenCalled();
  });

  it('does not export DELETE (D-11)', () => {
    expect(routeModule.DELETE).toBeUndefined();
  });
});
