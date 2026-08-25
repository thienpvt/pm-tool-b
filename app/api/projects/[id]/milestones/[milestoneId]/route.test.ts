import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, hasActivePmAssignment, updateMilestoneRepo } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  updateMilestoneRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/lib/repositories/milestones.repo', () => ({
  listMilestones: vi.fn(),
  createMilestone: vi.fn(),
  updateMilestone: updateMilestoneRepo,
  deleteMilestone: vi.fn(),
  listEpics: vi.fn(),
  linkEpic: vi.fn(),
  unlinkEpic: vi.fn(),
}));

import { getSessionFromRequest } from '@/lib/auth';
import { PUT } from './route';

const owner = {
  id: 2, username: 'ava', display_name: 'Ava', company_id: 5, company_name: 'Acme',
  is_admin: 0, onboarding_completed: 1,
  roles: ['pm'], status: 'active', email: 'ava@example.com',
};
const foreign = { ...owner, company_id: 9 };

describe('PUT /api/projects/[id]/milestones/[milestoneId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActivePmAssignment.mockResolvedValue(true);
  });
  const params = { params: Promise.resolve({ id: '7', milestoneId: '3' }) };
  const req = () =>
    new NextRequest('http://localhost/api/projects/7/milestones/3', {
      method: 'PUT',
      body: JSON.stringify({ name: 'M' }),
      headers: { 'Content-Type': 'application/json' },
    });

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    expect((await PUT(req(), params)).status).toBe(401);
  });

  it('returns 403 for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreign as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    expect((await PUT(req(), params)).status).toBe(403);
    expect(updateMilestoneRepo).not.toHaveBeenCalled();
  });

  it('returns updated row for owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(owner as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    updateMilestoneRepo.mockResolvedValue({ id: 3, name: 'M' });
    const res = await PUT(req(), params);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: 3, name: 'M' });
  });
});
