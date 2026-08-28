import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, roadmapEpicRows } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  roadmapEpicRows: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/modules/portfolio/backend/repositories/portfolio.repo', () => ({ roadmapEpicRows }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

/**
 * Route-level proof of the T-04-21 live read IDOR fix. Before this fix the route
 * was session-gated but read any `project_id` in the query string with no
 * ownership check. Mocks sit at the repository boundary so the real
 * assertProjectAccess logic runs under test.
 */
describe('GET /api/portfolio/roadmap/epics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function req(projectId?: string) {
    const url = projectId
      ? `http://localhost/api/portfolio/roadmap/epics?project_id=${projectId}`
      : 'http://localhost/api/portfolio/roadmap/epics';
    return new NextRequest(url);
  }

  const ownerSession = {
    id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
    is_admin: 0, onboarding_completed: 1,
  };
  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  it('returns 401 without a session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);

    const res = await GET(req('7'));

    expect(res.status).toBe(401);
    expect(projectAccessRow).not.toHaveBeenCalled();
    expect(roadmapEpicRows).not.toHaveBeenCalled();
  });

  it('returns 400 when project_id is absent', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);

    const res = await GET(req());

    expect(res.status).toBe(400);
    expect(roadmapEpicRows).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company project_id without calling the repo (IDOR fix)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await GET(req('7'));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(roadmapEpicRows).not.toHaveBeenCalled();
  });

  it('returns the weighted epic tree for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    roadmapEpicRows.mockResolvedValue([
      { id: 1, parent_id: null, phase: 'Build', no: 'EPIC', activity: 'Epic One', status: 'In Progress' },
      { id: 2, parent_id: 1, phase: 'Build', no: '1.1', activity: 'Child A', status: 'Done' },
      { id: 3, parent_id: 1, phase: 'Build', no: '1.2', activity: 'Child B', status: 'Not Started' },
    ]);

    const res = await GET(req('7'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.epics).toHaveLength(1);
    expect(body.epics[0]).toMatchObject({ id: 1, child_count: 2 });
    expect(body.epics[0].children).toHaveLength(2);
    expect(roadmapEpicRows).toHaveBeenCalledWith('7');
  });
});
