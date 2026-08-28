import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  getProject,
  listTeam,
  listMeetings,
  listRisks,
  listActivities,
  getDocumentForExport,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  getProject: vi.fn(),
  listTeam: vi.fn(),
  listMeetings: vi.fn(),
  listRisks: vi.fn(),
  listActivities: vi.fn(),
  getDocumentForExport: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({ projectAccessRow, getProject }));
vi.mock('@/modules/projects/backend/repositories/team.repo', () => ({ listTeam }));
vi.mock('@/modules/projects/backend/repositories/meetings.repo', () => ({ listMeetings }));
vi.mock('@/modules/projects/backend/repositories/risks.repo', () => ({ listRisks }));
vi.mock('@/modules/projects/backend/repositories/activities.repo', () => ({ listActivities }));
vi.mock('@/modules/projects/backend/repositories/documents.repo', () => ({ getDocumentForExport }));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

describe('POST /api/export/ppt/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });
  function req(body: unknown = {}) {
    return new NextRequest('http://localhost/api/export/ppt/7', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
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

  function mockKickoff() {
    getProject.mockResolvedValue({
      name: 'Alpha',
      client: 'Acme',
      pm_name: 'Ava',
      start_date: '2025-01-01',
      end_date: '2025-06-01',
      current_phase: 'Initializing',
    });
    listTeam.mockResolvedValue([]);
    listMeetings.mockResolvedValue([]);
    listRisks.mockResolvedValue([]);
    listActivities.mockResolvedValue([]);
    getDocumentForExport.mockResolvedValue(undefined);
  }

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(req(), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(projectAccessRow).not.toHaveBeenCalled();
    expect(getProject).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await POST(req(), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(getProject).not.toHaveBeenCalled();
  });

  it('returns 200 with original headers for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    mockKickoff();

    const res = await POST(req(), params());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="kickoff-presentation.pptx"',
    );
  });
});
