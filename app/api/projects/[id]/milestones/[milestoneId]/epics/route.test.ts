import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, listEpicsRepo } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  listEpicsRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/milestones.repo', () => ({
  listMilestones: vi.fn(),
  createMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  deleteMilestone: vi.fn(),
  listEpics: listEpicsRepo,
  linkEpic: vi.fn(),
  unlinkEpic: vi.fn(),
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from './route';

const owner = {
  id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
  is_admin: 0, onboarding_completed: 1,
};
const foreign = { ...owner, company_id: 9 };

describe('GET /api/projects/[id]/milestones/[milestoneId]/epics', () => {
  beforeEach(() => vi.clearAllMocks());
  const params = { params: Promise.resolve({ id: '7', milestoneId: '3' }) };
  const req = () => new NextRequest('http://localhost/api/projects/7/milestones/3/epics');

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    expect((await GET(req(), params)).status).toBe(401);
  });

  it('returns 403 for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreign as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    expect((await GET(req(), params)).status).toBe(403);
    expect(listEpicsRepo).not.toHaveBeenCalled();
  });

  it('returns 200 list for owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(owner as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    listEpicsRepo.mockResolvedValue([{ id: 10 }]);
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: 10 }]);
  });
});
