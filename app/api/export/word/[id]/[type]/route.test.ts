import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, getProject, getDocumentForExport } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  getProject: vi.fn(),
  getDocumentForExport: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({ projectAccessRow, getProject }));
vi.mock('@/modules/projects/backend/repositories/documents.repo', () => ({ getDocumentForExport }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

describe('GET /api/export/word/[id]/[type]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = (id = '7', type = 'project_charter') => ({
    params: Promise.resolve({ id, type }),
  });
  const req = (url = 'http://localhost/api/export/word/7/project_charter') =>
    new NextRequest(url);

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

  function mockDoc() {
    getProject.mockResolvedValue({
      name: 'Alpha',
      client: 'Acme',
      pm_name: 'Ava',
      start_date: '2025-01-01',
      end_date: '2025-06-01',
    });
    getDocumentForExport.mockResolvedValue({
      content_json: JSON.stringify({ objectives: 'Ship' }),
      title: 'Charter',
    });
  }

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await GET(req(), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(projectAccessRow).not.toHaveBeenCalled();
    expect(getProject).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await GET(req(), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(getProject).not.toHaveBeenCalled();
  });

  it('returns 200 with original headers for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    mockDoc();

    const res = await GET(req(), params());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="project_charter-7.docx"',
    );
  });
});
