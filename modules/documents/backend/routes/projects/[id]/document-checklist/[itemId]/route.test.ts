import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  getChecklistItemRepo,
  updateChecklistItemRepo,
  listChecklistByProject,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  getChecklistItemRepo: vi.fn(),
  updateChecklistItemRepo: vi.fn(),
  listChecklistByProject: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/modules/documents/backend/repositories/project-document-checklist.repo', () => ({
  getChecklistItem: getChecklistItemRepo,
  updateChecklistItem: updateChecklistItemRepo,
  listChecklistByProject,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET as listGET, POST as listPOST } from '@/app/api/projects/[id]/document-checklist/route';
import { GET, PATCH } from '@/app/api/projects/[id]/document-checklist/[itemId]/route';

describe('GET/PATCH /api/projects/[id]/document-checklist/[itemId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActivePmAssignment.mockResolvedValue(true);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
  });

  const params = (id = '7', itemId = '100') => ({
    params: Promise.resolve({ id, itemId }),
  });

  const item = {
    id: 100,
    project_id: 7,
    catalog_id: 1,
    status: 'none',
    confluence_url: null,
    approved_at: null,
    approved_by: null,
    na_reason: null,
    notes: null,
    created_at: '',
    updated_at: '',
    catalog_name: 'Charter',
    catalog_stage: 'L2',
    catalog_mandatory: true,
    catalog_active: true,
  };

  const pmSession = {
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

  const viewerSession = {
    ...pmSession,
    id: 3,
    roles: ['viewer'],
  };

  function jsonReq(method: string, body?: unknown) {
    return new NextRequest('http://localhost/api/projects/7/document-checklist/100', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

  function formReq() {
    const fd = new FormData();
    fd.set('status', 'drafting');
    return new NextRequest('http://localhost/api/projects/7/document-checklist/100', {
      method: 'PATCH',
      body: fd,
    });
  }

  it('returns 401 without session (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(jsonReq('GET'), params());
    expect(res.status).toBe(401);
    expect(getChecklistItemRepo).not.toHaveBeenCalled();
  });

  it('Viewer GET returns 200 (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    getChecklistItemRepo.mockResolvedValue(item);
    const res = await GET(jsonReq('GET'), params());
    expect(res.status).toBe(200);
    expect(getChecklistItemRepo).toHaveBeenCalled();
  });

  it('Viewer PATCH returns 403 (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    getChecklistItemRepo.mockResolvedValue(item);
    const res = await PATCH(jsonReq('PATCH', { status: 'drafting' }), params());
    expect(res.status).toBe(403);
    expect(updateChecklistItemRepo).not.toHaveBeenCalled();
  });

  it('PM PATCH returns 200 (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    getChecklistItemRepo.mockResolvedValue(item);
    updateChecklistItemRepo.mockResolvedValue({ ...item, status: 'drafting' });
    const res = await PATCH(jsonReq('PATCH', { status: 'drafting' }), params());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('drafting');
    expect(hasActivePmAssignment).toHaveBeenCalled();
  });

  it('FormData PATCH returns 400 Invalid JSON (D-07)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    const res = await PATCH(formReq(), params());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid JSON');
    expect(updateChecklistItemRepo).not.toHaveBeenCalled();
  });
});

describe('GET /api/projects/[id]/document-checklist collection (D-04)', () => {
  it('exports GET and does not export POST', () => {
    expect(typeof listGET).toBe('function');
    expect(listPOST).toBeUndefined();
  });
});
