import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  listProjectDocumentChecklist,
  getChecklistItem,
  patchChecklistItem,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  listProjectDocumentChecklist: vi.fn(),
  getChecklistItem: vi.fn(),
  patchChecklistItem: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/lib/services/project-document-checklist.service', () => ({
  listProjectDocumentChecklist,
  getChecklistItem,
  patchChecklistItem,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET as listGET, POST as listPOST } from '../route';
import { GET, PATCH } from './route';

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
    catalog_name: 'Charter',
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
    expect(getChecklistItem).not.toHaveBeenCalled();
  });

  it('Viewer GET returns 200 (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    getChecklistItem.mockResolvedValue(item);
    const res = await GET(jsonReq('GET'), params());
    expect(res.status).toBe(200);
    expect(getChecklistItem).toHaveBeenCalled();
  });

  it('Viewer PATCH returns 403 (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    const res = await PATCH(jsonReq('PATCH', { status: 'drafting' }), params());
    expect(res.status).toBe(403);
    expect(patchChecklistItem).not.toHaveBeenCalled();
  });

  it('PM PATCH returns 200 (D-06)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    patchChecklistItem.mockResolvedValue({ ...item, status: 'drafting' });
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
    expect(patchChecklistItem).not.toHaveBeenCalled();
  });
});

describe('GET /api/projects/[id]/document-checklist collection (D-04)', () => {
  it('exports GET and does not export POST', () => {
    expect(typeof listGET).toBe('function');
    expect(listPOST).toBeUndefined();
  });
});
